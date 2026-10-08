import { describe, expect, it } from 'vitest';
import { parseGroups } from '../functions/_shared/auth';
import { resolveEffectiveSubscription, type SubRecord } from '../functions/_shared/subscription';

describe('parseGroups', () => {
  it('handles HTTP API bracketed strings', () => {
    expect(parseGroups('[cloudscribble-admins]')).toEqual(['cloudscribble-admins']);
    expect(parseGroups('[a b]')).toEqual(['a', 'b']);
    expect(parseGroups('a,b')).toEqual(['a', 'b']);
  });
  it('handles arrays and missing claims', () => {
    expect(parseGroups(['x'])).toEqual(['x']);
    expect(parseGroups(undefined)).toEqual([]);
  });
});

describe('resolveEffectiveSubscription', () => {
  const iap = (status: SubRecord['status']): SubRecord => ({ SK: 'SUBSCRIPTION#IAP', status });
  const planner = (status: SubRecord['status']): SubRecord => ({ SK: 'SUBSCRIPTION#PLANNER', status });

  it('returns null with no records', () => {
    expect(resolveEffectiveSubscription([])).toBeNull();
  });
  it('prefers an active record over a higher-priority expired one', () => {
    expect(resolveEffectiveSubscription([iap('expired'), planner('active')])?.SK).toBe('SUBSCRIPTION#PLANNER');
  });
  it('Apple wins when both are active', () => {
    expect(resolveEffectiveSubscription([planner('active'), iap('in_trial')])?.SK).toBe('SUBSCRIPTION#IAP');
  });
  it('falls back to a representative terminal status', () => {
    expect(resolveEffectiveSubscription([planner('cancelled'), iap('expired')])?.status).toBe('expired');
  });
});
