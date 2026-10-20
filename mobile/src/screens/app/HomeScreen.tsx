/**
 * Home — placeholder until the scan loop lands (step 6.2). Shows the signed-in user and
 * proves an authenticated API round-trip via GET /v1/health.
 */
import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../lib/api';
import { env } from '../../config/env';
import { Button } from '../../components/ui/Button';

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const api = useApi();
  const [apiStatus, setApiStatus] = useState('checking…');

  useEffect(() => {
    api.get<{ status: string; stage: string }>('/v1/health')
      .then((r) => setApiStatus(`${r.status} (${r.stage})`))
      .catch((e) => setApiStatus(`error: ${e.message}`));
  }, [api]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerClassName="grow px-5 pb-8 pt-6">
        <Image source={require('../../../assets/images/logo.png')} className="mb-6 h-[70px] w-[180px] self-center" resizeMode="contain" />
        <Text className="mb-1 text-[28px] font-bold text-navy">Hi{user?.firstName ? `, ${user.firstName}` : ''}!</Text>
        <Text className="mb-8 text-base text-warm-gray">{user?.email}{user?.isAdmin ? ' · admin' : ''}</Text>

        <View className="mb-8 rounded-xl border-l-4 border-purple bg-white p-4">
          <Text className="text-base font-semibold text-navy">Scanning is coming next</Text>
          <Text className="mt-1 text-sm text-warm-gray">Sign-in works. The camera and calendar screens are the next step.</Text>
        </View>

        <Button title="Start Scanning" disabled />
        <View className="flex-1" />
        <Text className="mb-4 text-center text-xs text-warm-gray">API {apiStatus} · {env.stage}</Text>
        <Button title="Sign Out" variant="ghost" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
