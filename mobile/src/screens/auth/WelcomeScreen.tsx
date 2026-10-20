import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/Button';

const FEATURES = [
  { icon: '📸', text: 'Scan any planner page' },
  { icon: '🤖', text: 'AI reads your handwriting' },
  { icon: '📅', text: 'Events go to your calendar' },
];

export function WelcomeScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Welcome'>) {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerClassName="grow px-5 pb-8 pt-10" showsVerticalScrollIndicator={false}>
        <View className="mb-8 items-center">
          <Image
            source={require('../../../assets/images/logo.png')}
            className="h-[120px] w-[300px]"
            resizeMode="contain"
            accessibilityLabel="CloudScribble"
          />
        </View>

        <View className="mb-10 items-center">
          <Text className="mb-3 text-center text-[28px] font-bold text-navy">Welcome to CloudScribble</Text>
          <Text className="px-2.5 text-center text-base leading-6 text-warm-gray">
            Your planner companion that brings your handwritten schedule to digital life
          </Text>
        </View>

        <View className="mb-10">
          {FEATURES.map((f) => (
            <View key={f.text} className="mb-3 flex-row items-center rounded-xl border-l-4 border-purple bg-white p-4">
              <Text className="mr-4 text-[28px]">{f.icon}</Text>
              <Text className="text-base font-medium text-navy">{f.text}</Text>
            </View>
          ))}
        </View>

        <View className="mb-5 gap-3">
          <Button title="Sign In" onPress={() => navigation.navigate('SignIn')} />
          <Button title="Create Account" variant="secondary" onPress={() => navigation.navigate('SignUp')} />
        </View>

        <Text className="text-center text-sm italic text-warm-gray">
          Sign in or create an account to start syncing your planner
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
