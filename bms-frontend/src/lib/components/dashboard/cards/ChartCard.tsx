'use client';

import { DashboardCard } from '@/lib/components/ui/DashboardCard';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, unknown>>;
  type?: 'line' | 'bar' | 'pie' | 'area';
  xAxis?: string;
  yAxis?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  colSpan?: 1 | 2 | 3 | 4 | 6 | 12;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function ChartCard({
  title,
  subtitle,
  data,
  type = 'line',
  xAxis = 'name',
  yAxis = 'value',
  loading = false,
  error = null,
  onRetry,
  colSpan = 1,
}: ChartCardProps) {
  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      );
    }

    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `${value.toLocaleString()} ETB`}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Legend />
              <Line type="monotone" dataKey={yAxis} stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `${value.toLocaleString()} ETB`}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Legend />
              <Bar dataKey={yAxis} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={yAxis}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Chart type not supported
          </div>
        );
    }
  };

  return (
    <DashboardCard
      title={title}
      subtitle={subtitle}
      colSpan={colSpan}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {renderChart()}
    </DashboardCard>
  );
}
