export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: { email?: string; notice?: string } | undefined;
  SignUp: undefined;
  VerifyEmail: { email: string };
  ForgotPassword: { email?: string } | undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Camera: undefined;
  Scanning: { width?: number; height?: number } | undefined;
  Review: undefined;
};
