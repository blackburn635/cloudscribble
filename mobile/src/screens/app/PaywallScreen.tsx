/**
 * Paywall — monthly / annual from the RevenueCat "default" offering, 14-day free trial
 * (Apple intro offer), restore, and offer-code redemption (planner free year).
 * Includes Apple 3.1.2 disclosures: price/period, trial terms, auto-renew, Terms + Privacy links.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Purchases, { INTRO_ELIGIBILITY_STATUS, PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ENTITLEMENT_ID, SCAN_MONTHLY_LIMIT } from '@cloudscribble/shared';
import type { AppStackParamList } from '../../navigation/types';
import { useSubscription } from '../../subscription/SubscriptionProvider';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

const BENEFITS = [
  { icon: 'doc.text.viewfinder', text: 'Scan any paper planner — any brand, any layout' },
  { icon: 'sparkles', text: 'AI reads your handwriting into calendar events' },
  { icon: 'calendar.badge.plus', text: 'Save to any calendar on your iPhone, even shared ones' },
  { icon: 'arrow.triangle.2.circlepath', text: `Up to ${SCAN_MONTHLY_LIMIT} scans every month` },
] as const;

export function PaywallScreen({ navigation }: NativeStackScreenProps<AppStackParamList, 'Paywall'>) {
  const { purchasesReady, refreshUntilAccess } = useSubscription();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [trialEligible, setTrialEligible] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!purchasesReady) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const pkgs = (offerings.current?.availablePackages ?? [])
          .filter((p) => p.packageType === PACKAGE_TYPE.ANNUAL || p.packageType === PACKAGE_TYPE.MONTHLY)
          .sort((a) => (a.packageType === PACKAGE_TYPE.ANNUAL ? -1 : 1));
        setPackages(pkgs);
        setSelected(pkgs[0]?.identifier ?? null);
        const ids = pkgs.map((p) => p.product.identifier);
        if (ids.length) {
          const elig = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
          setTrialEligible(Object.fromEntries(ids.map((id) => [id, elig[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE])));
        }
      } catch {
        setMessage('Subscriptions are unavailable right now. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, [purchasesReady]);

  const chosen = packages.find((p) => p.identifier === selected) ?? null;
  const chosenTrial = chosen ? trialEligible[chosen.product.identifier] && !!chosen.product.introPrice : false;

  async function finishIfActive(active: boolean) {
    if (!active) return false;
    const ok = await refreshUntilAccess();
    if (ok) navigation.goBack();
    else setMessage('Your purchase went through — it can take a moment to activate. If scanning is still locked, reopen the app in a minute.');
    return true;
  }

  async function buy() {
    if (!chosen) return;
    setBusy('buy');
    setMessage(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage(chosen);
      await finishIfActive(!!customerInfo.entitlements.active[ENTITLEMENT_ID]);
    } catch (e) {
      if (!(e as { userCancelled?: boolean }).userCancelled) setMessage('The purchase didn’t complete. You haven’t been charged.');
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    setMessage(null);
    try {
      const info = await Purchases.restorePurchases();
      if (!(await finishIfActive(!!info.entitlements.active[ENTITLEMENT_ID]))) setMessage('No active subscription was found for your Apple ID.');
    } catch {
      setMessage('Couldn’t restore purchases. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function redeem() {
    setMessage(null);
    try {
      await Purchases.presentCodeRedemptionSheet();
      // The sheet doesn't report success; the webhook + foreground refresh pick it up.
      setMessage('After redeeming, it can take a minute to activate. You’ll be able to scan once it does.');
      refreshUntilAccess(30_000).then((ok) => ok && navigation.goBack());
    } catch {
      setMessage('Couldn’t open the code redemption sheet.');
    }
  }

  const periodLabel = (p: PurchasesPackage) => (p.packageType === PACKAGE_TYPE.ANNUAL ? 'year' : 'month');

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View className="flex-row justify-end px-5 pt-2">
        <Pressable onPress={navigation.goBack} hitSlop={12} accessibilityLabel="Close" className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <Icon name="xmark" size={15} fallback="✕" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-6">
        <Text className="mb-2 text-center text-[28px] font-bold text-navy">Unlock CloudScribble</Text>
        <Text className="mb-6 text-center text-base text-warm-gray">Turn your paper planner into calendar events in seconds.</Text>

        {BENEFITS.map((b) => (
          <View key={b.text} className="mb-3 flex-row items-center">
            <View className="mr-3 w-8 items-center"><Icon name={b.icon} size={22} color="#6774c8" /></View>
            <Text className="flex-1 text-base text-navy">{b.text}</Text>
          </View>
        ))}

        <View className="mt-5">
          {loading ? (
            <ActivityIndicator color="#6774c8" />
          ) : !purchasesReady ? (
            <Text className="text-center text-base text-warm-gray">Subscriptions aren’t set up in this build yet.</Text>
          ) : packages.length === 0 ? (
            <Text className="text-center text-base text-warm-gray">No subscription options are available right now.</Text>
          ) : (
            packages.map((p) => {
              const active = p.identifier === selected;
              const annual = p.packageType === PACKAGE_TYPE.ANNUAL;
              const trial = trialEligible[p.product.identifier] && !!p.product.introPrice;
              return (
                <Pressable
                  key={p.identifier}
                  onPress={() => setSelected(p.identifier)}
                  className={`mb-3 flex-row items-center rounded-2xl border-2 p-4 ${active ? 'border-purple bg-lavender' : 'border-white bg-white'}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-lg font-bold text-navy">{annual ? 'Annual' : 'Monthly'}</Text>
                      {annual && <Text className="ml-2 rounded-full bg-mauve px-2 py-0.5 text-xs font-bold text-white">BEST VALUE</Text>}
                    </View>
                    <Text className="text-base text-warm-gray">
                      {p.product.priceString} / {periodLabel(p)}
                      {annual && p.product.pricePerMonthString ? `  ·  ${p.product.pricePerMonthString}/mo` : ''}
                    </Text>
                    {trial && <Text className="text-sm font-semibold text-sage">14-day free trial</Text>}
                  </View>
                  <Icon name={active ? 'checkmark.circle.fill' : 'circle'} size={24} color={active ? '#6774c8' : '#C5A7B8'} fallback={active ? '●' : '○'} />
                </Pressable>
              );
            })
          )}
        </View>

        {message && <Text className="mb-3 mt-2 text-center text-base text-navy">{message}</Text>}

        <Button
          title={chosenTrial ? 'Start Free Trial' : 'Subscribe'}
          onPress={buy}
          loading={busy === 'buy'}
          disabled={!chosen || busy !== null}
          className="mt-3"
        />

        {chosen && (
          <Text className="mt-3 text-center text-xs leading-4 text-warm-gray">
            {chosenTrial
              ? `Free for 14 days, then ${chosen.product.priceString} per ${periodLabel(chosen)}. `
              : `${chosen.product.priceString} per ${periodLabel(chosen)}. `}
            Payment is charged to your Apple ID. The subscription renews automatically unless cancelled at least 24 hours
            before the end of the current period. Manage or cancel anytime in your Apple account settings.
          </Text>
        )}

        <View className="mt-5 flex-row justify-center gap-6">
          <Pressable onPress={restore} disabled={busy !== null || !purchasesReady} hitSlop={8}>
            <Text className="text-sm font-semibold text-purple">{busy === 'restore' ? 'Restoring…' : 'Restore Purchases'}</Text>
          </Pressable>
          <Pressable onPress={redeem} disabled={!purchasesReady} hitSlop={8}>
            <Text className="text-sm font-semibold text-purple">Redeem Code</Text>
          </Pressable>
        </View>
        <Text className="mt-2 text-center text-xs text-warm-gray">Bought a CloudScribble planner? Redeem the code inside for a free year.</Text>

        <View className="mt-4 flex-row justify-center gap-6">
          <Text className="text-xs text-purple underline" onPress={() => Linking.openURL('https://cloudscribble.com/terms')}>Terms of Service</Text>
          <Text className="text-xs text-purple underline" onPress={() => Linking.openURL('https://cloudscribble.com/privacy')}>Privacy Policy</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
