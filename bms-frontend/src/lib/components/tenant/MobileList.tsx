'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/lib/utils';
import { Loader2 } from 'lucide-react';

interface MobileListProps<T = unknown> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  onRefresh?: () => void;
}

export function MobileList<T = unknown>({
  items,
  renderItem,
  emptyMessage = 'No items',
  loading = false,
  className,
  onRefresh,
}: MobileListProps<T>) {
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center py-12 text-center text-muted-foreground',
          className,
        )}
      >
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            'border-b border-border last:border-b-0',
            index === 0 && 'border-t border-border',
          )}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}
