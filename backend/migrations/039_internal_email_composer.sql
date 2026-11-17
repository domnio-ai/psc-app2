CREATE TABLE IF NOT EXISTS app_email_messages(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id),
  subject VARCHAR(240) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS app_email_recipients(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES app_email_messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id),
  recipient_email VARCHAR(255) NOT NULL,
  delivery_status VARCHAR(24) NOT NULL DEFAULT 'Pending'
    CHECK(delivery_status IN('Pending','Sending','Sent','Retry','Failed','Suppressed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE(message_id,recipient_id)
);
CREATE INDEX IF NOT EXISTS app_email_messages_sender_created_idx ON app_email_messages(sender_id,created_at DESC);
CREATE INDEX IF NOT EXISTS app_email_recipients_queue_idx ON app_email_recipients(delivery_status,next_attempt_at)
WHERE delivery_status IN('Pending','Retry');
