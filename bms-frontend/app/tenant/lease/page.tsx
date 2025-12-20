'use client';

import { useEffect, useState } from 'react';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { Button } from '@/lib/components/ui/button';
import { ChevronDown, ChevronUp, Download, Eye, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/lib/utils';

interface LeaseData {
  id: string;
  leaseInfo: {
    startDate: string;
    endDate: string;
    rentAmount: number;
    serviceCharges?: number;
    status: string;
    billingCycle?: string;
    paymentDueDays?: number | null;
    nextInvoiceDate?: string | null;
    penaltyConfig?: {
      lateFeeRatePerDay?: number | null;
      lateFeeGraceDays?: number | null;
      lateFeeCapDays?: number | null;
    } | null;
    customTermsText?: string | null;
    termsAccepted?: { userId: string; role?: string | null; acceptedAt: string }[] | null;
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
    customText?: string | null;
  };
  charges: Array<{
    name: string;
    amount: number;
    frequency: string;
  }>;
  documents?: {
    _id?: string;
    filename: string;
    gridFsId: string;
    contentType?: string;
    size?: number;
  }[];
}

export default function TenantLeasePage() {
  const [lease, setLease] = useState<LeaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['leaseInfo']));
  const [accepting, setAccepting] = useState(false);
  const [acceptMessage, setAcceptMessage] = useState<string | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<{
    url: string;
    filename: string;
    contentType: string;
  } | null>(null);

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

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return 'N/A';
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

  const hasAccepted = lease?.leaseInfo.termsAccepted && lease.leaseInfo.termsAccepted.length > 0;

  async function handleAcceptTerms() {
    if (!lease) return;
    setAccepting(true);
    setAcceptMessage(null);
    try {
      const res = await fetch(`/api/leases/${lease.id}/accept-terms`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to accept terms');
      }
      setAcceptMessage('Terms accepted. Thank you.');
      const refreshed = await fetch('/api/tenant/lease').then((r) => r.json());
      setLease(refreshed.lease || refreshed);
    } catch (err) {
      setAcceptMessage(err instanceof Error ? err.message : 'Failed to accept terms');
    } finally {
      setAccepting(false);
    }
  }

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
      <Button className="w-full h-12" variant="outline" asChild disabled={!lease.id}>
        <a href={`/api/leases/${lease.id}/pdf`} target="_blank" rel="noreferrer">
          <Download className="mr-2 h-4 w-4" />
          Download Lease Document
        </a>
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
            {lease.leaseInfo.serviceCharges !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Charges</span>
                <span className="font-medium">
                  {formatCurrency(lease.leaseInfo.serviceCharges)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{lease.leaseInfo.status}</span>
            </div>
            {lease.leaseInfo.nextInvoiceDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Invoice</span>
                <span className="font-medium">
                  {new Date(lease.leaseInfo.nextInvoiceDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {lease.leaseInfo.paymentDueDays !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Due</span>
                <span className="font-medium">
                  {lease.leaseInfo.paymentDueDays} days after invoice
                </span>
              </div>
            )}
            {lease.leaseInfo.penaltyConfig?.lateFeeRatePerDay && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Late Fee</span>
                <span className="font-medium">
                  {(lease.leaseInfo.penaltyConfig.lateFeeRatePerDay * 100).toFixed(2)}% per day
                  {lease.leaseInfo.penaltyConfig.lateFeeGraceDays
                    ? ` after ${lease.leaseInfo.penaltyConfig.lateFeeGraceDays} days`
                    : ''}
                </span>
              </div>
            )}
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
            {lease.terms.customText && (
              <div className="pt-3 border-t">
                <div className="text-muted-foreground text-sm mb-1">Terms & Conditions</div>
                <p className="whitespace-pre-wrap text-sm">{lease.terms.customText}</p>
              </div>
            )}
            <div className="pt-3">
              <Button
                onClick={handleAcceptTerms}
                disabled={accepting || hasAccepted}
                className="w-full"
              >
                {hasAccepted ? 'Terms Accepted' : accepting ? 'Submitting...' : 'Accept Terms'}
              </Button>
              {acceptMessage && (
                <p className="text-sm text-muted-foreground mt-2">{acceptMessage}</p>
              )}
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

      {/* Documents Section */}
      {lease.documents && lease.documents.length > 0 && (
        <MobileCard>
          <div className="w-full flex items-center justify-between">
            <h2 className="text-lg font-semibold">Documents ({lease.documents.length})</h2>
          </div>
          <div className="mt-4 space-y-3 pt-4 border-t">
            {lease.documents.map((doc) => {
              const isPdf = doc.contentType === 'application/pdf';
              const isImage = doc.contentType?.startsWith('image/');
              const docUrl = `/api/leases/${lease.id}/documents/${doc.gridFsId}`;
              const fileSize = doc.size
                ? doc.size > 1024 * 1024
                  ? `${(doc.size / (1024 * 1024)).toFixed(2)} MB`
                  : `${(doc.size / 1024).toFixed(2)} KB`
                : '';

              return (
                <div
                  key={doc._id || doc.gridFsId}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isPdf ? (
                      <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                    ) : isImage ? (
                      <ImageIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{doc.filename}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {fileSize && <span>{fileSize}</span>}
                        {doc.contentType && (
                          <>
                            {fileSize && <span>•</span>}
                            <span className="capitalize">
                              {doc.contentType.split('/')[1] || doc.contentType}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(isPdf || isImage) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPreviewingDoc({
                            url: docUrl,
                            filename: doc.filename,
                            contentType: doc.contentType || 'application/pdf',
                          });
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.open(docUrl, '_blank');
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </MobileCard>
      )}

      {/* Document Preview Modal */}
      {previewingDoc && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewingDoc(null)}
        >
          <div className="relative w-full h-[90vh] max-w-4xl bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="bg-black/50 text-white hover:bg-black/70"
                onClick={() => {
                  window.open(previewingDoc.url, '_blank');
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="bg-black/50 text-white hover:bg-black/70"
                onClick={() => setPreviewingDoc(null)}
              >
                ×
              </Button>
            </div>
            {previewingDoc.contentType.startsWith('image/') ? (
              <img
                src={previewingDoc.url}
                alt={previewingDoc.filename}
                className="w-full h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <iframe
                src={previewingDoc.url}
                className="w-full h-full"
                title={previewingDoc.filename}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
