'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/lib/utils';
import { Button } from '@/lib/components/ui/button';
import {
  Search,
  Bell,
  Sun,
  Moon,
  User,
  LogOut,
  Settings,
  X,
  Loader2,
  Menu,
  Circle,
} from 'lucide-react';

interface TopbarProps {
  onMenuClick?: () => void;
  onSearchClick?: () => void;
}

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  path: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export function Topbar({ onMenuClick, onSearchClick }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; roles: string[] } | null>(null);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'degraded' | 'down'>('healthy');
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Mount check for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user data
  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    }
    fetchUser();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || []);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch notifications
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const response = await fetch('/api/notifications');
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    }
    fetchNotifications();
  }, []);

  // Fetch system status
  useEffect(() => {
    async function fetchSystemStatus() {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          setSystemStatus('healthy');
        } else {
          setSystemStatus('degraded');
        }
      } catch (error) {
        setSystemStatus('down');
      }
    }
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
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
    return 'U';
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-16 shrink-0">
      <div className="flex h-full items-center gap-4 px-4">
        {/* Left section - Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Center section - Search */}
        <div ref={searchRef} className="flex-1 relative max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search buildings, tenants, invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                onSearchClick?.();
              }}
              className={cn(
                'w-full pl-10 pr-20 py-2 rounded-md border border-input bg-background text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'md:block hidden cursor-pointer',
              )}
              readOnly
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {/* Mobile search icon */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onSearchClick?.();
              }}
              className="md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
            {/* Desktop search hint */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 hidden md:flex items-center gap-1 text-xs text-muted-foreground pointer-events-none">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">K</kbd>
            </div>
          </div>

          {/* Search dropdown */}
          {searchFocused && (searchQuery || searchResults.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-96 overflow-y-auto z-50">
              {searchLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="p-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        router.push(result.path);
                        setSearchFocused(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <div className="font-medium text-sm">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                      )}
                    </button>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* System Status Indicator */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50"
            title={`System status: ${systemStatus}`}
          >
            <Circle
              className={cn(
                'h-2 w-2',
                systemStatus === 'healthy' && 'text-green-500 fill-green-500',
                systemStatus === 'degraded' && 'text-yellow-500 fill-yellow-500',
                systemStatus === 'down' && 'text-red-500 fill-red-500',
              )}
            />
            <span className="text-xs text-muted-foreground hidden lg:inline">
              {systemStatus === 'healthy' ? 'All Systems Operational' : 'System Issues Detected'}
            </span>
          </div>

          {/* Theme switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>

          {/* Notifications */}
          <div ref={notificationsRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifications"
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Notifications dropdown */}
            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                </div>
                <div className="divide-y divide-border">
                  {notifications.length > 0 ? (
                    notifications.slice(0, 20).map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'p-4 hover:bg-accent transition-colors',
                          !notification.read && 'bg-accent/50',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{notification.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {notification.message}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMarkAsRead(notification.id)}
                              aria-label="Mark as read"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No notifications
                    </div>
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        router.push('/admin/notifications');
                        setNotificationsOpen(false);
                      }}
                    >
                      View all
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setProfileOpen(!profileOpen)}
              className="rounded-full"
              aria-label="User menu"
            >
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                {getUserInitials()}
              </div>
            </Button>

            {/* Profile dropdown */}
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-popover border rounded-md shadow-lg z-50">
                <div className="p-4 border-b border-border">
                  <div className="font-medium text-sm">{user?.name || 'User'}</div>
                  <div className="text-xs text-muted-foreground">{user?.email}</div>
                  {user?.roles && user.roles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      router.push('/admin/profile');
                      setProfileOpen(false);
                    }}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      router.push('/admin/settings');
                      setProfileOpen(false);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                  <div className="border-t border-border my-1" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
