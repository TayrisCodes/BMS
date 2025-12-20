'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { apiGet } from '@/lib/utils/api-client';
import { Building2, User, Phone, Calendar, MapPin, Download } from 'lucide-react';
import QRCode from 'qrcode';

interface QRCodeDetails {
  qrCode: {
    _id: string;
    visitorName: string;
    visitorPhone?: string | null;
    purpose: string;
    validFrom: string;
    validUntil: string;
    used: boolean;
    isValid: boolean;
  };
  tenant?: {
    _id: string;
    firstName: string;
    lastName: string;
    primaryPhone: string;
  } | null;
  unit?: {
    _id: string;
    unitNumber: string;
    floor?: number | null;
    unitType: string;
  } | null;
  building?: {
    _id: string;
    name: string;
    address?: string | null;
  } | null;
}

export default function ShareableQRCodePage() {
  const params = useParams();
  const code = params.code as string;
  const [details, setDetails] = useState<QRCodeDetails | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQRCodeDetails() {
      try {
        setIsLoading(true);
        const result = await apiGet<QRCodeDetails>(
          `/api/visitor-qr-codes/validate?qrCode=${encodeURIComponent(code)}`,
        );

        setDetails(result);

        // Generate QR code image
        // The code parameter is the QR code token, use it directly
        const qrData = code; // Use the QR code token directly

        const image = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          width: 400,
          margin: 2,
        });

        setQrCodeImage(image);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load QR code');
      } finally {
        setIsLoading(false);
      }
    }

    if (code) {
      fetchQRCodeDetails();
    }
  }, [code]);

  async function handleDownload() {
    if (!qrCodeImage) return;

    try {
      const response = await fetch(qrCodeImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visitor-qr-${details?.qrCode.visitorName.replace(/\s/g, '-') || 'code'}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download QR code');
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading QR code...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">{error || 'QR code not found'}</p>
              <p className="text-sm text-muted-foreground">
                This QR code may be invalid, expired, or already used.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isValid = details.qrCode.isValid && !details.qrCode.used;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-md mx-auto">
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Visitor QR Code</h1>
                <p className="text-muted-foreground">Present this at the security gate</p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                {qrCodeImage && (
                  <div className="relative">
                    <img
                      src={qrCodeImage}
                      alt="Visitor QR Code"
                      className="w-64 h-64 border-4 border-white rounded-lg shadow-lg"
                    />
                    {!isValid && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <Badge variant="destructive" className="text-lg px-4 py-2">
                          {details.qrCode.used ? 'Used' : 'Expired'}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex justify-center">
                <Badge variant={isValid ? 'default' : 'destructive'} className="text-sm px-4 py-1">
                  {isValid ? 'Valid' : details.qrCode.used ? 'Already Used' : 'Expired'}
                </Badge>
              </div>

              {/* Visitor Info */}
              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                    <User className="h-4 w-4" />
                    Visitor Name
                  </p>
                  <p className="font-semibold text-lg">{details.qrCode.visitorName}</p>
                </div>

                {details.tenant && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                      <User className="h-4 w-4" />
                      Host (Tenant)
                    </p>
                    <p className="font-medium">
                      {details.tenant.firstName} {details.tenant.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Phone className="h-4 w-4" />
                      {details.tenant.primaryPhone}
                    </p>
                  </div>
                )}

                {details.building && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4" />
                      Building
                    </p>
                    <p className="font-medium">{details.building.name}</p>
                    {details.building.address && (
                      <p className="text-sm text-muted-foreground">{details.building.address}</p>
                    )}
                  </div>
                )}

                {details.unit && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4" />
                      Destination
                    </p>
                    <p className="font-medium">
                      Unit {details.unit.unitNumber}
                      {details.unit.floor !== null && details.unit.floor !== undefined && (
                        <span className="text-muted-foreground"> - Floor {details.unit.floor}</span>
                      )}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {details.unit.unitType}
                    </Badge>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Purpose</p>
                  <p className="font-medium">{details.qrCode.purpose}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4" />
                    Valid Until
                  </p>
                  <p className="font-medium">
                    {new Date(details.qrCode.validUntil).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Download Button */}
              {qrCodeImage && (
                <div className="border-t pt-4">
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download QR Code
                  </button>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground border-t pt-4">
                <p>Show this QR code to security at the gate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
