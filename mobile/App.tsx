import './global.css';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { BRAND, SCAN_MONTHLY_LIMIT } from '@cloudscribble/shared';
import { env } from './src/config/env';

// Placeholder while screens are ported — proves NativeWind + shared package wiring.
export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-cream px-6">
      <Text className="text-3xl font-bold text-navy">{BRAND.name}</Text>
      <Text className="mt-2 text-center text-warm-gray">{BRAND.tagline}</Text>
      <Text className="mt-6 text-xs text-purple">
        {env.stage} · {SCAN_MONTHLY_LIMIT} scans/month
      </Text>
      <StatusBar style="dark" />
    </View>
  );
}
