/* eslint-disable react/jsx-no-bind */
'use client';

import { useState, useEffect } from 'react';
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
import { Building2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/lib/components/ui/badge';

type Step = 'phone' | 'code' | 'password';

export default function TenantSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
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

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, isSignup: true }),
      });

      const data = (await response.json()) as { message?: string; error?: string; code?: string };

      if (!response.ok) {
        setError(data.error ?? 'Failed to send OTP. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setOtpSent(true);
      setStep('code');

      // In dev, show the code if provided
      if (data.code) {
        console.log('OTP Code (dev only):', data.code);
      }
    } catch (e) {
      console.error('Request OTP failed', e);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, code, isSignup: true }),
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setError(data.error ?? 'Invalid code. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Move to password step
      setStep('password');
    } catch (e) {
      console.error('Verify OTP failed', e);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  async function handleSetPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Please enter a password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/tenant/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password }),
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setError(data.error ?? 'Failed to set password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Redirect to login or dashboard
      router.push(redirectTo || '/tenant/dashboard');
      router.refresh();
    } catch (e) {
      console.error('Set password failed', e);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  function handleBackToPhone() {
    setStep('phone');
    setCode('');
    setError(null);
    setOtpSent(false);
  }

  function handleBackToCode() {
    setStep('code');
    setPassword('');
    setConfirmPassword('');
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Tenant Sign Up</CardTitle>
          <CardDescription>
            {step === 'phone'
              ? 'Enter your phone number to receive a verification code'
              : step === 'code'
                ? `Enter the verification code sent to ${phone}`
                : 'Set your password to complete sign up'}
          </CardDescription>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Badge variant={step === 'phone' ? 'default' : 'secondary'}>1. Phone</Badge>
            <div className="h-0.5 w-8 bg-border" />
            <Badge
              variant={step === 'code' ? 'default' : step === 'password' ? 'default' : 'secondary'}
            >
              2. Code
            </Badge>
            <div className="h-0.5 w-8 bg-border" />
            <Badge variant={step === 'password' ? 'default' : 'secondary'}>3. Password</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+251912345678"
                  disabled={isSubmitting}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll send a verification code via Telegram
                </p>
              </div>

              {error ? (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
                {isSubmitting ? 'Sending code...' : 'Send Verification Code'}
              </Button>
            </form>
          ) : step === 'code' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, '');
                    setCode(value);
                  }}
                  className="h-14 text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  disabled={isSubmitting}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Check your Telegram for the 6-digit code
                </p>
              </div>

              {error ? (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToPhone}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || code.length !== 6}
                  className="flex-1"
                  size="lg"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Must be at least 8 characters long</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  disabled={isSubmitting}
                  className="h-11"
                />
                {password &&
                  confirmPassword &&
                  password === confirmPassword &&
                  password.length >= 8 && (
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Passwords match</span>
                    </div>
                  )}
              </div>

              {error ? (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToCode}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || password.length < 8 || password !== confirmPassword}
                  className="flex-1"
                  size="lg"
                >
                  {isSubmitting ? 'Setting password...' : 'Complete Sign Up'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/tenant/login" className="font-medium text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
