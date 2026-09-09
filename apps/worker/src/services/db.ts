import type {
  TrackedEmail,
  TrackedEmailSummary,
  TrackedEmailDetail,
  OpenEvent,
  DashboardStats,
  TrackedEmailStatus,
} from '@email-tracker/shared';

export class DbService {
  constructor(private db: D1Database) {}

  async enableForeignKeys(): Promise<void> {
    await this.db.prepare('PRAGMA foreign_keys = ON;').run();
  }

  async createTrackedEmail(email: {
    id: string;
    trackingId: string;
    recipientEmail: string;
    senderEmail?: string | null;
    subject: string;
    createdAt: number;
    status: TrackedEmailStatus;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO tracked_emails (id, tracking_id, recipient_email, sender_email, subject, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        email.id,
        email.trackingId,
        email.recipientEmail,
        email.senderEmail || null,
        email.subject,
        email.createdAt,
        email.status
      )
      .run();
  }

  async markEmailSent(id: string, sentAt: number): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE tracked_emails 
         SET status = 'sent', sent_at = ?
         WHERE id = ?`
      )
      .bind(sentAt, id)
      .run();

    return (res.meta?.changes ?? 0) > 0;
  }

  async getTrackedEmailByTrackingId(
    trackingId: string
  ): Promise<{ id: string; status: TrackedEmailStatus; sent_at: number | null; created_at: number } | null> {
    const row = await this.db
      .prepare(
        `SELECT id, status, sent_at, created_at FROM tracked_emails WHERE tracking_id = ? LIMIT 1`
      )
      .bind(trackingId)
      .first<{ id: string; status: TrackedEmailStatus; sent_at: number | null; created_at: number }>();

    return row || null;
  }

  async recordOpenEvent(event: {
    trackedEmailId: string;
    occurredAt: number;
    userAgent: string | null;
    ipHash: string | null;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO open_events (tracked_email_id, occurred_at, user_agent, ip_hash)
         VALUES (?, ?, ?, ?)`
      )
      .bind(
        event.trackedEmailId,
        event.occurredAt,
        event.userAgent ? event.userAgent.substring(0, 500) : null,
        event.ipHash
      )
      .run();
  }

  async listTrackedEmails(
    limit: number,
    offset: number,
    senderEmail?: string | null
  ): Promise<{ items: TrackedEmailSummary[]; total: number }> {
    let totalQuery = 'SELECT COUNT(*) as count FROM tracked_emails';
    const totalBinds: unknown[] = [];
    if (senderEmail) {
      totalQuery += ' WHERE sender_email = ?';
      totalBinds.push(senderEmail);
    }
    const totalRow = await this.db
      .prepare(totalQuery)
      .bind(...totalBinds)
      .first<{ count: number }>();
    const total = totalRow?.count ?? 0;

    let query = `SELECT 
           e.id,
           e.tracking_id as trackingId,
           e.recipient_email as recipientEmail,
           e.sender_email as senderEmail,
           e.subject,
           e.status,
           e.created_at as createdAt,
           e.sent_at as sentAt,
           MIN(o.occurred_at) as firstOpenedAt,
           MAX(o.occurred_at) as lastOpenedAt,
           COUNT(o.id) as openCount
         FROM tracked_emails e
         LEFT JOIN open_events o ON e.id = o.tracked_email_id`;

    const binds: unknown[] = [];
    if (senderEmail) {
      query += ' WHERE e.sender_email = ?';
      binds.push(senderEmail);
    }

    query += ` GROUP BY e.id
         ORDER BY e.created_at DESC
         LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const rows = await this.db
      .prepare(query)
      .bind(...binds)
      .all<TrackedEmailSummary>();

    return {
      items: rows.results || [],
      total,
    };
  }

  async getDistinctSenders(): Promise<string[]> {
    const rows = await this.db
      .prepare(
        `SELECT DISTINCT sender_email as senderEmail 
         FROM tracked_emails 
         WHERE sender_email IS NOT NULL AND sender_email != ''
         ORDER BY sender_email ASC`
      )
      .all<{ senderEmail: string }>();

    return (rows.results || []).map((r) => r.senderEmail);
  }

  async getTrackedEmailDetail(id: string): Promise<TrackedEmailDetail | null> {
    const emailRow = await this.db
      .prepare(
        `SELECT 
           e.id,
           e.tracking_id as trackingId,
           e.recipient_email as recipientEmail,
           e.sender_email as senderEmail,
           e.subject,
           e.status,
           e.created_at as createdAt,
           e.sent_at as sentAt,
           MIN(o.occurred_at) as firstOpenedAt,
           MAX(o.occurred_at) as lastOpenedAt,
           COUNT(o.id) as openCount
         FROM tracked_emails e
         LEFT JOIN open_events o ON e.id = o.tracked_email_id
         WHERE e.id = ?
         GROUP BY e.id
         LIMIT 1`
      )
      .bind(id)
      .first<TrackedEmailSummary>();

    if (!emailRow) {
      return null;
    }

    const eventsRows = await this.db
      .prepare(
        `SELECT 
           id,
           tracked_email_id as trackedEmailId,
           occurred_at as occurredAt,
           user_agent as userAgent,
           ip_hash as ipHash
         FROM open_events
         WHERE tracked_email_id = ?
         ORDER BY occurred_at DESC
         LIMIT 100`
      )
      .bind(id)
      .all<OpenEvent>();

    return {
      ...emailRow,
      events: eventsRows.results || [],
    };
  }

  async deleteTrackedEmail(id: string): Promise<boolean> {
    await this.enableForeignKeys();
    // In case foreign key cascade isn't enforced by sqlite runtime, delete open_events first as well
    await this.db
      .prepare('DELETE FROM open_events WHERE tracked_email_id = ?')
      .bind(id)
      .run();

    const res = await this.db
      .prepare('DELETE FROM tracked_emails WHERE id = ?')
      .bind(id)
      .run();

    return (res.meta?.changes ?? 0) > 0;
  }

  async getStats(): Promise<DashboardStats> {
    const totalRow = await this.db
      .prepare('SELECT COUNT(*) as count FROM tracked_emails')
      .first<{ count: number }>();
    const totalTracked = totalRow?.count ?? 0;

    const openedRow = await this.db
      .prepare(
        `SELECT COUNT(DISTINCT tracked_email_id) as count FROM open_events`
      )
      .first<{ count: number }>();
    const openedCount = openedRow?.count ?? 0;

    return {
      totalTracked,
      openedCount,
      notOpenedCount: Math.max(0, totalTracked - openedCount),
    };
  }
}
