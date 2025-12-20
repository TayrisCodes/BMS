'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { BarChart3, ArrowLeft, Users, Building2, TrendingUp } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

interface OrganizationStats {
  organizationId: string;
  organizationName: string;
  stats: {
    total: number;
    active: number;
    invited: number;
    inactive: number;
    suspended: number;
  };
}

interface AnalyticsData {
  stats: {
    total: number;
    active: number;
    invited: number;
    inactive: number;
    suspended: number;
  };
  byOrganization?: OrganizationStats[];
  byRole?: Record<string, number>;
  trends?: {
    last30Days: number;
    last90Days: number;
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setIsLoading(true);
        setError(null);

        const analyticsData = await apiGet<AnalyticsData>(
          '/api/users/stats?breakdown=organization&role=true',
        );
        setData(analyticsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">User Analytics</h1>
            <p className="text-muted-foreground">System-wide user statistics and trends</p>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invited</CardTitle>
            <Users className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data.stats.invited}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{data.stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.stats.suspended}</div>
          </CardContent>
        </Card>
      </div>

      {/* Trends */}
      {data.trends && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                User Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Last 30 Days</span>
                  <span className="text-lg font-semibold">{data.trends.last30Days}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Last 90 Days</span>
                  <span className="text-lg font-semibold">{data.trends.last90Days}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Role Distribution */}
      {data.byRole && (
        <Card>
          <CardHeader>
            <CardTitle>Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.byRole)
                .sort(([, a], [, b]) => b - a)
                .map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between">
                    <span className="text-sm">{role.replace(/_/g, ' ')}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organization Breakdown */}
      {data.byOrganization && data.byOrganization.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Users by Organization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.byOrganization
                .sort((a, b) => b.stats.total - a.stats.total)
                .map((org) => (
                  <div key={org.organizationId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={`/admin/organizations/${org.organizationId}/admins`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {org.organizationName}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        Total: {org.stats.total}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Active:</span>{' '}
                        <span className="font-semibold text-green-600">{org.stats.active}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Invited:</span>{' '}
                        <span className="font-semibold text-yellow-600">{org.stats.invited}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Inactive:</span>{' '}
                        <span className="font-semibold text-gray-600">{org.stats.inactive}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Suspended:</span>{' '}
                        <span className="font-semibold text-red-600">{org.stats.suspended}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

