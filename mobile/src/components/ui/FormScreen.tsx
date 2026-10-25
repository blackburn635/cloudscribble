/**
 * FormScreen — shared layout for the auth screens: safe area, keyboard avoidance,
 * scroll, optional Back link, title and subtitle, plus an inline error banner.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Icon } from './Icon';

interface FormScreenProps {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  error?: string | null;
  children: ReactNode;
}

export function FormScreen({ title, subtitle, onBack, error, children }: FormScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerClassName="grow px-5 pb-8 pt-5"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-10">
            {onBack && (
              <Pressable onPress={onBack} hitSlop={12} className="mb-5 flex-row items-center self-start" accessibilityRole="button" accessibilityLabel="Back">
                <Icon name="chevron.backward" size={17} color="#6774c8" fallback="‹" />
                <Text className="ml-1 text-base font-semibold text-purple">Back</Text>
              </Pressable>
            )}
            <Text className="mb-2 text-[32px] font-bold text-navy">{title}</Text>
            {typeof subtitle === 'string' ? <Text className="text-base leading-6 text-warm-gray">{subtitle}</Text> : subtitle}
          </View>
          {error ? (
            <View className="mb-5 rounded-xl bg-rose/40 p-4" accessibilityLiveRegion="polite">
              <Text className="text-base text-navy">{error}</Text>
            </View>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
