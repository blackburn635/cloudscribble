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
    // eas: { projectId } is added by `eas init`.
  },
});
