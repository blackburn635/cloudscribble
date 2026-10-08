/**
 * Public, per-branch configuration (Amplify branch environment variables).
 * These are identifiers, not secrets.
 */
export const config = {
  apiUrl: import.meta.env.VITE_API_URL as string | undefined,
  userPoolId: import.meta.env.VITE_USER_POOL_ID as string | undefined,
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID as string | undefined,
  /** Set on the production (main) branch only. */
  gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined,
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined,
};
