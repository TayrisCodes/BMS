'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Plus, Eye, Trash2, Bell, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface Notice {
  _id: string;
  title: string;
  type: 'announcement' | 'emergency' | 'maintenance' | 'general';
  priority: 'normal' | 'high' | 'urgent';
  publishedAt: string;
  expiryDate?: string | null;
  readReceipts?: Array<{ userId?: string | null; tenantId?: string | null; readAt: string }> | null;
}

const typeColors: Record<Notice['type'], string> = {
  announcement: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  emergency: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const priorityColors: Record<Notice['priority'], string> = {
  normal: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotices() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ notices: Notice[] }>('/api/notices');
        setNotices(data.notices || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notices');
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotices();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this notice?')) {
      try {
        await apiDelete(`/api/notices/${id}`);
        setNotices(notices.filter((n) => n._id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete notice');
      }
    }
  };

  return (
    <DashboardPage
      header={{
        title: 'Notice Board',
        description: 'Manage building announcements and notices',
        icon: Bell,
      }}
    >
      <div className="flex justify-between items-center mb-6">
        <Link href="/org/notices/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Notice
          </Button>
        </Link>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Read Count</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Loading notices...</p>
                </TableCell>
              </TableRow>
            ) : notices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">No notices created yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              notices.map((notice) => (
                <TableRow key={notice._id}>
                  <TableCell className="font-medium">{notice.title}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[notice.type]}>{notice.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={priorityColors[notice.priority]}>{notice.priority}</Badge>
                  </TableCell>
                  <TableCell>{format(new Date(notice.publishedAt), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    {notice.expiryDate
                      ? format(new Date(notice.expiryDate), 'MMM dd, yyyy')
                      : 'No expiry'}
                  </TableCell>
                  <TableCell>{notice.readReceipts?.length || 0} reads</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/org/notices/${notice._id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(notice._id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardPage>
  );
}

