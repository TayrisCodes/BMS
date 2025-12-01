'use client';

import { useEffect, useState } from 'react';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { Button } from '@/lib/components/ui/button';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { cn } from '@/lib/lib/utils';

interface LeaseData {
  leaseInfo: {
    startDate: string;
    endDate: string;
    rentAmount: number;
    status: string;
  };
  unitInfo: {
    number: string;
    buildingName: string;
    address: string;
  };
  terms: {
    deposit: number;
    utilitiesIncluded: boolean;
    petsAllowed: boolean;
    noticePeriod: number;
  };
  charges: Array<{
    name: string;
    amount: number;
    frequency: string;
  }>;
}

export default function TenantLeasePage() {
  const [lease, setLease] = useState<LeaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['leaseInfo']));

  useEffect(() => {
    async function fetchLease() {
      try {
        setLoading(true);
        const response = await fetch('/api/tenant/lease');
        if (response.ok) {
          const data = await response.json();
          setLease(data.lease || data);
        } else {
          setLease(null);
        }
      } catch (error) {
        console.error('Failed to fetch lease:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLease();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading lease information...</p>
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No lease information available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Download Lease Button */}
      <Button
        className="w-full h-12"
        variant="outline"
        onClick={() => {
          // TODO: Download lease PDF
          alert('Download lease PDF - feature coming soon');
        }}
      >
        <Download className="mr-2 h-4 w-4" />
        Download Lease Document
      </Button>

      {/* Lease Info Section */}
      <MobileCard>
        <button
          onClick={() => toggleSection('leaseInfo')}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-lg font-semibold">Lease Information</h2>
          {expandedSections.has('leaseInfo') ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
        {expandedSections.has('leaseInfo') && (
          <div className="mt-4 space-y-3 pt-4 border-t">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">
                {new Date(lease.leaseInfo.startDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span className="font-medium">
                {new Date(lease.leaseInfo.endDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Rent</span>
              <span className="font-medium">{formatCurrency(lease.leaseInfo.rentAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{lease.leaseInfo.status}</span>
            </div>
          </div>
        )}
      </MobileCard>

      {/* Unit Info Section */}
      <MobileCard>
        <button
          onClick={() => toggleSection('unitInfo')}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-lg font-semibold">Unit Information</h2>
          {expandedSections.has('unitInfo') ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
        {expandedSections.has('unitInfo') && (
          <div className="mt-4 space-y-3 pt-4 border-t">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unit Number</span>
              <span className="font-medium">{lease.unitInfo.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Building</span>
              <span className="font-medium">{lease.unitInfo.buildingName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address</span>
              <span className="font-medium text-right">{lease.unitInfo.address}</span>
            </div>
          </div>
        )}
      </MobileCard>

      {/* Terms Section */}
      <MobileCard>
        <button
          onClick={() => toggleSection('terms')}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-lg font-semibold">Terms & Conditions</h2>
          {expandedSections.has('terms') ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
        {expandedSections.has('terms') && (
          <div className="mt-4 space-y-3 pt-4 border-t">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit</span>
              <span className="font-medium">{formatCurrency(lease.terms.deposit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilities Included</span>
              <span className="font-medium">{lease.terms.utilitiesIncluded ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pets Allowed</span>
              <span className="font-medium">{lease.terms.petsAllowed ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notice Period</span>
              <span className="font-medium">{lease.terms.noticePeriod} days</span>
            </div>
          </div>
        )}
      </MobileCard>

      {/* Charges Section */}
      <MobileCard>
        <button
          onClick={() => toggleSection('charges')}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-lg font-semibold">Monthly Charges</h2>
          {expandedSections.has('charges') ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
        {expandedSections.has('charges') && (
          <div className="mt-4 space-y-3 pt-4 border-t">
            {lease.charges.map((charge, index) => (
              <div key={index} className="flex justify-between">
                <div>
                  <div className="font-medium">{charge.name}</div>
                  <div className="text-sm text-muted-foreground">{charge.frequency}</div>
                </div>
                <span className="font-medium">{formatCurrency(charge.amount)}</span>
              </div>
            ))}
            <div className="pt-3 border-t flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>
                {formatCurrency(lease.charges.reduce((sum, charge) => sum + charge.amount, 0))}
              </span>
            </div>
          </div>
        )}
      </MobileCard>
    </div>
  );
}
