import { describe, expect, it } from 'vitest';
import { authMatches, deriveStatus, mapSource } from '../functions/subscription/revenuecat';

const NOW = Date.UTC(2026, 10, 1);
const DAY = 86_400_000;

describe('deriveStatus', () => {
  it('uses ground truth, not the event verb', () => {
    expect(deriveStatus('INITIAL_PURCHASE', 'TRIAL', NOW + 14 * DAY, NOW)).toBe('in_trial');
    expect(deriveStatus('RENEWAL', 'NORMAL', NOW + 30 * DAY, NOW)).toBe('active');
    // Cancelled but still inside the paid period → still active until expiry
    expect(deriveStatus('CANCELLATION', 'NORMAL', NOW + 5 * DAY, NOW)).toBe('active');
    expect(deriveStatus('EXPIRATION', 'NORMAL', NOW - DAY, NOW)).toBe('expired');
    expect(deriveStatus('RENEWAL', 'NORMAL', null, NOW)).toBe('expired');
  });
  it('treats billing issues as past_due and offer-code years as active', () => {
    expect(deriveStatus('BILLING_ISSUE', 'NORMAL', NOW + DAY, NOW)).toBe('past_due');
    expect(deriveStatus('INITIAL_PURCHASE', 'PROMOTIONAL', NOW + 365 * DAY, NOW)).toBe('active');
  });
});

describe('mapSource', () => {
  it('maps stores', () => {
    expect(mapSource('APP_STORE')).toBe('apple_iap');
    expect(mapSource('PLAY_STORE')).toBe('google_iap');
    expect(mapSource('STRIPE')).toBeNull();
  });
});

describe('authMatches', () => {
  it('compares exactly and safely', () => {
    expect(authMatches('Bearer abc123', 'Bearer abc123')).toBe(true);
    expect(authMatches('Bearer abc124', 'Bearer abc123')).toBe(false);
    expect(authMatches('short', 'Bearer abc123')).toBe(false);
    expect(authMatches(undefined, 'Bearer abc123')).toBe(false);
    expect(authMatches('x', '')).toBe(false);
  });
});
