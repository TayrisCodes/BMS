'use client';

import { useEffect, useState } from 'react';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileForm, MobileFormField } from '@/lib/components/tenant/MobileForm';
import { Button } from '@/lib/components/ui/button';
import { Loader2, QrCode, Download, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Image from 'next/image';

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
}

interface VisitorQRCode {
  _id: string;
  visitorName: string;
  visitorPhone?: string | null;
  purpose: string;
  vehiclePlateNumber?: string | null;
  validFrom: string;
  validUntil: string;
  used: boolean;
  usedAt?: string | null;
  buildingName: string;
  unitNumber?: string | null;
  qrCodeImage?: string;
  qrCode?: string;
  createdAt: string;
}

export default function VisitorQRCodesPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [qrCodes, setQRCodes] = useState<VisitorQRCode[]>([]);
  const [generatedQR, setGeneratedQR] = useState<VisitorQRCode | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    buildingId: '',
    unitId: '',
    visitorName: '',
    visitorPhone: '',
    visitorIdNumber: '',
    purpose: '',
    vehiclePlateNumber: '',
    validUntil: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch tenant lease to get building and unit
        const leaseResponse = await fetch('/api/tenant/lease');
        if (leaseResponse.ok) {
          const leaseData = await leaseResponse.json();
          if (leaseData.lease && leaseData.lease.unitInfo) {
            const unitInfo = leaseData.lease.unitInfo;

            // If we have a buildingId, fetch the building
            if (unitInfo.buildingId) {
              const buildingResponse = await fetch(`/api/buildings/${unitInfo.buildingId}`);
              if (buildingResponse.ok) {
                const building = await buildingResponse.json();
                setBuildings([building]);
                // Set building as default selection
                setFormData((prev) => ({ ...prev, buildingId: building._id }));
              }
            }

            // If we have a unitId, fetch the unit
            if (unitInfo.unitId) {
              const unitResponse = await fetch(`/api/units/${unitInfo.unitId}`);
              if (unitResponse.ok) {
                const unit = await unitResponse.json();
                setUnits([unit]);
                setFormData((prev) => ({ ...prev, unitId: unit._id }));
              }
            }
          }
        }

        // Fetch existing QR codes
        const qrResponse = await fetch('/api/visitor-qr-codes?includeUsed=false');
        if (qrResponse.ok) {
          const qrData = await qrResponse.json();
          setQRCodes(qrData.qrCodes || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setErrors({ fetch: 'Failed to load data. Please try again.' });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGenerating(true);
    setErrors({});
    setGeneratedQR(null);

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.buildingId) {
      newErrors.buildingId = 'Building is required';
    }
    if (!formData.visitorName.trim()) {
      newErrors.visitorName = 'Visitor name is required';
    }
    if (!formData.purpose.trim()) {
      newErrors.purpose = 'Purpose is required';
    }
    if (!formData.validUntil) {
      newErrors.validUntil = 'Valid until date/time is required';
    } else {
      const validUntil = new Date(formData.validUntil);
      if (validUntil <= new Date()) {
        newErrors.validUntil = 'Valid until must be in the future';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setGenerating(false);
      return;
    }

    try {
      const response = await fetch('/api/visitor-qr-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buildingId: formData.buildingId,
          unitId: formData.unitId || null,
          visitorName: formData.visitorName.trim(),
          visitorPhone: formData.visitorPhone.trim() || null,
          visitorIdNumber: formData.visitorIdNumber.trim() || null,
          purpose: formData.purpose.trim(),
          vehiclePlateNumber: formData.vehiclePlateNumber.trim().toUpperCase() || null,
          validUntil: formData.validUntil,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedQR(data.qrCode);
        setQRCodes([data.qrCode, ...qrCodes]);

        // Reset form
        setFormData({
          buildingId: formData.buildingId,
          unitId: formData.unitId,
          visitorName: '',
          visitorPhone: '',
          visitorIdNumber: '',
          purpose: '',
          vehiclePlateNumber: '',
          validUntil: '',
        });

        // Scroll to generated QR code
        setTimeout(() => {
          document.getElementById('generated-qr')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        const errorData = await response.json();
        setErrors({ submit: errorData.error || 'Failed to generate QR code' });
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      setErrors({ submit: 'Failed to generate QR code. Please try again.' });
    } finally {
      setGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!generatedQR?.qrCodeImage) return;

    const link = document.createElement('a');
    link.href = generatedQR.qrCodeImage;
    link.download = `visitor-qr-${generatedQR.visitorName.replace(/\s+/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold mb-2">Visitor QR Codes</h1>
        <p className="text-muted-foreground">
          Generate QR codes for your visitors. Security can scan these codes to automatically log
          visitor entry.
        </p>
      </div>

      {/* Generate QR Code Form */}
      <MobileCard>
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Generate Visitor QR Code</h2>
        </div>

        <MobileForm onSubmit={handleSubmit} isLoading={generating} submitLabel="Generate QR Code">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="buildingId" className="text-base font-medium">
                Building
              </label>
              <select
                id="buildingId"
                name="buildingId"
                value={formData.buildingId}
                onChange={(e) => setFormData({ ...formData, buildingId: e.target.value })}
                className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="">Select building</option>
                {buildings.map((building) => (
                  <option key={building._id} value={building._id}>
                    {building.name}
                  </option>
                ))}
              </select>
              {errors.buildingId && <p className="text-sm text-destructive">{errors.buildingId}</p>}
            </div>

            {units.length > 0 && (
              <div className="space-y-2">
                <label htmlFor="unitId" className="text-base font-medium">
                  Unit (Optional)
                </label>
                <select
                  id="unitId"
                  name="unitId"
                  value={formData.unitId}
                  onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select unit</option>
                  {units.map((unit) => (
                    <option key={unit._id} value={unit._id}>
                      {unit.unitNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <MobileFormField
              label="Visitor Name"
              name="visitorName"
              placeholder="Enter visitor's full name"
              required
              value={formData.visitorName}
              onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
              {...(errors.visitorName ? { error: errors.visitorName } : {})}
            />

            <MobileFormField
              label="Visitor Phone (Optional)"
              name="visitorPhone"
              type="tel"
              placeholder="Enter visitor's phone number"
              value={formData.visitorPhone}
              onChange={(e) => setFormData({ ...formData, visitorPhone: e.target.value })}
            />

            <MobileFormField
              label="Visitor ID Number (Optional)"
              name="visitorIdNumber"
              placeholder="Enter visitor's ID number"
              value={formData.visitorIdNumber}
              onChange={(e) => setFormData({ ...formData, visitorIdNumber: e.target.value })}
            />

            <MobileFormField
              label="Purpose of Visit"
              name="purpose"
              placeholder="e.g., Meeting, Delivery, Maintenance"
              required
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              {...(errors.purpose ? { error: errors.purpose } : {})}
            />

            <MobileFormField
              label="Vehicle Plate Number (Optional)"
              name="vehiclePlateNumber"
              placeholder="Enter vehicle plate number"
              value={formData.vehiclePlateNumber}
              onChange={(e) =>
                setFormData({ ...formData, vehiclePlateNumber: e.target.value.toUpperCase() })
              }
            />

            <div className="space-y-2">
              <label htmlFor="validUntil" className="text-base font-medium">
                Valid Until <span className="text-destructive">*</span>
              </label>
              <input
                id="validUntil"
                name="validUntil"
                type="datetime-local"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
              <p className="text-xs text-muted-foreground">
                QR code will expire at this date and time
              </p>
              {errors.validUntil && <p className="text-sm text-destructive">{errors.validUntil}</p>}
            </div>

            {errors.submit && (
              <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
                {errors.submit}
              </div>
            )}
          </div>
        </MobileForm>
      </MobileCard>

      {/* Generated QR Code Display */}
      {generatedQR && (
        <div id="generated-qr">
          <MobileCard>
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold">QR Code Generated Successfully</h2>
              </div>

              {generatedQR.qrCodeImage && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-white rounded-lg border-2 border-primary">
                    <Image
                      src={generatedQR.qrCodeImage}
                      alt="Visitor QR Code"
                      width={250}
                      height={250}
                      className="w-full h-auto"
                    />
                  </div>
                  <Button onClick={downloadQRCode} variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Download QR Code
                  </Button>
                </div>
              )}

              <div className="text-left space-y-2 text-sm">
                <div>
                  <span className="font-medium">Visitor:</span> {generatedQR.visitorName}
                </div>
                {generatedQR.visitorPhone && (
                  <div>
                    <span className="font-medium">Phone:</span> {generatedQR.visitorPhone}
                  </div>
                )}
                <div>
                  <span className="font-medium">Purpose:</span> {generatedQR.purpose}
                </div>
                <div>
                  <span className="font-medium">Valid Until:</span>{' '}
                  {formatDate(generatedQR.validUntil)}
                </div>
              </div>
            </div>
          </MobileCard>
        </div>
      )}

      {/* Existing QR Codes */}
      {qrCodes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Active QR Codes</h2>
          <div className="space-y-4">
            {qrCodes.map((qr) => (
              <MobileCard key={qr._id}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{qr.visitorName}</h3>
                    {qr.used ? (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <XCircle className="h-4 w-4" />
                        Used
                      </span>
                    ) : new Date(qr.validUntil) < new Date() ? (
                      <span className="flex items-center gap-1 text-sm text-destructive">
                        <Clock className="h-4 w-4" />
                        Expired
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <div>
                      <span className="font-medium">Purpose:</span> {qr.purpose}
                    </div>
                    <div>
                      <span className="font-medium">Valid Until:</span> {formatDate(qr.validUntil)}
                    </div>
                    {qr.usedAt && (
                      <div>
                        <span className="font-medium">Used At:</span> {formatDate(qr.usedAt)}
                      </div>
                    )}
                  </div>
                </div>
              </MobileCard>
            ))}
          </div>
        </div>
      )}

      {qrCodes.length === 0 && !generatedQR && (
        <MobileCard>
          <div className="text-center py-8 text-muted-foreground">
            <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No QR codes generated yet.</p>
            <p className="text-sm mt-2">Generate your first visitor QR code above.</p>
          </div>
        </MobileCard>
      )}
    </div>
  );
}
