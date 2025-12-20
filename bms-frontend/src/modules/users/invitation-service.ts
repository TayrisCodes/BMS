import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  createUser,
  findUserById,
  updateUser,
  findUserByEmailOrPhone,
  findUserByInvitationToken,
} from '@/lib/auth/users';
import type { User, UserRole } from '@/lib/auth/types';
import { EmailProvider } from '@/modules/notifications/providers/email';
import { WhatsAppProvider } from '@/modules/notifications/providers/whatsapp';
import { findOrganizationById } from '@/lib/organizations/organizations';
import type { Document } from 'mongodb';

const INVITATION_TOKEN_LENGTH = 32;
const INVITATION_EXPIRY_DAYS = 7;

export interface CreateInvitationInput {
  organizationId: string;
  email?: string | null;
  phone: string;
  roles: UserRole[];
  invitedBy: string; // User ID of the inviter
  name?: string | null;
  emailFrom?: string; // Custom email sender address
  emailFromName?: string; // Custom email sender name
}

export interface InvitationResult {
  user: User;
  token: string;
  activationUrl: string;
}

/**
 * Generate a secure random token for invitation.
 */
function generateInvitationToken(): string {
  return crypto.randomBytes(INVITATION_TOKEN_LENGTH).toString('hex');
}

/**
 * Calculate invitation token expiration date.
 */
function getInvitationExpiryDate(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + INVITATION_EXPIRY_DAYS);
  return expiry;
}

/**
 * Create an invitation for a new user.
 * Generates secure token, creates user with "invited" status, and sends invitation.
 */
export async function createInvitation(input: CreateInvitationInput): Promise<InvitationResult> {
  // Check if user already exists
  const existingUser = await findUserByEmailOrPhone(input.email || input.phone);

  if (existingUser) {
    throw new Error('User with this email or phone already exists');
  }

  // Generate invitation token
  const token = generateInvitationToken();
  const expiresAt = getInvitationExpiryDate();

  // Create user with "invited" status
  const passwordHash = ''; // No password set yet, will be set on activation
  const user = await createUser({
    organizationId: input.organizationId,
    phone: input.phone,
    email: input.email || null,
    passwordHash,
    roles: input.roles,
    status: 'invited',
  });

  // Update user with invitation details
  await updateUser(
    user._id.toString(),
    {
      name: input.name || null,
      invitedBy: input.invitedBy,
      invitedAt: new Date(),
      invitationToken: token,
      invitationTokenExpiresAt: expiresAt,
    },
    false,
  );

  // Get organization details for email/SMS
  const organization = await findOrganizationById(input.organizationId);
  const inviter = await findUserById(input.invitedBy);

  // Generate activation URL
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const activationUrl = `${baseUrl}/auth/activate/${token}`;

  // Send invitation email/SMS
  await sendInvitationNotification({
    user: {
      ...user,
      name: input.name || null,
      invitedBy: input.invitedBy,
      invitedAt: new Date(),
      invitationToken: token,
      invitationTokenExpiresAt: expiresAt,
    },
    organization,
    inviter,
    activationUrl,
    emailFrom: input.emailFrom,
    emailFromName: input.emailFromName,
  }).catch((error) => {
    console.error('[InvitationService] Failed to send invitation notification:', error);
    // Don't throw - invitation is created, notification can be retried
  });

  return {
    user: {
      ...user,
      name: input.name || null,
      invitedBy: input.invitedBy,
      invitedAt: new Date(),
      invitationToken: token,
      invitationTokenExpiresAt: expiresAt,
    },
    token,
    activationUrl,
  };
}

/**
 * Validate invitation token and return the invited user.
 */
export async function validateInvitationToken(token: string): Promise<User | null> {
  const user = await findUserByInvitationToken(token);

  if (!user) {
    return null;
  }

  // Check if token is expired
  if (user.invitationTokenExpiresAt && user.invitationTokenExpiresAt < new Date()) {
    return null;
  }

  return user;
}

/**
 * Activate user account with password.
 * Verifies token, sets password, and activates account.
 */
export async function activateUser(token: string, password: string): Promise<User> {
  // Validate token
  const user = await validateInvitationToken(token);
  if (!user) {
    throw new Error('Invalid or expired invitation token');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Update user: set password, activate account, clear invitation token
  const updatedUser = await updateUser(
    user._id.toString(),
    {
      passwordHash,
      status: 'active',
      activatedAt: new Date(),
      invitationToken: null,
      invitationTokenExpiresAt: null,
    },
    false,
  );

  if (!updatedUser) {
    throw new Error('Failed to activate user account');
  }

  return updatedUser;
}

/**
 * Send invitation notification via email or SMS.
 */
async function sendInvitationNotification(input: {
  user: User;
  organization: { name: string; code: string } | null;
  inviter: User | null;
  activationUrl: string;
  emailFrom?: string;
  emailFromName?: string;
}): Promise<void> {
  const { user, organization, inviter, activationUrl, emailFrom, emailFromName } = input;

  const orgName = organization?.name || 'the organization';
  const inviterName = inviter?.name || inviter?.email || 'an administrator';

  // Send email if email is provided
  if (user.email) {
    const emailProvider = new EmailProvider();
    const { subject, body, htmlBody } = generateInvitationEmail({
      organizationName: orgName,
      inviterName,
      roles: user.roles,
      activationUrl,
    });

    await emailProvider.sendEmail(user.email, subject, body, htmlBody, emailFrom, emailFromName);
  }

  // Send SMS/WhatsApp if phone is provided
  if (user.phone) {
    const whatsappProvider = new WhatsAppProvider();
    const message = generateInvitationSMS({
      organizationName: orgName,
      activationUrl,
    });

    await whatsappProvider.sendWhatsApp(user.phone, message);
  }
}

/**
 * Generate invitation email template.
 */
function generateInvitationEmail(input: {
  organizationName: string;
  inviterName: string;
  roles: UserRole[];
  activationUrl: string;
}): { subject: string; body: string; htmlBody: string } {
  const { organizationName, inviterName, roles, activationUrl } = input;

  const subject = `You've been invited to join ${organizationName} BMS`;

  const body = `Dear User,

You have been invited to join ${organizationName} on the Building Management System (BMS).

Invited by: ${inviterName}
Assigned roles: ${roles.join(', ')}

To activate your account, please click on the following link and set your password:
${activationUrl}

This invitation link will expire in ${INVITATION_EXPIRY_DAYS} days.

If you did not expect this invitation, please ignore this email.

Best regards,
BMS Team`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to BMS</h1>
        </div>
        <div class="content">
          <p>Dear User,</p>
          <p>You have been invited to join <strong>${organizationName}</strong> on the Building Management System (BMS).</p>
          <p><strong>Invited by:</strong> ${inviterName}</p>
          <p><strong>Assigned roles:</strong> ${roles.join(', ')}</p>
          <p>To activate your account, please click the button below and set your password:</p>
          <p style="text-align: center;">
            <a href="${activationUrl}" class="button">Activate Account</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4F46E5;">${activationUrl}</p>
          <p><em>This invitation link will expire in ${INVITATION_EXPIRY_DAYS} days.</em></p>
          <p>If you did not expect this invitation, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>BMS Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, body, htmlBody };
}

/**
 * Generate invitation SMS template.
 * Supports multiple languages: English, Amharic, Afaan Oromo, Tigrigna.
 */
function generateInvitationSMS(input: {
  organizationName: string;
  activationUrl: string;
  language?: 'en' | 'am' | 'om' | 'ti';
}): string {
  const { organizationName, activationUrl, language = 'en' } = input;

  // For SMS, we'll use a shortened URL or code
  // In production, you might want to use a URL shortener
  const shortUrl =
    activationUrl.length > 50
      ? activationUrl.substring(activationUrl.length - 20) // Last 20 chars as fallback
      : activationUrl;

  const messages: Record<string, string> = {
    en: `You've been invited to join ${organizationName} BMS. Activate your account: ${shortUrl}. Link expires in ${INVITATION_EXPIRY_DAYS} days.`,
    am: `ከ${organizationName} BMS ጋር ለመቀላቀል ተጋብዘዋል። መለያዎን ያግብሩ: ${shortUrl}። አገናኙ በ${INVITATION_EXPIRY_DAYS} ቀናት ውስጥ ይወድቃል።`,
    om: `Waliin ${organizationName} BMS irratti hirmaachuu isiniif kenne. Akkaawuntii keessan milkaa'i: ${shortUrl}. Linkiin guyyaa ${INVITATION_EXPIRY_DAYS} keessatti ni darba.`,
    ti: `ናብ ${organizationName} BMS ንምብጻሕ ተዓዲብኩም። ኣካውንትኩም ኣክቲቭ ግበሩ: ${shortUrl}። እቲ ሊንክ ኣብ ${INVITATION_EXPIRY_DAYS} መዓልቲ ይዕድም።`,
  };

  const message = messages[language];
  return message || messages.en || '';
}
