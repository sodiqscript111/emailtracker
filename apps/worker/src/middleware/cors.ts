import type { Context, Next } from 'hono';
import type { WorkerEnv } from '../types.js';

export async function customCorsMiddleware(c: Context<{ Bindings: WorkerEnv }>, next: Next) {
  const origin = c.req.header('Origin');
  const allowedOriginsStr = c.env.ALLOWED_ORIGINS || 'http://localhost:5173';
  const configuredOrigins = allowedOriginsStr.split(',').map((o) => o.trim());

  let isAllowed = false;

  if (origin) {
    // Check if origin is a Chrome Extension
    if (origin.startsWith('chrome-extension://')) {
      isAllowed = true;
    } else if (configuredOrigins.includes(origin)) {
      isAllowed = true;
    } else if (origin.endsWith('.workers.dev') || origin === 'https://mail.google.com') {
      isAllowed = true;
    } else if (origin === 'http://localhost:5173' || origin === 'http://localhost:8787' || origin === 'http://127.0.0.1:5173') {
      isAllowed = true;
    }
  }

  // If preflight OPTIONS
  if (c.req.method === 'OPTIONS') {
    if (isAllowed && origin) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin',
        },
      });
    }
    return new Response(null, { status: 204 });
  }

  await next();

  if (isAllowed && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    c.header('Vary', 'Origin');
  }
}
