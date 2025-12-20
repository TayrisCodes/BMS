'use client';

import { useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';

export default function OfflinePage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <WifiOff className="h-16 w-16 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">You&apos;re Offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            It looks like you&apos;re not connected to the internet. Please check your connection
            and try again.
          </p>
          <p className="text-sm text-muted-foreground">
            Some cached content may still be available. You can try refreshing the page.
          </p>
          <Button onClick={handleRefresh} disabled={isRefreshing} className="w-full">
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Page
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

