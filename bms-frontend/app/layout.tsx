import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Header from './components/Header';
import { ThemeProvider } from '@/lib/components/providers/ThemeProvider';
import { KeyboardShortcutsProvider } from '@/lib/components/providers/KeyboardShortcutsProvider';
import { SkipLink } from '@/lib/components/ui/skip-link';
import { Toaster } from '@/lib/components/ui/toaster';

export const metadata: Metadata = {
  title: 'BMS - Building Management System',
  description: 'Building Management System for tenants and staff',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BMS',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  viewportFit: 'cover',
  // PWA-friendly settings
  minimumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BMS" />
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preload" href="/icon-192.png" as="image" />
      </head>
      <body>
        <ThemeProvider>
          <KeyboardShortcutsProvider>
            <SkipLink />
            <Header />
            <main id="main-content">{children}</main>
            <Toaster />
          </KeyboardShortcutsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
