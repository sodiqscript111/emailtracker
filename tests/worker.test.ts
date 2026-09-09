import { describe, it, expect, beforeEach } from 'vitest';
import app from '../apps/worker/src/index.js';
import { createMockD1Database } from './helpers/mock-d1.js';
import type { WorkerEnv } from '../apps/worker/src/types.js';
import { TRANSPARENT_GIF_BYTES } from '@email-tracker/shared';

const TEST_SECRET = 'test-token-12345';
const TEST_SALT = 'test-ip-salt';

function getTestEnv(): WorkerEnv {
  return {
    DB: createMockD1Database(),
    API_AUTH_TOKEN: TEST_SECRET,
    IP_SALT: TEST_SALT,
    BASE_URL: 'http://localhost:8787',
    ALLOWED_ORIGINS: 'http://localhost:5173',
  };
}

describe('Worker Endpoints & Tracking API', () => {
  let env: WorkerEnv;

  beforeEach(() => {
    env = getTestEnv();
  });

  describe('GET /health', () => {
    it('returns 200 OK and health status', async () => {
      const res = await app.request('/health', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ status: 'ok' });
    });
  });

  describe('Authentication & CORS', () => {
    it('rejects unauthenticated requests to /api/*', async () => {
      const res = await app.request('/api/tracked-emails', { method: 'GET' }, env);
      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('accepts valid Bearer token authentication', async () => {
      const res = await app.request(
        '/api/tracked-emails',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );
      expect(res.status).toBe(200);
    });

    it('accepts valid x-api-key header authentication', async () => {
      const res = await app.request(
        '/api/tracked-emails',
        {
          method: 'GET',
          headers: { 'x-api-key': TEST_SECRET },
        },
        env
      );
      expect(res.status).toBe(200);
    });

    it('handles CORS OPTIONS preflight correctly', async () => {
      const res = await app.request(
        '/api/tracked-emails',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'http://localhost:5173',
            'Access-Control-Request-Method': 'POST',
          },
        },
        env
      );
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('POST /api/tracked-emails (Create Tracked Email)', () => {
    it('creates a new tracked email with high-entropy tracking ID and returns tracking URL', async () => {
      const payload = {
        recipientEmail: 'client@example.com',
        subject: 'Q3 Progress Report',
      };

      const res = await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify(payload),
        },
        env
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as { id: string; trackingId: string; trackingUrl: string };
      expect(data.id).toBeDefined();
      expect(data.trackingId).toBeDefined();
      expect(data.trackingId.length).toBeGreaterThanOrEqual(32);
      expect(data.trackingUrl).toBe(`http://localhost:8787/t/o/${data.trackingId}`);
      // Tracking URL must not leak the recipient email address
      expect(data.trackingUrl).not.toContain('client@example.com');
    });

    it('rejects invalid email address', async () => {
      const res = await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ recipientEmail: 'invalid-email', subject: 'Test' }),
        },
        env
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /api/tracked-emails/:id/sent (Mark Email Sent)', () => {
    it('transitions status from created to sent with timestamp', async () => {
      // Create first
      const createRes = await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ recipientEmail: 'user@example.com', subject: 'Subject' }),
        },
        env
      );
      const created = (await createRes.json()) as { id: string };

      // Mark sent
      const sentTime = 1725880000000;
      const sentRes = await app.request(
        `/api/tracked-emails/${created.id}/sent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ sentAt: sentTime }),
        },
        env
      );

      expect(sentRes.status).toBe(200);
      const sentJson = (await sentRes.json()) as { status: string; sentAt: number };
      expect(sentJson.status).toBe('sent');
      expect(sentJson.sentAt).toBe(sentTime);

      // Verify detail
      const detailRes = await app.request(
        `/api/tracked-emails/${created.id}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );
      const detail = (await detailRes.json()) as { status: string; sentAt: number };
      expect(detail.status).toBe('sent');
      expect(detail.sentAt).toBe(sentTime);
    });
  });

  describe('GET /t/o/:trackingId (Tracking Pixel Endpoint)', () => {
    it('returns transparent 1x1 GIF with strict no-cache headers for valid tracking ID', async () => {
      // Create email
      const createRes = await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ recipientEmail: 'alice@example.com', subject: 'Meeting Notes' }),
        },
        env
      );
      const { id, trackingId } = (await createRes.json()) as { id: string; trackingId: string };

      // Request tracking pixel
      const pixelRes = await app.request(
        `/t/o/${trackingId}`,
        {
          method: 'GET',
          headers: {
            'user-agent': 'Mozilla/5.0 Test Mail Client',
            'CF-Connecting-IP': '198.51.100.42',
          },
        },
        env
      );

      expect(pixelRes.status).toBe(200);
      expect(pixelRes.headers.get('Content-Type')).toBe('image/gif');
      expect(pixelRes.headers.get('Cache-Control')).toContain('no-store');
      expect(pixelRes.headers.get('Cache-Control')).toContain('no-cache');
      expect(pixelRes.headers.get('Cache-Control')).toContain('max-age=0');
      expect(pixelRes.headers.get('Pragma')).toBe('no-cache');

      const arrayBuffer = await pixelRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      expect(bytes.length).toBe(42);
      expect(bytes).toEqual(TRANSPARENT_GIF_BYTES);

      // Verify open event was registered in database
      const detailRes = await app.request(
        `/api/tracked-emails/${id}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );
      const detail = (await detailRes.json()) as {
        openCount: number;
        firstOpenedAt: number;
        lastOpenedAt: number;
        events: Array<{ userAgent: string; ipHash: string }>;
      };
      expect(detail.openCount).toBe(1);
      expect(detail.firstOpenedAt).toBeDefined();
      expect(detail.lastOpenedAt).toBe(detail.firstOpenedAt);
      expect(detail.events.length).toBe(1);
      expect(detail.events[0].userAgent).toBe('Mozilla/5.0 Test Mail Client');
      // Privacy check: Raw IP is NEVER stored
      expect(detail.events[0].ipHash).toBeDefined();
      expect(detail.events[0].ipHash).not.toContain('198.51.100.42');
    });

    it('returns identical 1x1 transparent GIF for nonexistent tracking ID without leaking info', async () => {
      const nonexistentId = '00000000000000000000000000000000';
      const pixelRes = await app.request(`/t/o/${nonexistentId}`, { method: 'GET' }, env);

      expect(pixelRes.status).toBe(200);
      expect(pixelRes.headers.get('Content-Type')).toBe('image/gif');
      const bytes = new Uint8Array(await pixelRes.arrayBuffer());
      expect(bytes).toEqual(TRANSPARENT_GIF_BYTES);
    });

    it('returns transparent GIF safely for malformed tracking ID', async () => {
      const malformedId = 'short';
      const pixelRes = await app.request(`/t/o/${malformedId}`, { method: 'GET' }, env);

      expect(pixelRes.status).toBe(200);
      expect(pixelRes.headers.get('Content-Type')).toBe('image/gif');
      const bytes = new Uint8Array(await pixelRes.arrayBuffer());
      expect(bytes).toEqual(TRANSPARENT_GIF_BYTES);
    });

    it('handles multiple repeated requests correctly by recording occurrences and updating lastOpenedAt', async () => {
      const createRes = await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ recipientEmail: 'bob@example.com', subject: 'Invoice' }),
        },
        env
      );
      const { id, trackingId } = (await createRes.json()) as { id: string; trackingId: string };

      // Request 1
      await app.request(`/t/o/${trackingId}`, { method: 'GET' }, env);

      // Short delay
      await new Promise((r) => setTimeout(r, 10));

      // Request 2
      await app.request(`/t/o/${trackingId}`, { method: 'GET' }, env);

      const detailRes = await app.request(
        `/api/tracked-emails/${id}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );
      const detail = (await detailRes.json()) as {
        openCount: number;
        firstOpenedAt: number;
        lastOpenedAt: number;
        events: unknown[];
      };
      expect(detail.openCount).toBe(2);
      expect(detail.events.length).toBe(2);
      expect(detail.lastOpenedAt).toBeGreaterThanOrEqual(detail.firstOpenedAt);
    });

    it('ignores pixel requests within 5000ms cooldown after email was marked sent (self-open prevention)', async () => {
      const createRes = await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ recipientEmail: 'cooldown@example.com', subject: 'Cooldown Test' }),
        },
        env
      );
      const { id, trackingId } = (await createRes.json()) as { id: string; trackingId: string };

      // Mark sent with timestamp = Date.now() (just sent 100ms ago)
      await app.request(
        `/api/tracked-emails/${id}/sent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ sentAt: Date.now() }),
        },
        env
      );

      // Pixel requested immediately (simulating sender's browser DOM load 100ms later)
      const pixelRes = await app.request(`/t/o/${trackingId}`, { method: 'GET' }, env);
      expect(pixelRes.status).toBe(200);

      // Verify that NO open event was recorded because it fell inside the 5-second cooldown window
      const detailRes = await app.request(
        `/api/tracked-emails/${id}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );
      const detail = (await detailRes.json()) as { openCount: number; events: unknown[] };
      expect(detail.openCount).toBe(0);
      expect(detail.events.length).toBe(0);
    });
  });

  describe('Database Cascade & Deletion', () => {
    it('deletes tracked email and cascades deletion of all associated open events', async () => {
      const createRes = await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ recipientEmail: 'delete-me@example.com', subject: 'Temporary' }),
        },
        env
      );
      const { id, trackingId } = (await createRes.json()) as { id: string; trackingId: string };

      // Generate 2 open events
      await app.request(`/t/o/${trackingId}`, { method: 'GET' }, env);
      await app.request(`/t/o/${trackingId}`, { method: 'GET' }, env);

      // Verify events exist
      const beforeDelete = await app.request(
        `/api/tracked-emails/${id}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );
      expect(beforeDelete.status).toBe(200);

      // Delete email
      const deleteRes = await app.request(
        `/api/tracked-emails/${id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );
      expect(deleteRes.status).toBe(200);

      // Verify email no longer exists
      const afterDelete = await app.request(
        `/api/tracked-emails/${id}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );
      expect(afterDelete.status).toBe(404);

      // Verify direct open_events table is empty for this email
      const checkEvents = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM open_events WHERE tracked_email_id = ?'
      )
        .bind(id)
        .first<{ count: number }>();
      expect(checkEvents?.count).toBe(0);
    });
  });

  describe('List & Pagination', () => {
    it('supports pagination parameters page and limit', async () => {
      // Seed 3 emails
      for (let i = 1; i <= 3; i++) {
        await app.request(
          '/api/tracked-emails',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${TEST_SECRET}`,
            },
            body: JSON.stringify({ recipientEmail: `user${i}@example.com`, subject: `Subject ${i}` }),
          },
          env
        );
      }

      const listRes = await app.request(
        '/api/tracked-emails?page=1&limit=2',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );

      expect(listRes.status).toBe(200);
      const json = (await listRes.json()) as { items: unknown[]; total: number; page: number; limit: number };
      expect(json.items.length).toBe(2);
      expect(json.total).toBe(3);
      expect(json.page).toBe(1);
      expect(json.limit).toBe(2);
    });
  });

  describe('GET /api/stats', () => {
    it('calculates totalTracked, openedCount, and notOpenedCount', async () => {
      // Email 1: opened
      const e1 = await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ recipientEmail: 'opened@example.com', subject: 'S1' }),
        },
        env
      );
      const { trackingId } = (await e1.json()) as { trackingId: string };
      await app.request(`/t/o/${trackingId}`, { method: 'GET' }, env);

      // Email 2: not opened
      await app.request(
        '/api/tracked-emails',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify({ recipientEmail: 'unopened@example.com', subject: 'S2' }),
        },
        env
      );

      const statsRes = await app.request(
        '/api/stats',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        },
        env
      );

      expect(statsRes.status).toBe(200);
      const stats = (await statsRes.json()) as { totalTracked: number; openedCount: number; notOpenedCount: number };
      expect(stats.totalTracked).toBe(2);
      expect(stats.openedCount).toBe(1);
      expect(stats.notOpenedCount).toBe(1);
    });
  });
});
