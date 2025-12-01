'use client';

import { DashboardCard } from '@/lib/components/ui/DashboardCard';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  data: unknown[];
  type?: 'line' | 'bar' | 'pie' | 'area';
  xAxis?: string;
  yAxis?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  colSpan?: 1 | 2 | 3 | 4;
}

export function ChartCard({
  title,
  subtitle,
  data,
  type = 'line',
  xAxis,
  yAxis,
  loading = false,
  error = null,
  onRetry,
  colSpan = 1,
}: ChartCardProps) {
  // TODO: Integrate with chart library (recharts or chart.js)
  // For now, show placeholder
  return (
    <DashboardCard
      title={title}
      subtitle={subtitle}
      colSpan={colSpan}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Chart placeholder ({type}){/* Chart library integration will go here */}
      </div>
    </DashboardCard>
  );
}
