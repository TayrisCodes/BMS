import type { BotCommand, BotContext, BotResponse } from './types';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

export const botCommands: BotCommand[] = [
  {
    name: 'help',
    description: 'Show available commands and help information',
    aliases: ['h', '?'],
    handler: async (args, context) => {
      const commands = botCommands
        .filter((cmd) => !cmd.requiresAuth || context.userId)
        .map((cmd) => `/${cmd.name} - ${cmd.description}`)
        .join('\n');

      return {
        type: 'text',
        content: `Available commands:\n\n${commands}\n\nType /help [command] for more information about a specific command.`,
        title: 'Bot Commands',
      };
    },
  },
  {
    name: 'ask',
    description: 'Ask a question or search for help',
    aliases: ['question', 'search'],
    handler: async (args, context) => {
      const question = args.join(' ');
      if (!question) {
        return {
          type: 'error',
          content: 'Please provide a question. Usage: /ask [your question]',
        };
      }

      // Return help response with links to search
      const isTenant = context.roles.includes('TENANT');
      return {
        type: 'text',
        content: `I can help you with "${question}". Here are some options:`,
        buttons: [
          {
            label: 'Search Help Center',
            action: 'help',
            link: `/help?q=${encodeURIComponent(question)}`,
          },
          {
            label: 'Ask Building Manager',
            action: 'conversation',
            link: isTenant ? '/tenant/messages' : '/org/messages',
          },
        ],
      };
    },
  },
  {
    name: 'conversation',
    description: 'List conversations or open a specific conversation',
    aliases: ['conv', 'messages', 'msg'],
    handler: async (args, context) => {
      const conversationId = args[0];

      if (conversationId) {
        // Open specific conversation
        const isTenant = context.roles.includes('TENANT');
        const link = isTenant
          ? `/tenant/messages/${conversationId}`
          : `/org/messages/${conversationId}`;

        return {
          type: 'link',
          content: `Opening conversation ${conversationId}...`,
          link,
        };
      }

      // List conversations
      const isTenant = context.roles.includes('TENANT');
      const link = isTenant ? '/tenant/messages' : '/org/messages';

      return {
        type: 'link',
        content: 'Opening your conversations...',
        link,
      };
    },
  },
  {
    name: 'status',
    description: 'Check system status and your account information',
    aliases: ['info', 'account'],
    handler: async (args, context) => {
      try {
        const db = await getDb();
        let userInfo: any = {};

        if (context.roles.includes('TENANT') && context.tenantId) {
          const tenant = await db
            .collection('tenants')
            .findOne({ _id: new ObjectId(context.tenantId) });
          if (tenant) {
            userInfo = {
              name: `${tenant.firstName} ${tenant.lastName}`,
              phone: tenant.primaryPhone,
              email: tenant.email,
              status: tenant.status,
            };
          }
        } else {
          const user = await db.collection('users').findOne({ _id: new ObjectId(context.userId) });
          if (user) {
            userInfo = {
              name: user.name || user.email,
              email: user.email,
              phone: user.phone,
              roles: user.roles,
            };
          }
        }

        return {
          type: 'rich',
          content: `**Account Status**\n\nName: ${userInfo.name || 'N/A'}\nEmail: ${userInfo.email || 'N/A'}\nPhone: ${userInfo.phone || 'N/A'}\nStatus: ${userInfo.status || 'Active'}\nRoles: ${userInfo.roles?.join(', ') || 'N/A'}`,
          title: 'System Status',
        };
      } catch (error) {
        return {
          type: 'error',
          content: 'Failed to retrieve account information.',
        };
      }
    },
  },
  {
    name: 'payments',
    description: 'View payment information and recent invoices',
    aliases: ['pay', 'invoice', 'invoices'],
    handler: async (args, context) => {
      const isTenant = context.roles.includes('TENANT');
      const link = isTenant ? '/tenant/invoices' : '/org/payments';

      return {
        type: 'link',
        content: 'Opening payments...',
        link,
        buttons: [
          { label: 'View Invoices', action: 'link', link },
          { label: 'Make Payment', action: 'link', link: '/tenant/payments' },
        ],
      };
    },
  },
  {
    name: 'complaints',
    description: 'List or create complaints',
    aliases: ['complaint', 'issue', 'ticket'],
    handler: async (args, context) => {
      const isTenant = context.roles.includes('TENANT');
      const link = isTenant ? '/tenant/complaints' : '/org/complaints';

      return {
        type: 'link',
        content: 'Opening complaints...',
        link,
        buttons: [
          { label: 'View Complaints', action: 'link', link },
          { label: 'New Complaint', action: 'link', link: '/tenant/complaints/new' },
        ],
      };
    },
  },
  {
    name: 'settings',
    description: 'Access user settings',
    aliases: ['config', 'preferences'],
    handler: async (args, context) => {
      const isTenant = context.roles.includes('TENANT');
      const link = isTenant ? '/tenant/profile' : '/org/settings';

      return {
        type: 'link',
        content: 'Opening settings...',
        link,
      };
    },
  },
  {
    name: 'notifications',
    description: 'Manage notification preferences',
    aliases: ['notif', 'alerts'],
    handler: async (args, context) => {
      const isTenant = context.roles.includes('TENANT');
      const link = isTenant ? '/tenant/settings/notifications' : '/org/settings';

      return {
        type: 'link',
        content: 'Opening notification settings...',
        link,
      };
    },
  },
];

export function findCommand(input: string): BotCommand | null {
  const commandName = input.split(' ')[0].replace('/', '').toLowerCase();
  return (
    botCommands.find(
      (cmd) =>
        cmd.name.toLowerCase() === commandName ||
        cmd.aliases?.some((alias) => alias.toLowerCase() === commandName),
    ) || null
  );
}

export function getCommandSuggestions(partial: string): BotCommand[] {
  const query = partial.replace('/', '').toLowerCase();
  if (!query) return botCommands;

  return botCommands.filter(
    (cmd) =>
      cmd.name.toLowerCase().startsWith(query) ||
      cmd.aliases?.some((alias) => alias.toLowerCase().startsWith(query)),
  );
}
