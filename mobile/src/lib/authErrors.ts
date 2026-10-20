/**
 * Friendly messages for Cognito errors. Sign-in stays generic so it never reveals
 * whether an email has an account (the pool also has preventUserExistenceErrors on).
 */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string; name?: string })?.code ?? (err as { name?: string })?.name ?? '';
  const message = (err as Error)?.message ?? '';

  switch (code) {
    case 'NotAuthorizedException':
      return message.includes('attempts exceeded')
        ? 'Too many attempts. Please wait a few minutes and try again.'
        : 'Incorrect email or password.';
    case 'UserNotFoundException':
      return 'Incorrect email or password.';
    case 'UserNotConfirmedException':
      return 'Please verify your email first.';
    case 'UsernameExistsException':
      return 'An account with this email already exists. Try signing in instead.';
    case 'InvalidPasswordException':
      return 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.';
    case 'CodeMismatchException':
      return 'That code doesn’t match. Please check it and try again.';
    case 'ExpiredCodeException':
      return 'That code has expired. Tap “Resend code” to get a new one.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'InvalidParameterException':
      return 'Please check your details and try again.';
    case 'NetworkError':
      return 'No connection. Check your internet and try again.';
    case 'NewPasswordRequired':
      return message;
    default:
      return message.includes('Network') ? 'No connection. Check your internet and try again.' : 'Something went wrong. Please try again.';
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors the Cognito pool policy (infrastructure/lib/cloudscribble-stack.ts). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters';
  if (!/[a-z]/.test(pw)) return 'Add a lowercase letter';
  if (!/[A-Z]/.test(pw)) return 'Add an uppercase letter';
  if (!/\d/.test(pw)) return 'Add a number';
  return null;
}
