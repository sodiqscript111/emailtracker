import { describe, it, expect } from 'vitest';
import app from '../apps/worker/src/index.js';
import { createMockD1Database } from './helpers/mock-d1.js';
import type { WorkerEnv } from '../apps/worker/src/types.js';

describe('End-to-End Tracking Integration Pipeline', () => {
  it('executes full cycle: Create Email -> Fetch Tracking Pixel -> Verify D1 Record & Stats', async () => {
    const db = createMockD1Database();
    const token = 'test-secret';
    const env: WorkerEnv = {
      DB: db,
      API_AUTH_TOKEN: token,
      IP_SALT: 'integration-salt-value',
      BASE_URL: 'http://localhost:8787',
      ALLOWED_ORIGINS: 'http://localhost:5173',
    };

    // 1. Create tracked email via authenticated API
    const createRes = await app.request(
      '/api/tracked-emails',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientEmail: 'recipient@company.org',
          subject: 'Confidential Proposal',
        }),
      },
      env
    );

    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as { id: string; trackingId: string; trackingUrl: string };
    expect(createData.id).toBeDefined();
    expect(createData.trackingId).toBeDefined();
    expect(createData.trackingUrl).toMatch(/^http:\/\/localhost:8787\/t\/o\/[a-zA-Z0-9_-]+$/);

    // 2. Mark email as sent
    const markSentRes = await app.request(
      `/api/tracked-emails/${createData.id}/sent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sentAt: Date.now() - 10000 }),
      },
      env
    );
    expect(markSentRes.status).toBe(200);

    // 3. Emulate recipient's email client requesting the tracking pixel
    const url = new URL(createData.trackingUrl);
    const pixelRes = await app.request(
      url.pathname,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleMail/16.0',
          'CF-Connecting-IP': '203.0.113.195',
        },
      },
      env
    );

    // 4. Assert HTTP 200, Content-Type image/gif, strict no-cache headers
    expect(pixelRes.status).toBe(200);
    expect(pixelRes.headers.get('Content-Type')).toBe('image/gif');
    expect(pixelRes.headers.get('Cache-Control')).toContain('no-store');
    expect(pixelRes.headers.get('Cache-Control')).toContain('no-cache');

    const bodyBuffer = await pixelRes.arrayBuffer();
    expect(bodyBuffer.byteLength).toBe(42);

    // 5. Query D1 directly and verify open_events table
    const eventRow = await db
      .prepare('SELECT * FROM open_events WHERE tracked_email_id = ?')
      .bind(createData.id)
      .first<{
        id: number;
        tracked_email_id: string;
        occurred_at: number;
        user_agent: string;
        ip_hash: string;
      }>();

    expect(eventRow).toBeDefined();
    expect(eventRow?.tracked_email_id).toBe(createData.id);
    expect(eventRow?.user_agent).toContain('AppleMail');
    expect(eventRow?.ip_hash).toBeDefined();
    expect(eventRow?.ip_hash).not.toContain('203.0.113.195');

    // 6. Query Dashboard API and assert accurate status & timestamps
    const detailRes = await app.request(
      `/api/tracked-emails/${createData.id}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
      env
    );
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as {
      recipientEmail: string;
      subject: string;
      status: string;
      openCount: number;
      firstOpenedAt: number;
      lastOpenedAt: number;
      events: unknown[];
    };
    expect(detail.recipientEmail).toBe('recipient@company.org');
    expect(detail.subject).toBe('Confidential Proposal');
    expect(detail.status).toBe('sent');
    expect(detail.openCount).toBe(1);
    expect(detail.firstOpenedAt).toBeGreaterThan(0);
    expect(detail.lastOpenedAt).toBe(detail.firstOpenedAt);
    expect(detail.events.length).toBe(1);
  });
});
