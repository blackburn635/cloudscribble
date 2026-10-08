/**
 * Secrets Manager utility — fetch once at cold start, cache in memory.
 *
 * Usage:
 *   const key = await getSecret('TURNSTILE_SECRET_KEY');
 *
 * All secrets are stored as a single JSON blob in Secrets Manager
 * under the name `cloudscribble/{stage}/secrets`.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

/** Cached parsed secrets — populated once per cold start */
let cachedSecrets: Record<string, string> | null = null;

/**
 * Retrieve a single secret value by key.
 * Fetches the full secret blob on the first call, then serves from cache.
 */
export async function getSecret(key: string): Promise<string> {
  if (!cachedSecrets) {
    const secretName = process.env.SECRETS_NAME;
    if (!secretName) {
      throw new Error('SECRETS_NAME environment variable is not set');
    }

    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} has no string value`);
    }

    cachedSecrets = JSON.parse(response.SecretString);
  }

  const value = cachedSecrets![key];
  if (!value) {
    throw new Error(`Secret key "${key}" not found in Secrets Manager`);
  }

  return value;
}
