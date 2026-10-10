/**
 * Public build-time configuration (EXPO_PUBLIC_* — inlined into the bundle; never secrets).
 * EAS builds take these from eas.json; local `expo start` from mobile/.env.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name} — copy mobile/.env.example to mobile/.env`);
  return value;
}

export const env = {
  stage: (process.env.EXPO_PUBLIC_STAGE ?? 'staging') as 'staging' | 'prod',
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  userPoolId: required('EXPO_PUBLIC_USER_POOL_ID', process.env.EXPO_PUBLIC_USER_POOL_ID),
  userPoolClientId: required('EXPO_PUBLIC_USER_POOL_CLIENT_ID', process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID),
};
