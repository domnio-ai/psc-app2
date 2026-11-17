BEGIN;

CREATE TABLE IF NOT EXISTS repository_record_sequences(
  year INTEGER NOT NULL,
  prefix VARCHAR(80) NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(year,prefix)
);

CREATE TABLE IF NOT EXISTS repository_retention_schedules(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  record_class VARCHAR(120) NOT NULL,
  review_interval_months INTEGER CHECK(review_interval_months IS NULL OR review_interval_months BETWEEN 1 AND 240),
  retention_years INTEGER CHECK(retention_years IS NULL OR retention_years BETWEEN 1 AND 100),
  disposition_action VARCHAR(40) NOT NULL DEFAULT 'Review'
    CHECK(disposition_action IN('Review','Destroy','Transfer','Permanent')),
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS repository_retention_schedules_name_idx
  ON repository_retention_schedules(name);

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS retention_schedule_id UUID REFERENCES repository_retention_schedules(id),
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES knowledge_items(id),
  ADD COLUMN IF NOT EXISTS next_review_at DATE;

CREATE TABLE IF NOT EXISTS repository_saved_views(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,name)
);

CREATE INDEX IF NOT EXISTS repository_saved_views_user_idx
  ON repository_saved_views(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_items_record_class_idx
  ON knowledge_items(record_class,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_items_next_review_idx
  ON knowledge_items(next_review_at) WHERE next_review_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_items_superseded_idx
  ON knowledge_items(superseded_by) WHERE superseded_by IS NOT NULL;

INSERT INTO repository_retention_schedules(name,record_class,review_interval_months,retention_years,disposition_action,description)
VALUES
 ('Administrative Standard','Administrative Records',24,7,'Review','Default administrative record schedule.'),
 ('Policy Standard','Policies & Guidelines',24,7,'Review','Policy and guideline review every two years.'),
 ('Meeting Record Standard','Meeting Records',NULL,7,'Review','Meeting minutes and formal proceedings.'),
 ('Evidence Standard','Evidence & Supporting Records',NULL,7,'Review','Evidence retained for the governed business need and disposition review.'),
 ('Research Knowledge Standard','Research & Knowledge',24,10,'Review','Research and institutional knowledge schedule.'),
 ('Permanent Institutional Record','Permanent Record',60,NULL,'Permanent','Permanent preservation candidate.')
ON CONFLICT(name) DO NOTHING;

WITH missing AS(
  SELECT id,EXTRACT(YEAR FROM COALESCE(document_date,created_at))::int yr,
    ROW_NUMBER() OVER(ORDER BY created_at,id) rn
  FROM knowledge_items
  WHERE record_number IS NULL
)
UPDATE knowledge_items k
SET record_number='PSC/LEGACY/'||missing.yr||'/'||LPAD(missing.rn::text,4,'0')
FROM missing WHERE k.id=missing.id;

COMMIT;
