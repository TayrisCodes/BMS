import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { findUserByEmailOrPhone, updateUser, findUserByResetPasswordToken } from '@/lib/auth/users';
import type { User } from '@/lib/auth/types';
import { EmailProvider } from '@/modules/notifications/providers/email';
import { WhatsAppProvider } from '@/modules/notifications/providers/whatsapp';
import { findOrganizationById } from '@/lib/organizations/organizations';
import { validatePassword } from '@/lib/auth/password-policy';

const RESET_TOKEN_LENGTH = 32;
const RESET_TOKEN_EXPIRY_HOURS = 1;

/**
 * Generate a secure random token for password reset.
 */
function generateResetToken(): string {
  return crypto.randomBytes(RESET_TOKEN_LENGTH).toString('hex');
}

/**
 * Calculate reset token expiration date.
 */
function getResetTokenExpiryDate(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + RESET_TOKEN_EXPIRY_HOURS);
  return expiry;
}

/**
 * Request password reset for a user.
 * Finds user by email or phone, generates reset token, and sends reset link.
 */
export async function requestPasswordReset(
  emailOrPhone: string,
): Promise<{ success: boolean; message: string }> {
  // Find user by email or phone
  const user = await findUserByEmailOrPhone(emailOrPhone);

  // Don't reveal if user exists for security
  // Always return success message
  if (!user) {
    return {
      success: true,
      message:
        'If an account exists with that email or phone, a password reset link has been sent.',
    };
  }

  // Check if user is active (don't allow reset for inactive users)
  if (user.status !== 'active') {
    // Still return success to avoid revealing user status
    return {
      success: true,
      message:
        'If an account exists with that email or phone, a password reset link has been sent.',
    };
  }

  // Generate reset token
  const token = generateResetToken();
  const expiresAt = getResetTokenExpiryDate();

  // Update user with reset token
  await updateUser(
    user._id.toString(),
    {
      resetPasswordToken: token,
      resetPasswordTokenExpiresAt: expiresAt,
    },
    false,
  );

  // Get organization details for email/SMS
  const organization = user.organizationId ? await findOrganizationById(user.organizationId) : null;

  // Generate reset URL
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/auth/reset-password/${token}`;

  // Send reset email/SMS
  await sendPasswordResetNotification({
    user,
    organization,
    resetUrl,
  }).catch((error) => {
    console.error('[PasswordResetService] Failed to send reset notification:', error);
    // Don't throw - token is created, notification can be retried
  });

  return {
    success: true,
    message: 'If an account exists with that email or phone, a password reset link has been sent.',
  };
}

/**
 * Validate reset token and return the user.
 */
export async function validateResetToken(token: string): Promise<User | null> {
  const user = await findUserByResetPasswordToken(token);

  if (!user) {
    return null;
  }

  // Check if token is expired
  if (user.resetPasswordTokenExpiresAt && user.resetPasswordTokenExpiresAt < new Date()) {
    return null;
  }

  return user;
}

/**
 * Reset password with token.
 * Validates token, checks password policy, and updates password.
 */
export async function resetPassword(token: string, newPassword: string): Promise<User> {
  // Validate token
  const user = await validateResetToken(token);
  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  // Validate password policy
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  // Hash password
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Update user: set password, clear reset token, update passwordChangedAt
  const updatedUser = await updateUser(
    user._id.toString(),
    {
      passwordHash,
      passwordChangedAt: new Date(),
      resetPasswordToken: null,
      resetPasswordTokenExpiresAt: null,
    },
    false,
  );

  if (!updatedUser) {
    throw new Error('Failed to reset password');
  }

  return updatedUser;
}

/**
 * Send password reset notification via email or SMS.
 */
async function sendPasswordResetNotification(input: {
  user: User;
  organization: { name: string; code: string } | null;
  resetUrl: string;
}): Promise<void> {
  const { user, organization, resetUrl } = input;

  const orgName = organization?.name || 'the organization';

  // Send email if email is provided
  if (user.email) {
    const emailProvider = new EmailProvider();
    const { subject, body, htmlBody } = generatePasswordResetEmail({
      organizationName: orgName,
      resetUrl,
    });

    await emailProvider.sendEmail(user.email, subject, body, htmlBody);
  }

  // Send SMS/WhatsApp if phone is provided
  if (user.phone) {
    const whatsappProvider = new WhatsAppProvider();
    const message = generatePasswordResetSMS({
      organizationName: orgName,
      resetUrl,
    });

    await whatsappProvider.sendWhatsApp(user.phone, message);
  }
}

/**
 * Generate password reset email template.
 */
function generatePasswordResetEmail(input: { organizationName: string; resetUrl: string }): {
  subject: string;
  body: string;
  htmlBody: string;
} {
  const { organizationName, resetUrl } = input;

  const subject = `Password Reset Request - ${organizationName} BMS`;

  const body = `Dear User,

You have requested to reset your password for your ${organizationName} BMS account.

To reset your password, please click on the following link:
${resetUrl}

This link will expire in ${RESET_TOKEN_EXPIRY_HOURS} hour(s).

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

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
        .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Dear User,</p>
          <p>You have requested to reset your password for your <strong>${organizationName}</strong> BMS account.</p>
          <p>To reset your password, please click the button below:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
          <p><em>This link will expire in ${RESET_TOKEN_EXPIRY_HOURS} hour(s).</em></p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you did not request this password reset, please ignore this email. Your password will remain unchanged.
          </div>
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
 * Generate password reset SMS template.
 */
function generatePasswordResetSMS(input: {
  organizationName: string;
  resetUrl: string;
  language?: 'en' | 'am' | 'om' | 'ti';
}): string {
  const { organizationName, resetUrl, language = 'en' } = input;

  // For SMS, we'll use a shortened URL or code
  const shortUrl =
    resetUrl.length > 50
      ? resetUrl.substring(resetUrl.length - 20) // Last 20 chars as fallback
      : resetUrl;

  const messages: Record<string, string> = {
    en: `Password reset requested for ${organizationName} BMS. Reset link: ${shortUrl}. Expires in ${RESET_TOKEN_EXPIRY_HOURS} hour(s). If you didn't request this, ignore this message.`,
    am: `ለ${organizationName} BMS የይለፍ ቃል ማስተካከያ ተጠይቋል። የማስተካከያ አገናኝ: ${shortUrl}። በ${RESET_TOKEN_EXPIRY_HOURS} ሰዓት ውስጥ ይወድቃል። ይህን ካልጠየቁ ይህንን መልእክት ችላ ይበሉ።`,
    om: `Jecha iccitii ${organizationName} BMS irratti barbaadame. Linkiin jijjiiramaa: ${shortUrl}. Sa'aatii ${RESET_TOKEN_EXPIRY_HOURS} keessatti ni darba. Yoo kan hin barbaadne taatan, ergaa kana dhiisaa.`,
    ti: `ን${organizationName} BMS ደልዲል ቃል ምሕዳስ ተሓቲቱ። ሊንክ ምሕዳስ: ${shortUrl}። ኣብ ${RESET_TOKEN_EXPIRY_HOURS} ሰዓት ውስጥ ይዕድም። እዚ እንተዘይሓተትኩም እዚ መልእክቲ ተዘሓሊፉዎ።`,
  };

  const message = messages[language];
  return message || messages.en || '';
}
