BEGIN;
CREATE TABLE IF NOT EXISTS leave_types(
 code TEXT PRIMARY KEY,name TEXT NOT NULL,default_entitlement_days NUMERIC(6,2),
 paid BOOLEAN NOT NULL DEFAULT TRUE,requires_document BOOLEAN NOT NULL DEFAULT FALSE,
 active BOOLEAN NOT NULL DEFAULT TRUE,display_order INTEGER NOT NULL DEFAULT 100,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO leave_types(code,name,default_entitlement_days,paid,requires_document,display_order) VALUES
('ANNUAL','Annual Leave',30,TRUE,FALSE,10),
('SICK','Sick Leave',NULL,TRUE,TRUE,20),
('MATERNITY','Maternity Leave',NULL,TRUE,TRUE,30),
('PATERNITY','Paternity Leave',NULL,TRUE,TRUE,40),
('ADOPTION','Child Adoption Leave',NULL,TRUE,TRUE,50),
('COMPASSIONATE','Compassionate Leave',NULL,TRUE,FALSE,60),
('OFFICIAL_DUTY','Official Duty',NULL,TRUE,FALSE,70),
('TRAINING','Training / Study Leave',NULL,TRUE,FALSE,80),
('UNPAID','Unpaid Leave',NULL,FALSE,FALSE,90),
('TERMINAL','Terminal Leave',NULL,TRUE,FALSE,100),
('OTHER','Other Approved Absence',NULL,TRUE,FALSE,110)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,default_entitlement_days=EXCLUDED.default_entitlement_days,
 paid=EXCLUDED.paid,requires_document=EXCLUDED.requires_document,display_order=EXCLUDED.display_order,updated_at=NOW();

CREATE TABLE IF NOT EXISTS leave_requests(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 leave_type_code TEXT NOT NULL REFERENCES leave_types(code),
 start_date DATE NOT NULL,end_date DATE NOT NULL,working_days NUMERIC(6,2) NOT NULL CHECK(working_days>0),
 reason TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Pending'
 CHECK(status IN('Pending','Approved','Returned','Rejected','Cancelled')),
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),approver_id UUID REFERENCES users(id),
 decision_note TEXT,decided_at TIMESTAMPTZ,cancelled_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(end_date>=start_date)
);
CREATE INDEX IF NOT EXISTS leave_requests_user_dates_idx ON leave_requests(user_id,start_date,end_date,status);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON leave_requests(status,submitted_at DESC);

CREATE TABLE IF NOT EXISTS leave_balance_adjustments(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 leave_type_code TEXT NOT NULL REFERENCES leave_types(code),
 leave_year INTEGER NOT NULL,adjustment_days NUMERIC(6,2) NOT NULL,
 reason TEXT NOT NULL,created_by UUID NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS leave_balance_adjustments_lookup_idx
 ON leave_balance_adjustments(user_id,leave_type_code,leave_year);
COMMIT;
