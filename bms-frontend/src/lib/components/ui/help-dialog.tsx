'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { HelpCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  content?: string;
  helpLink?: string;
}

export function HelpDialog({ open, onOpenChange, title, content, helpLink }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            {title || 'Help'}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {content && <p className="text-sm text-muted-foreground mb-4">{content}</p>}
          {helpLink && (
            <Button variant="outline" asChild>
              <Link href={helpLink} target="_blank" rel="noopener noreferrer">
                View Full Documentation <ExternalLink className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
