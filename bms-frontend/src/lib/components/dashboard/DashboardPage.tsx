import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/lib/utils';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface DashboardPageProps {
  title?: string;
  breadcrumbs?: Breadcrumb[];
  children: ReactNode;
  className?: string;
}

export function DashboardPage({ title, breadcrumbs, children, className }: DashboardPageProps) {
  return (
    <div className={cn('space-y-6 p-6', className)}>
      {(title || breadcrumbs) && (
        <div className="space-y-2">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
              aria-label="Breadcrumb"
            >
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors font-medium"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{crumb.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </nav>
          )}
          {title && <h1 className="text-3xl font-bold tracking-tight">{title}</h1>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}
