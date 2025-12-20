'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Button } from '@/lib/components/ui/button';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { ParkingMeter, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface AvailabilityStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  byType: {
    tenant: { total: number; available: number; occupied: number };
    visitor: { total: number; available: number; occupied: number };
    reserved: { total: number; available: number; occupied: number };
  };
}

interface Building {
  _id: string;
  name: string;
}

export default function ParkingDashboardPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [availability, setAvailability] = useState<AvailabilityStats | null>(null);
  const [violationsToday, setViolationsToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBuildings() {
      try {
        const data = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(data.buildings || []);
        if (data.buildings && data.buildings.length > 0) {
          setSelectedBuilding(data.buildings[0]._id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load buildings');
      }
    }
    fetchBuildings();
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!selectedBuilding) return;

      try {
        setIsLoading(true);
        const [availabilityData, violationsData] = await Promise.all([
          apiGet<{ availability: AvailabilityStats }>(
            `/api/parking/availability?buildingId=${selectedBuilding}`,
          ),
          apiGet<{ violations: any[] }>(
            `/api/parking/violations?buildingId=${selectedBuilding}&startDate=${new Date().toISOString().split('T')[0]}`,
          ),
        ]);
        setAvailability(availabilityData.availability);
        setViolationsToday(violationsData.violations?.length || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedBuilding]);

  return (
    <DashboardPage
      header={{
        title: 'Parking Dashboard',
        description: 'Real-time parking overview and statistics',
        icon: ParkingMeter,
      }}
    >
      <div className="col-span-full space-y-6">
        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spaces</CardTitle>
              <ParkingMeter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : availability?.total || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? '...' : availability?.available || 0}
              </div>
              {availability && availability.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round((availability.available / availability.total) * 100)}% available
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupied</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {isLoading ? '...' : availability?.occupied || 0}
              </div>
              {availability && availability.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round((availability.occupied / availability.total) * 100)}% occupied
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Violations Today</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{violationsToday}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/org/parking/violations/new">
                <Button variant="outline" className="w-full">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report Violation
                </Button>
              </Link>
              <Link href="/org/parking/logs">
                <Button variant="outline" className="w-full">
                  <Clock className="h-4 w-4 mr-2" />
                  View Logs
                </Button>
              </Link>
              <Link href="/org/parking/reports/utilization">
                <Button variant="outline" className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Utilization Report
                </Button>
              </Link>
            </CardContent>
          </Card>

          {availability && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>By Type - Tenant</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Total:</span>
                      <span className="font-medium">{availability.byType.tenant.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Available:</span>
                      <span className="font-medium text-green-600">
                        {availability.byType.tenant.available}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Occupied:</span>
                      <span className="font-medium text-orange-600">
                        {availability.byType.tenant.occupied}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By Type - Visitor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Total:</span>
                      <span className="font-medium">{availability.byType.visitor.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Available:</span>
                      <span className="font-medium text-green-600">
                        {availability.byType.visitor.available}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Occupied:</span>
                      <span className="font-medium text-orange-600">
                        {availability.byType.visitor.occupied}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}

