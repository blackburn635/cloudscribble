/**
 * Auth utilities — the caller's identity from the HTTP API JWT authorizer.
 * Identity only: billing and usage state always come from DynamoDB, never the token.
 */

import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { ForbiddenError, UnauthorizedError } from './errors';

export const ADMIN_GROUP = 'cloudscribble-admins';

export interface AuthUser {
  /** Cognito sub — also the RevenueCat App User ID */
  userId: string;
  email: string;
  groups: string[];
}

/**
 * Parse `cognito:groups`. HTTP API serializes JWT arrays as bracketed strings
 * ("[cloudscribble-admins]" or "[a b]"), so strip the brackets before splitting.
 */
export function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string') return [];
  return raw.replace(/^\[|\]$/g, '').split(/[,\s]+/).map((g) => g.trim()).filter(Boolean);
}

export function getAuthUser(event: APIGatewayProxyEventV2WithJWTAuthorizer): AuthUser {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) {
    throw new UnauthorizedError('Missing authentication');
  }
  return {
    userId: String(claims.sub),
    email: claims.email ? String(claims.email) : '',
    groups: parseGroups(claims['cognito:groups']),
  };
}

export function isAdmin(user: AuthUser): boolean {
  return user.groups.includes(ADMIN_GROUP);
}

export function requireAdmin(user: AuthUser): void {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Admin access required');
  }
}
