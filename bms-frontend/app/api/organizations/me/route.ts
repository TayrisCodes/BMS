import { NextResponse } from 'next/server';
import { resolveOrganizationFromSession } from '@/lib/organizations/resolver';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await resolveOrganizationFromSession(true);

    if (!context) {
      return NextResponse.json(
        { error: 'Not authenticated or no organization in session' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      organizationId: context.organizationId,
      organization: context.organization,
    });
  } catch (error) {
    console.error('Get organization error', error);
    return NextResponse.json(
      { error: 'Unexpected error while fetching organization' },
      { status: 500 },
    );
  }
}
