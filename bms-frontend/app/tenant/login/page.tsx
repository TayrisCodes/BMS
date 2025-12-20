/* eslint-disable react/jsx-no-bind */
'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Building2, AlertCircle, KeyRound, MessageSquare } from 'lucide-react';

export default function TenantLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    const redirect = searchParams.get('redirect');
    if (redirect) {
      setRedirectTo(redirect);
    }
  }, [searchParams]);

  async function handleRequestOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }

    setIsRequestingOtp(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to send OTP. Please try again.');
        setIsRequestingOtp(false);
        return;
      }

      const data = (await response.json()) as { message?: string; code?: string };
      setOtpSent(true);
      if (data.code && process.env.NODE_ENV !== 'production') {
        // Show OTP in dev mode
        setError(`OTP sent! Code: ${data.code} (dev mode only)`);
      }
    } catch (e) {
      console.error('Request OTP failed', e);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!phone.trim() || !otpCode.trim()) {
      setError('Please enter your phone number and OTP code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phone.trim(), code: otpCode.trim() }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Invalid OTP code. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Redirect immediately after successful login
      router.push(redirectTo || '/tenant/dashboard');
      router.refresh();
    } catch (e) {
      console.error('Verify OTP failed', e);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  async function handlePasswordLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!phone.trim() || !password.trim()) {
      setError('Please enter your phone number and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Login failed. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Redirect immediately after successful login
      router.push(redirectTo || '/tenant/dashboard');
      router.refresh();
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
          <CardTitle className="text-2xl font-bold">Tenant Login</CardTitle>
          <CardDescription>
            Choose your preferred login method to access your tenant portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={loginMethod}
            onValueChange={(v) => {
              setLoginMethod(v as 'password' | 'otp');
              setError(null);
              setOtpSent(false);
              setOtpCode('');
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Password
              </TabsTrigger>
              <TabsTrigger value="otp" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                OTP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="space-y-4 mt-4">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone-password">Phone Number</Label>
                  <Input
                    id="phone-password"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+251912345678"
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
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
                  {isSubmitting ? 'Signing in...' : 'Sign In with Password'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="otp" className="space-y-4 mt-4">
              {!otpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-otp">Phone Number</Label>
                    <Input
                      id="phone-otp"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+251912345678"
                      disabled={isRequestingOtp}
                      className="h-11"
                    />
                  </div>

                  {error ? (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <Button type="submit" disabled={isRequestingOtp} className="w-full" size="lg">
                    {isRequestingOtp ? 'Sending OTP...' : 'Send OTP via Telegram'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp-code">OTP Code</Label>
                    <Input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit code"
                      disabled={isSubmitting}
                      className="h-11 text-center text-2xl tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the 6-digit code sent to your Telegram
                    </p>
                  </div>

                  {error ? (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
                    {isSubmitting ? 'Verifying...' : 'Verify OTP'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      setError(null);
                    }}
                    className="w-full"
                  >
                    Use Different Phone Number
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            <Link href="/auth/forgot-password" className="font-medium text-primary hover:underline">
              Forgot Password?
            </Link>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Are you a staff member?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Login to Staff Portal
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
