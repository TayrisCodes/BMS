'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiPost, apiGet } from '@/lib/utils/api-client';
import { ArrowLeft, Users, Search, Building2, Package } from 'lucide-react';
import { Badge } from '@/lib/components/ui/badge';
import { Checkbox } from '@/lib/components/ui/checkbox';

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
  buildingName?: string;
  floor?: number | null;
  unitType: string;
  status: string;
  rentAmount?: number | null;
}

export default function NewTenantPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [createLease, setCreateLease] = useState(true);
  const [leaseStartDate, setLeaseStartDate] = useState<string>('');
  const [leaseRentAmount, setLeaseRentAmount] = useState<string>('');

  // Fetch buildings and units on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [buildingsData, unitsData] = await Promise.all([
          apiGet<{ buildings: Building[] }>('/api/buildings'),
          apiGet<{ units: Unit[] }>('/api/units?status=available'),
        ]);
        setBuildings(buildingsData.buildings || []);
        const unitsList = unitsData.units || [];
        setUnits(unitsList);
        setFilteredUnits(unitsList);

        // Fetch building names for units
        if (unitsList.length > 0) {
          const buildingIds = [...new Set(unitsList.map((u) => u.buildingId))];
          const buildingPromises = buildingIds.map((id) =>
            apiGet<{ building: Building }>(`/api/buildings/${id}`).catch(() => null),
          );
          const buildingResults = await Promise.all(buildingPromises);
          const buildingMap = new Map<string, string>();
          buildingResults.forEach((result, index) => {
            if (result?.building && buildingIds[index]) {
              buildingMap.set(buildingIds[index], result.building.name);
            }
          });
          const unitsWithBuildings = unitsList.map((u) => ({
            ...u,
            buildingName: buildingMap.get(u.buildingId) || 'Unknown Building',
          }));
          setUnits(unitsWithBuildings);
          setFilteredUnits(unitsWithBuildings);
        }
      } catch (err) {
        console.error('Failed to fetch buildings/units:', err);
      }
    }
    fetchData();
  }, []);

  // Filter units based on search and building
  useEffect(() => {
    let filtered = units;

    // Filter by building
    if (selectedBuildingId) {
      filtered = filtered.filter((u) => u.buildingId === selectedBuildingId);
    }

    // Filter by search query
    if (unitSearchQuery) {
      const query = unitSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.unitNumber.toLowerCase().includes(query) ||
          u.buildingName?.toLowerCase().includes(query) ||
          u.unitType.toLowerCase().includes(query),
      );
    }

    setFilteredUnits(filtered);
  }, [selectedBuildingId, unitSearchQuery, units]);

  // Set lease start date to today by default
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0] || '';
    setLeaseStartDate(today);
  }, []);

  // Update rent amount when unit is selected
  useEffect(() => {
    if (selectedUnitId) {
      const unit = units.find((u) => u._id === selectedUnitId);
      if (unit?.rentAmount) {
        setLeaseRentAmount(unit.rentAmount.toString());
      }
    }
  }, [selectedUnitId, units]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const password = formData.get('password')?.toString() || '';
    const confirmPassword = formData.get('confirmPassword')?.toString() || '';

    // Validate password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsSubmitting(false);
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsSubmitting(false);
      return;
    }

    const tenantData = {
      firstName: formData.get('firstName')?.toString() || '',
      lastName: formData.get('lastName')?.toString() || '',
      primaryPhone: formData.get('primaryPhone')?.toString() || '',
      email: formData.get('email')?.toString() || null,
      nationalId: formData.get('nationalId')?.toString() || null,
      language: formData.get('language')?.toString() || null,
      password,
      unitId: createLease && selectedUnitId ? selectedUnitId : null,
      leaseData:
        createLease && selectedUnitId
          ? {
              startDate: leaseStartDate || new Date().toISOString().split('T')[0],
              endDate: formData.get('leaseEndDate')?.toString() || null,
              rentAmount: leaseRentAmount ? parseFloat(leaseRentAmount) : 0,
              depositAmount: formData.get('depositAmount')
                ? parseFloat(formData.get('depositAmount')!.toString())
                : null,
              billingCycle: formData.get('billingCycle')?.toString() || 'monthly',
              dueDay: parseInt(formData.get('dueDay')?.toString() || '1'),
            }
          : null,
      emergencyContact: {
        name: formData.get('emergencyName')?.toString() || '',
        phone: formData.get('emergencyPhone')?.toString() || '',
      },
      notes: formData.get('notes')?.toString() || null,
    };

    try {
      const result = await apiPost<{ tenant: { _id: string } }>('/api/tenants', tenantData);
      router.push(`/admin/tenants/${result.tenant._id}`);
    } catch (err) {
      if (err instanceof Error) {
        // Check if error has details about password validation
        try {
          const errorData = JSON.parse(err.message);
          if (errorData.errors) {
            setError(`Password validation failed: ${errorData.errors.join(', ')}`);
          } else {
            setError(err.message);
          }
        } catch {
          setError(err.message);
        }
      } else {
        setError('Failed to create tenant');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Create New Tenant</CardTitle>
              <CardDescription>Add a new tenant to the system</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" name="firstName" required placeholder="First name" />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" name="lastName" required placeholder="Last name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryPhone">Phone Number *</Label>
                  <Input
                    id="primaryPhone"
                    name="primaryPhone"
                    required
                    placeholder="+251 9XX XXX XXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="email@example.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Enter password"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum 8 characters, must include uppercase, lowercase, number, and special
                    character
                  </p>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nationalId">National ID</Label>
                  <Input id="nationalId" name="nationalId" placeholder="National ID number" />
                </div>
                <div>
                  <Label htmlFor="language">Preferred Language</Label>
                  <Select name="language">
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="am">Amharic</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="om">Afaan Oromo</SelectItem>
                      <SelectItem value="ti">Tigrigna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Emergency Contact</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="emergencyName" className="text-xs">
                      Name
                    </Label>
                    <Input
                      id="emergencyName"
                      name="emergencyName"
                      placeholder="Emergency contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone" className="text-xs">
                      Phone
                    </Label>
                    <Input
                      id="emergencyPhone"
                      name="emergencyPhone"
                      placeholder="Emergency contact phone"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes about the tenant"
                  rows={3}
                />
              </div>

              {/* Unit Selection Section */}
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox
                    id="createLease"
                    checked={createLease}
                    onCheckedChange={(checked) => setCreateLease(checked === true)}
                  />
                  <Label htmlFor="createLease" className="text-base font-semibold cursor-pointer">
                    Assign Unit & Create Lease
                  </Label>
                </div>

                {createLease && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    {/* Building Filter */}
                    <div>
                      <Label htmlFor="buildingFilter">Filter by Building (Optional)</Label>
                      <Select
                        value={selectedBuildingId || 'all'}
                        onValueChange={(value) => {
                          const buildingId = value === 'all' ? '' : value;
                          setSelectedBuildingId(buildingId);
                          if (buildingId) {
                            setSelectedUnitId(''); // Reset unit selection when building changes
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Buildings" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Buildings</SelectItem>
                          {buildings.map((building) => (
                            <SelectItem key={building._id} value={building._id}>
                              {building.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Unit Search */}
                    <div>
                      <Label htmlFor="unitSearch">Search Units</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="unitSearch"
                          placeholder="Search by unit number, building, or type..."
                          value={unitSearchQuery}
                          onChange={(e) => setUnitSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Unit Selection */}
                    <div>
                      <Label htmlFor="unitId">Select Unit *</Label>
                      <Select
                        value={selectedUnitId}
                        onValueChange={setSelectedUnitId}
                        required={createLease}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a unit" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {filteredUnits.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                              {unitSearchQuery || selectedBuildingId
                                ? 'No units found matching your criteria'
                                : 'No available units'}
                            </div>
                          ) : (
                            filteredUnits.map((unit) => (
                              <SelectItem key={unit._id} value={unit._id}>
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span className="font-medium">{unit.unitNumber}</span>
                                    <span className="text-muted-foreground">
                                      ({unit.buildingName || 'Unknown'})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Badge variant="outline">{unit.unitType}</Badge>
                                    {unit.rentAmount && (
                                      <span className="text-sm text-muted-foreground">
                                        {unit.rentAmount.toLocaleString()} ETB
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {selectedUnitId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Selected: {units.find((u) => u._id === selectedUnitId)?.unitNumber}
                        </p>
                      )}
                    </div>

                    {/* Lease Details */}
                    {selectedUnitId && (
                      <div className="space-y-4 bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-semibold text-sm">Lease Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="leaseStartDate">Start Date *</Label>
                            <Input
                              id="leaseStartDate"
                              type="date"
                              value={leaseStartDate}
                              onChange={(e) => setLeaseStartDate(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="leaseEndDate">End Date (Optional)</Label>
                            <Input
                              id="leaseEndDate"
                              name="leaseEndDate"
                              type="date"
                              placeholder="Leave empty for month-to-month"
                            />
                          </div>
                          <div>
                            <Label htmlFor="rentAmount">Rent Amount (ETB) *</Label>
                            <Input
                              id="rentAmount"
                              type="number"
                              step="0.01"
                              value={leaseRentAmount}
                              onChange={(e) => setLeaseRentAmount(e.target.value)}
                              required
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label htmlFor="depositAmount">Deposit Amount (ETB)</Label>
                            <Input
                              id="depositAmount"
                              name="depositAmount"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label htmlFor="billingCycle">Billing Cycle *</Label>
                            <Select name="billingCycle" defaultValue="monthly">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                <SelectItem value="annually">Annually</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="dueDay">Due Day (1-31) *</Label>
                            <Input
                              id="dueDay"
                              name="dueDay"
                              type="number"
                              min="1"
                              max="31"
                              defaultValue="1"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/admin/tenants">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Tenant'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
