import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { requireRole } from '@/lib/auth/guards';
import { SecurityMobileLayout } from '@/lib/components/layouts/SecurityMobileLayout';
import { ServiceWorkerRegistration } from '@/lib/components/pwa/ServiceWorkerRegistration';
import { OfflineBanner } from '@/lib/components/tenant/OfflineBanner';
import { ErrorBoundary } from '@/lib/components/tenant/ErrorBoundary';

/**
 * Layout guard for security portal routes.
 * Requires SECURITY role and uses TechnicianMobileLayout (mobile-friendly).
 */
export default async function SecurityLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  // Public routes that don't require authentication
  const publicRoutes: string[] = [];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );

  // Only require authentication for non-public routes
  if (!isPublicRoute) {
    // This will redirect to /login if not authenticated or not a security guard
    await requireRole(['SECURITY'], '/login');

    // Use SecurityMobileLayout for authenticated security routes
    return (
      <>
        <ServiceWorkerRegistration />
        <ErrorBoundary>
          <OfflineBanner />
          <SecurityMobileLayout>{children}</SecurityMobileLayout>
        </ErrorBoundary>
      </>
    );
  }

  // Public routes (if any) don't use TechnicianMobileLayout
  return (
    <>
      <ServiceWorkerRegistration />
      <ErrorBoundary>
        <OfflineBanner />
        {children}
      </ErrorBoundary>
    </>
  );
}
