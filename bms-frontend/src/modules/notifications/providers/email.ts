import nodemailer from 'nodemailer';

/**
 * Gmail email provider for sending notifications.
 * Uses Gmail SMTP with app password authentication.
 */
export class EmailProvider {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';
    const emailUser = process.env.EMAIL_USER || 'tarikumy@gmail.com';
    const emailPassword = process.env.EMAIL_PASSWORD; // App password: anha xxuz imxk mhwk
    const emailFromAddress = process.env.EMAIL_FROM_ADDRESS || emailUser;
    const emailFromName = process.env.EMAIL_FROM_NAME || 'BMS System';

    if (!emailPassword) {
      console.warn('[EmailProvider] EMAIL_PASSWORD not configured, email sending disabled');
      return;
    }

    // Configure Gmail transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        console.error('[EmailProvider] Connection verification failed:', error);
      } else {
        console.log('[EmailProvider] Gmail connection verified successfully');
      }
    });
  }

  /**
   * Send an email notification.
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param body - Plain text body
   * @param htmlBody - Optional HTML body
   * @returns Promise with success status and error if any
   */
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    htmlBody?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email provider not configured',
      };
    }

    try {
      const emailFromAddress = process.env.EMAIL_FROM_ADDRESS || 'tarikumy@gmail.com';
      const emailFromName = process.env.EMAIL_FROM_NAME || 'BMS System';

      const mailOptions = {
        from: `"${emailFromName}" <${emailFromAddress}>`,
        to,
        subject,
        text: body,
        html: htmlBody || body.replace(/\n/g, '<br>'),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailProvider] Email sent successfully to ${to}:`, info.messageId);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[EmailProvider] Failed to send email to ${to}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate email template for invoice created notification.
   */
  generateInvoiceCreatedEmail(
    invoiceNumber: string,
    amount: number,
    dueDate: Date,
  ): {
    subject: string;
    body: string;
    htmlBody: string;
  } {
    const subject = `New Invoice: ${invoiceNumber}`;
    const body =
      `Dear Tenant,\n\nA new invoice has been created for you.\n\n` +
      `Invoice Number: ${invoiceNumber}\n` +
      `Amount: ETB ${amount.toLocaleString()}\n` +
      `Due Date: ${dueDate.toLocaleDateString()}\n\n` +
      `Please log in to your tenant portal to view details and make payment.\n\n` +
      `Thank you,\nBMS System`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Invoice Created</h2>
        <p>Dear Tenant,</p>
        <p>A new invoice has been created for you.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">ETB ${amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${dueDate.toLocaleDateString()}</td>
          </tr>
        </table>
        <p>Please log in to your tenant portal to view details and make payment.</p>
        <p>Thank you,<br>BMS System</p>
      </div>
    `;

    return { subject, body, htmlBody };
  }

  /**
   * Generate email template for payment due reminder.
   */
  generatePaymentDueEmail(
    invoiceNumber: string,
    amount: number,
    dueDate: Date,
    daysUntilDue: number,
  ): {
    subject: string;
    body: string;
    htmlBody: string;
  } {
    const subject = `Payment Reminder: Invoice ${invoiceNumber} due in ${daysUntilDue} day(s)`;
    const body =
      `Dear Tenant,\n\nThis is a reminder that your invoice payment is due soon.\n\n` +
      `Invoice Number: ${invoiceNumber}\n` +
      `Amount: ETB ${amount.toLocaleString()}\n` +
      `Due Date: ${dueDate.toLocaleDateString()}\n` +
      `Days Remaining: ${daysUntilDue}\n\n` +
      `Please make payment before the due date to avoid any late fees.\n\n` +
      `Thank you,\nBMS System`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Reminder</h2>
        <p>Dear Tenant,</p>
        <p>This is a reminder that your invoice payment is due soon.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">ETB ${amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${dueDate.toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Remaining:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${daysUntilDue}</td>
          </tr>
        </table>
        <p>Please make payment before the due date to avoid any late fees.</p>
        <p>Thank you,<br>BMS System</p>
      </div>
    `;

    return { subject, body, htmlBody };
  }

  /**
   * Generate email template for payment received notification.
   */
  generatePaymentReceivedEmail(
    amount: number,
    invoiceNumber?: string,
  ): {
    subject: string;
    body: string;
    htmlBody: string;
  } {
    const subject = `Payment Received: ETB ${amount.toLocaleString()}`;
    const body =
      `Dear Tenant,\n\nYour payment has been received successfully.\n\n` +
      (invoiceNumber ? `Invoice Number: ${invoiceNumber}\n` : '') +
      `Amount: ETB ${amount.toLocaleString()}\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `Thank you for your payment.\n\n` +
      `BMS System`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Received</h2>
        <p>Dear Tenant,</p>
        <p>Your payment has been received successfully.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          ${
            invoiceNumber
              ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${invoiceNumber}</td>
          </tr>
          `
              : ''
          }
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">ETB ${amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleDateString()}</td>
          </tr>
        </table>
        <p>Thank you for your payment.</p>
        <p>BMS System</p>
      </div>
    `;

    return { subject, body, htmlBody };
  }

  /**
   * Generate email template for complaint status changed notification.
   */
  generateComplaintStatusChangedEmail(
    complaintId: string,
    status: string,
    message?: string,
  ): {
    subject: string;
    body: string;
    htmlBody: string;
  } {
    const subject = `Complaint Status Updated: ${status}`;
    const body =
      `Dear Tenant,\n\nYour complaint status has been updated.\n\n` +
      `Complaint ID: ${complaintId}\n` +
      `New Status: ${status}\n` +
      (message ? `Message: ${message}\n` : '') +
      `\nPlease log in to your tenant portal to view details.\n\n` +
      `Thank you,\nBMS System`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Complaint Status Updated</h2>
        <p>Dear Tenant,</p>
        <p>Your complaint status has been updated.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Complaint ID:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${complaintId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>New Status:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${status}</td>
          </tr>
          ${
            message
              ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Message:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${message}</td>
          </tr>
          `
              : ''
          }
        </table>
        <p>Please log in to your tenant portal to view details.</p>
        <p>Thank you,<br>BMS System</p>
      </div>
    `;

    return { subject, body, htmlBody };
  }
}
