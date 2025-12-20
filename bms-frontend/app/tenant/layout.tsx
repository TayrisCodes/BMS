import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { requireTenant } from '@/lib/auth/guards';
import { TenantMobileLayout } from '@/lib/components/layouts/TenantMobileLayout';
import { ServiceWorkerRegistration } from '@/lib/components/pwa/ServiceWorkerRegistration';
import PWAInstallPrompt from '@/lib/components/pwa/PWAInstallPrompt';
import { PushNotificationPrompt } from '@/lib/components/pwa/PushNotificationPrompt';
import { OfflineBanner } from '@/lib/components/tenant/OfflineBanner';
import { ErrorBoundary } from '@/lib/components/tenant/ErrorBoundary';

/**
 * Layout guard for tenant portal routes.
 * Public routes (login, signup) don't require authentication.
 * Other routes require tenant authentication and use TenantMobileLayout.
 */
export default async function TenantLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  // Public routes that don't require authentication
  const publicRoutes = ['/tenant/login', '/tenant/signup'];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );

  // Only require authentication for non-public routes
  if (!isPublicRoute) {
    // This will redirect to /tenant/login if not authenticated or not a tenant
    await requireTenant();
    // Use TenantMobileLayout for authenticated tenant routes
    return (
      <>
        <ServiceWorkerRegistration />
        <ErrorBoundary>
          <OfflineBanner />
          <TenantMobileLayout>
            {children}
            <PWAInstallPrompt />
            <PushNotificationPrompt />
          </TenantMobileLayout>
        </ErrorBoundary>
      </>
    );
  }

  // Public routes (login, signup) don't use TenantMobileLayout
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
