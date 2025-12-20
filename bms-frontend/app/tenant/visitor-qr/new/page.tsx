'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { QrCode, Download, Share2, Calendar, User, Building2 } from 'lucide-react';
import QRCode from 'qrcode';

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  floor?: number | null;
  buildingId: string;
}

interface Lease {
  _id: string;
  unitId: string;
  buildingId: string;
  status: string;
}

export default function NewVisitorQRPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{
    qrCode: string;
    qrCodeImage: string;
    shareUrl: string;
    visitorName: string;
    validUntil: string;
    buildingName: string;
    unitNumber: string | null;
  } | null>(null);
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
        // Fetch buildings
        const buildingsData = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(buildingsData.buildings || []);

        // Fetch tenant's leases
        const leasesData = await apiGet<{ leases: Lease[] }>('/api/leases?status=active');
        setLeases(leasesData.leases || []);

        // Set default building and unit from first active lease
        if (leasesData.leases && leasesData.leases.length > 0) {
          const firstLease = leasesData.leases[0];
          setFormData((prev) => ({
            ...prev,
            buildingId: firstLease.buildingId,
            unitId: firstLease.unitId,
          }));

          // Fetch units for this building
          const unitsData = await apiGet<{ units: Unit[] }>(
            `/api/units?buildingId=${firstLease.buildingId}`,
          );
          setUnits(unitsData.units || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchUnits() {
      if (!formData.buildingId) {
        setUnits([]);
        return;
      }

      try {
        const unitsData = await apiGet<{ units: Unit[] }>(
          `/api/units?buildingId=${formData.buildingId}`,
        );
        setUnits(unitsData.units || []);

        // Auto-select unit from active lease if available
        const activeLease = leases.find(
          (l) => l.buildingId === formData.buildingId && l.status === 'active',
        );
        if (activeLease) {
          setFormData((prev) => ({ ...prev, unitId: activeLease.unitId }));
        }
      } catch (err) {
        console.error('Failed to fetch units', err);
      }
    }

    fetchUnits();
  }, [formData.buildingId, leases]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        buildingId: formData.buildingId,
        unitId: formData.unitId || null,
        visitorName: formData.visitorName,
        visitorPhone: formData.visitorPhone || null,
        visitorIdNumber: formData.visitorIdNumber || null,
        purpose: formData.purpose,
        vehiclePlateNumber: formData.vehiclePlateNumber || null,
        validUntil: formData.validUntil,
      };

      const result = await apiPost<{
        qrCode: {
          _id: string;
          qrCode: string;
          qrCodeImage: string;
          visitorName: string;
          validUntil: string;
          buildingName: string;
          unitNumber: string | null;
        };
      }>('/api/visitor-qr-codes', payload);

      // Generate share URL
      const shareUrl = `${window.location.origin}/visitor-qr/${result.qrCode.qrCode}`;

      setQrCodeData({
        qrCode: result.qrCode.qrCode,
        qrCodeImage: result.qrCode.qrCodeImage,
        shareUrl,
        visitorName: result.qrCode.visitorName,
        validUntil: result.qrCode.validUntil,
        buildingName: result.qrCode.buildingName,
        unitNumber: result.qrCode.unitNumber,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create QR code');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!qrCodeData) return;

    try {
      // Convert base64 to blob
      const response = await fetch(qrCodeData.qrCodeImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visitor-qr-${qrCodeData.visitorName.replace(/\s/g, '-')}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download QR code');
    }
  }

  async function handleShare() {
    if (!qrCodeData) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Visitor QR Code for ${qrCodeData.visitorName}`,
          text: `Please use this QR code for your visit. Valid until ${new Date(qrCodeData.validUntil).toLocaleString()}`,
          url: qrCodeData.shareUrl,
        });
      } catch (err) {
        // User cancelled or error
        console.error('Share error:', err);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(qrCodeData.shareUrl);
        alert('Share link copied to clipboard!');
      } catch (err) {
        setError('Failed to copy share link');
      }
    }
  }

  if (qrCodeData) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">QR Code Generated</h1>
          <Button variant="ghost" onClick={() => router.push('/tenant/visitor-qr')}>
            Back to List
          </Button>
        </div>

        <MobileCard>
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">{qrCodeData.visitorName}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Valid until {new Date(qrCodeData.validUntil).toLocaleString()}
              </p>
              <div className="flex justify-center mb-4">
                <img
                  src={qrCodeData.qrCodeImage}
                  alt="Visitor QR Code"
                  className="w-64 h-64 border rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Building:</span>
                <span className="font-medium">{qrCodeData.buildingName}</span>
              </div>
              {qrCodeData.unitNumber && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Unit:</span>
                  <span className="font-medium">{qrCodeData.unitNumber}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button onClick={handleShare} className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>

            <div className="pt-4 border-t">
              <Label className="text-sm text-muted-foreground">Share Link</Label>
              <div className="flex gap-2 mt-1">
                <Input value={qrCodeData.shareUrl} readOnly className="text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(qrCodeData.shareUrl);
                    alert('Link copied!');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </MobileCard>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Generate Visitor QR Code</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">{error}</div>
      )}

      <MobileCard>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buildingId">Building *</Label>
            <Select
              value={formData.buildingId}
              onValueChange={(value) => setFormData({ ...formData, buildingId: value, unitId: '' })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select building" />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((building) => (
                  <SelectItem key={building._id} value={building._id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unitId">Unit *</Label>
            <Select
              value={formData.unitId}
              onValueChange={(value) => setFormData({ ...formData, unitId: value })}
              required
              disabled={!formData.buildingId || units.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit._id} value={unit._id}>
                    Unit {unit.unitNumber}
                    {unit.floor !== null && unit.floor !== undefined && ` - Floor ${unit.floor}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitorName">Visitor Name *</Label>
            <Input
              id="visitorName"
              value={formData.visitorName}
              onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
              placeholder="Enter visitor's full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitorPhone">Visitor Phone</Label>
            <Input
              id="visitorPhone"
              type="tel"
              value={formData.visitorPhone}
              onChange={(e) => setFormData({ ...formData, visitorPhone: e.target.value })}
              placeholder="+251..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitorIdNumber">Visitor ID Number</Label>
            <Input
              id="visitorIdNumber"
              value={formData.visitorIdNumber}
              onChange={(e) => setFormData({ ...formData, visitorIdNumber: e.target.value })}
              placeholder="National ID or passport number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose of Visit *</Label>
            <Input
              id="purpose"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="e.g., Meeting, Delivery, Maintenance"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehiclePlateNumber">Vehicle Plate Number</Label>
            <Input
              id="vehiclePlateNumber"
              value={formData.vehiclePlateNumber}
              onChange={(e) =>
                setFormData({ ...formData, vehiclePlateNumber: e.target.value.toUpperCase() })
              }
              placeholder="ABC-1234"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="validUntil">Valid Until *</Label>
            <Input
              id="validUntil"
              type="datetime-local"
              value={formData.validUntil}
              onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
              required
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
            {isSubmitting ? 'Generating...' : 'Generate QR Code'}
          </Button>
        </form>
      </MobileCard>
    </div>
  );
}

