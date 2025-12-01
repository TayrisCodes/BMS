const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    // In dev, log to console if Telegram is not configured
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Telegram Mock] OTP Code:', message);
      return true;
    }
    console.error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured');
    return false;
  }

  try {
    const payload: TelegramMessage = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    };

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram message', error);
    return false;
  }
}

export async function sendOtpViaTelegram(phone: string, code: string): Promise<boolean> {
  const message = `🔐 <b>BMS OTP Code</b>\n\nYour verification code is: <code>${code}</code>\n\nPhone: ${phone}\nValid for 10 minutes.\n\nDo not share this code with anyone.`;

  return sendTelegramMessage(message);
}

