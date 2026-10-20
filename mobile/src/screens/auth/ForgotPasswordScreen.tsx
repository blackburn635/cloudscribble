/**
 * Forgot password — two steps on one screen: request a code, then set a new password.
 * The request step always reports success so it never reveals whether an email has an account.
 */
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage, EMAIL_RE, passwordProblem } from '../../lib/authErrors';
import { FormScreen } from '../../components/ui/FormScreen';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function ForgotPasswordScreen({ navigation, route }: NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>) {
  const { forgotPassword, confirmPassword } = useAuth();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const normalized = email.trim().toLowerCase();

  async function requestCode() {
    if (!EMAIL_RE.test(normalized)) return setError('Please enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(normalized);
    } catch (err) {
      // Throttling is worth showing; anything else (incl. unknown email) proceeds silently.
      const code = (err as { code?: string }).code;
      if (code === 'LimitExceededException' || code === 'TooManyRequestsException') {
        setBusy(false);
        return setError(authErrorMessage(err));
      }
    }
    setBusy(false);
    setStep('reset');
  }

  async function resetPassword() {
    if (!/^\d{6}$/.test(code.trim())) return setError('Please enter the 6-digit code from the email.');
    const pw = passwordProblem(password);
    if (pw) return setError(`Password: ${pw.toLowerCase()}.`);
    setBusy(true);
    setError(null);
    try {
      await confirmPassword(normalized, code.trim(), password);
      navigation.reset({
        index: 0,
        routes: [{ name: 'SignIn', params: { email: normalized, notice: 'Password updated. Sign in with your new password.' } }],
      });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  if (step === 'request') {
    return (
      <FormScreen
        title="Reset Password"
        subtitle="Enter your account email and we’ll send you a code to reset your password."
        onBack={navigation.goBack}
        error={error}
      >
        <Input label="Email Address" placeholder="your.email@example.com" value={email} onChangeText={setEmail}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress"
          autoComplete="email" returnKeyType="go" onSubmitEditing={requestCode} editable={!busy} />
        <Button title="Send Code" onPress={requestCode} loading={busy} />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Set a New Password"
      subtitle={
        <Text className="text-base leading-6 text-warm-gray">
          If an account exists for <Text className="font-semibold text-navy">{normalized}</Text>, we’ve emailed it a 6-digit code.
        </Text>
      }
      onBack={() => setStep('request')}
      error={error}
    >
      <Input label="Verification Code" placeholder="Enter 6-digit code" value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" textContentType="oneTimeCode"
        autoComplete="one-time-code" maxLength={6} returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()} editable={!busy} />
      <Input ref={passwordRef} label="New Password" placeholder="Create a strong password" value={password}
        onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password"
        helper="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
        returnKeyType="go" onSubmitEditing={resetPassword} editable={!busy} />
      <Button title="Update Password" onPress={resetPassword} loading={busy} />
      <Pressable onPress={requestCode} disabled={busy} className="mt-6 items-center" hitSlop={8}>
        <Text className="text-base font-semibold text-purple">Resend code</Text>
      </Pressable>
    </FormScreen>
  );
}
