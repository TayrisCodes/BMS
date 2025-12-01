'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/lib/utils';
import { Button } from '@/lib/components/ui/button';
import {
  Home,
  Receipt,
  MessageSquare,
  User,
  Bell,
  ChevronLeft,
  ArrowLeft,
  QrCode,
} from 'lucide-react';

interface TenantMobileLayoutProps {
  children: React.ReactNode;
}

export function TenantMobileLayout({ children }: TenantMobileLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{
    name?: string;
    email?: string;
    balance?: number;
  } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Determine if we're on a nested page (need back button)
  const isNestedPage =
    pathname !== '/tenant/dashboard' && !pathname.match(/^\/tenant\/(login|signup)/);

  // Fetch user data
  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }

        // Fetch notifications count
        const notificationsRes = await fetch('/api/notifications');
        if (notificationsRes.ok) {
          const notificationsData = await notificationsRes.json();
          const unread = (notificationsData.notifications || []).filter(
            (n: { read?: boolean }) => !n.read,
          ).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    }

    fetchUser();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    const email = user?.email;
    if (email) {
      const firstChar = email.charAt(0);
      if (firstChar) {
        return firstChar.toUpperCase();
      }
    }
    return 'T';
  };

  const navigationItems = [
    { icon: Home, label: 'Home', href: '/tenant/dashboard' },
    { icon: Receipt, label: 'Invoices', href: '/tenant/invoices' },
    { icon: MessageSquare, label: 'Complaints', href: '/tenant/complaints' },
    { icon: QrCode, label: 'QR Codes', href: '/tenant/visitor-qr-codes' },
    { icon: User, label: 'Profile', href: '/tenant/profile' },
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-3 px-4">
          {/* Back button (only on nested pages) */}
          {isNestedPage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-9 w-9"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}

          {/* User info */}
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
              {getUserInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">{user?.name || 'Tenant'}</div>
              {user?.balance !== undefined && (
                <div className="truncate text-xs text-muted-foreground">
                  Balance: {formatCurrency(user.balance)}
                </div>
              )}
            </div>
          </div>

          {/* Notifications icon */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/tenant/notifications')}
            className="relative h-9 w-9"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 safe-area-inset-bottom">
        <div className="p-4">{children}</div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
        <div className="flex h-16 items-center justify-around px-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
