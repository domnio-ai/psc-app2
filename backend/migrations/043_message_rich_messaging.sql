-- APP2 Messages V1 R2.9 - Rich Messaging
ALTER TABLE app_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES app_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_messages_reply_to_idx
  ON app_messages(reply_to_message_id);

CREATE TABLE IF NOT EXISTS message_reactions(
  message_id UUID NOT NULL REFERENCES app_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(message_id,user_id,emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON message_reactions(message_id,created_at);

CREATE TABLE IF NOT EXISTS message_attachments(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES app_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id),
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(320) NOT NULL UNIQUE,
  mime_type VARCHAR(160) NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS message_attachments_conversation_idx
  ON message_attachments(conversation_id,created_at);
