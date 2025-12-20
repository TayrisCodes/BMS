'use client';

import { useEffect, useState } from 'react';

export function ServiceWorkerRegistration() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    // Check if service workers are supported
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      setIsSupported(true);
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker
        .register('/sw.js', {
          scope: '/tenant',
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
          throw error;
        });

      console.log('[PWA] Service Worker registered:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New service worker available
                console.log('[PWA] New service worker available');
                // Optionally show update notification to user
                // You can add a toast notification here
              } else {
                // Service worker installed for the first time
                console.log('[PWA] Service worker installed');
              }
            }
          });
        }
      });

      // Check if there's an update available
      await registration.update();

      setIsRegistered(true);

      // Handle service worker updates more gracefully
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          // Give user a moment before reloading
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      });
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  };

  // Don't render anything, just register the service worker
  return null;
}
