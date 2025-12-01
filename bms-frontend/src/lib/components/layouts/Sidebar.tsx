'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/lib/utils';
import { getMenuItemsForRole } from '@/lib/navigation/menu-items';
import type { UserRole } from '@/lib/auth/types';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/lib/components/ui/button';

interface SidebarProps {
  userRoles: UserRole[];
  onMobileClose?: () => void;
  mobileOpen?: boolean;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function Sidebar({ userRoles, onMobileClose, mobileOpen = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) {
      setCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  const menuItems = getMenuItemsForRole(userRoles);

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const toggleExpandItem = (path: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (path: string) => {
    if (path === '/admin' || path === '/org') {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  const renderMenuItem = (item: (typeof menuItems)[0], level = 0) => {
    const active = isActive(item.path);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.path);

    return (
      <div key={item.path} className={cn(level > 0 && 'ml-4')}>
        <div className="relative group">
          <Link
            href={item.path}
            onClick={() => {
              if (hasChildren) {
                toggleExpandItem(item.path);
              } else {
                onMobileClose?.();
              }
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              active && 'bg-accent text-accent-foreground',
              collapsed && !hasChildren && 'justify-center px-2',
              level > 0 && 'text-sm',
            )}
          >
            <item.icon className={cn('h-5 w-5 shrink-0', collapsed && level === 0 && 'mx-auto')} />
            {(!collapsed || level > 0) && <span className="flex-1 truncate">{item.label}</span>}
            {hasChildren && !collapsed && (
              <ChevronRight
                className={cn('h-4 w-4 transition-transform', isExpanded && 'transform rotate-90')}
              />
            )}
          </Link>
          {collapsed && !hasChildren && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover border rounded-md shadow-md text-sm whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {item.label}
            </div>
          )}
        </div>
        {hasChildren && (isExpanded || collapsed) && !collapsed && (
          <div className="mt-1 space-y-1">
            {item.children?.map((child) => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50',
          'bg-background border-r border-border',
          'flex flex-col',
          'transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Logo/Brand section */}
        <div
          className={cn(
            'flex items-center justify-between p-4 border-b border-border',
            collapsed && 'justify-center px-2',
          )}
        >
          {!collapsed && (
            <Link href="/admin" className="font-bold text-lg">
              BMS
            </Link>
          )}
          {collapsed && <span className="font-bold text-lg">B</span>}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="h-8 w-8 md:flex hidden"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMobileClose}
              className="h-8 w-8 md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>

        {/* Mobile close hint */}
        {mobileOpen && (
          <div className="p-4 border-t border-border md:hidden">
            <Button variant="outline" onClick={onMobileClose} className="w-full">
              Close Menu
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
