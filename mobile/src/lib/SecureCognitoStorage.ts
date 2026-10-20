/**
 * SecureCognitoStorage
 *
 * Bridges amazon-cognito-identity-js's synchronous storage interface
 * (`ICognitoStorage`) to expo-secure-store's async API.
 *
 * Design
 * ------
 *   1. An in-memory Map serves all synchronous reads and writes — this
 *      is what Cognito's SDK actually interacts with.
 *   2. `hydrate()` runs once at construction, pre-loading the cache from
 *      SecureStore based on the LastAuthUser pointer. Exposed as the
 *      `ready` promise — AuthProvider must await this before its first
 *      `userPool.getCurrentUser()` call, otherwise a returning user will
 *      flash as logged-out at app start.
 *   3. Every `setItem`/`removeItem` schedules a write-through to
 *      SecureStore. Writes are chained per-key to preserve ordering;
 *      failures log a warning but never block the synchronous return.
 *
 * Cognito key shapes
 * ------------------
 *   CognitoIdentityServiceProvider.{ClientId}.LastAuthUser
 *   CognitoIdentityServiceProvider.{ClientId}.{username}.idToken
 *   CognitoIdentityServiceProvider.{ClientId}.{username}.accessToken
 *   CognitoIdentityServiceProvider.{ClientId}.{username}.refreshToken
 *   CognitoIdentityServiceProvider.{ClientId}.{username}.clockDrift
 *   CognitoIdentityServiceProvider.{ClientId}.{username}.userData
 *
 * Notes
 * -----
 *   - SecureStore key character set is `A-Z a-z 0-9 . - _` — all Cognito
 *     keys conform.
 *   - iOS Keychain values cap around 4KB. Cognito JWTs are typically
 *     1–2KB, well under the limit.
 *   - On write failure, the next app start may surface a logged-out user.
 *     This is a recoverable failure mode and is acceptable.
 */

import * as SecureStore from 'expo-secure-store';
import type { ICognitoStorage } from 'amazon-cognito-identity-js';

const KEY_PREFIX = 'CognitoIdentityServiceProvider';
const LAST_AUTH_USER = 'LastAuthUser';
const PER_USER_SUFFIXES = [
  'idToken',
  'accessToken',
  'refreshToken',
  'clockDrift',
  'userData',
] as const;

export class SecureCognitoStorage implements ICognitoStorage {
  private readonly clientId: string;
  private readonly cache = new Map<string, string>();
  private readonly knownKeys = new Set<string>();
  private readonly writeChain = new Map<string, Promise<void>>();
  

  /**
   * Resolves once initial hydration from SecureStore is complete.
   * `AuthProvider` must `await this.ready` before any session lookup.
   * Never rejects — hydrate failures are logged and swallowed so the
   * app can still boot (just without a restored session).
   */
  public readonly ready: Promise<void>;

  constructor(clientId: string) {
    this.clientId = clientId;
    this.ready = this.hydrate();
  }

  // ====================================================================
  // ICognitoStorage — synchronous interface required by Cognito SDK
  // ====================================================================

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    this.knownKeys.add(key);
    this.scheduleWrite(key, value);
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    this.knownKeys.delete(key);
    this.scheduleDelete(key);
  }

  clear(): void {
    const keys = Array.from(this.knownKeys);
    this.cache.clear();
    this.knownKeys.clear();
    for (const key of keys) {
      this.scheduleDelete(key);
    }
  }

  // ====================================================================
  // Hydration
  // ====================================================================

  private async hydrate(): Promise<void> {
    try {
      const lastAuthUserKey = `${KEY_PREFIX}.${this.clientId}.${LAST_AUTH_USER}`;
      const lastAuthUser = await SecureStore.getItemAsync(lastAuthUserKey);

      if (!lastAuthUser) {
        // No previous session on this device — nothing to hydrate.
        return;
      }

      // Cache LastAuthUser. The `!cache.has` guard protects against the
      // (defensive) case where a write happened during hydration.
      if (!this.cache.has(lastAuthUserKey)) {
        this.cache.set(lastAuthUserKey, lastAuthUser);
        this.knownKeys.add(lastAuthUserKey);
      }

      // Pre-load all per-user keys in parallel. Each read is independently
      // try/catch'd so a single corrupt entry doesn't abort hydration.
      const userKeyPrefix = `${KEY_PREFIX}.${this.clientId}.${lastAuthUser}`;
      await Promise.all(
        PER_USER_SUFFIXES.map(async (suffix) => {
          const key = `${userKeyPrefix}.${suffix}`;
          try {
            const value = await SecureStore.getItemAsync(key);
            if (value !== null && !this.cache.has(key)) {
              this.cache.set(key, value);
              this.knownKeys.add(key);
            }
          } catch (err) {
            console.warn(
              `[SecureCognitoStorage] hydrate read failed for ${this.maskKey(key)}:`,
              err
            );
          }
        })
      );
    } catch (err) {
      // Catastrophic — likely keychain is unavailable. Log and let the
      // app boot in a logged-out state. User can sign in fresh.
      console.warn('[SecureCognitoStorage] hydrate failed:', err);
    }
  }

  // ====================================================================
  // Write-through scheduling
  // ====================================================================

  private scheduleWrite(key: string, value: string): void {
    this.chain(key, () => SecureStore.setItemAsync(key, value)).catch((err) => {
      console.warn(
        `[SecureCognitoStorage] setItem failed for ${this.maskKey(key)}:`,
        err
      );
    });
  }

  private scheduleDelete(key: string): void {
    this.chain(key, () => SecureStore.deleteItemAsync(key)).catch((err) => {
      console.warn(
        `[SecureCognitoStorage] removeItem failed for ${this.maskKey(key)}:`,
        err
      );
    });
  }

  /**
   * Sequence operations on the same key so writes can't reorder.
   * The chain link stored in `writeChain` always resolves (errors are
   * swallowed at the link level) — that way one transient failure can't
   * permanently block subsequent writes for the same key.
   * The promise returned to the caller still rejects on failure, so the
   * scheduling site can log the error.
   */
  private chain(key: string, op: () => Promise<unknown>): Promise<void> {
    const previous = this.writeChain.get(key) ?? Promise.resolve();

    // Caller-facing promise — surfaces errors of this op
    const opPromise = previous.then(() => op()).then(() => undefined);

    // Chain-link promise — never rejects, becomes the "previous" for next op
    const chainLink = opPromise.catch(() => undefined);

    this.writeChain.set(key, chainLink);

    // Cleanup map entry once this is the tail
    chainLink.finally(() => {
      if (this.writeChain.get(key) === chainLink) {
        this.writeChain.delete(key);
      }
    });

    return opPromise;
  }

  /**
   * Mask the username portion of a Cognito key for log output, so emails
   * don't leak into console / Sentry breadcrumbs.
   *   CognitoIdentityServiceProvider.{ClientId}.{username}.{field}
   *     -> CognitoIdentityServiceProvider.{ClientId}.<user>.{field}
   */
  private maskKey(key: string): string {
    const parts = key.split('.');
    if (parts.length >= 4 && parts[0] === KEY_PREFIX) {
      return `${parts[0]}.${parts[1]}.<user>.${parts.slice(3).join('.')}`;
    }
    return key;
  }
}
