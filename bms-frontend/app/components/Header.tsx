'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Building2 } from 'lucide-react';

interface UserInfo {
  auth: {
    userId: string;
    organizationId?: string;
    roles: string[];
  };
  user: {
    email?: string | null;
    phone: string;
    status: string;
  };
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = (await response.json()) as UserInfo | { auth: null; user: null };
          // Check if user is authenticated
          if (data.auth && data.user) {
            setUserInfo(data as UserInfo);
          } else {
            setUserInfo(null);
          }
        } else {
          setUserInfo(null);
        }
      } catch (error) {
        console.error('Failed to fetch user info', error);
        setUserInfo(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserInfo();
  }, []);

  async function handleLogout() {
    try {
      const isTenant = userInfo?.auth.roles.includes('TENANT');
      await fetch('/api/auth/logout', { method: 'POST' });
      setUserInfo(null);
      router.push(isTenant ? '/tenant/login' : '/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed', error);
    }
  }

  // Don't show header on homepage
  if (pathname === '/') {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">BMS</span>
          </Link>
          <nav className="hidden gap-4 md:flex">
            {userInfo?.auth.roles.includes('TENANT') ? (
              <Link href="/tenant/dashboard">
                <Button variant="ghost" size="sm">
                  Tenant Portal
                </Button>
              </Link>
            ) : userInfo ? (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  Admin
                </Button>
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <span className="text-sm text-muted-foreground">Loading...</span>
          ) : userInfo ? (
            <>
              <div className="hidden flex-col items-end md:flex">
                <span className="text-sm font-medium">
                  {userInfo.user.email ?? userInfo.user.phone}
                </span>
                <span className="text-xs text-muted-foreground">
                  {userInfo.auth.roles.join(', ')}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Link href="/tenant/signup">
                <Button variant="ghost" size="sm">
                  Sign Up
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm">Login</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
