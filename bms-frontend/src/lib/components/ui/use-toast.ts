'use client';

import React, { useState, useCallback, useEffect } from 'react';

export type ToastVariant = 'default' | 'destructive';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

let toastCount = 0;

function generateId() {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER;
  return `toast-${toastCount}`;
}

const listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function subscribe(listener: (toasts: Toast[]) => void) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

function toast(props: Omit<Toast, 'id'>) {
  const id = generateId();
  const newToast: Toast = {
    id,
    ...props,
  };

  toasts = [...toasts, newToast];
  notify();

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    dismiss(id);
  }, 5000);

  return {
    id,
    dismiss: () => dismiss(id),
  };
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setToastList);
    setToastList([...toasts]);
    return unsubscribe;
  }, []);

  return {
    toasts: toastList,
    toast: useCallback((props: Omit<Toast, 'id'>) => {
      return toast(props);
    }, []),
    dismiss: useCallback((id: string) => {
      dismiss(id);
    }, []),
  };
}
