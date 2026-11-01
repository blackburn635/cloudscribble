import './global.css';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ScanSessionProvider } from './src/scan/ScanSession';
import { SubscriptionProvider } from './src/subscription/SubscriptionProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <ScanSessionProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </ScanSessionProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
