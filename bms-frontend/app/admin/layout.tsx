import type { ReactNode } from 'react';
import { requireStaff } from '@/lib/auth/guards';
import { DashboardLayout } from '@/lib/components/layouts/DashboardLayout';

/**
 * Layout guard for admin/staff routes.
 * All routes under /admin/** require staff authentication.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // This will redirect to /login if not authenticated or not staff
  const context = await requireStaff();

  return <DashboardLayout userRoles={context.roles}>{children}</DashboardLayout>;
}
