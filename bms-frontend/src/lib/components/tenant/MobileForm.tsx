'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/lib/utils';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';

interface MobileFormProps {
  children: ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  submitLabel?: string;
  isLoading?: boolean;
}

export function MobileForm({
  children,
  onSubmit,
  className,
  submitLabel = 'Submit',
  isLoading = false,
}: MobileFormProps) {
  return (
    <form onSubmit={onSubmit} className={cn('space-y-6', className)} noValidate>
      {children}
      <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
        {isLoading ? 'Loading...' : submitLabel}
      </Button>
    </form>
  );
}

interface MobileFormFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string | undefined;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  textarea?: boolean;
  rows?: number;
}

export function MobileFormField({
  label,
  name,
  type = 'text',
  placeholder,
  required = false,
  error,
  value,
  onChange,
  textarea = false,
  rows = 4,
}: MobileFormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-base font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange as unknown as (e: React.ChangeEvent<HTMLTextAreaElement>) => void}
          rows={rows}
          className={cn(
            'flex min-h-[60px] w-full rounded-md border border-input bg-background px-4 py-3 text-base',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
          )}
        />
      ) : (
        <Input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          className={cn('h-12 text-base', error && 'border-destructive')}
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
