import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage } from '../../lib/authErrors';
import { FormScreen } from '../../components/ui/FormScreen';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function VerifyEmailScreen({ navigation, route }: NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>) {
  const { email } = route.params;
  const { confirmSignUp, resendSignUpCode } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    if (!/^\d{6}$/.test(code.trim())) return setError('Please enter the 6-digit code from the email.');
    setBusy(true);
    setError(null);
    try {
      await confirmSignUp(email, code.trim());
      navigation.reset({ index: 0, routes: [{ name: 'SignIn', params: { email, notice: 'Email verified! Sign in to get started.' } }] });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await resendSignUpCode(email);
      setNotice('A new code is on its way. Check your inbox (and spam folder).');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <FormScreen
      title="Verify Your Email"
      subtitle={
        <Text className="text-base leading-6 text-warm-gray">
          We sent a 6-digit verification code to:{'\n'}
          <Text className="font-semibold text-navy">{email}</Text>
        </Text>
      }
      onBack={navigation.goBack}
      error={error}
    >
      <Input
        label="Verification Code"
        placeholder="Enter 6-digit code"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!busy}
      />
      {notice && <Text className="mb-4 text-sm text-sage">{notice}</Text>}

      <Button title="Verify Email" onPress={submit} loading={busy} />

      <Pressable onPress={resend} disabled={resending} className="mt-6 items-center" hitSlop={8}>
        <Text className="text-base font-semibold text-purple">{resending ? 'Sending…' : 'Didn’t get it? Resend code'}</Text>
      </Pressable>
    </FormScreen>
  );
}
