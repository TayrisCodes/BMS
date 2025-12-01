import { getUserActivityLogsCollection } from '@/lib/users/user-activity-logs';
import type { UserActivityLog, UserActivityAction } from '@/lib/users/user-activity-logs';
import type { Document } from 'mongodb';
import { NextRequest } from 'next/server';

export interface LogActivityInput {
  userId: string;
  organizationId?: string | null;
  action: UserActivityAction;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  request?: NextRequest; // Optional request object to extract IP and user agent
}

/**
 * Extract IP address from request headers.
 * Handles various proxy headers (X-Forwarded-For, X-Real-IP, etc.)
 */
function extractIpAddress(request?: NextRequest): string | null {
  if (!request) return null;

  // Try various headers in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Fallback to connection remote address (if available)
  // Note: In Next.js, this might not be directly available
  return null;
}

/**
 * Extract user agent from request headers.
 */
function extractUserAgent(request?: NextRequest): string | null {
  if (!request) return null;
  return request.headers.get('user-agent') || null;
}

/**
 * Log user activity to the database.
 * Automatically extracts IP address and user agent from request if provided.
 */
export async function logActivity(input: LogActivityInput): Promise<UserActivityLog | null> {
  try {
    const collection = await getUserActivityLogsCollection();

    // Extract IP and user agent from request if not explicitly provided
    const ipAddress = input.ipAddress ?? extractIpAddress(input.request);
    const userAgent = input.userAgent ?? extractUserAgent(input.request);

    const logEntry: Omit<UserActivityLog, '_id'> = {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      action: input.action,
      details: input.details ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(logEntry);

    if (!result.insertedId) {
      return null;
    }

    return collection.findOne({ _id: result.insertedId } as Document);
  } catch (error) {
    console.error('Failed to log user activity:', error);
    // Don't throw - logging failures shouldn't break the application
    return null;
  }
}

/**
 * Log activity with automatic error handling.
 * This is a convenience wrapper that catches errors silently.
 */
export async function logActivitySafe(input: LogActivityInput): Promise<void> {
  try {
    await logActivity(input);
  } catch (error) {
    // Silently fail - activity logging should not break the application
    console.error('Activity logging failed:', error);
  }
}
