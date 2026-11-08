import './global.css';
import * as Sentry from '@sentry/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ScanSessionProvider } from './src/scan/ScanSession';
import { SubscriptionProvider } from './src/subscription/SubscriptionProvider';
import { env } from './src/config/env';

// Crash + error reporting. No PII: no user IDs, emails, photos, or scanned events are attached.
Sentry.init({
  dsn: env.sentryDsn,
  enabled: !!env.sentryDsn && !__DEV__,
  environment: env.stage,
  sendDefaultPii: false,
  tracesSampleRate: env.stage === 'prod' ? 0.1 : 1.0,
});

function App() {
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

export default Sentry.wrap(App);
