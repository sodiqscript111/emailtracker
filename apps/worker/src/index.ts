import { Hono } from 'hono';
import type { WorkerEnv } from './types.js';
import { healthRouter } from './routes/health.js';
import { trackingRouter } from './routes/tracking.js';
import { apiRouter } from './routes/api.js';
import { customCorsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { ERROR_CODES } from '@email-tracker/shared';

const app = new Hono<{ Bindings: WorkerEnv }>();

// Minimal structured observability logger (no secrets, no bodies, no raw IPs)
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Log tracking and API requests without sensitive information
  if (path.startsWith('/t/o/')) {
    const rawId = path.substring(5);
    const maskedId = rawId.length > 8 ? `${rawId.substring(0, 4)}...${rawId.substring(rawId.length - 4)}` : '***';
    console.log(JSON.stringify({ type: 'TRACKING_PIXEL', id: maskedId, status, durationMs: duration }));
  } else if (path.startsWith('/api/')) {
    console.log(JSON.stringify({ type: 'API_REQUEST', method, path, status, durationMs: duration }));
  }
});

// Health check endpoint
app.route('/health', healthRouter);

// Tracking pixel endpoint (public, standard 1x1 transparent GIF)
app.route('/t/o', trackingRouter);

// Management API with CORS and Token Authentication
app.use('/api/*', customCorsMiddleware);
app.use('/api/*', authMiddleware);
app.route('/api', apiRouter);

// Standard 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: 'Endpoint not found',
      },
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled server error:', err instanceof Error ? err.message : String(err));
  return c.json(
    {
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    },
    500
  );
});

export default app;
