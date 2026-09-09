-- Initial schema for Email Open Tracker

CREATE TABLE IF NOT EXISTS tracked_emails (
    id TEXT PRIMARY KEY,
    tracking_id TEXT NOT NULL UNIQUE,
    recipient_email TEXT,
    sender_email TEXT,
    subject TEXT,
    created_at INTEGER NOT NULL,
    sent_at INTEGER,
    status TEXT NOT NULL DEFAULT 'created'
);

CREATE TABLE IF NOT EXISTS open_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracked_email_id TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    user_agent TEXT,
    ip_hash TEXT,
    FOREIGN KEY (tracked_email_id)
        REFERENCES tracked_emails(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracked_emails_tracking_id
ON tracked_emails(tracking_id);

CREATE INDEX IF NOT EXISTS idx_open_events_tracked_email
ON open_events(tracked_email_id);

CREATE INDEX IF NOT EXISTS idx_open_events_occurred_at
ON open_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_tracked_emails_recipient
ON tracked_emails(recipient_email);
