'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { LogOut, AlertCircle, Clock, User, Building } from 'lucide-react';

interface VisitorLog {
  _id: string;
  visitorName: string;
  visitorPhone?: string | null;
  hostTenantId: string;
  purpose: string;
  vehiclePlateNumber?: string | null;
  entryTime: Date | string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

export default function LogVisitorExitPage() {
  const router = useRouter();
  const params = useParams();
  const visitorId = params.id as string;

  const [visitor, setVisitor] = useState<VisitorLog | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVisitor = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/visitor-logs/${visitorId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch visitor log');
      }
      const data = await response.json();
      setVisitor(data.visitorLog);

      // Fetch tenant info
      if (data.visitorLog.hostTenantId) {
        const tenantResponse = await fetch(`/api/tenants/${data.visitorLog.hostTenantId}`);
        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          setTenant(tenantData.tenant);
        }
      }
    } catch (err) {
      console.error('Failed to fetch visitor:', err);
      setError(err instanceof Error ? err.message : 'Failed to load visitor information');
    } finally {
      setLoading(false);
    }
  }, [visitorId]);

  useEffect(() => {
    if (visitorId) {
      fetchVisitor();
    }
  }, [visitorId, fetchVisitor]);

  const handleLogExit = async () => {
    if (!visitor) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(`/api/visitor-logs/${visitorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exitTime: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to log visitor exit');
      }

      router.push('/security/visitors');
    } catch (err) {
      console.error('Failed to log exit:', err);
      setError(err instanceof Error ? err.message : 'Failed to log visitor exit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-2xl font-bold">Log Visitor Exit</div>
        <div className="rounded-lg border bg-card p-4 space-y-3 animate-pulse">
          <div className="h-4 w-3/4 bg-muted rounded"></div>
          <div className="h-3 w-1/2 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!visitor) {
    return (
      <div className="space-y-4">
        <div className="text-2xl font-bold">Log Visitor Exit</div>
        <div className="rounded-lg border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-lg font-medium mb-2">Visitor Not Found</p>
          <p className="text-sm text-muted-foreground mb-4">The visitor log could not be found.</p>
          <Button onClick={() => router.push('/security/visitors')}>Back to Visitors</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Log Visitor Exit</h1>
        <p className="text-sm text-muted-foreground mt-1">Record visitor departure</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <LogOut className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Visitor Exit</CardTitle>
              <CardDescription>Confirm visitor departure and record exit time</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Visitor Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <User className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold">{visitor.visitorName}</div>
                {visitor.visitorPhone && (
                  <div className="text-sm text-muted-foreground">{visitor.visitorPhone}</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm font-medium">Host:</span>
                <span className="text-sm">
                  {tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Unknown'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm font-medium">Purpose:</span>
                <span className="text-sm">{visitor.purpose}</span>
              </div>

              {visitor.vehiclePlateNumber && (
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="text-sm font-medium">Vehicle:</span>
                  <span className="text-sm font-mono">{visitor.vehiclePlateNumber}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Entry Time:</span>
                </div>
                <span className="text-sm font-medium">{formatDateTime(visitor.entryTime)}</span>
              </div>
            </div>
          </div>

          {/* Exit Time Info */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Exit Time
              </span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              The exit time will be recorded as the current time when you confirm.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleLogExit} disabled={isSubmitting} className="flex-1">
              <LogOut className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Logging Exit...' : 'Confirm Exit'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
