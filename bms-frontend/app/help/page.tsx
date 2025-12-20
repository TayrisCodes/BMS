'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Input } from '@/lib/components/ui/input';
import { Button } from '@/lib/components/ui/button';
import { Search, HelpCircle, Book, Video, MessageSquare, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{
    title: string;
    description: string;
    link?: string;
  }>;
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of using BMS',
    icon: Book,
    items: [
      {
        title: 'Welcome to BMS',
        description: 'Introduction to the Building Management System',
        link: '/help/getting-started/welcome',
      },
      {
        title: 'Creating Your First Organization',
        description: 'Step-by-step guide to setting up your organization',
        link: '/help/getting-started/organization',
      },
      {
        title: 'Adding Buildings and Units',
        description: 'How to add and manage buildings and units',
        link: '/help/getting-started/buildings',
      },
      {
        title: 'Onboarding Tenants',
        description: 'Guide to adding and managing tenants',
        link: '/help/getting-started/tenants',
      },
    ],
  },
  {
    id: 'features',
    title: 'Features',
    description: 'Explore BMS features',
    icon: HelpCircle,
    items: [
      {
        title: 'Billing & Payments',
        description: 'Manage invoices and payment processing',
        link: '/help/features/billing',
      },
      {
        title: 'Maintenance Management',
        description: 'Track work orders and maintenance requests',
        link: '/help/features/maintenance',
      },
      {
        title: 'Complaints & Requests',
        description: 'Handle tenant complaints and service requests',
        link: '/help/features/complaints',
      },
      {
        title: 'Reports & Analytics',
        description: 'Generate reports and view analytics',
        link: '/help/features/reports',
      },
    ],
  },
  {
    id: 'tutorials',
    title: 'Video Tutorials',
    description: 'Watch step-by-step video guides',
    icon: Video,
    items: [
      {
        title: 'Getting Started Video',
        description: 'Watch a quick overview of BMS',
      },
      {
        title: 'Managing Tenants',
        description: 'Learn how to manage tenant information',
      },
      {
        title: 'Processing Payments',
        description: 'Step-by-step payment processing guide',
      },
      {
        title: 'Generating Reports',
        description: 'How to create and export reports',
      },
    ],
  },
];

const faqs = [
  {
    question: 'How do I reset my password?',
    answer:
      'You can reset your password from the settings page or by contacting your administrator.',
  },
  {
    question: 'How do I add a new building?',
    answer:
      'Navigate to Buildings in the sidebar, click "Add Building", and fill in the required information.',
  },
  {
    question: 'Can I export data?',
    answer:
      'Yes, most pages have export functionality. Look for the export button in the top right of data tables.',
  },
  {
    question: 'How do I process a payment?',
    answer: 'Navigate to the tenant\'s page, find the invoice, and click "Process Payment".',
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = helpSections.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  }));

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-muted-foreground">Find answers and learn how to use BMS</p>
      </div>

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" asChild>
          <Link href="/tenant/messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Ask for Help
          </Link>
        </Button>
      </div>

      {!searchQuery && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {helpSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-primary" />
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`#${section.id}`}>
                      Explore <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-8">
        {filteredSections.map((section) => {
          if (section.items.length === 0) return null;
          const Icon = section.icon;
          return (
            <div key={section.id} id={section.id}>
              <div className="flex items-center gap-3 mb-4">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold">{section.title}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((item, index) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                      {item.link && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={item.link}>
                            Learn more <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        <div id="faq">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {filteredFaqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-base">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
