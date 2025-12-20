export interface BotCommand {
  name: string;
  description: string;
  aliases?: string[];
  handler: (args: string[], context: BotContext) => Promise<BotResponse>;
  requiresAuth?: boolean;
}

export interface BotContext {
  userId: string;
  organizationId?: string;
  roles: string[];
  tenantId?: string;
}

export interface BotResponse {
  type: 'text' | 'rich' | 'link' | 'list' | 'error';
  content: string;
  title?: string;
  buttons?: Array<{ label: string; action: string; link?: string }>;
  items?: Array<{ title: string; description?: string; link?: string }>;
  link?: string;
  metadata?: Record<string, unknown>;
}

