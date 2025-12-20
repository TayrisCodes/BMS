'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { apiGet } from '@/lib/utils/api-client';
import { QrCode, Plus, Calendar, CheckCircle, XCircle, Download, Share2 } from 'lucide-react';
import Link from 'next/link';

interface QRCodeItem {
  _id: string;
  visitorName: string;
  visitorPhone?: string | null;
  purpose: string;
  validFrom: string;
  validUntil: string;
  used: boolean;
  usedAt?: string | null;
  buildingName: string;
  unitNumber: string | null;
  createdAt: string;
}

export default function TenantVisitorQRPage() {
  const router = useRouter();
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'used'>('active');

  useEffect(() => {
    async function fetchQRCodes() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ qrCodes: QRCodeItem[] }>(
          `/api/visitor-qr-codes?includeUsed=${filter === 'all'}`,
        );
        let filtered = data.qrCodes || [];

        if (filter === 'active') {
          filtered = filtered.filter((qr) => !qr.used && new Date(qr.validUntil) > new Date());
        } else if (filter === 'used') {
          filtered = filtered.filter((qr) => qr.used);
        }

        setQrCodes(filtered);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load QR codes');
      } finally {
        setIsLoading(false);
      }
    }

    fetchQRCodes();
  }, [filter]);

  function isQRCodeValid(qr: QRCodeItem): boolean {
    if (qr.used) return false;
    const now = new Date();
    return now >= new Date(qr.validFrom) && now <= new Date(qr.validUntil);
  }

  async function handleShare(qr: QRCodeItem) {
    // We need to get the actual QR code token from the API
    // For now, we'll use a different approach - fetch the QR code details
    try {
      const details = await apiGet<{ qrCode: { qrCode: string } }>(
        `/api/visitor-qr-codes/${qr._id}`,
      );
      const shareUrl = `${window.location.origin}/visitor-qr/${details.qrCode.qrCode}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: `Visitor QR Code for ${qr.visitorName}`,
            text: `Please use this QR code for your visit. Valid until ${new Date(qr.validUntil).toLocaleString()}`,
            url: shareUrl,
          });
        } catch (err) {
          // User cancelled
        }
      } else {
        try {
          await navigator.clipboard.writeText(shareUrl);
          alert('Share link copied to clipboard!');
        } catch (err) {
          setError('Failed to copy share link');
        }
      }
    } catch (err) {
      setError('Failed to get share link');
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Visitor QR Codes</h1>
        <Link href="/tenant/visitor-qr/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Generate New
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">{error}</div>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('active')}
        >
          Active
        </Button>
        <Button
          variant={filter === 'used' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('used')}
        >
          Used
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading QR codes...</p>
        </div>
      ) : qrCodes.length === 0 ? (
        <MobileCard>
          <div className="text-center py-8">
            <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No QR codes found</p>
            <Link href="/tenant/visitor-qr/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Your First QR Code
              </Button>
            </Link>
          </div>
        </MobileCard>
      ) : (
        <div className="space-y-3">
          {qrCodes.map((qr) => (
            <MobileCard key={qr._id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{qr.visitorName}</h3>
                    <p className="text-sm text-muted-foreground">{qr.purpose}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isQRCodeValid(qr) ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        {qr.used ? 'Used' : 'Expired'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Valid until:</span>
                    <span className="font-medium">{new Date(qr.validUntil).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Building:</span>{' '}
                    <span className="font-medium">{qr.buildingName}</span>
                  </div>
                  {qr.unitNumber && (
                    <div>
                      <span className="text-muted-foreground">Unit:</span>{' '}
                      <span className="font-medium">{qr.unitNumber}</span>
                    </div>
                  )}
                  {qr.used && qr.usedAt && (
                    <div className="text-muted-foreground text-xs">
                      Used on: {new Date(qr.usedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {isQRCodeValid(qr) && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const details = await apiGet<{ qrCode: { qrCode: string } }>(
                            `/api/visitor-qr-codes/${qr._id}`,
                          );
                          router.push(`/visitor-qr/${details.qrCode.qrCode}`);
                        } catch (err) {
                          setError('Failed to load QR code');
                        }
                      }}
                      className="flex-1"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      View QR
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare(qr)}
                      className="flex-1"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                )}
              </div>
            </MobileCard>
          ))}
        </div>
      )}
    </div>
  );
}
