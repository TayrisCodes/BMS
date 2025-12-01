'use client';

import { DashboardCard } from '@/lib/components/ui/DashboardCard';

interface ListCardProps<T = unknown> {
  title: string;
  subtitle?: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  maxItems?: number;
  colSpan?: 1 | 2 | 3 | 4;
}

export function ListCard<T = unknown>({
  title,
  subtitle,
  items,
  renderItem,
  emptyMessage = 'No items',
  loading = false,
  error = null,
  onRetry,
  maxItems,
  colSpan = 1,
}: ListCardProps<T>) {
  const displayItems = maxItems ? items.slice(0, maxItems) : items;

  return (
    <DashboardCard
      title={title}
      subtitle={subtitle}
      colSpan={colSpan}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!loading && !error && items.length === 0}
      emptyMessage={emptyMessage}
    >
      {!loading && !error && items.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayItems.map((item, index) => (
            <div key={index} className="border-b border-border last:border-b-0 pb-2 last:pb-0">
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
