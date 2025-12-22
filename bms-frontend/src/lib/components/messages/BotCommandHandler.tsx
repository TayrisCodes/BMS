'use client';

import { useState, useEffect, useRef } from 'react';
import { findCommand, getCommandSuggestions } from '@/lib/bot/commands';
import type { BotResponse } from '@/lib/bot/types';

interface BotCommandHandlerProps {
  input: string;
  onCommandExecute: (response: BotResponse) => void;
  onSuggestionsChange: (suggestions: string[]) => void;
}

export function BotCommandHandler({
  input,
  onCommandExecute,
  onSuggestionsChange,
}: BotCommandHandlerProps) {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Update suggestions as user types
    if (input.startsWith('/')) {
      const suggestions = getCommandSuggestions(input);
      onSuggestionsChange(suggestions.map((cmd) => `/${cmd.name}`));
    } else {
      onSuggestionsChange([]);
    }
  }, [input, onSuggestionsChange]);

  const executeCommand = async (commandInput: string) => {
    if (!commandInput.startsWith('/')) return;

    const command = findCommand(commandInput);
    if (!command) {
      onCommandExecute({
        type: 'error',
        content: `Unknown command. Type /help for available commands.`,
      });
      return;
    }

    setProcessing(true);
    try {
      // Get auth context
      const response = await fetch('/api/me');
      if (!response.ok) {
        throw new Error('Not authenticated');
      }

      const userData = await response.json();
      const context = {
        userId: userData.auth?.userId || userData.user?._id || '',
        organizationId: userData.auth?.organizationId || '',
        roles: userData.auth?.roles || [],
        tenantId: userData.auth?.tenantId || userData.user?.tenantId || '',
      };

      // Execute command
      const args = commandInput.split(' ').slice(1);
      const botResponse = await command.handler(args, context);

      onCommandExecute(botResponse);
    } catch (error: any) {
      onCommandExecute({
        type: 'error',
        content: error.message || 'Failed to execute command',
      });
    } finally {
      setProcessing(false);
    }
  };

  return { executeCommand, processing };
}
