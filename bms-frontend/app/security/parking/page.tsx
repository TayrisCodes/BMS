'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { SecurityMobileLayout } from '@/lib/components/layouts/SecurityMobileLayout';
import { ParkingMeter, AlertTriangle, Clock, LogIn } from 'lucide-react';

export default function SecurityParkingPage() {
  return (
    <SecurityMobileLayout title="Parking">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <Link href="/security/parking/log-entry">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-2">
                  <LogIn className="h-8 w-8 text-primary" />
                  <p className="font-medium">Log Entry/Exit</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/security/parking/violations">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-2">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <p className="font-medium">Violations</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/security/parking/log-entry">
              <Button variant="outline" className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                Log Entry/Exit
              </Button>
            </Link>
            <Link href="/security/parking/report-violation">
              <Button variant="outline" className="w-full">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Report Violation
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </SecurityMobileLayout>
  );
}

