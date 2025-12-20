import type { ComponentType } from 'react';
import type { UserRole } from '@/lib/auth/types';
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileText,
  CreditCard,
  MessageSquare,
  Wrench,
  Package,
  Gauge,
  BarChart3,
  Settings,
  Shield,
  FileCheck,
  Car,
  UserCheck,
  Clock,
  Receipt,
  TrendingUp,
  AlertCircle,
  Activity,
  Flag,
  DollarSign,
  Bot,
} from 'lucide-react';

export interface MenuItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
  roles: UserRole[];
  children?: MenuItem[];
}

export const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin',
    roles: [
      'SUPER_ADMIN',
      'ORG_ADMIN',
      'BUILDING_MANAGER',
      'FACILITY_MANAGER',
      'ACCOUNTANT',
      'SECURITY',
      'TECHNICIAN',
      'AUDITOR',
    ],
  },
  {
    label: 'Organizations',
    icon: Building2,
    path: '/admin/organizations',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'System Settings',
    icon: Settings,
    path: '/admin/settings',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Monitoring',
    icon: Activity,
    path: '/admin/monitoring',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Subscriptions',
    icon: CreditCard,
    path: '/admin/subscriptions',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    path: '/admin/analytics',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Users',
    icon: Users,
    path: '/admin/users',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Audit Logs',
    icon: FileCheck,
    path: '/admin/audit-logs',
    roles: ['SUPER_ADMIN', 'AUDITOR'],
  },
  {
    label: 'Feature Flags',
    icon: Flag,
    path: '/admin/feature-flags',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Buildings',
    icon: Building2,
    path: '/org/buildings',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER'],
  },
  {
    label: 'Units',
    icon: DoorOpen,
    path: '/org/units',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER'],
  },
  {
    label: 'Tenants',
    icon: Users,
    path: '/org/tenants',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER'],
  },
  {
    label: 'Leases',
    icon: FileText,
    path: '/org/leases',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER'],
  },
  {
    label: 'Invoices',
    icon: Receipt,
    path: '/org/invoices',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'ACCOUNTANT'],
  },
  {
    label: 'Payments',
    icon: CreditCard,
    path: '/org/payments',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'ACCOUNTANT'],
  },
  {
    label: 'Messages',
    icon: MessageSquare,
    path: '/org/messages',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER'],
  },
  {
    label: 'Assistant',
    icon: Bot,
    path: '/org/bot',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'ACCOUNTANT'],
  },
  {
    label: 'Complaints',
    icon: MessageSquare,
    path: '/org/complaints',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER'],
  },
  {
    label: 'Work Orders',
    icon: Wrench,
    path: '/org/work-orders',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'TECHNICIAN'],
  },
  {
    label: 'Assets',
    icon: Package,
    path: '/org/assets',
    roles: ['ORG_ADMIN', 'FACILITY_MANAGER', 'TECHNICIAN'],
  },
  {
    label: 'Meters',
    icon: Gauge,
    path: '/org/meters',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    path: '/org/reports',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'ACCOUNTANT', 'AUDITOR'],
  },
  {
    label: 'Security',
    icon: Shield,
    path: '/org/security',
    roles: ['ORG_ADMIN'],
    children: [
      {
        label: 'Visitor Management',
        icon: UserCheck,
        path: '/org/security',
        roles: ['ORG_ADMIN'],
      },
      {
        label: 'Visitor Logs',
        icon: UserCheck,
        path: '/org/security/visitors',
        roles: ['ORG_ADMIN'],
      },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    path: '/org/settings',
    roles: ['ORG_ADMIN'],
    children: [
      {
        label: 'Organization',
        icon: Building2,
        path: '/org/settings/organization',
        roles: ['ORG_ADMIN'],
      },
      {
        label: 'Users & Roles',
        icon: Users,
        path: '/org/settings/users',
        roles: ['ORG_ADMIN'],
      },
      {
        label: 'Payment Integration',
        icon: CreditCard,
        path: '/org/settings/payments',
        roles: ['ORG_ADMIN'],
      },
    ],
  },
  {
    label: 'Utilities',
    icon: Gauge,
    path: '/org/meters',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'],
    children: [
      {
        label: 'Meters',
        icon: Gauge,
        path: '/org/meters',
        roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'],
      },
      {
        label: 'Utility Payments',
        icon: Receipt,
        path: '/org/utilities/payments',
        roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'],
      },
    ],
  },
  {
    label: 'Maintenance Schedules',
    icon: Clock,
    path: '/org/maintenance-schedules',
    roles: ['FACILITY_MANAGER'],
  },
  {
    label: 'Financial',
    icon: TrendingUp,
    path: '/org/financial',
    roles: ['ACCOUNTANT'],
  },
  {
    label: 'Transactions',
    icon: Receipt,
    path: '/org/transactions',
    roles: ['ACCOUNTANT'],
  },
  {
    label: 'Visitors',
    icon: UserCheck,
    path: '/org/visitors',
    roles: ['SECURITY'],
  },
  {
    label: 'Parking',
    icon: Car,
    path: '/org/parking/spaces',
    roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'SECURITY'],
    children: [
      {
        label: 'Parking Spaces',
        icon: Car,
        path: '/org/parking/spaces',
        roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'SECURITY'],
      },
      {
        label: 'Tenant Parking',
        icon: Car,
        path: '/org/parking/tenants',
        roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'SECURITY'],
      },
      {
        label: 'Visitor Parking',
        icon: UserCheck,
        path: '/org/parking/visitors',
        roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'SECURITY'],
      },
      {
        label: 'Pricing',
        icon: DollarSign,
        path: '/org/parking/pricing',
        roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'],
      },
      {
        label: 'Revenue',
        icon: TrendingUp,
        path: '/org/parking/revenue',
        roles: ['ORG_ADMIN', 'BUILDING_MANAGER', 'ACCOUNTANT'],
      },
    ],
  },
  {
    label: 'Access Logs',
    icon: Shield,
    path: '/org/access-logs',
    roles: ['SECURITY'],
  },
  {
    label: 'Security Incidents',
    icon: AlertCircle,
    path: '/org/security-incidents',
    roles: ['SECURITY'],
  },
  {
    label: 'My Work Orders',
    icon: Wrench,
    path: '/org/my-work-orders',
    roles: ['TECHNICIAN'],
  },
  {
    label: 'Tools',
    icon: Package,
    path: '/org/tools',
    roles: ['TECHNICIAN'],
  },
  {
    label: 'Schedule',
    icon: Clock,
    path: '/org/schedule',
    roles: ['TECHNICIAN'],
  },
  {
    label: 'Financial Reports',
    icon: BarChart3,
    path: '/org/financial-reports',
    roles: ['AUDITOR'],
  },
];

/**
 * Filters menu items based on user roles.
 * Returns menu items that match at least one of the user's roles.
 */
export function getMenuItemsForRole(userRoles: UserRole[]): MenuItem[] {
  return menuItems
    .filter((item) => item.roles.some((role) => userRoles.includes(role)))
    .map((item) => {
      // Filter children if they exist
      if (item.children) {
        return {
          ...item,
          children: item.children.filter((child) =>
            child.roles.some((role) => userRoles.includes(role)),
          ),
        };
      }
      return item;
    });
}
