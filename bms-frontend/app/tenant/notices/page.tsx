'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Bell, AlertTriangle, Wrench, Info } from 'lucide-react';
import { format } from 'date-fns';

interface Notice {
  _id: string;
  title: string;
  content: string;
  type: 'announcement' | 'emergency' | 'maintenance' | 'general';
  priority: 'normal' | 'high' | 'urgent';
  publishedAt: string;
  expiryDate?: string | null;
  readReceipts?: Array<{ userId?: string | null; tenantId?: string | null; readAt: string }> | null;
  isRead?: boolean;
}

const typeIcons: Record<Notice['type'], typeof Bell> = {
  announcement: Bell,
  emergency: AlertTriangle,
  maintenance: Wrench,
  general: Info,
};

const priorityColors: Record<Notice['priority'], string> = {
  normal: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function TenantNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotices() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ notices: Notice[] }>('/api/notices');
        // Filter notices that should be shown to this tenant (would be done server-side in production)
        setNotices(data.notices || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notices');
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotices();
  }, []);

  const handleMarkAsRead = async (noticeId: string) => {
    try {
      await apiPost(`/api/notices/${noticeId}/read`, {});
      setNotices(notices.map((n) => (n._id === noticeId ? { ...n, isRead: true } : n)));
    } catch (err) {
      console.error('Failed to mark notice as read:', err);
    }
  };

  const unreadCount = notices.filter((n) => !n.isRead).length;

  return (
    <DashboardPage
      header={{
        title: 'Notice Board',
        description: 'Building announcements and updates',
        icon: Bell,
      }}
    >
      {unreadCount > 0 && (
        <div className="mb-4 p-4 bg-primary/10 rounded-lg">
          <p className="text-sm font-medium">
            You have {unreadCount} unread notice{unreadCount > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6">{error}</div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading notices...</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No notices available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => {
            const Icon = typeIcons[notice.type];
            const isExpired = notice.expiryDate && new Date(notice.expiryDate) < new Date();

            return (
              <Card key={notice._id} className={!notice.isRead ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-5 w-5 mt-1" />
                      <div className="flex-1">
                        <CardTitle className="text-lg">{notice.title}</CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge className={priorityColors[notice.priority]}>
                            {notice.priority}
                          </Badge>
                          {!notice.isRead && (
                            <Badge variant="outline" className="bg-primary/10">
                              New
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="outline" className="bg-gray-100">
                              Expired
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none mb-4"
                    dangerouslySetInnerHTML={{ __html: notice.content }}
                  />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Published: {format(new Date(notice.publishedAt), 'MMM dd, yyyy')}</span>
                    {notice.expiryDate && (
                      <span>Expires: {format(new Date(notice.expiryDate), 'MMM dd, yyyy')}</span>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/tenant/notices/${notice._id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                    {!notice.isRead && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(notice._id)}
                      >
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardPage>
  );
}
