/**
 * Camera — full-screen capture with an 8.5×11 page guide (the archived PlannerCamera, now
 * brand-neutral: no CloudScribble-only columns or code box). Uses the public takePictureAsync.
 */
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import { useScanSession } from '../../scan/ScanSession';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

export function CameraScreen({ navigation }: NativeStackScreenProps<AppStackParamList, 'Camera'>) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const { startScan } = useScanSession();
  const { width } = useWindowDimensions();
  const guideWidth = width * 0.86;
  const guideHeight = (guideWidth * 11) / 8.5;

  async function capture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (!photo?.uri) throw new Error('no photo');
      startScan(photo.uri);
      navigation.replace('Scanning', { width: photo.width, height: photo.height });
    } catch {
      setError('Couldn’t take the photo. Please try again.');
      setCapturing(false);
    }
  }

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    startScan(a.uri);
    navigation.replace('Scanning', { width: a.width, height: a.height });
  }

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-cream px-6">
        <Text className="mb-3 text-center text-2xl font-bold text-navy">Camera access needed</Text>
        <Text className="mb-8 text-center text-base text-warm-gray">
          CloudScribble uses the camera to photograph your planner pages.
        </Text>
        {permission.canAskAgain ? (
          <Button title="Allow Camera" onPress={requestPermission} />
        ) : (
          <Button title="Open Settings" onPress={() => Linking.openSettings()} />
        )}
        <Button title="Choose from Photos instead" variant="ghost" onPress={pickPhoto} className="mt-3" />
        <Button title="Back" variant="ghost" onPress={navigation.goBack} />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" flash={flashOn ? 'on' : 'off'} onCameraReady={() => setReady(true)} />

      {/* Page guide */}
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View style={{ width: guideWidth, height: guideHeight }} className="rounded-lg border border-white/60" />
        <Text className="mt-3 text-center text-sm text-white/90">Fit the planner page inside the frame</Text>
      </View>

      <SafeAreaView className="absolute inset-x-0 top-0" edges={['top']}>
        <View className="mx-4 mt-2 flex-row justify-between">
          <Pressable onPress={navigation.goBack} hitSlop={12} accessibilityLabel="Cancel" className="h-11 w-11 items-center justify-center rounded-full bg-black/50">
            <Icon name="xmark" size={20} color="#ffffff" fallback="✕" />
          </Pressable>
          <Pressable onPress={() => setFlashOn((f) => !f)} hitSlop={12} accessibilityLabel={flashOn ? 'Turn flash off' : 'Turn flash on'} className="h-11 w-11 items-center justify-center rounded-full bg-black/50">
            <Icon name={flashOn ? 'bolt.fill' : 'bolt.slash.fill'} size={20} color={flashOn ? '#FFCC33' : '#ffffff'} fallback="⚡" />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView className="absolute inset-x-0 bottom-0" edges={['bottom']}>
        {error && <Text className="mb-3 text-center text-base text-white">{error}</Text>}
        <View className="mb-4 flex-row items-center justify-between px-8">
          <Pressable onPress={pickPhoto} hitSlop={10} accessibilityLabel="Choose from Photos" className="h-14 w-20 items-center justify-center">
            <Icon name="photo.on.rectangle" size={30} color="#ffffff" fallback="🖼" />
          </Pressable>
          <Pressable
            onPress={capture}
            disabled={!ready || capturing}
            accessibilityLabel="Take photo"
            className="h-20 w-20 items-center justify-center rounded-full border-4 border-white"
            style={{ opacity: ready ? 1 : 0.5 }}
          >
            {capturing ? <ActivityIndicator color="#fff" /> : <View className="h-16 w-16 rounded-full bg-white" />}
          </Pressable>
          <View className="w-20" />
        </View>
      </SafeAreaView>
    </View>
  );
}
