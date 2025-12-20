import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked: string;
  message?: string;
}

async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const responseTime = Date.now() - startTime;

    return {
      name: 'MongoDB Database',
      status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'down',
      responseTime,
      lastChecked: new Date().toISOString(),
      message: responseTime < 1000 ? 'Database responding normally' : 'Database response slow',
    };
  } catch (error) {
    return {
      name: 'MongoDB Database',
      status: 'down',
      lastChecked: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkPaymentProviders(): Promise<ServiceHealth[]> {
  // Check payment provider configurations (not actual API calls to avoid rate limits)
  const providers = ['Telebirr', 'CBE Birr', 'Chapa', 'HelloCash'];
  const services: ServiceHealth[] = [];

  for (const provider of providers) {
    // Check if provider is configured (check environment variables)
    const envKey = provider.toUpperCase().replace(/\s+/g, '_');
    const isConfigured =
      process.env[`${envKey}_API_KEY`] || process.env[`${envKey}_SECRET`] || false;

    services.push({
      name: `${provider} Payment Provider`,
      status: isConfigured ? 'healthy' : 'degraded',
      lastChecked: new Date().toISOString(),
      message: isConfigured
        ? 'Provider configured'
        : 'Provider not configured (check environment variables)',
    });
  }

  return services;
}

async function checkEmailService(): Promise<ServiceHealth> {
  // Check email service configuration
  const isConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD;

  return {
    name: 'Email Service (SMTP)',
    status: isConfigured ? 'healthy' : 'degraded',
    lastChecked: new Date().toISOString(),
    message: isConfigured
      ? 'Email service configured'
      : 'Email service not configured (check SMTP settings)',
  };
}

async function checkWhatsAppService(): Promise<ServiceHealth> {
  // Check WhatsApp/Telegram service configuration
  const isConfigured = process.env.TELEGRAM_BOT_TOKEN || process.env.WHATSAPP_API_KEY;

  return {
    name: 'WhatsApp/Telegram Service',
    status: isConfigured ? 'healthy' : 'degraded',
    lastChecked: new Date().toISOString(),
    message: isConfigured ? 'Messaging service configured' : 'Messaging service not configured',
  };
}

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can access monitoring
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check all services in parallel
    const [database, email, whatsapp, ...paymentProviders] = await Promise.all([
      checkDatabaseHealth(),
      checkEmailService(),
      checkWhatsAppService(),
      ...(await checkPaymentProviders()),
    ]);

    const services: ServiceHealth[] = [database, email, whatsapp, ...paymentProviders];

    // Determine overall system health
    const hasDown = services.some((s) => s.status === 'down');
    const hasDegraded = services.some((s) => s.status === 'degraded');

    const systemHealth = {
      status: hasDown
        ? ('down' as const)
        : hasDegraded
          ? ('degraded' as const)
          : ('healthy' as const),
      message: hasDown
        ? 'One or more services are down'
        : hasDegraded
          ? 'Some services are experiencing issues'
          : 'All systems operational',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      health: systemHealth,
      services,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        health: {
          status: 'down',
          message: 'Failed to check system health',
          timestamp: new Date().toISOString(),
        },
        services: [],
      },
      { status: 500 },
    );
  }
}

