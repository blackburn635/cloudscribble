/**
 * Home — the archived home view: logo header, greeting, how-it-works list, Start Scanning,
 * plus Choose from Photos and the scans-left count (from the last scan this session).
 */
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SCAN_MONTHLY_LIMIT } from '@cloudscribble/shared';
import type { AppStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useScanSession } from '../../scan/ScanSession';
import { env } from '../../config/env';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

const STEPS = [
  { icon: 'camera.fill', fallback: '📸', text: 'Photograph a planner page' },
  { icon: 'pencil', fallback: '✏️', text: 'Check and fix the events' },
  { icon: 'calendar.badge.plus', fallback: '📅', text: 'Save them to your calendar' },
] as const;

export function HomeScreen({ navigation }: NativeStackScreenProps<AppStackParamList, 'Home'>) {
  const { user, signOut } = useAuth();
  const { startScan, remainingThisMonth, reset } = useScanSession();

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    startScan(a.uri);
    navigation.navigate('Scanning', { width: a.width, height: a.height });
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Image source={require('../../../assets/images/logo.png')} className="h-[52px] w-[150px]" resizeMode="contain" accessibilityLabel="CloudScribble" />
        <Pressable onPress={() => { reset(); signOut(); }} hitSlop={10}>
          <Text className="text-sm font-semibold text-purple">Sign Out</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="grow px-5 pb-6 pt-6">
        <Text className="mb-1 text-[28px] font-bold text-navy">Hi{user?.firstName ? `, ${user.firstName}` : ''}!</Text>
        <Text className="mb-8 text-base text-warm-gray">Ready to sync your planner?</Text>

        {STEPS.map((s) => (
          <View key={s.text} className="mb-3 flex-row items-center rounded-xl border-l-4 border-purple bg-white p-4">
            <View className="mr-4 w-8 items-center"><Icon name={s.icon} size={24} color="#6774c8" fallback={s.fallback} /></View>
            <Text className="text-base font-medium text-navy">{s.text}</Text>
          </View>
        ))}

        <View className="mt-6 gap-3">
          <Button title="Start Scanning" onPress={() => navigation.navigate('Camera')} />
          <Button title="Choose from Photos" variant="secondary" onPress={pickPhoto} />
        </View>

        <View className="flex-1" />
        <Text className="mt-8 text-center text-xs text-warm-gray">
          {remainingThisMonth !== null ? `${remainingThisMonth} of ${SCAN_MONTHLY_LIMIT} scans left this month` : `${SCAN_MONTHLY_LIMIT} scans per month`}
          {env.stage !== 'prod' ? ` · ${env.stage}` : ''}
          {user?.isAdmin ? ' · admin' : ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
