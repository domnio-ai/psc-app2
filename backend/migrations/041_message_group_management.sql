-- APP2 Messages V1 R2.7 - Group Chat Management
ALTER TABLE message_conversations
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

UPDATE message_conversations
SET owner_id=created_by
WHERE owner_id IS NULL;

CREATE INDEX IF NOT EXISTS message_conversations_owner_idx
  ON message_conversations(owner_id);

CREATE TABLE IF NOT EXISTS message_conversation_events(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(32) NOT NULL
    CHECK(event_type IN('Group Renamed','Member Added','Member Removed')),
  target_user_id UUID REFERENCES users(id),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS message_conversation_events_conversation_idx
  ON message_conversation_events(conversation_id,created_at,id);
