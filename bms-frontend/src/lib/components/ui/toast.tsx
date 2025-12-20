'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/lib/utils';

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  onClose?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ id, title, description, variant = 'default', onClose, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all',
          variant === 'destructive'
            ? 'border-destructive bg-destructive text-destructive-foreground'
            : 'border bg-background text-foreground',
        )}
        {...props}
      >
        <div className="grid gap-1">
          {title && <div className="text-sm font-semibold">{title}</div>}
          {description && (
            <div
              className={cn(
                'text-sm opacity-90',
                variant === 'destructive' && 'text-destructive-foreground',
              )}
            >
              {description}
            </div>
          )}
        </div>
        {onClose && (
          <button
            className={cn(
              'absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100',
              variant === 'destructive' &&
                'text-destructive-foreground/50 hover:text-destructive-foreground',
            )}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);
Toast.displayName = 'Toast';

export { Toast };

