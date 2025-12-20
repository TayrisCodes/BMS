import type { ReactNode } from 'react';
import { cn } from '@/lib/lib/utils';

interface MainContentAreaProps {
  children: ReactNode;
  className?: string;
}

export function MainContentArea({ children, className }: MainContentAreaProps) {
  return (
    <main className={cn('flex-1 overflow-y-auto overflow-x-hidden', className)}>
      <div className="container mx-auto max-w-7xl px-4 md:px-6 pt-4 md:pt-6 pb-24 min-h-full">
        {children}
      </div>
    </main>
  );
}
