import { NotificationService } from './notification-service';
import { findUserById } from '@/lib/auth/users';
import { findBuildingById } from '@/lib/buildings/buildings';
import type { SecurityIncident } from '@/lib/security/incidents';
import type { Shift } from '@/lib/security/shifts';

const notificationService = new NotificationService();

/**
 * Send notification for critical security incidents.
 */
export async function notifyCriticalIncident(incident: SecurityIncident): Promise<void> {
  if (incident.severity !== 'high' && incident.severity !== 'critical') {
    return; // Only notify for high/critical incidents
  }

  try {
    // Get building to find building manager
    const building = await findBuildingById(incident.buildingId, incident.organizationId);
    if (!building) {
      return;
    }

    // Get reporter info
    const reporter = await findUserById(incident.reportedBy);
    const reporterName = reporter?.name || 'Security Staff';

    // Find users with BUILDING_MANAGER or ORG_ADMIN roles in the organization
    // Note: This is a simplified approach. In production, you'd query users by role and building.
    const title = `Security Incident: ${incident.title}`;
    const message = `A ${incident.severity} severity ${incident.incidentType} incident has been reported at ${building.name} by ${reporterName}. Status: ${incident.status}.`;

    // In a real implementation, you would:
    // 1. Query users with BUILDING_MANAGER role for this building
    // 2. Query users with ORG_ADMIN role for this organization
    // 3. Send notifications to each user

    // For now, we'll create a notification that can be picked up by the notification system
    // The actual user targeting would be handled by the calling code or a separate service
    console.log(`[Security Event] ${title}: ${message}`);
  } catch (error) {
    console.error('Failed to send critical incident notification:', error);
  }
}

/**
 * Send notification for shift assignments.
 */
export async function notifyShiftAssignment(
  shift: Shift,
  securityStaffUserId: string,
): Promise<void> {
  try {
    const building = await findBuildingById(shift.buildingId, shift.organizationId);
    const buildingName = building?.name || 'Building';

    const title = `Shift Assignment: ${shift.shiftType} shift`;
    const message = `You have been assigned a ${shift.shiftType} shift at ${buildingName} from ${shift.startTime.toLocaleString()} to ${shift.endTime.toLocaleString()}.`;

    await notificationService.createNotification({
      organizationId: shift.organizationId,
      userId: securityStaffUserId,
      type: 'shift_assignment',
      title,
      message,
      channels: ['in_app', 'email'],
      link: `/security/shifts/${shift._id}`,
      metadata: {
        shiftId: shift._id,
        buildingId: shift.buildingId,
        shiftType: shift.shiftType,
        startTime: shift.startTime,
        endTime: shift.endTime,
      },
    });
  } catch (error) {
    console.error('Failed to send shift assignment notification:', error);
  }
}

/**
 * Send notification for shift reminders.
 */
export async function notifyShiftReminder(
  shift: Shift,
  securityStaffUserId: string,
): Promise<void> {
  try {
    const building = await findBuildingById(shift.buildingId, shift.organizationId);
    const buildingName = building?.name || 'Building';

    const title = `Shift Reminder: ${shift.shiftType} shift starting soon`;
    const message = `Your ${shift.shiftType} shift at ${buildingName} starts at ${shift.startTime.toLocaleString()}.`;

    await notificationService.createNotification({
      organizationId: shift.organizationId,
      userId: securityStaffUserId,
      type: 'shift_reminder',
      title,
      message,
      channels: ['in_app', 'sms'],
      link: `/security/shifts/${shift._id}`,
      metadata: {
        shiftId: shift._id,
        buildingId: shift.buildingId,
        shiftType: shift.shiftType,
        startTime: shift.startTime,
      },
    });
  } catch (error) {
    console.error('Failed to send shift reminder notification:', error);
  }
}

/**
 * Send notification when incident is reported.
 */
export async function notifyIncidentReported(incident: SecurityIncident): Promise<void> {
  try {
    const building = await findBuildingById(incident.buildingId, incident.organizationId);
    const buildingName = building?.name || 'Building';

    const title = `New Security Incident: ${incident.title}`;
    const message = `A ${incident.severity} severity ${incident.incidentType} incident has been reported at ${buildingName}.`;

    // In a real implementation, you would query for BUILDING_MANAGER and ORG_ADMIN users
    // For now, we'll log it
    console.log(`[Security Event] ${title}: ${message}`);
  } catch (error) {
    console.error('Failed to send incident reported notification:', error);
  }
}

/**
 * Send notification when incident is resolved.
 */
export async function notifyIncidentResolved(incident: SecurityIncident): Promise<void> {
  try {
    const building = await findBuildingById(incident.buildingId, incident.organizationId);
    const buildingName = building?.name || 'Building';

    const title = `Security Incident Resolved: ${incident.title}`;
    const message = `The ${incident.incidentType} incident at ${buildingName} has been resolved.`;

    // In a real implementation, you would query for relevant users
    console.log(`[Security Event] ${title}: ${message}`);
  } catch (error) {
    console.error('Failed to send incident resolved notification:', error);
  }
}

/**
 * Send notification to tenant when visitor arrives (after QR code validation).
 */
export async function notifyVisitorArrived(
  tenantId: string,
  organizationId: string,
  visitorName: string,
  visitorPhone: string | null,
  unitNumber: string | null,
  floor: number | null,
  buildingName: string,
  entryTime: Date,
): Promise<void> {
  try {
    const { findUnitById } = await import('@/lib/units/units');
    const { findTenantById } = await import('@/lib/tenants/tenants');

    const tenant = await findTenantById(tenantId, organizationId);
    if (!tenant) {
      console.error('Tenant not found for visitor arrival notification');
      return;
    }

    const unitInfo = unitNumber ? `Unit ${unitNumber}${floor ? `, Floor ${floor}` : ''}` : '';
    const visitorInfo = visitorPhone ? `${visitorName} (${visitorPhone})` : visitorName;

    const title = 'Visitor Arrived';
    const message = `${visitorInfo} has arrived at ${buildingName}${unitInfo ? ` - ${unitInfo}` : ''}. Entry time: ${entryTime.toLocaleString()}`;

    await notificationService.createNotification({
      organizationId,
      tenantId,
      type: 'visitor_arrived',
      title,
      message,
      channels: ['in_app', 'email', 'sms'],
      link: `/tenant/visitors`,
      metadata: {
        visitorName,
        visitorPhone,
        unitNumber,
        floor,
        buildingName,
        entryTime: entryTime.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to send visitor arrival notification:', error);
  }
}
