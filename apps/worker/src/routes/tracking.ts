import { Hono } from 'hono';
import type { WorkerEnv } from '../types.js';
import { TRANSPARENT_GIF_BYTES, isValidTrackingId } from '@email-tracker/shared';
import { DbService } from '../services/db.js';
import { hashIpAddress } from '../services/privacy.js';

export const trackingRouter = new Hono<{ Bindings: WorkerEnv }>();

function createGifResponse(): Response {
  return new Response(TRANSPARENT_GIF_BYTES, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF_BYTES.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      // Allow loading in any email client/context
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}

trackingRouter.get('/:trackingId', async (c) => {
  const trackingId = c.req.param('trackingId');

  // Validate tracking ID format. If invalid, return GIF immediately (no JSON, no leak)
  if (!isValidTrackingId(trackingId)) {
    return createGifResponse();
  }

  const db = new DbService(c.env.DB);

  try {
    const email = await db.getTrackedEmailByTrackingId(trackingId);

    // If tracking ID does not exist, return GIF anyway (never disclose existence)
    if (!email) {
      return createGifResponse();
    }

    // Protection against immediate false-positive self-opens:
    // When an email is dispatched, the sender's compose window renders the DOM and loads the image within 100-500ms.
    // Legitimate recipient opens cannot occur within 5 seconds of dispatch.
    const now = Date.now();
    if (email.sent_at && now - email.sent_at < 5000) {
      return createGifResponse();
    }

    // Extract IP safely (CF-Connecting-IP in production, headers/fallback in dev)
    const clientIp =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('x-real-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      '127.0.0.1';

    const userAgent = c.req.header('user-agent') || null;
    const ipHash = await hashIpAddress(clientIp, c.env.IP_SALT || 'default-salt');

    const recordPromise = db.recordOpenEvent({
      trackedEmailId: email.id,
      occurredAt: Date.now(),
      userAgent,
      ipHash,
    });

    // If executionCtx.waitUntil is supported (Cloudflare runtime), use it; otherwise await directly
    let usedWaitUntil = false;
    try {
      if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
        c.executionCtx.waitUntil(recordPromise);
        usedWaitUntil = true;
      }
    } catch {
      usedWaitUntil = false;
    }

    if (!usedWaitUntil) {
      await recordPromise;
    }
  } catch (err) {
    // Log minimal safe debug error without leaking sensitive user data
    console.error('Error handling tracking event:', err instanceof Error ? err.message : String(err));
  }

  return createGifResponse();
});
