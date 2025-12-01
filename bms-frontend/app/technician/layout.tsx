import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { requireRole } from '@/lib/auth/guards';
import { TechnicianMobileLayout } from '@/lib/components/layouts/TechnicianMobileLayout';
import { ServiceWorkerRegistration } from '@/lib/components/pwa/ServiceWorkerRegistration';
import { OfflineBanner } from '@/lib/components/tenant/OfflineBanner';
import { ErrorBoundary } from '@/lib/components/tenant/ErrorBoundary';

/**
 * Layout guard for technician portal routes.
 * Requires TECHNICIAN role and uses TechnicianMobileLayout.
 */
export default async function TechnicianLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  // Public routes that don't require authentication
  const publicRoutes: string[] = [];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );

  // Only require authentication for non-public routes
  if (!isPublicRoute) {
    // This will redirect to /login if not authenticated or not a technician
    await requireRole(['TECHNICIAN'], '/login');

    // Use TechnicianMobileLayout for authenticated technician routes
    return (
      <>
        <ServiceWorkerRegistration />
        <ErrorBoundary>
          <OfflineBanner />
          <TechnicianMobileLayout>{children}</TechnicianMobileLayout>
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
