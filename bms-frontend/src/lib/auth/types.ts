export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'BUILDING_MANAGER'
  | 'FACILITY_MANAGER'
  | 'ACCOUNTANT'
  | 'SECURITY'
  | 'TECHNICIAN'
  | 'TENANT'
  | 'AUDITOR';

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  pushEnabled?: boolean; // Push notifications for PWA
  emailTypes: string[]; // Notification types to receive via email
  smsTypes: string[]; // Notification types to receive via SMS
  pushTypes?: string[]; // Notification types to receive via push
  quietHoursEnabled?: boolean;
  quietHoursStart?: string; // e.g., "22:00"
  quietHoursEnd?: string; // e.g., "08:00"
  doNotDisturbEnabled?: boolean;
  doNotDisturbUntil?: Date | null;
  preferredLanguage?: string; // e.g., "en", "am", "om", "ti"
}

export interface User {
  _id: string;
  organizationId: string;
  phone: string;
  email?: string | null;
  passwordHash: string;
  roles: UserRole[];
  status: UserStatus;
  tenantId?: string | null; // ObjectId ref to tenants (for users with TENANT role)
  notificationPreferences?: NotificationPreferences | null;
  name?: string | null;
  skills?: string[]; // Optional skills for technicians/guards
  availabilityNote?: string | null; // Optional availability/shift note
  shiftStatus?: string | null; // Optional status for security/technicians (e.g., on_shift, off_shift)
  invitedBy?: string | null; // ObjectId ref to users
  invitedAt?: Date | null;
  activatedAt?: Date | null;
  lastLoginAt?: Date | null;
  passwordChangedAt?: Date | null;
  invitationToken?: string | null;
  invitationTokenExpiresAt?: Date | null;
  resetPasswordToken?: string | null;
  resetPasswordTokenExpiresAt?: Date | null;
  pushSubscription?: any | null; // Web Push subscription object
  createdAt: Date;
  updatedAt: Date;
}
