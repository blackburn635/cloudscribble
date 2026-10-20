/**
 * AuthContext — Cognito authentication state (ported from TableTryb, households removed).
 *
 * Tokens live in the Keychain via SecureCognitoStorage. The mount-time session check
 * awaits `storage.ready` so a returning user doesn't flash as signed-out.
 * Identity only — subscription and usage state always come from the API, never the token.
 */
import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { SecureCognitoStorage } from '../lib/SecureCognitoStorage';
import { env } from '../config/env';

const ADMIN_GROUP = 'cloudscribble-admins';

const storage = new SecureCognitoStorage(env.userPoolClientId);
const userPool = new CognitoUserPool({
  UserPoolId: env.userPoolId,
  ClientId: env.userPoolClientId,
  Storage: storage,
});

/** Every manual CognitoUser must get Storage explicitly (CLAUDE.md). */
const cognitoUserFor = (email: string) => new CognitoUser({ Username: email, Pool: userPool, Storage: storage });

export interface AuthUser {
  /** Cognito sub — also the RevenueCat App User ID */
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

export interface SignUpFields {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fields: SignUpFields) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendSignUpCode: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => void;
  /** Fresh ID token for API calls (refreshes automatically when expired). */
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.replace(/^\[|\]$/g, '').split(/[,\s]+/).filter(Boolean);
  return [];
}

function extractUser(session: CognitoUserSession): AuthUser {
  const p = session.getIdToken().decodePayload();
  return {
    userId: p.sub,
    email: p.email || '',
    firstName: p.given_name || '',
    lastName: p.family_name || '',
    isAdmin: parseGroups(p['cognito:groups']).includes(ADMIN_GROUP),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore a saved session after Keychain hydration. `cancelled` keeps StrictMode remounts safe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await storage.ready;
      if (cancelled) return;
      const current = userPool.getCurrentUser();
      if (!current) return setIsLoading(false);
      current.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (cancelled) return;
        if (!err && session?.isValid()) setUser(extractUser(session));
        setIsLoading(false);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      new Promise<void>((resolve, reject) => {
        cognitoUserFor(email).authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
          onSuccess: (session) => {
            setUser(extractUser(session));
            resolve();
          },
          onFailure: reject,
          // Only admin-created accounts hit this; regular sign-ups never do.
          newPasswordRequired: () =>
            reject(Object.assign(new Error('Please reset your password to finish setting up this account.'), { code: 'NewPasswordRequired' })),
        });
      }),
    []
  );

  const signUp = useCallback(
    ({ email, password, firstName, lastName }: SignUpFields) =>
      new Promise<void>((resolve, reject) => {
        const attributes = [
          new CognitoUserAttribute({ Name: 'email', Value: email }),
          new CognitoUserAttribute({ Name: 'given_name', Value: firstName }),
          new CognitoUserAttribute({ Name: 'family_name', Value: lastName }),
        ];
        userPool.signUp(email, password, attributes, [], (err) => (err ? reject(err) : resolve()));
      }),
    []
  );

  const confirmSignUp = useCallback(
    (email: string, code: string) =>
      new Promise<void>((resolve, reject) => {
        cognitoUserFor(email).confirmRegistration(code, true, (err) => (err ? reject(err) : resolve()));
      }),
    []
  );

  const resendSignUpCode = useCallback(
    (email: string) =>
      new Promise<void>((resolve, reject) => {
        cognitoUserFor(email).resendConfirmationCode((err) => (err ? reject(err) : resolve()));
      }),
    []
  );

  const forgotPassword = useCallback(
    (email: string) =>
      new Promise<void>((resolve, reject) => {
        cognitoUserFor(email).forgotPassword({
          onSuccess: () => resolve(),
          onFailure: reject,
          inputVerificationCode: () => resolve(),
        });
      }),
    []
  );

  const confirmPassword = useCallback(
    (email: string, code: string, newPassword: string) =>
      new Promise<void>((resolve, reject) => {
        cognitoUserFor(email).confirmPassword(code, newPassword, { onSuccess: () => resolve(), onFailure: reject });
      }),
    []
  );

  const signOut = useCallback(() => {
    userPool.getCurrentUser()?.signOut();
    setUser(null);
  }, []);

  const getToken = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        const current = userPool.getCurrentUser();
        if (!current) return reject(new Error('Not signed in'));
        current.getSession((err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session?.isValid()) return reject(err || new Error('Session expired'));
          resolve(session.getIdToken().getJwtToken());
        });
      }),
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        confirmSignUp,
        resendSignUpCode,
        forgotPassword,
        confirmPassword,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
