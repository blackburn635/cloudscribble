/**
 * Settings — account, subscription (manage / restore / redeem), links, sign out,
 * and in-app account deletion (Apple 5.1.1(v)). Deleting the account doesn't cancel an
 * App Store subscription, so the confirmation says so and offers Manage Subscription first.
 */
import { useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SubscriptionStatusResponse } from '@cloudscribble/shared';
import type { AppStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../lib/api';
import { useScanSession } from '../../scan/ScanSession';
import { useSubscription } from '../../subscription/SubscriptionProvider';
import { env } from '../../config/env';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

const SITE = 'https://cloudscribble.com';
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

function statusLabel(s: SubscriptionStatusResponse | null): string {
  if (!s) return '—';
  if (s.isAdmin && !['active', 'in_trial', 'past_due'].includes(s.status)) return 'Admin access';
  const until = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : null;
  switch (s.status) {
    case 'in_trial':
      return until ? `Free trial · until ${until}` : 'Free trial';
    case 'active':
      return until ? `Active · renews or ends ${until}` : 'Active';
    case 'past_due':
      return 'Payment issue — update it in your Apple account';
    case 'cancelled':
    case 'expired':
      return 'Expired';
    default:
      return 'Not subscribed';
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-warm-gray">{title}</Text>
      <View className="overflow-hidden rounded-xl bg-white">{children}</View>
    </View>
  );
}

function Row({ label, value, onPress, last }: { label: string; value?: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center px-4 py-3.5 active:bg-lavender ${last ? '' : 'border-b border-cream'}`}
    >
      <Text className={`flex-1 text-base ${onPress ? 'text-purple' : 'text-navy'}`}>{label}</Text>
      {value && <Text className="ml-3 shrink text-right text-sm text-warm-gray">{value}</Text>}
      {onPress && <Icon name="chevron.right" size={13} color="#9e9e9e" fallback="›" />}
    </Pressable>
  );
}

export function SettingsScreen({ navigation }: NativeStackScreenProps<AppStackParamList, 'Settings'>) {
  const { user, signOut } = useAuth();
  const api = useApi();
  const { reset } = useScanSession();
  const { status, purchasesReady, refresh } = useSubscription();
  const [deleting, setDeleting] = useState(false);
  const hasAppleSub = status?.source === 'apple_iap' && ['active', 'in_trial', 'past_due'].includes(status.status);

  async function manageSubscription() {
    try {
      if (purchasesReady) return await Purchases.showManageSubscriptions();
    } catch {
      // fall through to the web page
    }
    Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
  }

  async function restore() {
    try {
      await Purchases.restorePurchases();
      const s = await refresh();
      Alert.alert(s?.hasAccess ? 'Purchases restored' : 'No active subscription found for your Apple ID.');
    } catch {
      Alert.alert('Couldn’t restore purchases. Please try again.');
    }
  }

  async function redeem() {
    try {
      await Purchases.presentCodeRedemptionSheet();
    } catch {
      Alert.alert('Couldn’t open the code redemption sheet.');
    }
  }

  function doSignOut() {
    reset();
    signOut();
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api.del('/v1/users/me');
      reset();
      signOut();
    } catch {
      setDeleting(false);
      Alert.alert('Couldn’t delete your account', 'Please try again, or contact support@cloudscribble.com.');
    }
  }

  function confirmDelete() {
    const subWarning = hasAppleSub
      ? '\n\nYour App Store subscription is NOT cancelled by deleting your account. Cancel it in Manage Subscription first, or Apple will keep billing you.'
      : '';
    Alert.alert(
      'Delete account?',
      `This permanently deletes your CloudScribble account and data. Events already saved to your calendar stay there.${subWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(hasAppleSub ? [{ text: 'Manage Subscription', onPress: manageSubscription }] : []),
        { text: 'Delete', style: 'destructive' as const, onPress: deleteAccount },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View className="flex-row items-center px-5 pb-2 pt-2">
        <Pressable onPress={navigation.goBack} hitSlop={12} accessibilityLabel="Back" className="mr-3">
          <Icon name="chevron.left" size={20} color="#6774c8" fallback="‹" />
        </Pressable>
        <Text className="text-[22px] font-bold text-navy">Settings</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <Section title="Account">
          <Row label="Email" value={user?.email} />
          <Row label="Sign Out" onPress={doSignOut} last />
        </Section>

        <Section title="Subscription">
          <Row label="Status" value={statusLabel(status)} />
          {status && <Row label="Scans this month" value={`${status.scansUsedThisMonth} of ${status.scanMonthlyLimit}`} />}
          {status && !status.hasAccess && <Row label="Subscribe" onPress={() => navigation.navigate('Paywall')} />}
          <Row label="Manage Subscription" onPress={manageSubscription} />
          {purchasesReady && <Row label="Restore Purchases" onPress={restore} />}
          {purchasesReady && <Row label="Redeem Planner Code" onPress={redeem} last />}
        </Section>

        <Section title="Help & Legal">
          <Row label="Support" onPress={() => Linking.openURL(`${SITE}/support`)} />
          <Row label="FAQ" onPress={() => Linking.openURL(`${SITE}/faq`)} />
          <Row label="Privacy Policy" onPress={() => Linking.openURL(`${SITE}/privacy`)} />
          <Row label="Terms of Service" onPress={() => Linking.openURL(`${SITE}/terms`)} last />
        </Section>

        <Button title="Delete Account" variant="danger" onPress={confirmDelete} loading={deleting} />
        <Text className="mt-6 text-center text-xs text-warm-gray">
          CloudScribble {Constants.expoConfig?.version ?? ''}
          {env.stage !== 'prod' ? ` · ${env.stage}` : ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
