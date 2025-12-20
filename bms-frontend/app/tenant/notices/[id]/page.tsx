'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Bell, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Notice {
  _id: string;
  title: string;
  content: string;
  type: 'announcement' | 'emergency' | 'maintenance' | 'general';
  priority: 'normal' | 'high' | 'urgent';
  publishedAt: string;
  expiryDate?: string | null;
  attachments?: string[] | null;
  isRead?: boolean;
}

const priorityColors: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function NoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  useEffect(() => {
    async function fetchNotice() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ notice: Notice }>(`/api/notices/${params.id}`);
        setNotice(data.notice);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notice');
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) {
      fetchNotice();
    }
  }, [params.id]);

  async function handleMarkAsRead() {
    if (!notice) return;

    setIsMarkingRead(true);
    try {
      await apiPost(`/api/notices/${notice._id}/read`, {});
      setNotice({ ...notice, isRead: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notice as read');
    } finally {
      setIsMarkingRead(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage title="Notice Details" icon={<Bell className="h-5 w-5" />}>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading notice...</p>
        </div>
      </DashboardPage>
    );
  }

  if (!notice) {
    return (
      <DashboardPage title="Notice Details" icon={<Bell className="h-5 w-5" />}>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Notice not found</p>
        </div>
      </DashboardPage>
    );
  }

  const isExpired = notice.expiryDate && new Date(notice.expiryDate) < new Date();

  return (
    <DashboardPage
      title="Notice Details"
      description="View notice information"
      icon={<Bell className="h-5 w-5" />}
    >
      <div className="col-span-full space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/tenant/notices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl">{notice.title}</CardTitle>
                <div className="flex gap-2 mt-2">
                  <Badge className={priorityColors[notice.priority]}>{notice.priority}</Badge>
                  <Badge variant="outline">{notice.type}</Badge>
                  {isExpired && (
                    <Badge variant="outline" className="bg-gray-100">
                      Expired
                    </Badge>
                  )}
                  {!notice.isRead && (
                    <Badge variant="outline" className="bg-primary/10">
                      New
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: notice.content }}
            />

            <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
              <span>Published: {format(new Date(notice.publishedAt), 'MMM dd, yyyy HH:mm')}</span>
              {notice.expiryDate && (
                <span>Expires: {format(new Date(notice.expiryDate), 'MMM dd, yyyy')}</span>
              )}
            </div>

            {notice.attachments && notice.attachments.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Attachments</h4>
                <div className="space-y-2">
                  {notice.attachments.map((attachment, index) => (
                    <a
                      key={index}
                      href={attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-primary hover:underline"
                    >
                      {attachment.split('/').pop()}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {!notice.isRead && (
              <div className="pt-4">
                <Button onClick={handleMarkAsRead} disabled={isMarkingRead}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isMarkingRead ? 'Marking...' : 'Mark as Read'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}

