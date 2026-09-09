-- Add sender_email to tracked_emails for multi-user attribution
ALTER TABLE tracked_emails ADD COLUMN sender_email TEXT;
CREATE INDEX IF NOT EXISTS idx_tracked_emails_sender ON tracked_emails(sender_email);
