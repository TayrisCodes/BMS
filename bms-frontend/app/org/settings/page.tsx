'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Building2, Users, CreditCard, ArrowRight } from 'lucide-react';

export default function OrgSettingsPage() {
  const settingsItems = [
    {
      title: 'Organization',
      description: 'Manage organization details, contact information, and general settings',
      icon: Building2,
      href: '/org/settings/organization',
    },
    {
      title: 'Users & Roles',
      description: 'Manage users, assign roles, and configure permissions',
      icon: Users,
      href: '/org/settings/users',
    },
    {
      title: 'Payment Integration',
      description: 'Configure payment providers and payment settings',
      icon: CreditCard,
      href: '/org/settings/payments',
    },
  ];

  return (
    <DashboardPage
      title="Settings"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Settings', href: '/org/settings' },
      ]}
    >
      <div className="col-span-full">
        <p className="text-muted-foreground mb-6">
          Manage your organization settings and configurations
        </p>
      </div>

      <div className="col-span-full grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                  <CardDescription className="mt-2">{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-primary text-sm font-medium">
                    Configure
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </DashboardPage>
  );
}
