'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Bot, Send, Loader2, HelpCircle, ArrowRight } from 'lucide-react';
import type { BotResponse } from '@/lib/bot/types';
import Link from 'next/link';

interface BotMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  response?: BotResponse;
  timestamp: Date;
}

interface BotInterfaceProps {
  className?: string;
}

export function BotInterface({ className }: BotInterfaceProps) {
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: '1',
      type: 'bot',
      content: "Hello! I'm your BMS assistant. Type /help to see available commands.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update suggestions as user types
  useEffect(() => {
    if (input.startsWith('/')) {
      // Client-side command suggestions (no MongoDB import needed)
      const commandNames = [
        'help',
        'ask',
        'conversation',
        'status',
        'payments',
        'complaints',
        'settings',
        'notifications',
      ];
      const query = input.replace('/', '').toLowerCase();
      const filtered = commandNames.filter((cmd) => cmd.startsWith(query));
      setSuggestions(filtered.map((cmd) => `/${cmd}`));
    } else {
      setSuggestions([]);
    }
  }, [input]);

  const handleCommandExecute = async (commandInput: string) => {
    if (!commandInput.startsWith('/')) return;

    setProcessing(true);
    try {
      // Execute command via API
      const args = commandInput.split(' ').slice(1);
      const command = commandInput.split(' ')[0].replace('/', '');

      const response = await fetch('/api/bot/commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ command, args }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute command');
      }

      const botResponse = await response.json();

      const botMessage: BotMessage = {
        id: Date.now().toString(),
        type: 'bot',
        content: botResponse.content,
        response: botResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error: any) {
      const errorMessage: BotMessage = {
        id: Date.now().toString(),
        type: 'bot',
        content: error.message || 'Failed to execute command',
        response: {
          type: 'error',
          content: error.message || 'Failed to execute command',
        },
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing) return;

    const userMessage: BotMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const inputValue = input;
    setInput('');
    setProcessing(true);

    if (inputValue.startsWith('/')) {
      await handleCommandExecute(inputValue);
    } else {
      // Treat as regular question, use /ask command
      await handleCommandExecute(`/ask ${inputValue}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion + ' ');
    inputRef.current?.focus();
  };

  const renderBotResponse = (response: BotResponse) => {
    if (response.type === 'link' && response.link) {
      return (
        <div className="space-y-2">
          <p>{response.content}</p>
          <Button size="sm" asChild>
            <Link href={response.link}>
              Open <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      );
    }

    if (response.type === 'list' && response.items) {
      return (
        <div className="space-y-2">
          <p>{response.content}</p>
          <div className="space-y-1">
            {response.items.map((item, index) => (
              <div key={index} className="p-2 border rounded">
                <p className="font-semibold text-sm">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
                {item.link && (
                  <Button size="sm" variant="outline" asChild className="mt-1">
                    <Link href={item.link}>View</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (response.type === 'rich' && response.buttons) {
      return (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap">{response.content}</p>
          <div className="flex flex-wrap gap-2">
            {response.buttons.map((button, index) => (
              <Button
                key={index}
                size="sm"
                variant="outline"
                asChild={!!button.link}
                onClick={!button.link ? () => handleCommandExecute(button.action) : undefined}
              >
                {button.link ? (
                  <Link href={button.link}>{button.label}</Link>
                ) : (
                  <span>{button.label}</span>
                )}
              </Button>
            ))}
          </div>
        </div>
      );
    }

    return <p className="whitespace-pre-wrap">{response.content}</p>;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          BMS Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-[600px]">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {message.response ? (
                  renderBotResponse(message.response)
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          {processing && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command (e.g., /help) or ask a question..."
            disabled={processing}
          />
          <Button type="submit" disabled={!input.trim() || processing}>
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
          <HelpCircle className="h-3 w-3" />
          <span>Type /help for available commands</span>
        </div>
      </CardContent>
    </Card>
  );
}
