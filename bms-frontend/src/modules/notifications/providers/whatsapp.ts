/**
 * WhatsApp provider for sending notifications via WhatsApp messages.
 * Supports multiple providers:
 * - Twilio WhatsApp API (recommended)
 * - WhatsApp Business API
 * - Generic REST API providers
 */
export type WhatsAppProviderType = 'twilio' | 'whatsapp-business' | 'generic' | 'mock';

export class WhatsAppProvider {
  private apiKey: string | null = null;
  private apiUrl: string | null = null;
  private providerType: WhatsAppProviderType = 'mock';
  private accountSid: string | null = null; // For Twilio
  private fromNumber: string | null = null; // For Twilio

  constructor() {
    // Determine provider type from environment
    const providerType = (
      process.env.WHATSAPP_PROVIDER || 'mock'
    ).toLowerCase() as WhatsAppProviderType;
    this.providerType = providerType;

    if (providerType === 'twilio') {
      // Twilio configuration
      this.accountSid = process.env.TWILIO_ACCOUNT_SID || null;
      this.apiKey = process.env.TWILIO_AUTH_TOKEN || process.env.WHATSAPP_API_KEY || null;
      this.fromNumber =
        process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_FROM_NUMBER || null;

      // Twilio API URL format
      if (this.accountSid) {
        this.apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      }

      if (!this.accountSid || !this.apiKey || !this.fromNumber) {
        console.warn(
          '[WhatsAppProvider] Twilio not fully configured. Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM',
        );
        this.providerType = 'mock';
      }
    } else if (providerType === 'whatsapp-business' || providerType === 'generic') {
      // Generic WhatsApp API configuration
      this.apiKey = process.env.WHATSAPP_API_KEY || null;
      this.apiUrl = process.env.WHATSAPP_API_URL || null;

      if (!this.apiKey || !this.apiUrl) {
        console.warn('[WhatsAppProvider] WHATSAPP_API_KEY or WHATSAPP_API_URL not configured');
        this.providerType = 'mock';
      }
    } else {
      // Mock mode
      this.providerType = 'mock';
    }
  }

  /**
   * Send a WhatsApp message.
   * @param to - Recipient phone number (with country code, e.g., +251912345678)
   * @param message - Message text
   * @returns Promise with success status and error if any
   */
  async sendWhatsApp(to: string, message: string): Promise<{ success: boolean; error?: string }> {
    // Normalize phone number (ensure it starts with +)
    const normalizedPhone = to.startsWith('+') ? to : `+${to}`;

    // If not configured, use mock mode for development/testing
    if (
      !this.apiKey ||
      !this.apiUrl ||
      this.apiKey === 'your_whatsapp_api_key' ||
      this.apiUrl === 'your_whatsapp_api_url'
    ) {
      console.log(`[WhatsAppProvider] Mock mode - Would send to ${normalizedPhone}:`);
      console.log(
        `[WhatsAppProvider] Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
      );

      // In mock mode, simulate success for testing
      // In production, this should return an error to indicate WhatsApp is not configured
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        return {
          success: false,
          error: 'WhatsApp provider not configured',
        };
      }

      // Development/test mode: simulate success
      return { success: true };
    }

    try {
      let response: Response;

      if (this.providerType === 'twilio') {
        // Twilio WhatsApp API
        if (!this.accountSid || !this.apiKey || !this.fromNumber) {
          throw new Error('Twilio not fully configured');
        }

        // Twilio uses Basic Auth with AccountSid:AuthToken
        // Use btoa for base64 encoding (works in both Node.js and browser)
        const credentials = `${this.accountSid}:${this.apiKey}`;
        const auth =
          typeof Buffer !== 'undefined'
            ? Buffer.from(credentials).toString('base64')
            : btoa(credentials);

        // Twilio requires form data
        const formData = new URLSearchParams();
        formData.append('From', `whatsapp:${this.fromNumber}`);
        formData.append('To', `whatsapp:${normalizedPhone}`);
        formData.append('Body', message);

        response = await fetch(this.apiUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${auth}`,
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Twilio API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log(
          `[WhatsAppProvider] Twilio message sent successfully to ${normalizedPhone} (SID: ${result.sid})`,
        );
        return { success: true };
      } else {
        // Generic WhatsApp API (WhatsApp Business API or other providers)
        const requestBody: Record<string, unknown> = {
          to: normalizedPhone,
          message,
        };

        // Some providers use different field names
        if (this.providerType === 'whatsapp-business') {
          requestBody.recipient = normalizedPhone;
          requestBody.text = message;
        }

        response = await fetch(this.apiUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`[WhatsAppProvider] Message sent successfully to ${normalizedPhone}`);
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[WhatsAppProvider] Failed to send WhatsApp to ${to}:`, errorMessage);

      // For MVP, if WhatsApp fails, we'll log but not throw
      // In production, you might want to retry or queue for later
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate WhatsApp message template for invoice created notification.
   */
  generateInvoiceCreatedMessage(invoiceNumber: string, amount: number, dueDate: Date): string {
    return (
      `📄 New Invoice Created\n\n` +
      `Invoice: ${invoiceNumber}\n` +
      `Amount: ETB ${amount.toLocaleString()}\n` +
      `Due Date: ${dueDate.toLocaleDateString()}\n\n` +
      `Please log in to your tenant portal to view details and make payment.\n\n` +
      `Thank you,\nBMS System`
    );
  }

  /**
   * Generate WhatsApp message template for payment due reminder.
   */
  generatePaymentDueMessage(
    invoiceNumber: string,
    amount: number,
    dueDate: Date,
    daysUntilDue: number,
  ): string {
    return (
      `⏰ Payment Reminder\n\n` +
      `Invoice: ${invoiceNumber}\n` +
      `Amount: ETB ${amount.toLocaleString()}\n` +
      `Due Date: ${dueDate.toLocaleDateString()}\n` +
      `Days Remaining: ${daysUntilDue}\n\n` +
      `Please make payment before the due date to avoid any late fees.\n\n` +
      `Thank you,\nBMS System`
    );
  }

  /**
   * Generate WhatsApp message template for payment received notification.
   */
  generatePaymentReceivedMessage(amount: number, invoiceNumber?: string): string {
    return (
      `✅ Payment Received\n\n` +
      (invoiceNumber ? `Invoice: ${invoiceNumber}\n` : '') +
      `Amount: ETB ${amount.toLocaleString()}\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `Thank you for your payment.\n\n` +
      `BMS System`
    );
  }

  /**
   * Generate WhatsApp message template for complaint status changed notification.
   */
  generateComplaintStatusChangedMessage(
    complaintId: string,
    status: string,
    message?: string,
  ): string {
    return (
      `📋 Complaint Status Updated\n\n` +
      `Complaint ID: ${complaintId}\n` +
      `New Status: ${status}\n` +
      (message ? `Message: ${message}\n` : '') +
      `\nPlease log in to your tenant portal to view details.\n\n` +
      `Thank you,\nBMS System`
    );
  }

  /**
   * Generate WhatsApp message template for work order assigned notification.
   */
  generateWorkOrderAssignedMessage(workOrderId: string, priority: string, dueDate?: Date): string {
    return (
      `🔧 Work Order Assigned\n\n` +
      `Work Order ID: ${workOrderId}\n` +
      `Priority: ${priority}\n` +
      (dueDate ? `Due Date: ${dueDate.toLocaleDateString()}\n` : '') +
      `\nPlease log in to view details and update status.\n\n` +
      `Thank you,\nBMS System`
    );
  }

  /**
   * Generate WhatsApp message template for visitor arrived notification.
   */
  generateVisitorArrivedMessage(
    visitorName: string,
    visitorPhone: string | null,
    buildingName: string,
    unitNumber: string | null,
    floor: number | null,
    entryTime: Date,
  ): string {
    const unitInfo = unitNumber ? `Unit ${unitNumber}${floor ? `, Floor ${floor}` : ''}` : '';
    const visitorInfo = visitorPhone ? `${visitorName} (${visitorPhone})` : visitorName;

    return (
      `🚪 Visitor Arrived\n\n` +
      `Visitor: ${visitorInfo}\n` +
      `Building: ${buildingName}\n` +
      (unitInfo ? `Unit: ${unitInfo}\n` : '') +
      `Entry Time: ${entryTime.toLocaleString()}\n\n` +
      `Please check your tenant portal for more details.\n\n` +
      `Thank you,\nBMS System`
    );
  }
}
