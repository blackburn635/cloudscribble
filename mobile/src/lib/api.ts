/**
 * useApi — authenticated JSON client for the CloudScribble API (Bearer = Cognito ID token).
 * Errors surface the API's typed codes (e.g. SCAN_QUOTA_EXCEEDED) as ApiError.code.
 */
import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { env } from '../config/env';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export function useApi() {
  const { getToken } = useAuth();

  const request = useCallback(
    async <T,>(method: Method, path: string, body?: unknown): Promise<T> => {
      const token = await getToken();
      let res: Response;
      try {
        res = await fetch(`${env.apiUrl}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw new ApiError('No connection. Check your internet and try again.', 0, 'NETWORK_ERROR');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data.error);
      }
      return (res.status === 204 ? undefined : await res.json()) as T;
    },
    [getToken]
  );

  // Stable object so it can be used in effect dependency arrays.
  return useMemo(
    () => ({
      get: <T,>(path: string) => request<T>('GET', path),
      post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
      del: <T,>(path: string) => request<T>('DELETE', path),
    }),
    [request]
  );
}
