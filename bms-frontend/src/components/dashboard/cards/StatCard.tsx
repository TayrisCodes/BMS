import { DashboardCard } from '@/lib/components/ui/DashboardCard';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  icon?: React.ComponentType<{ className?: string }>;
  formatValue?: (value: number) => string;
  colSpan?: 1 | 2 | 3 | 4;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  formatValue,
  colSpan = 1,
  loading = false,
  error = null,
  onRetry,
}: StatCardProps) {
  const formattedValue =
    typeof value === 'number' && formatValue ? formatValue(value) : value.toString();

  return (
    <DashboardCard
      title={label}
      icon={Icon}
      colSpan={colSpan}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      <div className="space-y-2">
        <div className="text-3xl font-bold">{formattedValue}</div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm',
              trend.direction === 'up'
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
