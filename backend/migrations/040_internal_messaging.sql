-- APP2 Messages V1 - Internal Messaging
CREATE TABLE IF NOT EXISTS message_conversations(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(12) NOT NULL CHECK(kind IN('Direct','Group')),
  title VARCHAR(160),
  direct_key VARCHAR(80),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_conversations_direct_key_uidx
  ON message_conversations(direct_key)
  WHERE direct_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_conversation_members(
  conversation_id UUID NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(conversation_id,user_id)
);

CREATE INDEX IF NOT EXISTS message_conversation_members_user_idx
  ON message_conversation_members(user_id,conversation_id);

CREATE TABLE IF NOT EXISTS app_messages(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 8000),
  context_type VARCHAR(40),
  context_id TEXT,
  context_title VARCHAR(240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_messages_conversation_created_idx
  ON app_messages(conversation_id,created_at,id);
