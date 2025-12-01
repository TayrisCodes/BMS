import { NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { PaymentIntentService } from '@/modules/payments/payment-intent-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a tenant
    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    // Validate organization context
    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant
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
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const { id } = await routeParams.params;

    // Get payment intent
    const intent = await PaymentIntentService.getPaymentIntentStatus(id, organizationId);

    if (!intent) {
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 });
    }

    // Verify tenant owns the payment intent
    if (intent.tenantId !== tenant._id.toString()) {
      return NextResponse.json(
        { error: 'Access denied: Payment intent does not belong to you' },
        { status: 403 },
      );
    }

    if (intent.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Payment intent does not belong to your organization' },
        { status: 403 },
      );
    }

    return NextResponse.json({
      intent: {
        id: intent._id,
        invoiceId: intent.invoiceId,
        amount: intent.amount,
        currency: intent.currency,
        provider: intent.provider,
        status: intent.status,
        redirectUrl: intent.redirectUrl,
        paymentInstructions: intent.paymentInstructions,
        referenceNumber: intent.referenceNumber,
        expiresAt: intent.expiresAt.toISOString(),
        createdAt: intent.createdAt.toISOString(),
        updatedAt: intent.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get payment intent error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json({ error: 'Failed to fetch payment intent' }, { status: 500 });
  }
}
