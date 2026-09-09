import type { Context, Next } from 'hono';
import type { WorkerEnv } from '../types.js';
import { ERROR_CODES } from '@email-tracker/shared';

export async function authMiddleware(c: Context<{ Bindings: WorkerEnv }>, next: Next) {
  // Allow OPTIONS requests through without auth (handled by CORS)
  if (c.req.method === 'OPTIONS') {
    return next();
  }

  const configuredToken = c.env.API_AUTH_TOKEN;
  if (!configuredToken) {
    // If no token is configured in environment, allow local dev or fail safe
    // For strict security, if in production, require token
    return next();
  }

  const authHeader = c.req.header('Authorization');
  const apiKeyHeader = c.req.header('x-api-key');

  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token || token !== configuredToken) {
    return c.json(
      {
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid or missing authentication token',
        },
      },
      401
    );
  }

  return next();
}
