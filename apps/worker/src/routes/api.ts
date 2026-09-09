import { Hono } from 'hono';
import type { WorkerEnv } from '../types.js';
import {
  validateCreateEmailRequest,
  parsePaginationParams,
  generateSecureId,
  ERROR_CODES,
  TRACKING_PATH_PREFIX,
} from '@email-tracker/shared';
import { DbService } from '../services/db.js';

export const apiRouter = new Hono<{ Bindings: WorkerEnv }>();

// Helper to determine base URL
function getBaseUrl(c: { req: { url: string }; env: WorkerEnv }): string {
  if (c.env.BASE_URL) {
    return c.env.BASE_URL.replace(/\/+$/, '');
  }
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

// POST /api/tracked-emails
apiRouter.post('/tracked-emails', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: {
          code: ERROR_CODES.INVALID_REQUEST,
          message: 'Malformed JSON in request body',
        },
      },
      400
    );
  }

  const validation = validateCreateEmailRequest(body);
  if (!validation.valid) {
    return c.json(
      {
        error: {
          code: ERROR_CODES.INVALID_REQUEST,
          message: validation.error,
        },
      },
      400
    );
  }

  const { recipientEmail, subject, senderEmail } = validation.value;
  const id = generateSecureId(16);
  const trackingId = generateSecureId(16);
  const createdAt = Date.now();

  const db = new DbService(c.env.DB);
  await db.createTrackedEmail({
    id,
    trackingId,
    recipientEmail,
    senderEmail,
    subject,
    createdAt,
    status: 'created',
  });

  const baseUrl = getBaseUrl(c);
  const trackingUrl = `${baseUrl}${TRACKING_PATH_PREFIX}${trackingId}`;

  return c.json(
    {
      id,
      trackingId,
      trackingUrl,
    },
    201
  );
});

// POST /api/tracked-emails/:id/sent
apiRouter.post('/tracked-emails/:id/sent', async (c) => {
  const id = c.req.param('id');
  const db = new DbService(c.env.DB);

  let sentAt = Date.now();
  try {
    const body = await c.req.json().catch(() => null);
    if (body && typeof (body as { sentAt?: number }).sentAt === 'number') {
      sentAt = (body as { sentAt: number }).sentAt;
    }
  } catch {
    // Ignore body parse failure and use current timestamp
  }

  const updated = await db.markEmailSent(id, sentAt);
  if (!updated) {
    return c.json(
      {
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Tracked email not found',
        },
      },
      404
    );
  }

  return c.json({ status: 'sent', sentAt });
});

// GET /api/senders
apiRouter.get('/senders', async (c) => {
  const db = new DbService(c.env.DB);
  const senders = await db.getDistinctSenders();
  return c.json({ senders });
});

// GET /api/tracked-emails
apiRouter.get('/tracked-emails', async (c) => {
  const { page, limit, offset } = parsePaginationParams(
    c.req.query('page'),
    c.req.query('limit')
  );
  const senderEmail = c.req.query('senderEmail') || c.req.query('sender') || null;

  const db = new DbService(c.env.DB);
  const { items, total } = await db.listTrackedEmails(limit, offset, senderEmail);

  return c.json({
    items,
    page,
    limit,
    total,
  });
});

// GET /api/tracked-emails/:id
apiRouter.get('/tracked-emails/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DbService(c.env.DB);

  const detail = await db.getTrackedEmailDetail(id);
  if (!detail) {
    return c.json(
      {
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Tracked email not found',
        },
      },
      404
    );
  }

  return c.json(detail);
});

// DELETE /api/tracked-emails/:id
apiRouter.delete('/tracked-emails/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DbService(c.env.DB);

  const deleted = await db.deleteTrackedEmail(id);
  if (!deleted) {
    return c.json(
      {
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Tracked email not found',
        },
      },
      404
    );
  }

  return c.json({ success: true });
});

// GET /api/stats
apiRouter.get('/stats', async (c) => {
  const db = new DbService(c.env.DB);
  const stats = await db.getStats();
  return c.json(stats);
});
