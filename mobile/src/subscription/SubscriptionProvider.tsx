/**
 * SubscriptionProvider — RevenueCat setup + the server's view of access.
 *
 * - The API (GET /v1/subscription/status) is the source of truth for access and scans left;
 *   the RevenueCat SDK is only used to buy/restore/redeem.
 * - RevenueCat App User ID = Cognito sub (Purchases.logIn), so webhooks map to the right user.
 * - After a purchase, the webhook can lag a few seconds: `refreshUntilAccess` polls briefly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { SubscriptionStatusResponse } from '@cloudscribble/shared';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../lib/api';
import { env } from '../config/env';

interface SubscriptionValue {
  status: SubscriptionStatusResponse | null;
  loading: boolean;
  /** RevenueCat configured and logged in as this user */
  purchasesReady: boolean;
  refresh: () => Promise<SubscriptionStatusResponse | null>;
  refreshUntilAccess: (timeoutMs?: number) => Promise<boolean>;
}

const Ctx = createContext<SubscriptionValue | null>(null);
export const useSubscription = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSubscription must be used within SubscriptionProvider');
  return v;
};

let configured = false;
function configurePurchases(): boolean {
  if (configured) return true;
  if (Platform.OS !== 'ios' || !env.revenueCatIosKey) return false;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: env.revenueCatIosKey });
  configured = true;
  return true;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const api = useApi();
  const [status, setStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasesReady, setPurchasesReady] = useState(false);
  const userId = user?.userId;
  const latestUser = useRef(userId);
  latestUser.current = userId;

  const refresh = useCallback(async () => {
    if (!latestUser.current) return null;
    setLoading(true);
    try {
      const s = await api.get<SubscriptionStatusResponse>('/v1/subscription/status');
      setStatus(s);
      return s;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [api]);

  const refreshUntilAccess = useCallback(
    async (timeoutMs = 15_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const s = await refresh();
        if (s?.hasAccess) return true;
        await new Promise((r) => setTimeout(r, 1500));
      }
      return false;
    },
    [refresh]
  );

  // Link RevenueCat to the signed-in user; reset on sign-out.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setStatus(null);
      setPurchasesReady(false);
      if (configured) Purchases.logOut().catch(() => undefined);
      return;
    }
    refresh();
    if (configurePurchases()) {
      Purchases.logIn(userId)
        .then(() => !cancelled && setPurchasesReady(true))
        .catch(() => !cancelled && setPurchasesReady(false));
    }
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  // Re-check when the app returns to the foreground (renewals, cancellations, offer codes).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && latestUser.current) refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(
    () => ({ status, loading, purchasesReady, refresh, refreshUntilAccess }),
    [status, loading, purchasesReady, refresh, refreshUntilAccess]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
