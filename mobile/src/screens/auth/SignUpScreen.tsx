import { useRef, useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage, EMAIL_RE, passwordProblem } from '../../lib/authErrors';
import { FormScreen } from '../../components/ui/FormScreen';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function SignUpScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'SignUp'>) {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = {
    lastName: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
    confirm: useRef<TextInput>(null),
  };
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const email = form.email.trim().toLowerCase();
    if (!form.firstName.trim()) return setError('Please enter your first name.');
    if (!form.lastName.trim()) return setError('Please enter your last name.');
    if (!EMAIL_RE.test(email)) return setError('Please enter a valid email address.');
    const pw = passwordProblem(form.password);
    if (pw) return setError(`Password: ${pw.toLowerCase()}.`);
    if (form.password !== form.confirm) return setError('Passwords do not match.');

    setBusy(true);
    setError(null);
    try {
      await signUp({ email, password: form.password, firstName: form.firstName.trim(), lastName: form.lastName.trim() });
      navigation.navigate('VerifyEmail', { email });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScreen
      title="Create Account"
      subtitle="Sign up to start syncing your planner with your digital calendar."
      onBack={navigation.goBack}
      error={error}
    >
      <Input label="First Name" placeholder="Jane" value={form.firstName} onChangeText={set('firstName')}
        textContentType="givenName" autoComplete="given-name" returnKeyType="next"
        onSubmitEditing={() => refs.lastName.current?.focus()} editable={!busy} />
      <Input ref={refs.lastName} label="Last Name" placeholder="Smith" value={form.lastName} onChangeText={set('lastName')}
        textContentType="familyName" autoComplete="family-name" returnKeyType="next"
        onSubmitEditing={() => refs.email.current?.focus()} editable={!busy} />
      <Input ref={refs.email} label="Email Address" placeholder="your.email@example.com" value={form.email}
        onChangeText={set('email')} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
        textContentType="emailAddress" autoComplete="email" returnKeyType="next"
        onSubmitEditing={() => refs.password.current?.focus()} editable={!busy} />
      <Input ref={refs.password} label="Password" placeholder="Create a strong password" value={form.password}
        onChangeText={set('password')} secureTextEntry textContentType="newPassword" autoComplete="new-password"
        helper="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
        returnKeyType="next" onSubmitEditing={() => refs.confirm.current?.focus()} editable={!busy} />
      <Input ref={refs.confirm} label="Confirm Password" placeholder="Re-enter your password" value={form.confirm}
        onChangeText={set('confirm')} secureTextEntry textContentType="newPassword" autoComplete="new-password"
        returnKeyType="go" onSubmitEditing={submit} editable={!busy} />

      <Button title="Create Account" onPress={submit} loading={busy} className="mt-2" />

      <Text className="mt-5 text-center text-sm leading-5 text-warm-gray">
        By creating an account you agree to our{' '}
        <Text className="text-purple underline" onPress={() => Linking.openURL('https://cloudscribble.com/terms')}>Terms</Text>
        {' '}and{' '}
        <Text className="text-purple underline" onPress={() => Linking.openURL('https://cloudscribble.com/privacy')}>Privacy Policy</Text>.
      </Text>

      <View className="mt-8 items-center">
        <Text className="text-base text-warm-gray">
          Already have an account?{' '}
          <Text className="font-semibold text-purple" onPress={() => navigation.navigate('SignIn')}>Sign In</Text>
        </Text>
      </View>
    </FormScreen>
  );
}
