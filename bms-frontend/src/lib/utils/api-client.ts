/**
 * Utility functions for making authenticated API calls from client components
 */

export interface ApiError {
  error: string;
  message?: string;
}

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      error: 'An error occurred',
    }))) as ApiError;
    throw new Error(error.error || error.message || 'An error occurred');
  }

  return (await response.json()) as T;
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiCall<T>(endpoint, { method: 'GET' });
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiCall<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : null,
  });
}

export async function apiPatch<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiCall<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : null,
  });
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiCall<T>(endpoint, { method: 'DELETE' });
}

