import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { findCommand } from '@/lib/bot/commands';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bot/commands
 * Execute a bot command
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { command, args } = body;

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const botCommand = findCommand(command);
    if (!botCommand) {
      return NextResponse.json({
        type: 'error',
        content: 'Unknown command. Type /help for available commands.',
      });
    }

    const botContext = {
      userId: context.userId,
      organizationId: context.organizationId || '',
      roles: context.roles,
      tenantId: context.tenantId || '',
    };

    const response = await botCommand.handler(args || [], botContext);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Bot command error:', error);
    return NextResponse.json(
      {
        type: 'error',
        content: error.message || 'Failed to execute command',
      },
      { status: 500 },
    );
  }
}
