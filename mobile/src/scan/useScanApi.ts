/**
 * Upload + scan: POST /v1/uploads (presigned POST) → upload JPEG straight to S3 →
 * POST /v1/scans. Errors come back as ApiError with the API's typed codes.
 */
import { useCallback } from 'react';
import type { ScanResponse, UploadResponse } from '@cloudscribble/shared';
import { ApiError, useApi } from '../lib/api';

/** User's local calendar date, "YYYY-MM-DD" (anchors the year for pages that don't print one). */
export function localDateString(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function scanErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'SCAN_UNREADABLE':
      case 'SCAN_QUOTA_EXCEEDED':
      case 'SCAN_UPLOAD_NOT_FOUND':
      case 'SUBSCRIPTION_REQUIRED':
        return err.message;
      case 'SCAN_AI_ERROR':
        return "We couldn't read that page right now. Please try again in a moment.";
      case 'NETWORK_ERROR':
        return err.message;
    }
    if (err.status === 429) return 'Lots of scans right now — please try again in a few seconds.';
  }
  return 'Something went wrong. Please try again.';
}

export function useScanApi() {
  const api = useApi();

  const upload = useCallback(
    async (jpegUri: string): Promise<string> => {
      const { url, fields, uploadKey } = await api.post<UploadResponse>('/v1/uploads', { contentType: 'image/jpeg' });
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      // React Native FormData accepts a { uri, name, type } file descriptor.
      form.append('file', { uri: jpegUri, name: 'page.jpg', type: 'image/jpeg' } as unknown as Blob);
      let res: Response;
      try {
        res = await fetch(url, { method: 'POST', body: form });
      } catch {
        throw new ApiError('No connection. Check your internet and try again.', 0, 'NETWORK_ERROR');
      }
      if (res.status !== 204 && res.status !== 201 && res.status !== 200) {
        throw new ApiError('The photo couldn’t be uploaded. Please try again.', res.status, 'UPLOAD_FAILED');
      }
      return uploadKey;
    },
    [api]
  );

  const scan = useCallback(
    (uploadKey: string) => api.post<ScanResponse>('/v1/scans', { uploadKey, localDate: localDateString() }),
    [api]
  );

  return { upload, scan };
}
