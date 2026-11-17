-- APP2 Messages V1 R2.8 - real-time delivery/read receipts
CREATE TABLE IF NOT EXISTS message_receipts(
  message_id UUID NOT NULL REFERENCES app_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  PRIMARY KEY(message_id,user_id)
);
CREATE INDEX IF NOT EXISTS message_receipts_user_idx ON message_receipts(user_id,read_at,delivered_at);
INSERT INTO message_receipts(message_id,user_id,delivered_at,read_at)
SELECT m.id,cm.user_id,
       CASE WHEN cm.last_read_at>=m.created_at THEN cm.last_read_at ELSE NULL END,
       CASE WHEN cm.last_read_at>=m.created_at THEN cm.last_read_at ELSE NULL END
FROM app_messages m
JOIN message_conversation_members cm ON cm.conversation_id=m.conversation_id
WHERE cm.user_id<>m.sender_id
ON CONFLICT(message_id,user_id) DO NOTHING;
