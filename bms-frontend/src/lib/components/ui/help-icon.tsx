'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { cn } from '@/lib/lib/utils';

interface HelpIconProps {
  content: string | React.ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  variant?: 'default' | 'info' | 'warning' | 'error';
}

export function HelpIcon({ content, className, side = 'top', variant = 'default' }: HelpIconProps) {
  const variantStyles = {
    default: 'text-muted-foreground',
    info: 'text-blue-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              variantStyles[variant],
              className,
            )}
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {typeof content === 'string' ? <p>{content}</p> : content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
