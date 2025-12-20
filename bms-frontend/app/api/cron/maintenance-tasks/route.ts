import { NextResponse } from 'next/server';
import {
  generateMaintenanceTasks,
  processDueMaintenanceTasks,
} from '@/modules/maintenance/task-generator';
import { listOrganizations } from '@/lib/organizations/organizations';

/**
 * POST /api/cron/maintenance-tasks
 * Cron job endpoint for automatic maintenance task generation and work order creation.
 * This should be called daily (e.g., via a cron service or scheduled job).
 *
 * Security: This endpoint should be protected by a secret token or IP whitelist
 * in production. For now, we'll add basic validation.
 */
export async function POST(request: Request) {
  try {
    // Basic security check - in production, use a secret token
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'change-me-in-production';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all organizations
    const organizations = await listOrganizations();

    const results = {
      organizationsProcessed: 0,
      tasksGenerated: { created: 0, updated: 0, errors: 0 },
      workOrdersCreated: 0,
      errors: [] as string[],
    };

    // Process each organization
    for (const org of organizations) {
      try {
        // Generate maintenance tasks for assets with schedules
        const taskResults = await generateMaintenanceTasks(org._id);
        results.tasksGenerated.created += taskResults.created;
        results.tasksGenerated.updated += taskResults.updated;
        results.tasksGenerated.errors += taskResults.errors;

        // Process due tasks and create work orders
        const processResults = await processDueMaintenanceTasks(org._id);
        results.workOrdersCreated += processResults.workOrdersCreated;

        results.organizationsProcessed++;
      } catch (error) {
        const errorMsg = `Error processing organization ${org._id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    return NextResponse.json({
      message: 'Maintenance task cron job completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Maintenance task cron job error:', error);
    return NextResponse.json(
      {
        error: 'Unexpected error in maintenance task cron job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/cron/maintenance-tasks
 * Health check endpoint for the cron job.
 */
export async function GET() {
  return NextResponse.json({
    message: 'Maintenance task cron job endpoint is active',
    timestamp: new Date().toISOString(),
  });
}

