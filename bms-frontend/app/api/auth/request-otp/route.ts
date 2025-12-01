import { NextResponse } from 'next/server';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { createOtpCode, ensureOtpIndexes } from '@/lib/auth/otp';
import { sendOtpViaTelegram } from '@/lib/telegram/telegram';

interface RequestOtpRequestBody {
  phone?: string;
  isSignup?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestOtpRequestBody;
    const phone = body.phone?.trim() ?? '';
    const isSignup = body.isSignup ?? false;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // For sign-up, don't require existing tenant
    if (!isSignup) {
      // For login, validate phone belongs to a tenant
      const tenant = await findTenantByPhone(phone);
      if (!tenant) {
        // Don't reveal if phone exists or not for security
        return NextResponse.json(
          { message: 'If this phone number is registered, an OTP code will be sent.' },
          { status: 200 },
        );
      }

      if (tenant.status !== 'active') {
        return NextResponse.json({ error: 'Tenant account is not active' }, { status: 403 });
      }
    }

    await ensureOtpIndexes();
    const otp = await createOtpCode(phone);

    // Send OTP via Telegram
    const sent = await sendOtpViaTelegram(phone, otp.code);

    if (!sent && process.env.NODE_ENV === 'production') {
      // In production, fail if Telegram fails
      return NextResponse.json(
        { error: 'Failed to send OTP. Please try again later.' },
        { status: 500 },
      );
    }

    // In dev, always return success (OTP is logged to console)
    return NextResponse.json(
      {
        message: 'OTP code sent successfully',
        // In dev, include the code for testing
        ...(process.env.NODE_ENV !== 'production' ? { code: otp.code } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Request OTP error', error);
    return NextResponse.json({ error: 'Unexpected error while requesting OTP' }, { status: 500 });
  }
}
