/* eslint-disable react/jsx-no-bind */
'use client';

import { useState, useEffect, Suspense } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Building2, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    const redirect = searchParams.get('redirect');
    if (redirect) {
      setRedirectTo(redirect);
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email/phone and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Login failed. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Fetch user info to determine redirect based on role
      try {
        const meResponse = await fetch('/api/me', {
          credentials: 'include',
        });
        if (meResponse.ok) {
          const meData = (await meResponse.json()) as {
            auth?: { roles?: string[] };
          };
          const roles = meData.auth?.roles || [];

          // Determine redirect destination based on role
          let destination = redirectTo;
          if (!destination) {
            // If no explicit redirect, use role-based default
            if (roles.includes('SUPER_ADMIN')) {
              destination = '/admin';
            } else if (roles.includes('TENANT')) {
              // Tenants should use tenant login, but redirect them if they use staff login
              destination = '/tenant/dashboard';
            } else if (
              roles.includes('ORG_ADMIN') ||
              roles.includes('BUILDING_MANAGER') ||
              roles.includes('FACILITY_MANAGER') ||
              roles.includes('ACCOUNTANT') ||
              roles.includes('SECURITY') ||
              roles.includes('TECHNICIAN') ||
              roles.includes('AUDITOR')
            ) {
              // All other staff roles go to organization dashboard
              destination = '/org';
            } else {
              // Fallback to home page
              destination = '/';
            }
          }

          router.push(destination);
          router.refresh();
        } else {
          // If /api/me fails, fall back to default redirect
          router.push(redirectTo || '/');
          router.refresh();
        }
      } catch (meError) {
        console.error('Failed to fetch user info', meError);
        // Fall back to default redirect if fetching user info fails
        router.push(redirectTo || '/');
        router.refresh();
      }
    } catch (e) {
      console.error('Login request failed', e);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Staff Login</CardTitle>
          <CardDescription>
            Enter your email or phone number and password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or Phone</Label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="you@example.com or +251912345678"
                disabled={isSubmitting}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                disabled={isSubmitting}
                className="h-11"
              />
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Are you a tenant?{' '}
            <Link href="/tenant/login" className="font-medium text-primary hover:underline">
              Login to Tenant Portal
            </Link>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/tenant/signup" className="font-medium text-primary hover:underline">
              Sign Up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Staff Login</CardTitle>
              <CardDescription>Loading...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
