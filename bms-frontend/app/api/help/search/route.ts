import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/help/search
 * Search help articles
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    // Simple help article search (can be enhanced with full-text search)
    const helpArticles = [
      {
        id: 'getting-started',
        title: 'Getting Started',
        description: 'Learn the basics of using BMS',
        link: '/help#getting-started',
      },
      {
        id: 'billing',
        title: 'Billing & Payments',
        description: 'Manage invoices and payment processing',
        link: '/help#features',
      },
      {
        id: 'maintenance',
        title: 'Maintenance Management',
        description: 'Track work orders and maintenance requests',
        link: '/help#features',
      },
      {
        id: 'complaints',
        title: 'Complaints & Requests',
        description: 'Handle tenant complaints and service requests',
        link: '/help#features',
      },
      {
        id: 'messages',
        title: 'Messaging',
        description: 'Communicate with building managers',
        link: '/help#features',
      },
    ];

    const searchTerm = query.toLowerCase();
    const results = helpArticles.filter(
      (article) =>
        article.title.toLowerCase().includes(searchTerm) ||
        article.description.toLowerCase().includes(searchTerm),
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Help search error:', error);
    return NextResponse.json({ error: 'Failed to search help' }, { status: 500 });
  }
}

