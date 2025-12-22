'use client';

import { BotInterface } from '@/lib/components/messages/BotInterface';

export default function BotPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">BMS Assistant</h1>
        <p className="text-muted-foreground">Get help and perform quick actions using commands</p>
      </div>
      <BotInterface />
    </div>
  );
}
