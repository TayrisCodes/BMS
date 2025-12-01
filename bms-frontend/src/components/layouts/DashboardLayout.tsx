'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MainContentArea } from './MainContentArea';
import type { UserRole } from '@/lib/auth/types';

interface DashboardLayoutProps {
  children: ReactNode;
  userRoles: UserRole[];
}

export function DashboardLayout({ children, userRoles }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userRoles={userRoles}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileMenuOpen(true)} />
        <MainContentArea>{children}</MainContentArea>
      </div>
    </div>
  );
}

