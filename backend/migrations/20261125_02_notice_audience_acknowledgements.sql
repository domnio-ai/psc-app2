BEGIN;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS acknowledgement_required BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS alert_audience_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  audience_type VARCHAR(24) NOT NULL
    CHECK (audience_type IN ('ORGANISATION','ROLE','DIRECTORATE','USER')),
  audience_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alert_audience_rules_value_check CHECK (
    (audience_type='ORGANISATION' AND audience_value='*') OR
    (audience_type<>'ORGANISATION' AND char_length(btrim(audience_value)) BETWEEN 1 AND 160)
  ),
  CONSTRAINT alert_audience_rules_unique UNIQUE(alert_id,audience_type,audience_value)
);

CREATE TABLE IF NOT EXISTS alert_recipients (
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(alert_id,user_id)
);

CREATE INDEX IF NOT EXISTS alert_audience_rules_lookup_idx
  ON alert_audience_rules(audience_type,audience_value,alert_id);
CREATE INDEX IF NOT EXISTS alert_recipients_user_idx
  ON alert_recipients(user_id,alert_id);
CREATE INDEX IF NOT EXISTS alert_recipients_pending_ack_idx
  ON alert_recipients(alert_id,user_id)
  WHERE acknowledged_at IS NULL;

COMMIT;
