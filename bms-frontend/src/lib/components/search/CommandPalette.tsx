'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/lib/components/ui/dialog';
import { Input } from '@/lib/components/ui/input';
import { Badge } from '@/lib/components/ui/badge';
import { cn } from '@/lib/lib/utils';
import {
  Search,
  Building2,
  Users,
  FileText,
  CreditCard,
  Settings,
  BarChart3,
  Activity,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

interface Command {
  id: string;
  type: 'action' | 'search';
  title: string;
  subtitle?: string;
  path?: string;
  icon?: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  path: string;
}

const COMMANDS: Command[] = [
  {
    id: 'dashboard',
    type: 'action',
    title: 'Go to Dashboard',
    path: '/admin',
    icon: BarChart3,
    keywords: ['dashboard', 'home', 'main'],
  },
  {
    id: 'organizations',
    type: 'action',
    title: 'Organizations',
    path: '/admin/organizations',
    icon: Building2,
    keywords: ['organizations', 'orgs', 'companies'],
  },
  {
    id: 'users',
    type: 'action',
    title: 'Users',
    path: '/admin/users',
    icon: Users,
    keywords: ['users', 'people', 'staff'],
  },
  {
    id: 'subscriptions',
    type: 'action',
    title: 'Subscriptions',
    path: '/admin/subscriptions',
    icon: CreditCard,
    keywords: ['subscriptions', 'plans', 'billing'],
  },
  {
    id: 'analytics',
    type: 'action',
    title: 'Analytics',
    path: '/admin/analytics',
    icon: BarChart3,
    keywords: ['analytics', 'reports', 'stats'],
  },
  {
    id: 'monitoring',
    type: 'action',
    title: 'System Monitoring',
    path: '/admin/monitoring',
    icon: Activity,
    keywords: ['monitoring', 'health', 'status'],
  },
  {
    id: 'settings',
    type: 'action',
    title: 'Settings',
    path: '/admin/settings',
    icon: Settings,
    keywords: ['settings', 'config', 'preferences'],
  },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = COMMANDS.filter((cmd) => {
    if (!query.trim()) return true;
    const searchTerm = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(searchTerm) ||
      cmd.keywords?.some((kw) => kw.toLowerCase().includes(searchTerm))
    );
  });

  const allResults = [
    ...filteredCommands.map((cmd) => ({
      id: cmd.id,
      type: 'command',
      title: cmd.title,
      subtitle: cmd.subtitle,
      path: cmd.path,
      icon: cmd.icon,
    })),
    ...searchResults.map((result) => ({
      ...result,
      icon: getIconForType(result.type),
    })),
  ];

  function getIconForType(type: string) {
    switch (type) {
      case 'organization':
        return Building2;
      case 'user':
        return Users;
      case 'building':
        return Building2;
      case 'tenant':
        return Users;
      default:
        return FileText;
    }
  }

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setSearchResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const data = await apiGet<{ results: SearchResult[] }>(
          `/api/admin/search?q=${encodeURIComponent(query)}`,
        );
        setSearchResults(data.results || []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= allResults.length) {
      setSelectedIndex(0);
    }
  }, [allResults.length, selectedIndex]);

  function handleSelect(result: (typeof allResults)[0]) {
    if (result.path) {
      router.push(result.path);
      onOpenChange(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allResults.length) % allResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex items-center border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search or run a command... (Type to search, ↑↓ to navigate, Enter to select)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
          />
          {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {allResults.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {query.trim() ? 'No results found' : 'Start typing to search...'}
            </div>
          ) : (
            <div className="py-2">
              {filteredCommands.length > 0 && query.length < 2 && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                    Quick Actions
                  </div>
                  {filteredCommands.map((cmd, index) => {
                    const Icon = cmd.icon;
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => handleSelect(cmd)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-accent transition-colors',
                          isSelected && 'bg-accent',
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                        <div className="flex-1">
                          <div className="font-medium">{cmd.title}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </>
              )}

              {allResults.length > 0 && (
                <>
                  {query.length >= 2 && (
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                      {searchResults.length > 0 ? 'Search Results' : 'Quick Actions'}
                    </div>
                  )}
                  {allResults.map((result, index) => {
                    const Icon = result.icon;
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-accent transition-colors',
                          isSelected && 'bg-accent',
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                        <div className="flex-1">
                          <div className="font-medium">{result.title}</div>
                          {result.subtitle && (
                            <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {result.type}
                        </Badge>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>Press Esc to close</span>
          <span>↑↓ Navigate • Enter Select</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}





