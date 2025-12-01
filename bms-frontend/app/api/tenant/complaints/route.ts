import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findComplaintsByTenant } from '@/lib/complaints/complaints';
import type { ComplaintStatus } from '@/lib/complaints/complaints';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    // Validate organization context
    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please contact your building manager.' },
        { status: 404 },
      );
    }

    // Validate tenant belongs to organization
    if (tenant.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Tenant does not belong to your organization' },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status') as ComplaintStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get complaints for this tenant
    const complaints = await findComplaintsByTenant(tenant._id.toString(), organizationId);

    // Filter by status if provided
    let filteredComplaints = complaints;
    if (statusFilter) {
      filteredComplaints = complaints.filter((c) => c.status === statusFilter);
    }

    // Apply limit
    filteredComplaints = filteredComplaints.slice(0, limit);

    const formattedComplaints = filteredComplaints.map((complaint) => ({
      id: complaint._id.toString(),
      title: complaint.title,
      category: complaint.category,
      description: complaint.description,
      status: complaint.status,
      priority: complaint.priority,
      photos: complaint.photos || [],
      assignedTo: complaint.assignedTo,
      resolvedAt: complaint.resolvedAt,
      resolutionNotes: complaint.resolutionNotes,
      createdAt: complaint.createdAt.toISOString(),
      updatedAt: complaint.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      complaints: formattedComplaints,
      count: formattedComplaints.length,
      total: complaints.length,
    });
  } catch (error) {
    console.error('Tenant complaints error:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Access denied') || error.message.includes('does not belong')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch complaints' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    // Validate organization context
    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please contact your building manager.' },
        { status: 404 },
      );
    }

    // Validate tenant belongs to organization
    if (tenant.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Tenant does not belong to your organization' },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.category || !body.description) {
      return NextResponse.json(
        { error: 'Title, category, and description are required' },
        { status: 400 },
      );
    }

    // Validate category
    const validCategories = ['maintenance', 'noise', 'security', 'cleanliness', 'other'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 },
      );
    }

    // Import and use the proper createComplaint function
    const { createComplaint } = await import('@/lib/complaints/complaints');

    // Create complaint with proper validation
    const complaint = await createComplaint({
      organizationId,
      tenantId: tenant._id.toString(),
      unitId: body.unitId || null,
      category: body.category,
      title: body.title,
      description: body.description,
      photos: body.photos || null, // Array of photo URLs
      priority: body.priority || 'medium',
      status: 'open',
    });

    return NextResponse.json(
      {
        id: complaint._id,
        title: complaint.title,
        category: complaint.category,
        description: complaint.description,
        status: complaint.status,
        priority: complaint.priority,
        photos: complaint.photos || [],
        createdAt: complaint.createdAt.toISOString(),
        updatedAt: complaint.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create complaint error:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('does not belong') || error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json(
      { error: 'Failed to create complaint. Please try again later.' },
      { status: 500 },
    );
  }
}
