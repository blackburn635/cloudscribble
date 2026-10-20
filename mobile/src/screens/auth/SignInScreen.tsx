import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage, EMAIL_RE } from '../../lib/authErrors';
import { FormScreen } from '../../components/ui/FormScreen';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function SignInScreen({ navigation, route }: NativeStackScreenProps<AuthStackParamList, 'SignIn'>) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setError('Please enter a valid email address.');
    if (!password) return setError('Please enter your password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(e, password); // RootNavigator swaps to the app on success
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'UserNotConfirmedException') {
        navigation.navigate('VerifyEmail', { email: e });
      } else {
        setError(authErrorMessage(err));
      }
      setBusy(false);
    }
  }

  return (
    <FormScreen
      title="Sign In"
      subtitle={route.params?.notice ?? 'Welcome back! Sign in to continue syncing your planner.'}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      error={error}
    >
      <Input
        label="Email Address"
        placeholder="your.email@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!busy}
      />
      <Input
        ref={passwordRef}
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!busy}
      />

      <Pressable
        onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
        className="-mt-2.5 mb-5 self-end"
        hitSlop={8}
      >
        <Text className="text-sm font-semibold text-purple">Forgot your password?</Text>
      </Pressable>

      <Button title="Sign In" onPress={submit} loading={busy} className="mt-5" />

      <View className="mt-8 items-center">
        <Text className="text-base text-warm-gray">
          Don't have an account?{' '}
          <Text className="font-semibold text-purple" onPress={() => navigation.navigate('SignUp')}>
            Sign Up
          </Text>
        </Text>
      </View>
    </FormScreen>
  );
}
