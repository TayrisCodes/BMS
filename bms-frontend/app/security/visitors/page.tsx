'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Users, Plus, LogOut, Clock } from 'lucide-react';

interface VisitorLog {
  _id: string;
  visitorName: string;
  visitorPhone?: string | null;
  hostTenantId: string;
  hostUnitId?: string | null;
  purpose: string;
  vehiclePlateNumber?: string | null;
  parkingSpaceId?: string | null;
  entryTime: Date | string;
  loggedBy: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

export default function SecurityVisitorsPage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<VisitorLog[]>([]);
  const [tenants, setTenants] = useState<Record<string, Tenant>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants?status=active');
      if (response.ok) {
        const data = await response.json();
        const tenantsMap: Record<string, Tenant> = {};
        (data.tenants || []).forEach((tenant: Tenant) => {
          tenantsMap[tenant._id] = tenant;
        });
        setTenants(tenantsMap);
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  };

  const fetchActiveVisitors = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/visitor-logs?status=active');
      if (!response.ok) {
        throw new Error('Failed to fetch active visitors');
      }

      const data = await response.json();
      setVisitors(data.visitorLogs || []);
    } catch (err) {
      console.error('Failed to fetch active visitors:', err);
      setError(err instanceof Error ? err.message : 'Failed to load visitors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchActiveVisitors();
    // Refresh every 30 seconds
    const interval = setInterval(fetchActiveVisitors, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTenantName = (tenantId: string) => {
    const tenant = tenants[tenantId];
    return tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Unknown';
  };

  const handleLogExit = (visitorId: string) => {
    router.push(`/security/visitors/${visitorId}/exit`);
  };

  if (loading && visitors.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-2xl font-bold">Active Visitors</div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3 animate-pulse">
              <div className="h-4 w-3/4 bg-muted rounded"></div>
              <div className="h-3 w-1/2 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Active Visitors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {visitors.length} visitor{visitors.length !== 1 ? 's' : ''} currently on site
          </p>
        </div>
        <Button onClick={() => router.push('/security/visitors/new')} size="lg" className="h-12">
          <Plus className="h-5 w-5 mr-2" />
          Log Entry
        </Button>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      {/* Active Visitors List */}
      {visitors.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">No Active Visitors</p>
          <p className="text-sm text-muted-foreground mb-4">
            All visitors have exited or no visitors have been logged today.
          </p>
          <Button onClick={() => router.push('/security/visitors/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Log First Visitor
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visitors.map((visitor) => (
            <div key={visitor._id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{visitor.visitorName}</h3>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    >
                      Active
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Host:</span>
                      <span>{getTenantName(visitor.hostTenantId)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Purpose:</span>
                      <span>{visitor.purpose}</span>
                    </div>
                    {visitor.visitorPhone && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Phone:</span>
                        <span>{visitor.visitorPhone}</span>
                      </div>
                    )}
                    {visitor.vehiclePlateNumber && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Vehicle:</span>
                        <Badge variant="outline">{visitor.vehiclePlateNumber}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Entered: {formatTime(visitor.entryTime)}</span>
                </div>
                <Button onClick={() => handleLogExit(visitor._id)} variant="outline" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Exit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
