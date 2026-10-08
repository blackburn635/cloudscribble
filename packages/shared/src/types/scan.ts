/**
 * Scan types — shared by the API, the mobile app, and the evals.
 *
 * Flow: POST /v1/uploads (presigned POST) → upload image → POST /v1/scans → events.
 * The device writes events to the phone calendar; the server never stores them.
 */

/** Fair-use cap per user per calendar month (UTC). 100 × ~$0.0116 keeps a maxed-out user within the 30% margin at $1.99/mo. */
export const SCAN_MONTHLY_LIMIT = 100;

/** Claude reads jpeg/png/webp (not HEIC) — the app converts HEIC to JPEG before upload. */
export const SCAN_UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ScanUploadContentType = (typeof SCAN_UPLOAD_CONTENT_TYPES)[number];

/** Upload ceiling (Claude's per-image limit is 5 MB; the app downsizes to ~1568px, typically < 1 MB). */
export const SCAN_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export interface UploadRequest {
  contentType: ScanUploadContentType;
}

export interface UploadResponse {
  /** S3 POST endpoint */
  url: string;
  /** Form fields to include before the file field */
  fields: Record<string, string>;
  /** Pass to POST /v1/scans */
  uploadKey: string;
  expiresInSeconds: number;
}

export interface ScanRequest {
  uploadKey: string;
  /** User's local date "YYYY-MM-DD" — anchors the year for pages that don't print one. */
  localDate: string;
}

export interface ScanEvent {
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" 24h local, null for all-day */
  start: string | null;
  /** "HH:MM" 24h local, null when not written */
  end: string | null;
  allDay: boolean;
  note: string | null;
  /** 0–1 */
  confidence: number;
}

export interface ScanResult {
  /** False when the image isn't a readable planner page */
  readable: boolean;
  events: ScanEvent[];
  /** Overall confidence 0–1 */
  confidence: number;
  /** First/last dates the page covers per its printed headers; null when none are printed */
  pageDates: { start: string; end: string } | null;
}

export interface ScanResponse extends ScanResult {
  /** Model that produced the result (diagnostics) */
  model: string;
  /** Scans left this month after this one */
  remainingThisMonth: number;
}

export type ScanErrorCode =
  | 'SCAN_UNREADABLE'
  | 'SCAN_QUOTA_EXCEEDED'
  | 'SCAN_AI_ERROR'
  | 'SCAN_UPLOAD_NOT_FOUND'
  | 'SCAN_UPLOAD_INVALID';
