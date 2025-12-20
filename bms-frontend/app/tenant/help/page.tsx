'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { Button } from '@/lib/components/ui/button';
import {
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  CreditCard,
  Wrench,
  Calendar,
} from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

const FAQ_CATEGORIES = [
  { value: 'all', label: 'All Questions' },
  { value: 'payments', label: 'Payments' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'lease', label: 'Lease' },
  { value: 'general', label: 'General' },
];

const FAQS: FAQ[] = [
  {
    category: 'payments',
    question: 'How do I make a payment?',
    answer:
      'You can make payments through the "Pay Now" button on your dashboard or from the Payments page. We accept Telebirr, CBE Birr, Chapa, HelloCash, and bank transfers. Select your preferred method and follow the instructions.',
  },
  {
    category: 'payments',
    question: 'When are payments due?',
    answer:
      'Payment due dates are shown on your invoices. Typically, payments are due within 7 days of invoice generation. You can check your next payment due date on your dashboard.',
  },
  {
    category: 'payments',
    question: 'What happens if I pay late?',
    answer:
      'Late payment penalties may apply as per your lease agreement. The penalty amount and calculation method are specified in your lease terms. Check your lease document for details.',
  },
  {
    category: 'maintenance',
    question: 'How do I submit a maintenance request?',
    answer:
      'Go to Complaints, select "Maintenance Request", choose the category (plumbing, electrical, HVAC, etc.), set the urgency level, and provide details. You can also upload photos to help us understand the issue better.',
  },
  {
    category: 'maintenance',
    question: 'How long does it take to resolve maintenance requests?',
    answer:
      'Response time depends on the urgency level. Emergency requests are prioritized and addressed immediately. High priority requests are typically handled within 24 hours, while medium and low priority requests are scheduled based on availability.',
  },
  {
    category: 'maintenance',
    question: 'Can I track the status of my maintenance request?',
    answer:
      'Yes! You can view the status of your maintenance requests in the Complaints section. If your request has been converted to a work order, you can track it in the Maintenance section.',
  },
  {
    category: 'lease',
    question: 'How do I view my lease document?',
    answer:
      'Go to the Lease page from your dashboard. You can view lease details, download documents, and see your lease terms and conditions. You can also preview documents before downloading.',
  },
  {
    category: 'lease',
    question: 'What should I do if my lease is expiring soon?',
    answer:
      "If your lease is expiring within the renewal notice period, you'll see a warning on your dashboard. Contact your building manager to discuss renewal options. You can also view your lease details to see the exact expiration date.",
  },
  {
    category: 'lease',
    question: 'Can I accept lease terms digitally?',
    answer:
      'Yes! On your Lease page, you can review the terms and conditions and accept them digitally. This creates a digital record of your acceptance.',
  },
  {
    category: 'general',
    question: 'How do I update my profile information?',
    answer:
      'Go to your Profile page from the bottom navigation. You can update your name, email, language preferences, communication preferences, and emergency contact information.',
  },
  {
    category: 'general',
    question: 'How do I change my password?',
    answer:
      'On your Profile page, scroll to the "Change Password" section. Enter your current password and your new password. Make sure your new password is at least 8 characters and includes uppercase, lowercase, number, and special character.',
  },
  {
    category: 'general',
    question: 'How do I contact my building manager?',
    answer:
      'You can contact your building manager through the "Contact Manager" button on this Help page. You can also submit a complaint or maintenance request, which will be reviewed by the building management team.',
  },
  {
    category: 'general',
    question: 'What should I do in case of an emergency?',
    answer:
      'For emergencies, call the emergency contact number provided by your building. You can also submit an urgent maintenance request through the app. For life-threatening emergencies, always call local emergency services first.',
  },
];

export default function TenantHelpPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFAQ, setExpandedFAQ] = useState<Set<string>>(new Set());
  const [buildingManager, setBuildingManager] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  } | null>(null);

  useEffect(() => {
    // Fetch building manager contact info
    async function fetchBuildingManager() {
      try {
        const response = await fetch('/api/tenant/building-manager');
        if (response.ok) {
          const data = await response.json();
          setBuildingManager(data);
        }
      } catch (error) {
        console.error('Failed to fetch building manager:', error);
      }
    }
    fetchBuildingManager();
  }, []);

  const filteredFAQs =
    selectedCategory === 'all' ? FAQS : FAQS.filter((faq) => faq.category === selectedCategory);

  const toggleFAQ = (index: number) => {
    const key = `faq-${index}`;
    const newExpanded = new Set(expandedFAQ);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedFAQ(newExpanded);
  };

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold mb-2">Help & Support</h1>
        <p className="text-muted-foreground">
          Find answers to common questions and get in touch with support.
        </p>
      </div>

      {/* Contact Building Manager */}
      <MobileCard>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contact Building Manager
          </h2>
          {buildingManager ? (
            <div className="space-y-3">
              {buildingManager.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{buildingManager.name}</span>
                </div>
              )}
              {buildingManager.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${buildingManager.phone}`} className="text-primary hover:underline">
                    {buildingManager.phone}
                  </a>
                </div>
              )}
              {buildingManager.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${buildingManager.email}`}
                    className="text-primary hover:underline"
                  >
                    {buildingManager.email}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Building manager contact information not available. Please contact your building
              administration.
            </p>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/tenant/complaints/new')}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Send Message
          </Button>
        </div>
      </MobileCard>

      {/* Emergency Contact */}
      <MobileCard className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <h2 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
              Emergency Contact
            </h2>
          </div>
          <p className="text-sm text-orange-800 dark:text-orange-200">
            For life-threatening emergencies, call local emergency services immediately.
          </p>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full border-orange-500 text-orange-700 dark:text-orange-300"
              onClick={() => {
                // This would typically open phone dialer
                window.location.href = 'tel:911';
              }}
            >
              <Phone className="mr-2 h-4 w-4" />
              Emergency Services: 911
            </Button>
            <Button
              variant="outline"
              className="w-full border-orange-500 text-orange-700 dark:text-orange-300"
              onClick={() =>
                router.push('/tenant/complaints/new?type=maintenance_request&urgency=emergency')
              }
            >
              <Wrench className="mr-2 h-4 w-4" />
              Submit Emergency Maintenance Request
            </Button>
          </div>
        </div>
      </MobileCard>

      {/* FAQ Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </h2>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {FAQ_CATEGORIES.map((category) => (
              <Button
                key={category.value}
                variant={selectedCategory === category.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.value)}
                className="whitespace-nowrap"
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>

        {/* FAQ List */}
        <div className="space-y-2">
          {filteredFAQs.map((faq, index) => {
            const key = `faq-${index}`;
            const isExpanded = expandedFAQ.has(key);

            return (
              <MobileCard key={index}>
                <button onClick={() => toggleFAQ(index)} className="w-full text-left space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{faq.question}</div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  {isExpanded && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </button>
              </MobileCard>
            );
          })}
        </div>
      </div>

      {/* Quick Links */}
      <MobileCard>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quick Links</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-3"
              onClick={() => router.push('/tenant/payments?action=pay')}
            >
              <CreditCard className="h-5 w-5" />
              <span className="text-xs">Make Payment</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-3"
              onClick={() => router.push('/tenant/complaints/new')}
            >
              <MessageSquare className="h-5 w-5" />
              <span className="text-xs">Submit Complaint</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-3"
              onClick={() => router.push('/tenant/complaints/new?type=maintenance_request')}
            >
              <Wrench className="h-5 w-5" />
              <span className="text-xs">Maintenance Request</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-3"
              onClick={() => router.push('/tenant/lease')}
            >
              <FileText className="h-5 w-5" />
              <span className="text-xs">View Lease</span>
            </Button>
          </div>
        </div>
      </MobileCard>
    </div>
  );
}

