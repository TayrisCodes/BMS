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
  emailTypes: string[]; // Notification types to receive via email
  smsTypes: string[]; // Notification types to receive via SMS
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
  invitedBy?: string | null; // ObjectId ref to users
  invitedAt?: Date | null;
  activatedAt?: Date | null;
  lastLoginAt?: Date | null;
  passwordChangedAt?: Date | null;
  invitationToken?: string | null;
  invitationTokenExpiresAt?: Date | null;
  resetPasswordToken?: string | null;
  resetPasswordTokenExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
