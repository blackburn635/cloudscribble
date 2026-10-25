/**
 * Scanning — prepare (resize/JPEG) → upload → scan, with progress and friendly errors.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import { useScanSession } from '../../scan/ScanSession';
import { prepareForScan } from '../../scan/imagePrep';
import { scanErrorMessage, useScanApi } from '../../scan/useScanApi';
import { Button } from '../../components/ui/Button';

const STEPS = { prepare: 'Preparing photo…', upload: 'Uploading…', scan: 'Reading your handwriting…' } as const;

export function ScanningScreen({ navigation, route }: NativeStackScreenProps<AppStackParamList, 'Scanning'>) {
  const { photoUri, setResult } = useScanSession();
  const { upload, scan } = useScanApi();
  const [step, setStep] = useState<keyof typeof STEPS>('prepare');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    if (!photoUri) return navigation.goBack();
    setError(null);
    try {
      setStep('prepare');
      const prepared = await prepareForScan(photoUri, route.params?.width, route.params?.height);
      setStep('upload');
      const key = await upload(prepared.uri);
      setStep('scan');
      const result = await scan(key);
      setResult(result);
      navigation.replace('Review');
    } catch (err) {
      setError(scanErrorMessage(err));
    }
  }, [photoUri, route.params, upload, scan, setResult, navigation]);

  useEffect(() => {
    if (started.current) return; // StrictMode double-mount guard
    started.current = true;
    run();
  }, [run]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-cream px-6">
      {photoUri && <Image source={{ uri: photoUri }} className="mb-8 h-64 w-48 rounded-xl" resizeMode="cover" />}
      {error ? (
        <>
          <Text className="mb-6 text-center text-lg text-navy">{error}</Text>
          <Button title="Try Again" onPress={run} className="mb-3 w-full" />
          <Button title="Retake Photo" variant="secondary" onPress={() => navigation.replace('Camera')} className="mb-3 w-full" />
          <Button title="Cancel" variant="ghost" onPress={() => navigation.popToTop()} className="w-full" />
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#6774c8" />
          <Text className="mt-4 text-lg font-semibold text-navy">{STEPS[step]}</Text>
          <Text className="mt-2 text-center text-sm text-warm-gray">This usually takes about 10 seconds.</Text>
        </>
      )}
    </SafeAreaView>
  );
}
