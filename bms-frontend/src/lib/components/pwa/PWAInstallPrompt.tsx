'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isTenant, setIsTenant] = useState(false);
  const promptFiredRef = useRef(false);

  // Check if user is a tenant
  useEffect(() => {
    const checkTenantRole = async () => {
      try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.auth?.roles?.includes('TENANT')) {
            setIsTenant(true);
          }
        }
      } catch (error) {
        console.error('Failed to check user role:', error);
      }
    };

    checkTenantRole();
  }, []);

  useEffect(() => {
    // Only proceed if user is a tenant
    if (!isTenant) {
      return;
    }

    // Detect if already installed
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isStandaloneMode) {
      setIsInstalled(true);
      return;
    }

    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const now = Date.now();
      // Show again after 7 days
      if (now - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // For browsers that support beforeinstallprompt (Chrome, Edge, Samsung Internet)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      promptFiredRef.current = true;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Universal fallback: Show prompt after delay for all browsers
    // Only show if beforeinstallprompt hasn't fired and we're not in standalone mode
    const universalTimeout = setTimeout(() => {
      if (!promptFiredRef.current && !isStandaloneMode) {
        // Show prompt even if beforeinstallprompt didn't fire (for browsers like Safari)
        setShowPrompt(true);
      }
    }, 5000);

    // Check if app is already installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(universalTimeout);
    };
  }, [isTenant]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        // Chrome, Edge, Samsung Internet - use native prompt
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
          setShowPrompt(false);
          setIsInstalled(true);
        } else {
          // User dismissed the prompt
          setShowPrompt(false);
          localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        }

        setDeferredPrompt(null);
      } catch (error) {
        console.error('Error showing install prompt:', error);
        // Fallback: show manual instructions
        setShowPrompt(false);
        alert(
          'To install this app:\n\nOn Chrome/Edge: Click the menu (⋮) and select "Install app"\nOn Safari (iOS): Tap Share → Add to Home Screen',
        );
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      }
    } else {
      // For browsers that don't support beforeinstallprompt (Safari, etc.)
      // Show manual instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);

      if (isIOS) {
        alert(
          'To install this app:\n\n1. Tap the Share button (square with arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add"',
        );
      } else if (isAndroid) {
        alert(
          'To install this app:\n\n1. Tap the menu (⋮) in your browser\n2. Select "Install app" or "Add to Home screen"',
        );
      } else {
        alert(
          'To install this app:\n\nOn Chrome/Edge: Click the menu (⋮) and select "Install app" or look for the install icon in the address bar.',
        );
      }

      setShowPrompt(false);
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if not tenant, already installed, or prompt not shown
  if (!isTenant || isInstalled || !showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, x: 20, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 20, y: 20 }}
          className="fixed right-4 z-40"
          style={{ bottom: '80px' }}
        >
          {/* Small Install Button */}
          <div className="relative">
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 px-4 py-2.5 text-white font-semibold text-sm rounded-full shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#FF701A' }}
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
            <button
              onClick={handleDismiss}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors shadow-md"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
