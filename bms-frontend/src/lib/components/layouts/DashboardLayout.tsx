'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MainContentArea } from './MainContentArea';
import { CommandPalette } from '@/lib/components/search/CommandPalette';
import type { UserRole } from '@/lib/auth/types';

interface DashboardLayoutProps {
  children: ReactNode;
  userRoles: UserRole[];
}

export function DashboardLayout({ children, userRoles }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Keyboard shortcut for command palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        userRoles={userRoles}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          onMenuClick={() => setMobileMenuOpen(true)}
          onSearchClick={() => setCommandPaletteOpen(true)}
        />
        <MainContentArea>{children}</MainContentArea>
      </div>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  );
}
