'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Bell, ArrowLeft, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Notice {
  _id: string;
  title: string;
  content: string;
  type: 'announcement' | 'emergency' | 'maintenance' | 'general';
  priority: 'normal' | 'high' | 'urgent';
  publishedAt: string;
  expiryDate?: string | null;
  readReceipts?: Array<{
    userId?: string | null;
    tenantId?: string | null;
    readAt: string;
  }> | null;
}

const priorityColors: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function NoticeDetailPage() {
  const params = useParams();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [readReceipts, setReadReceipts] = useState<Notice['readReceipts']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotice() {
      try {
        setIsLoading(true);
        const [noticeData, receiptsData] = await Promise.all([
          apiGet<{ notice: Notice }>(`/api/notices/${params.id}`),
          apiGet<{ readReceipts: Notice['readReceipts'] }>(
            `/api/notices/${params.id}/read-receipts`,
          ),
        ]);
        setNotice(noticeData.notice);
        setReadReceipts(receiptsData.readReceipts || []);
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

  return (
    <DashboardPage
      title="Notice Details"
      description="View notice and read receipts"
      icon={<Bell className="h-5 w-5" />}
    >
      <div className="col-span-full space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/org/notices">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Read Receipts ({readReceipts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {readReceipts.length === 0 ? (
              <p className="text-muted-foreground">No read receipts yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant/User ID</TableHead>
                    <TableHead>Read At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readReceipts.map((receipt, index) => (
                    <TableRow key={index}>
                      <TableCell>{receipt.tenantId || receipt.userId || 'Unknown'}</TableCell>
                      <TableCell>
                        {format(new Date(receipt.readAt), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}

