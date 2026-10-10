import type { ConfigContext, ExpoConfig } from 'expo/config';
// Expo's config loader can't import TypeScript from packages/shared, so the two brand values
// needed here are copied — keep them in sync with packages/shared/src/constants/branding.ts.
const APP_NAME = 'CloudScribble';
const CREAM = '#FDF8F0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'cloudscribble',
  scheme: 'cloudscribble',
  owner: 'blackburn635',
  version: '1.0.0',
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png', // TODO: real 1024×1024 icon (no transparency) from docs/brand/logo-master.pdf
  ios: {
    bundleIdentifier: 'com.cloudscribble.app',
    supportsTablet: false,
    buildNumber: '1',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.cloudscribble.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: CREAM,
    },
  },
  plugins: [
    'expo-dev-client',
    'expo-secure-store',
    'expo-font',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: CREAM },
    ],
    // Before expo-camera so the camera string below wins. iOS uses the system photo picker
    // (no library permission prompt); the string is still required for review.
    [
      'expo-image-picker',
      {
        photosPermission: 'CloudScribble lets you choose a photo of a planner page you’ve already taken.',
        microphonePermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'CloudScribble uses the camera to photograph your planner pages so it can read your handwritten plans.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-calendar',
      {
        calendarPermission:
          'CloudScribble adds the events you approve to your calendar and checks for ones it already added, so rescans don’t create duplicates.',
      },
    ],
    // Never list react-native-purchases here — it has no config plugin.
  ],
  extra: {
    // EAS project @blackburn635/cloudscribble (reused from the archived app: same credentials + build numbers).
    eas: { projectId: 'ace9d970-b90c-4c88-b8e2-6dab8a49da43' },
  },
});
