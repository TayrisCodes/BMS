'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { SecurityMobileLayout } from '@/lib/components/layouts/SecurityMobileLayout';
import {
  QrCode,
  Camera,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  User,
  Phone,
  Building2,
} from 'lucide-react';

interface QRValidationResult {
  qrCode: {
    _id: string;
    visitorName: string;
    visitorPhone?: string | null;
    visitorIdNumber?: string | null;
    purpose: string;
    vehiclePlateNumber?: string | null;
    validFrom: string;
    validUntil: string;
    used: boolean;
    usedAt?: string | null;
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

export default function QRScannerPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [validationResult, setValidationResult] = useState<QRValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup camera stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera on mobile
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      }
    } catch (err) {
      setError('Failed to access camera. Please check permissions.');
      console.error('Camera error:', err);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }

  async function handleQRCodeInput(qrCodeValue: string) {
    if (!qrCodeValue || qrCodeValue.trim() === '') {
      setError('Please enter or scan a QR code');
      return;
    }

    setIsValidating(true);
    setError(null);
    setValidationResult(null);

    try {
      // First, get QR code details
      const result = await apiGet<{
        qrCode: QRValidationResult['qrCode'] & { qrCode: string };
        tenant?: any;
        unit?: any;
        building?: any;
      }>(`/api/visitor-qr-codes/validate?qrCode=${encodeURIComponent(qrCodeValue.trim())}`);

      setValidationResult({
        qrCode: {
          ...result.qrCode,
          qrCode: result.qrCode.qrCode || qrCodeValue.trim(),
        },
        tenant: result.tenant,
        unit: result.unit,
        building: result.building,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate QR code');
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  }

  async function handleLogEntry() {
    // Extract QR code from validation result
    const qrCodeValue = validationResult?.qrCode?.qrCode || qrCode;
    if (!qrCodeValue) {
      setError('No QR code to log');
      return;
    }

    setIsLogging(true);
    setError(null);

    try {
      const result = await apiPost<{
        message: string;
        visitorLog: any;
        tenant: any;
        unit: any;
        building: any;
      }>('/api/visitor-qr-codes/validate', {
        qrCode: qrCodeValue,
      });

      // Show success and redirect to visitors page
      alert('Visitor logged successfully!');
      router.push('/security/visitors');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log visitor entry');
    } finally {
      setIsLogging(false);
    }
  }

  function handleManualInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQrCode(e.target.value);
  }

  function handleManualSubmit() {
    handleQRCodeInput(qrCode);
  }

  return (
    <SecurityMobileLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">QR Code Scanner</h1>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">{error}</div>
        )}

        {/* Camera View */}
        {isScanning && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Camera Scanner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white rounded-lg w-64 h-64"></div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Position QR code within the frame
              </p>
              <Button onClick={stopCamera} variant="outline" className="w-full">
                Stop Camera
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Manual Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              {isScanning ? 'Manual Entry' : 'Scan or Enter QR Code'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isScanning && (
              <Button onClick={startCamera} className="w-full" variant="outline">
                <Camera className="h-4 w-4 mr-2" />
                Start Camera Scanner
              </Button>
            )}
            <div className="space-y-2">
              <input
                type="text"
                value={qrCode}
                onChange={handleManualInput}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Enter QR code or scan with camera"
                className="w-full px-3 py-2 border rounded-md"
              />
              <Button
                onClick={handleManualSubmit}
                disabled={isValidating || !qrCode.trim()}
                className="w-full"
              >
                {isValidating ? 'Validating...' : 'Validate QR Code'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Validation Result */}
        {validationResult && (
          <Card
            className={validationResult.qrCode.isValid ? 'border-green-500' : 'border-destructive'}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {validationResult.qrCode.isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                Validation Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Visitor Name</p>
                  <p className="font-medium">{validationResult.qrCode.visitorName}</p>
                </div>

                {validationResult.tenant && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Generated By (Tenant)
                    </p>
                    <p className="font-medium">
                      {validationResult.tenant.firstName} {validationResult.tenant.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {validationResult.tenant.primaryPhone}
                    </p>
                  </div>
                )}

                {validationResult.building && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Building
                    </p>
                    <p className="font-medium">{validationResult.building.name}</p>
                    {validationResult.building.address && (
                      <p className="text-sm text-muted-foreground">
                        {validationResult.building.address}
                      </p>
                    )}
                  </div>
                )}

                {validationResult.unit && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Destination
                    </p>
                    <p className="font-medium">
                      Unit {validationResult.unit.unitNumber}
                      {validationResult.unit.floor !== null &&
                        validationResult.unit.floor !== undefined && (
                          <span className="text-muted-foreground">
                            {' '}
                            - Floor {validationResult.unit.floor}
                          </span>
                        )}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {validationResult.unit.unitType}
                    </Badge>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Purpose</p>
                  <p className="font-medium">{validationResult.qrCode.purpose}</p>
                </div>

                {validationResult.qrCode.visitorPhone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Visitor Phone</p>
                    <p className="font-medium">{validationResult.qrCode.visitorPhone}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant={validationResult.qrCode.isValid ? 'default' : 'destructive'}>
                    {validationResult.qrCode.isValid ? 'Valid' : 'Invalid'}
                  </Badge>
                  {validationResult.qrCode.used && <Badge variant="secondary">Already Used</Badge>}
                </div>

                {validationResult.qrCode.isValid && !validationResult.qrCode.used && (
                  <Button
                    onClick={handleLogEntry}
                    disabled={isLogging}
                    className="w-full"
                    size="lg"
                  >
                    {isLogging ? 'Logging Entry...' : 'Log Visitor Entry'}
                  </Button>
                )}

                {!validationResult.qrCode.isValid && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                    {validationResult.qrCode.used
                      ? 'This QR code has already been used.'
                      : new Date(validationResult.qrCode.validUntil) < new Date()
                        ? 'This QR code has expired.'
                        : new Date(validationResult.qrCode.validFrom) > new Date()
                          ? 'This QR code is not yet valid.'
                          : 'QR code is invalid.'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SecurityMobileLayout>
  );
}
