// Polyfills MUST come first. amazon-cognito-identity-js needs
// crypto.getRandomValues for SRP nonce generation; this polyfill provides it.
// Importing this anywhere later in the dep graph risks a tree-shaker reorder.
import 'react-native-get-random-values';
import { NativeModules } from 'react-native';

// amazon-cognito-identity-js v6.3.x's RN getRandomBase64 looks for either
// NativeModules.ExpoRandom (legacy Expo, removed when replaced by
// expo-crypto in SDK 50+) or NativeModules.RNAWSCognito (a deprecated
// vendored native module the SDK dropped). Neither exists in Expo SDK 55.
//
// Without this shim:
//   - In dev, the SDK's outdated `nativeCallSyncHook` check trips and it
//     falls back to Math.random with the "insecure random" warning.
//   - In production, it bypasses the check and throws
//     "Could not find a native getRandomBase64 implementation" on signin.
//
// Polyfill ExpoRandom.getRandomBase64String in JS, backed by the
// polyfilled crypto.getRandomValues from react-native-get-random-values
// (which delegates to a real native module via Expo autolinking).
if (!NativeModules.ExpoRandom && !NativeModules.RNAWSCognito) {
  (NativeModules as any).ExpoRandom = {
    getRandomBase64String: (byteLength: number): string => {
      const arr = new Uint8Array(byteLength);
      (globalThis as any).crypto.getRandomValues(arr);
      let binary = '';
      for (let i = 0; i < arr.length; i++) {
        binary += String.fromCharCode(arr[i]);
      }
      return (globalThis as any).btoa(binary);
    },
  };
}

// The SDK's getRandomValues.native.js also gates its native path on
// `global.nativeCallSyncHook` being defined when __DEV__ is true. This
// is a legacy bridge flag that React Native's new architecture (default
// since 0.76) doesn't set, even though synchronous native calls work
// fine via JSI/TurboModules. Without this, dev sign-ins skip the native
// path entirely and fall back to Math.random.
//
// Safe to enable only after the ExpoRandom shim above is installed:
// flipping the flag without the shim would replace dev's "warning +
// Math.random" with "throw on signin" (matching the broken production
// behavior the shim also fixes).
if (typeof (globalThis as any).nativeCallSyncHook === 'undefined') {
  (globalThis as any).nativeCallSyncHook = true;
}

import { registerRootComponent } from 'expo';
import App from './App';

// Sentry init goes here before TestFlight (CLAUDE.md).

registerRootComponent(App);
