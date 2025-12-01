import type { ReactNode } from 'react';
import { cn } from '@/lib/lib/utils';

interface MainContentAreaProps {
  children: ReactNode;
  className?: string;
}

export function MainContentArea({ children, className }: MainContentAreaProps) {
  return (
    <main className={cn('flex-1 overflow-y-auto', className)}>
      <div className="container mx-auto max-w-7xl p-4 md:p-6">{children}</div>
    </main>
  );
}

