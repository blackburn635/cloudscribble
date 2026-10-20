/**
 * RootNavigator — swaps the whole tree between AuthStack and AppStack on auth state
 * (React Navigation's auth-flow pattern; no "back to Sign In" after signing in).
 */
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import type { AppStackParamList, AuthStackParamList } from './types';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { HomeScreen } from '../screens/app/HomeScreen';

const Auth = createNativeStackNavigator<AuthStackParamList>();
const App = createNativeStackNavigator<AppStackParamList>();

function AuthStack() {
  return (
    <Auth.Navigator screenOptions={{ headerShown: false }}>
      <Auth.Screen name="Welcome" component={WelcomeScreen} />
      <Auth.Screen name="SignIn" component={SignInScreen} />
      <Auth.Screen name="SignUp" component={SignUpScreen} />
      <Auth.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Auth.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Auth.Navigator>
  );
}

function AppStack() {
  return (
    <App.Navigator screenOptions={{ headerShown: false }}>
      <App.Screen name="Home" component={HomeScreen} />
    </App.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator size="large" color="#6774c8" />
      </View>
    );
  }
  return isAuthenticated ? <AppStack /> : <AuthStack />;
}
