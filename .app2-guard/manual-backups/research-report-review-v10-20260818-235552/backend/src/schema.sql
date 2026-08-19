CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(160) NOT NULL,email VARCHAR(255) NOT NULL UNIQUE,password_hash TEXT NOT NULL,role VARCHAR(40) NOT NULL CHECK(role IN('Administrator','Research Manager','Research Officer','Reviewer')),division VARCHAR(160) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'Available' CHECK(status IN('Available','Busy','Away')),active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS password_reset_tokens(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS assignments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(240) NOT NULL,description TEXT NOT NULL DEFAULT '',division VARCHAR(160) NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'Not Started' CHECK(status IN('Not Started','In Progress','Ready for Review','Completed','Overdue')),priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK(priority IN('Low','Normal','High','Critical')),due_date DATE,created_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS assignment_members(assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,user_id UUID NOT NULL REFERENCES users(id),member_role VARCHAR(30) NOT NULL DEFAULT 'Contributor' CHECK(member_role IN('Lead','Contributor','Reviewer')),assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(assignment_id,user_id));
CREATE TABLE IF NOT EXISTS assignment_comments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,author_id UUID NOT NULL REFERENCES users(id),body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS assignment_history(id BIGSERIAL PRIMARY KEY,assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,user_id UUID REFERENCES users(id),action VARCHAR(80) NOT NULL,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS assignment_attachments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,uploader_id UUID NOT NULL REFERENCES users(id),original_name VARCHAR(255) NOT NULL,stored_name VARCHAR(255) NOT NULL,mime_type VARCHAR(160) NOT NULL,size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=10485760),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS assignment_tasks(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,title VARCHAR(240) NOT NULL,description TEXT NOT NULL DEFAULT '',owner_id UUID REFERENCES users(id) ON DELETE SET NULL,priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK(priority IN('Low','Normal','High','Critical')),status VARCHAR(30) NOT NULL DEFAULT 'Not Started' CHECK(status IN('Not Started','In Progress','Blocked','Completed')),progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),start_date DATE,due_date DATE,notes TEXT NOT NULL DEFAULT '',created_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS assignment_sections(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  section_order INTEGER NOT NULL DEFAULT 1 CHECK(section_order>0),
  lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'Not Started' CHECK(status IN('Not Started','In Progress','Blocked','Ready for Integration','Completed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id),
  CHECK(due_date IS NULL OR start_date IS NULL OR due_date>=start_date)
);
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS assignment_section_id UUID REFERENCES assignment_sections(id) ON DELETE SET NULL;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS task_purpose TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS specific_instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS expected_findings TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS expected_output VARCHAR(200) NOT NULL DEFAULT 'Task Report';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS evidence_required TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS evidence_reviewed TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_challenges TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_next_actions TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id);
CREATE TABLE IF NOT EXISTS assignment_reviews(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,reviewer_id UUID NOT NULL REFERENCES users(id),decision VARCHAR(30) NOT NULL CHECK(decision IN('Submitted','Under Review','Changes Requested','Approved')),comments TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS assignment_task_requests(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  suggested_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK(priority IN('Low','Normal','High','Critical')),
  due_date DATE,
  reason TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','Approved','Rejected','Withdrawn')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_comments TEXT NOT NULL DEFAULT '',
  task_id UUID REFERENCES assignment_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE assignment_attachments DROP CONSTRAINT IF EXISTS assignment_attachments_size_bytes_check;
ALTER TABLE assignment_attachments ADD CONSTRAINT assignment_attachments_size_bytes_check CHECK(size_bytes>0 AND size_bytes<=104857600);
CREATE TABLE IF NOT EXISTS alerts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(200) NOT NULL,body TEXT NOT NULL,severity VARCHAR(20) NOT NULL DEFAULT 'Information' CHECK(severity IN('Information','Important','Urgent')),audience_role VARCHAR(40),created_by UUID NOT NULL REFERENCES users(id),expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'Published' CHECK(status IN('Pending Approval','Published','Rejected'));
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS event_start TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS event_end TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS expiry_notified_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES users(id);
UPDATE alerts SET expires_at=COALESCE(expires_at,created_at+INTERVAL '30 days');
ALTER TABLE alerts ALTER COLUMN expires_at SET NOT NULL;
CREATE TABLE IF NOT EXISTS alert_comments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,user_id UUID NOT NULL REFERENCES users(id),body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS calendar_events(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(200) NOT NULL,description TEXT NOT NULL DEFAULT '',start_at TIMESTAMPTZ NOT NULL,end_at TIMESTAMPTZ,event_type VARCHAR(30) NOT NULL DEFAULT 'Meeting' CHECK(event_type IN('Meeting','Reminder','Deadline','Activity')),created_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(end_at IS NULL OR end_at>=start_at));
CREATE TABLE IF NOT EXISTS audit_logs(id BIGSERIAL PRIMARY KEY,user_id UUID REFERENCES users(id),action VARCHAR(100) NOT NULL,entity_type VARCHAR(80) NOT NULL,entity_id TEXT,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS knowledge_items(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(240) NOT NULL,description TEXT NOT NULL DEFAULT '',category VARCHAR(100) NOT NULL,tags TEXT[] NOT NULL DEFAULT '{}',author VARCHAR(200),document_date DATE,status VARCHAR(30) NOT NULL DEFAULT 'Draft' CHECK(status IN('Draft','Pending Approval','Published','Rejected','Archived')),created_by UUID NOT NULL REFERENCES users(id),approved_by UUID REFERENCES users(id),approved_at TIMESTAMPTZ,rejection_reason TEXT,current_version INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'App2 Upload';
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_source_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_source_type_check CHECK(source_type IN('Internet','Research','Assignment','Task','App2 Report','External Upload','App2 Upload'));
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS knowledge_versions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,version_number INTEGER NOT NULL,uploader_id UUID NOT NULL REFERENCES users(id),original_name VARCHAR(255) NOT NULL,stored_name VARCHAR(255) NOT NULL UNIQUE,mime_type VARCHAR(160) NOT NULL,size_bytes BIGINT NOT NULL CHECK(size_bytes>0),notes VARCHAR(1000) NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(knowledge_id,version_number));
CREATE TABLE IF NOT EXISTS knowledge_assignment_links(knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,linked_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(knowledge_id,assignment_id));
CREATE TABLE IF NOT EXISTS knowledge_downloads(id BIGSERIAL PRIMARY KEY,knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,version_id UUID NOT NULL REFERENCES knowledge_versions(id) ON DELETE CASCADE,user_id UUID NOT NULL REFERENCES users(id),downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS document_deletion_requests(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),knowledge_id UUID REFERENCES knowledge_items(id) ON DELETE SET NULL,knowledge_title VARCHAR(240) NOT NULL,requested_by UUID NOT NULL REFERENCES users(id),reason TEXT NOT NULL CHECK(char_length(reason) BETWEEN 5 AND 2000),status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','Approved','Rejected')),reviewed_by UUID REFERENCES users(id),review_comments TEXT NOT NULL DEFAULT '',reviewed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX IF NOT EXISTS document_deletion_requests_pending_idx ON document_deletion_requests(knowledge_id) WHERE status='Pending' AND knowledge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_deletion_requests_requester_idx ON document_deletion_requests(requested_by,created_at DESC);
CREATE TABLE IF NOT EXISTS repository_entity_links(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,entity_type VARCHAR(20) NOT NULL CHECK(entity_type IN('assignment','task','research','report')),entity_id UUID NOT NULL,linked_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(knowledge_id,entity_type,entity_id));
CREATE INDEX IF NOT EXISTS repository_entity_links_entity_idx ON repository_entity_links(entity_type,entity_id,created_at DESC);
CREATE TABLE IF NOT EXISTS felix_document_index_jobs(id BIGSERIAL PRIMARY KEY,knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,version_number INTEGER NOT NULL CHECK(version_number>0),requested_by UUID NOT NULL REFERENCES users(id),status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','Processing','Completed','Failed')),attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),completed_at TIMESTAMPTZ,UNIQUE(knowledge_id,version_number));
CREATE INDEX IF NOT EXISTS assignment_members_user_idx ON assignment_members(user_id);
CREATE INDEX IF NOT EXISTS assignments_status_idx ON assignments(status);
CREATE INDEX IF NOT EXISTS assignment_comments_assignment_idx ON assignment_comments(assignment_id,created_at);
CREATE INDEX IF NOT EXISTS alerts_created_idx ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_pinned_idx ON alerts(is_pinned,pinned_at DESC) WHERE is_pinned=TRUE;
CREATE INDEX IF NOT EXISTS alert_comments_alert_idx ON alert_comments(alert_id,created_at);
CREATE INDEX IF NOT EXISTS calendar_events_start_idx ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS assignment_history_assignment_idx ON assignment_history(assignment_id,created_at DESC);
CREATE INDEX IF NOT EXISTS assignment_attachments_assignment_idx ON assignment_attachments(assignment_id,created_at DESC);
CREATE INDEX IF NOT EXISTS assignment_tasks_assignment_idx ON assignment_tasks(assignment_id,status,due_date);
CREATE INDEX IF NOT EXISTS assignment_tasks_owner_idx ON assignment_tasks(owner_id,due_date);
CREATE INDEX IF NOT EXISTS assignment_tasks_active_idx ON assignment_tasks(assignment_id,archived_at,status,due_date);
CREATE INDEX IF NOT EXISTS assignment_sections_assignment_order_idx ON assignment_sections(assignment_id,archived_at,section_order);
CREATE INDEX IF NOT EXISTS assignment_sections_lead_idx ON assignment_sections(lead_id,status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS assignment_tasks_section_idx ON assignment_tasks(assignment_section_id) WHERE assignment_section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS assignment_reviews_assignment_idx ON assignment_reviews(assignment_id,created_at DESC);
CREATE INDEX IF NOT EXISTS assignment_task_requests_assignment_idx ON assignment_task_requests(assignment_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS assignment_task_requests_requester_idx ON assignment_task_requests(requested_by,status,created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_items_status_category_idx ON knowledge_items(status,category);
CREATE INDEX IF NOT EXISTS knowledge_items_search_idx ON knowledge_items USING GIN(to_tsvector('english',title||' '||description||' '||COALESCE(author,'')));
CREATE INDEX IF NOT EXISTS knowledge_versions_item_idx ON knowledge_versions(knowledge_id,version_number DESC);
CREATE INDEX IF NOT EXISTS knowledge_links_assignment_idx ON knowledge_assignment_links(assignment_id);
CREATE INDEX IF NOT EXISTS knowledge_downloads_item_idx ON knowledge_downloads(knowledge_id,downloaded_at DESC);
CREATE INDEX IF NOT EXISTS felix_document_index_jobs_pending_idx ON felix_document_index_jobs(status,next_attempt_at,id);
CREATE TABLE IF NOT EXISTS research_projects(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(240) NOT NULL,summary TEXT NOT NULL DEFAULT '',research_question TEXT NOT NULL DEFAULT '',objectives TEXT NOT NULL DEFAULT '',methodology TEXT NOT NULL DEFAULT '',status VARCHAR(30) NOT NULL DEFAULT 'Planning' CHECK(status IN('Planning','Active','Under Review','Completed','Archived')),start_date DATE,end_date DATE,lead_id UUID NOT NULL REFERENCES users(id),assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS research_collaborators(project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,user_id UUID NOT NULL REFERENCES users(id),role VARCHAR(40) NOT NULL DEFAULT 'Researcher',PRIMARY KEY(project_id,user_id));
CREATE TABLE IF NOT EXISTS research_milestones(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,title VARCHAR(200) NOT NULL,due_date DATE,status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','In Progress','Completed')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE research_milestones ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);
ALTER TABLE research_milestones ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE research_milestones ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK(priority IN('Low','Normal','High','Critical'));
ALTER TABLE research_milestones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TABLE IF NOT EXISTS research_sources(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,source_type VARCHAR(40) NOT NULL CHECK(source_type IN('Journal Article','Report','Policy Document','Legislation','Institutional Report','Dataset','Website','Book','Interview','Field Evidence')),title VARCHAR(300) NOT NULL,author VARCHAR(240) NOT NULL DEFAULT '',publisher VARCHAR(240) NOT NULL DEFAULT '',publication_date DATE,url TEXT NOT NULL DEFAULT '',identifier VARCHAR(160) NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',created_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE research_sources ADD COLUMN IF NOT EXISTS provenance VARCHAR(30) NOT NULL DEFAULT 'External' CHECK(provenance IN('Internal','External','Primary Evidence','Secondary Evidence'));
ALTER TABLE research_sources ADD COLUMN IF NOT EXISTS quality VARCHAR(20) NOT NULL DEFAULT 'Unrated' CHECK(quality IN('Unrated','Low','Moderate','High'));
ALTER TABLE research_sources ADD COLUMN IF NOT EXISTS relevance VARCHAR(20) NOT NULL DEFAULT 'Supporting' CHECK(relevance IN('Background','Supporting','Core'));
CREATE TABLE IF NOT EXISTS research_activity(id BIGSERIAL PRIMARY KEY,project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,user_id UUID REFERENCES users(id),action VARCHAR(80) NOT NULL,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS research_sources_project_idx ON research_sources(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS research_activity_project_idx ON research_activity(project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS document_templates(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),template_key VARCHAR(100) NOT NULL UNIQUE,name VARCHAR(200) NOT NULL,context VARCHAR(20) NOT NULL CHECK(context IN('Assignment','Research')),description TEXT NOT NULL DEFAULT '',sections JSONB NOT NULL DEFAULT '[]',version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),governance_status VARCHAR(20) NOT NULL DEFAULT 'Standard' CHECK(governance_status IN('Draft','Standard','Approved','Retired')),active BOOLEAN NOT NULL DEFAULT TRUE,created_by UUID REFERENCES users(id),approved_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS generated_documents(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),template_id UUID NOT NULL REFERENCES document_templates(id),template_version INTEGER NOT NULL,context VARCHAR(20) NOT NULL CHECK(context IN('Assignment','Research')),context_id UUID NOT NULL,title VARCHAR(300) NOT NULL,reference VARCHAR(100) NOT NULL,classification VARCHAR(40) NOT NULL DEFAULT 'Official',status VARCHAR(30) NOT NULL DEFAULT 'Draft' CHECK(status IN('Draft','Submitted','Under Review','Changes Requested','Revised','Approved','Final')),version INTEGER NOT NULL DEFAULT 1,created_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS generated_document_sections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,section_key VARCHAR(100) NOT NULL,title VARCHAR(200) NOT NULL,section_order INTEGER NOT NULL,content TEXT NOT NULL DEFAULT '',completion INTEGER NOT NULL DEFAULT 0 CHECK(completion BETWEEN 0 AND 100),updated_by UUID REFERENCES users(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(document_id,section_key));
CREATE INDEX IF NOT EXISTS generated_documents_context_idx ON generated_documents(context,context_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS generated_document_sections_doc_idx ON generated_document_sections(document_id,section_order);
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id);
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS review_due_date DATE;
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES users(id);
ALTER TABLE generated_document_sections ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);
ALTER TABLE generated_document_sections ADD COLUMN IF NOT EXISTS section_status VARCHAR(30) NOT NULL DEFAULT 'Not Started';
ALTER TABLE generated_document_sections DROP CONSTRAINT IF EXISTS generated_document_sections_section_status_check;
ALTER TABLE generated_document_sections ADD CONSTRAINT generated_document_sections_section_status_check CHECK(section_status IN('Not Started','In Progress','Ready','Needs Changes','Complete'));
CREATE TABLE IF NOT EXISTS generated_document_section_locks(section_id UUID PRIMARY KEY REFERENCES generated_document_sections(id) ON DELETE CASCADE,document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,locked_by UUID NOT NULL REFERENCES users(id),locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS generated_document_section_locks_expiry_idx ON generated_document_section_locks(expires_at);
CREATE TABLE IF NOT EXISTS generated_document_versions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,version_number INTEGER NOT NULL,sections JSONB NOT NULL,change_note TEXT NOT NULL DEFAULT '',status VARCHAR(30) NOT NULL,template_version INTEGER NOT NULL,created_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(document_id,version_number));
CREATE TABLE IF NOT EXISTS generated_document_comments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,section_id UUID REFERENCES generated_document_sections(id) ON DELETE SET NULL,author_id UUID NOT NULL REFERENCES users(id),body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE generated_document_comments ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE generated_document_comments ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS generated_document_reviews(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,version_number INTEGER NOT NULL,reviewer_id UUID NOT NULL REFERENCES users(id),decision VARCHAR(30) NOT NULL CHECK(decision IN('Submitted','Under Review','Changes Requested','Approved','Final')),comments TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS generated_document_references(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,source_type VARCHAR(40) NOT NULL,title VARCHAR(300) NOT NULL,author VARCHAR(240) NOT NULL DEFAULT '',publication_year INTEGER,publisher VARCHAR(240) NOT NULL DEFAULT '',url TEXT NOT NULL DEFAULT '',identifier VARCHAR(160) NOT NULL DEFAULT '',citation_style VARCHAR(20) NOT NULL DEFAULT 'APA' CHECK(citation_style IN('APA','Harvard','Chicago')),created_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS generated_document_versions_doc_idx ON generated_document_versions(document_id,version_number DESC);
CREATE INDEX IF NOT EXISTS generated_document_reviews_doc_idx ON generated_document_reviews(document_id,created_at DESC);
CREATE INDEX IF NOT EXISTS generated_document_references_doc_idx ON generated_document_references(document_id,created_at);
INSERT INTO document_templates(template_key,name,context,description,sections) VALUES
('assignment-brief','Assignment Brief','Assignment','Standard professional starting structure for an assignment.','[{"key":"background","title":"Background"},{"key":"purpose","title":"Purpose"},{"key":"objectives","title":"Objectives"},{"key":"scope","title":"Scope"},{"key":"deliverables","title":"Key Deliverables"},{"key":"risks","title":"Risks"}]'),
('terms-of-reference','Terms of Reference','Assignment','Structured terms, scope, governance and deliverables.','[{"key":"background","title":"Background"},{"key":"objectives","title":"Objectives"},{"key":"scope","title":"Scope of Work"},{"key":"methodology","title":"Approach"},{"key":"deliverables","title":"Deliverables"},{"key":"governance","title":"Governance"},{"key":"timeline","title":"Timeline"}]'),
('work-plan','Work Plan','Assignment','Planned activities, ownership, schedule and monitoring.','[{"key":"objectives","title":"Objectives"},{"key":"activities","title":"Activities"},{"key":"schedule","title":"Schedule"},{"key":"responsibilities","title":"Responsibilities"},{"key":"monitoring","title":"Monitoring"},{"key":"risks","title":"Risks"}]'),
('progress-report','Progress Report','Assignment','Periodic delivery status and management actions.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"progress","title":"Progress"},{"key":"outputs","title":"Outputs"},{"key":"issues","title":"Issues and Risks"},{"key":"next-steps","title":"Next Steps"},{"key":"recommendations","title":"Recommendations"}]'),
('completion-report','Completion Report','Assignment','Completion record, results and lessons learned.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"objectives","title":"Objectives"},{"key":"outputs","title":"Outputs Delivered"},{"key":"outcomes","title":"Outcomes"},{"key":"lessons","title":"Lessons Learned"},{"key":"recommendations","title":"Recommendations"}]'),
('research-concept-note','Research Concept Note','Research','Initial research rationale and proposed approach.','[{"key":"background","title":"Background"},{"key":"problem","title":"Problem Statement"},{"key":"purpose","title":"Purpose"},{"key":"objectives","title":"Objectives"},{"key":"scope","title":"Scope"},{"key":"methodology","title":"Proposed Methodology"},{"key":"outputs","title":"Expected Outputs"}]'),
('research-proposal','Research Proposal','Research','Full proposal structure for controlled research planning.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"problem","title":"Problem Statement"},{"key":"objectives","title":"Objectives"},{"key":"literature","title":"Literature Review"},{"key":"methodology","title":"Methodology"},{"key":"ethics","title":"Ethical Considerations"},{"key":"work-plan","title":"Work Plan"},{"key":"references","title":"References"}]'),
('literature-review','Literature Review','Research','Structured synthesis of existing evidence.','[{"key":"introduction","title":"Introduction"},{"key":"method","title":"Search and Selection Method"},{"key":"themes","title":"Thematic Findings"},{"key":"gaps","title":"Evidence Gaps"},{"key":"discussion","title":"Discussion"},{"key":"references","title":"References"}]'),
('methodology-paper','Methodology Paper','Research','Detailed research design and analytical methods.','[{"key":"design","title":"Research Design"},{"key":"population","title":"Population and Sampling"},{"key":"collection","title":"Data Collection"},{"key":"analysis","title":"Analysis Plan"},{"key":"quality","title":"Quality Assurance"},{"key":"ethics","title":"Ethics"},{"key":"limitations","title":"Limitations"}]'),
('research-report','Research Report','Research','Full professional research report structure.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"objectives","title":"Objectives"},{"key":"methodology","title":"Methodology"},{"key":"findings","title":"Findings"},{"key":"analysis","title":"Analysis"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]'),
('policy-brief','Policy Brief','Research','Concise evidence-to-policy communication structure.','[{"key":"key-messages","title":"Key Messages"},{"key":"context","title":"Context"},{"key":"evidence","title":"Evidence"},{"key":"options","title":"Policy Options"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"}]') ON CONFLICT(template_key) DO NOTHING;
UPDATE document_templates SET name='Progress Report',context='Assignment',description='Structured assignment progress report.',version=2,governance_status='Approved',active=TRUE,updated_at=NOW(),sections='[{"key":"executive_summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"assignment_objectives","title":"Assignment Objectives"},{"key":"activities_undertaken","title":"Activities Undertaken"},{"key":"progress_against_plan","title":"Progress Against Plan"},{"key":"key_achievements","title":"Key Achievements"},{"key":"challenges_risks","title":"Challenges / Risks"},{"key":"corrective_actions","title":"Corrective Actions"},{"key":"next_steps","title":"Next Steps"},{"key":"recommendations","title":"Recommendations"},{"key":"appendices","title":"Appendices"}]'::jsonb WHERE template_key='progress-report';
INSERT INTO document_templates(template_key,name,context,description,sections) VALUES
('concept-note','Concept Note','Assignment','Concise rationale, scope and intended results.','[{"key":"background","title":"Background"},{"key":"problem","title":"Problem Statement"},{"key":"purpose","title":"Purpose"},{"key":"objectives","title":"Objectives"},{"key":"approach","title":"Approach"},{"key":"outputs","title":"Expected Outputs"}]'),
('status-report','Status Report','Assignment','Current delivery status, exceptions and required decisions.','[{"key":"summary","title":"Status Summary"},{"key":"achievements","title":"Achievements"},{"key":"exceptions","title":"Exceptions"},{"key":"risks","title":"Risks"},{"key":"decisions","title":"Decisions Required"},{"key":"next-steps","title":"Next Steps"}]'),
('field-visit-report','Field/Visit Report','Assignment','Controlled record of a field activity or institutional visit.','[{"key":"purpose","title":"Purpose"},{"key":"participants","title":"Participants"},{"key":"observations","title":"Observations"},{"key":"findings","title":"Findings"},{"key":"actions","title":"Follow-up Actions"},{"key":"appendices","title":"Appendices"}]'),
('meeting-report','Meeting Report','Assignment','Meeting context, deliberations, decisions and actions.','[{"key":"meeting-details","title":"Meeting Details"},{"key":"attendance","title":"Attendance"},{"key":"agenda","title":"Agenda"},{"key":"discussion","title":"Discussion"},{"key":"decisions","title":"Decisions"},{"key":"actions","title":"Action Items"}]'),
('technical-report','Technical Report','Assignment','Detailed technical findings and recommendations.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"methodology","title":"Methodology"},{"key":"findings","title":"Findings"},{"key":"analysis","title":"Analysis"},{"key":"recommendations","title":"Recommendations"},{"key":"appendices","title":"Appendices"}]'),
('management-report','Management Report','Assignment','Management-level performance and decision report.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"performance","title":"Performance"},{"key":"issues","title":"Strategic Issues"},{"key":"risks","title":"Risks"},{"key":"recommendations","title":"Recommendations"},{"key":"decisions","title":"Decisions Required"}]'),
('lessons-learned','Lessons Learned Report','Assignment','Delivery reflection and reusable institutional learning.','[{"key":"context","title":"Context"},{"key":"successes","title":"What Worked"},{"key":"challenges","title":"Challenges"},{"key":"lessons","title":"Lessons"},{"key":"recommendations","title":"Recommendations"}]'),
('executive-brief','Executive Brief','Assignment','Short executive decision brief.','[{"key":"issue","title":"Issue"},{"key":"context","title":"Context"},{"key":"analysis","title":"Analysis"},{"key":"options","title":"Options"},{"key":"recommendation","title":"Recommended Action"}]'),
('memo','Memo','Assignment','Formal internal memorandum.','[{"key":"subject","title":"Subject"},{"key":"purpose","title":"Purpose"},{"key":"details","title":"Details"},{"key":"action","title":"Action Required"}]'),
('submission-note','Submission/Transmittal Note','Assignment','Controlled note transmitting work for action or decision.','[{"key":"recipient","title":"Recipient and Purpose"},{"key":"documents","title":"Documents Transmitted"},{"key":"summary","title":"Summary"},{"key":"action","title":"Action Requested"}]'),
('inception-report','Inception Report','Research','Confirmed scope, approach and mobilization plan.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"understanding","title":"Understanding of the Study"},{"key":"methodology","title":"Methodology"},{"key":"work-plan","title":"Work Plan"},{"key":"risks","title":"Risks"},{"key":"outputs","title":"Outputs"}]'),
('research-protocol','Research Protocol','Research','Controlled study protocol and safeguards.','[{"key":"background","title":"Background"},{"key":"objectives","title":"Objectives"},{"key":"design","title":"Study Design"},{"key":"methods","title":"Methods"},{"key":"ethics","title":"Ethics"},{"key":"quality","title":"Quality Assurance"}]'),
('data-collection-plan','Data Collection Plan','Research','Fieldwork methods, instruments and quality controls.','[{"key":"requirements","title":"Data Requirements"},{"key":"sources","title":"Sources"},{"key":"instruments","title":"Instruments"},{"key":"fieldwork","title":"Fieldwork Plan"},{"key":"quality","title":"Quality Control"},{"key":"security","title":"Data Security"}]'),
('survey-questionnaire','Survey / Questionnaire','Research','Structured data collection instrument.','[{"key":"introduction","title":"Respondent Introduction"},{"key":"consent","title":"Consent"},{"key":"screening","title":"Screening Questions"},{"key":"questions","title":"Questionnaire"},{"key":"closing","title":"Closing Statement"}]'),
('issue-paper','Issue Paper','Research','Focused exploration of an institutional issue.','[{"key":"issue","title":"Issue Definition"},{"key":"context","title":"Context"},{"key":"evidence","title":"Evidence"},{"key":"analysis","title":"Analysis"},{"key":"options","title":"Options"},{"key":"recommendations","title":"Recommendations"}]'),
('discussion-paper','Discussion Paper','Research','Evidence-led paper for consultation and debate.','[{"key":"abstract","title":"Abstract"},{"key":"background","title":"Background"},{"key":"argument","title":"Discussion"},{"key":"implications","title":"Implications"},{"key":"questions","title":"Questions for Consultation"},{"key":"references","title":"References"}]'),
('working-paper','Working Paper','Research','Preliminary analytical research output.','[{"key":"abstract","title":"Abstract"},{"key":"introduction","title":"Introduction"},{"key":"methodology","title":"Methodology"},{"key":"analysis","title":"Analysis"},{"key":"discussion","title":"Discussion"},{"key":"references","title":"References"}]'),
('evidence-brief','Evidence Brief','Research','Compact synthesis of evidence for decision-makers.','[{"key":"question","title":"Decision Question"},{"key":"key-findings","title":"Key Findings"},{"key":"evidence","title":"Evidence Summary"},{"key":"limitations","title":"Limitations"},{"key":"implications","title":"Implications"},{"key":"references","title":"References"}]'),
('executive-summary-research','Executive Summary','Research','Standalone executive synthesis of a research output.','[{"key":"purpose","title":"Purpose"},{"key":"method","title":"Method"},{"key":"findings","title":"Key Findings"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"}]'),
('evaluation-report','Evaluation Report','Research','Evaluation design, findings and recommendations.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"context","title":"Context"},{"key":"criteria","title":"Evaluation Criteria"},{"key":"methodology","title":"Methodology"},{"key":"findings","title":"Findings"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"}]'),
('baseline-report','Baseline Report','Research','Baseline indicators, methods and initial findings.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"indicators","title":"Indicators"},{"key":"methodology","title":"Methodology"},{"key":"findings","title":"Baseline Findings"},{"key":"recommendations","title":"Recommendations"}]'),
('feasibility-study','Feasibility Study','Research','Assessment of technical, operational and financial feasibility.','[{"key":"executive-summary","title":"Executive Summary"},{"key":"need","title":"Need and Context"},{"key":"options","title":"Options Assessed"},{"key":"technical","title":"Technical Feasibility"},{"key":"operational","title":"Operational Feasibility"},{"key":"financial","title":"Financial Feasibility"},{"key":"recommendation","title":"Recommendation"}]'),
('case-study','Case Study','Research','Structured examination of an institutional case.','[{"key":"summary","title":"Case Summary"},{"key":"context","title":"Context"},{"key":"approach","title":"Approach"},{"key":"findings","title":"Findings"},{"key":"lessons","title":"Lessons"},{"key":"implications","title":"Implications"}]') ON CONFLICT(template_key) DO NOTHING;
INSERT INTO document_templates(template_key,name,context,description,sections,governance_status,active) VALUES
('task-standard-report','Task Report','Assignment','Standard controlled report for completed task work.','[{"key":"title","title":"Output Title"},{"key":"workCompleted","title":"Work Completed"},{"key":"evidence","title":"Evidence Reviewed"},{"key":"findings","title":"Key Findings"},{"key":"recommendations","title":"Recommendations"},{"key":"challenges","title":"Challenges or Limitations"},{"key":"nextActions","title":"Next Actions"}]','Approved',TRUE),
('task-technical-note','Task Technical Note','Assignment','Technical task output with method, evidence, analysis and actions.','[{"key":"title","title":"Technical Output Title"},{"key":"workCompleted","title":"Method and Work Completed"},{"key":"evidence","title":"Evidence and Inputs"},{"key":"findings","title":"Technical Findings"},{"key":"recommendations","title":"Technical Recommendations"},{"key":"challenges","title":"Constraints"},{"key":"nextActions","title":"Implementation Actions"}]','Approved',TRUE),
('task-field-report','Task Field Report','Assignment','Controlled record for fieldwork, interviews, inspections or visits.','[{"key":"title","title":"Field Activity Title"},{"key":"workCompleted","title":"Activity Completed"},{"key":"evidence","title":"Observations and Evidence"},{"key":"findings","title":"Findings"},{"key":"recommendations","title":"Recommended Action"},{"key":"challenges","title":"Limitations"},{"key":"nextActions","title":"Follow-up Actions"}]','Approved',TRUE)
ON CONFLICT(template_key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,sections=EXCLUDED.sections,governance_status='Approved',active=TRUE,updated_at=NOW();
CREATE TABLE IF NOT EXISTS research_comments(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE research_comments ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'Update' CHECK(category IN('Update','Question','Decision','Review Note'));
ALTER TABLE research_comments ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE research_comments ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);
ALTER TABLE research_comments ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_research_comments_project
ON research_comments(project_id, created_at);
CREATE TABLE IF NOT EXISTS research_report_sections(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL
    REFERENCES research_projects(id)
    ON DELETE CASCADE,

  section_key TEXT NOT NULL,

  title TEXT NOT NULL,

  content TEXT NOT NULL DEFAULT '',

  section_order INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'Not Started'
    CHECK (
      status IN (
        'Not Started',
        'Draft',
        'In Progress',
        'Ready for Review',
        'Approved'
      )
    ),

  updated_by UUID
    REFERENCES users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(project_id,section_key)
);

CREATE INDEX IF NOT EXISTS idx_research_report_sections_project
ON research_report_sections(project_id,section_order);
ALTER TABLE research_report_sections ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);
ALTER TABLE research_report_sections ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id);


CREATE TABLE IF NOT EXISTS research_report_versions(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL
    REFERENCES research_projects(id)
    ON DELETE CASCADE,

  version_number INTEGER NOT NULL,

  title TEXT NOT NULL,

  report_snapshot JSONB NOT NULL,

  created_by UUID NOT NULL
    REFERENCES users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(project_id,version_number)
);

CREATE INDEX IF NOT EXISTS idx_research_report_versions_project
ON research_report_versions(project_id,version_number);
CREATE TABLE IF NOT EXISTS research_knowledge_links(project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,linked_by UUID REFERENCES users(id),linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(project_id,knowledge_item_id));
ALTER TABLE research_knowledge_links ADD COLUMN IF NOT EXISTS linked_by UUID REFERENCES users(id);
ALTER TABLE research_knowledge_links ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS research_knowledge_links_project_idx ON research_knowledge_links(project_id,linked_at DESC);
CREATE INDEX IF NOT EXISTS research_projects_status_idx ON research_projects(status);
CREATE TABLE IF NOT EXISTS document_locks(knowledge_id UUID PRIMARY KEY REFERENCES knowledge_items(id) ON DELETE CASCADE,locked_by UUID NOT NULL REFERENCES users(id),locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '2 hours');
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS retention_until DATE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id);
CREATE TABLE IF NOT EXISTS document_reviews(id BIGSERIAL PRIMARY KEY,knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,reviewer_id UUID REFERENCES users(id),actor_id UUID NOT NULL REFERENCES users(id),action VARCHAR(40) NOT NULL CHECK(action IN('SUBMITTED','ASSIGNED','APPROVED','REJECTED','RESUBMITTED')),comments TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS notifications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,title VARCHAR(200) NOT NULL,body TEXT NOT NULL,entity_type VARCHAR(80),entity_id TEXT,read_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS document_locks_expiry_idx ON document_locks(expires_at);
CREATE INDEX IF NOT EXISTS document_reviews_item_idx ON document_reviews(knowledge_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,read_at,created_at DESC);
CREATE TABLE IF NOT EXISTS system_settings(id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1),organization_name VARCHAR(200) NOT NULL DEFAULT 'Public Service Commission',department_name VARCHAR(200) NOT NULL DEFAULT 'Research Department',support_email VARCHAR(255) NOT NULL DEFAULT 'support@publicservice.go.ke',session_minutes INTEGER NOT NULL DEFAULT 480 CHECK(session_minutes BETWEEN 15 AND 1440),max_upload_mb INTEGER NOT NULL DEFAULT 100 CHECK(max_upload_mb BETWEEN 1 AND 500),default_retention_days INTEGER NOT NULL DEFAULT 2555 CHECK(default_retention_days BETWEEN 30 AND 7300),document_categories TEXT[] NOT NULL DEFAULT ARRAY['Policy','Report','Circular','Research Paper','Book','Template'],maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,email_notifications BOOLEAN NOT NULL DEFAULT TRUE,updated_by UUID REFERENCES users(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO system_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS user_preferences(user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,email_notifications BOOLEAN NOT NULL DEFAULT TRUE,in_app_notifications BOOLEAN NOT NULL DEFAULT TRUE,compact_layout BOOLEAN NOT NULL DEFAULT FALSE,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(20) NOT NULL DEFAULT 'Dark' CHECK(theme_mode IN('Dark','Light','System'));
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_theme_mode_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_theme_mode_check CHECK(theme_mode IN('Dark','Light','System','Gold Grey','Navy Blue'));
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) NOT NULL DEFAULT 'Gold' CHECK(accent_color IN('Gold','Blue','Green'));


-- Task contribution mapping
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS expected_contribution TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS target_document_id UUID REFERENCES generated_documents(id) ON DELETE SET NULL;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS target_section_id UUID REFERENCES generated_document_sections(id) ON DELETE SET NULL;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_title VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_findings TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_recommendations TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_status VARCHAR(30) NOT NULL DEFAULT 'Draft';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_section_statuses JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_updated_at TIMESTAMPTZ;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_ready_at TIMESTAMPTZ;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_integrated_at TIMESTAMPTZ;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_integrated_by UUID REFERENCES users(id);

ALTER TABLE assignment_tasks DROP CONSTRAINT IF EXISTS assignment_tasks_contribution_status_check;
ALTER TABLE assignment_tasks ADD CONSTRAINT assignment_tasks_contribution_status_check
CHECK(contribution_status IN('Draft','Ready for Integration','Integrated','Accepted'));

CREATE INDEX IF NOT EXISTS assignment_tasks_contribution_idx
ON assignment_tasks(assignment_id,contribution_status,target_document_id,target_section_id);


-- Generated task contribution report preview/submission
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_report_html TEXT NOT NULL DEFAULT '';
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_report_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS contribution_report_generated_at TIMESTAMPTZ;


-- Exact assignment contribution mapping
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS assignment_part TEXT NOT NULL DEFAULT '';

-- Production document repository metadata (migration 009)
CREATE TABLE IF NOT EXISTS document_categories(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(120) NOT NULL UNIQUE,description TEXT NOT NULL DEFAULT '',parent_id UUID REFERENCES document_categories(id),is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO document_categories(name) VALUES('Policies & Guidelines'),('Acts & Regulations'),('Circulars'),('Research Reports'),('Assignment Reports'),('Manuals & SOPs'),('Strategic Documents'),('Meeting & Workshop Reports'),('Templates'),('Reference Materials') ON CONFLICT(name) DO NOTHING;
CREATE TABLE IF NOT EXISTS document_tags(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(60) NOT NULL,normalized_name VARCHAR(60) NOT NULL UNIQUE,created_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS document_tag_links(knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,tag_id UUID NOT NULL REFERENCES document_tags(id) ON DELETE CASCADE,PRIMARY KEY(knowledge_id,tag_id));
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES document_categories(id);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS directorate VARCHAR(160);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS document_type VARCHAR(100) NOT NULL DEFAULT 'Document';
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS subject VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS classification VARCHAR(20) NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS felix_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE knowledge_items ALTER COLUMN felix_enabled SET DEFAULT TRUE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION enable_felix_for_published_document() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status='Published' THEN NEW.felix_enabled=TRUE; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS knowledge_items_auto_enable_felix ON knowledge_items;
CREATE TRIGGER knowledge_items_auto_enable_felix BEFORE INSERT OR UPDATE OF status ON knowledge_items FOR EACH ROW EXECUTE FUNCTION enable_felix_for_published_document();
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_classification_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_classification_check CHECK(classification IN('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'));
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS sha256_hash CHAR(64);
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
UPDATE knowledge_versions v SET storage_path=COALESCE(v.storage_path,v.stored_name),is_current=(v.version_number=k.current_version) FROM knowledge_items k WHERE k.id=v.knowledge_id;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_versions_hash_idx ON knowledge_versions(sha256_hash) WHERE sha256_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_versions_one_current_idx ON knowledge_versions(knowledge_id) WHERE is_current;
CREATE TABLE IF NOT EXISTS document_permissions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,user_id UUID REFERENCES users(id) ON DELETE CASCADE,role VARCHAR(40),permission VARCHAR(20) NOT NULL CHECK(permission IN('READ','WRITE','REVIEW')),granted_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK((user_id IS NOT NULL) <> (role IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS document_permissions_user_idx ON document_permissions(knowledge_id,user_id,permission) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS document_permissions_role_idx ON document_permissions(knowledge_id,role,permission) WHERE role IS NOT NULL;
CREATE TABLE IF NOT EXISTS document_text_content(version_id UUID PRIMARY KEY REFERENCES knowledge_versions(id) ON DELETE CASCADE,knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,extracted_text TEXT NOT NULL DEFAULT '',search_vector TSVECTOR GENERATED ALWAYS AS(to_tsvector('english',extracted_text)) STORED,extraction_status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK(extraction_status IN('Pending','Completed','Unsupported','Failed')),extraction_error TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS document_text_search_idx ON document_text_content USING GIN(search_vector);
ALTER TABLE document_permissions DROP CONSTRAINT IF EXISTS document_permissions_permission_check;
ALTER TABLE document_permissions ADD CONSTRAINT document_permissions_permission_check CHECK(permission IN('READ','DOWNLOAD','WRITE','REVIEW'));
CREATE TABLE IF NOT EXISTS user_report_favourites(user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,report_key VARCHAR(100) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,report_key));
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS sla_due_date DATE;
UPDATE assignments SET completed_at=updated_at WHERE status='Completed' AND completed_at IS NULL;
UPDATE assignments SET sla_due_date=due_date WHERE sla_due_date IS NULL;
CREATE OR REPLACE FUNCTION set_assignment_reporting_dates() RETURNS trigger AS $$ BEGIN IF NEW.status='Completed' AND OLD.status IS DISTINCT FROM 'Completed' THEN NEW.completed_at=COALESCE(NEW.completed_at,NOW()); END IF; IF NEW.status<>'Completed' THEN NEW.completed_at=NULL; END IF; IF NEW.sla_due_date IS NULL THEN NEW.sla_due_date=NEW.due_date; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS assignments_reporting_dates_trigger ON assignments;
CREATE TRIGGER assignments_reporting_dates_trigger BEFORE INSERT OR UPDATE OF status,due_date,sla_due_date ON assignments FOR EACH ROW EXECUTE FUNCTION set_assignment_reporting_dates();
CREATE TABLE IF NOT EXISTS user_report_views(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,report_key VARCHAR(100) NOT NULL,name VARCHAR(120) NOT NULL,filters JSONB NOT NULL DEFAULT '{}'::jsonb,is_default BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,report_key,name));
CREATE INDEX IF NOT EXISTS user_report_views_lookup_idx ON user_report_views(user_id,report_key,updated_at DESC);
CREATE TABLE IF NOT EXISTS report_exports(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id),report_key VARCHAR(100) NOT NULL,format VARCHAR(10) NOT NULL CHECK(format IN('pdf','docx','xlsx')),filters JSONB NOT NULL DEFAULT '{}'::jsonb,row_count INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS report_exports_audit_idx ON report_exports(user_id,report_key,created_at DESC);
CREATE TABLE IF NOT EXISTS report_decisions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),report_key VARCHAR(100) NOT NULL,title VARCHAR(240) NOT NULL,decision TEXT NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK(status IN('Open','Resolved')),created_by UUID NOT NULL REFERENCES users(id),resolved_by UUID REFERENCES users(id),resolved_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS felix_report_metrics(id BIGSERIAL PRIMARY KEY,user_id UUID REFERENCES users(id) ON DELETE SET NULL,mode VARCHAR(40),query_length INTEGER NOT NULL DEFAULT 0,response_ok BOOLEAN NOT NULL DEFAULT FALSE,source_count INTEGER NOT NULL DEFAULT 0,confidence NUMERIC(5,4),response_ms INTEGER,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS felix_report_metrics_created_idx ON felix_report_metrics(created_at,user_id);
CREATE TABLE IF NOT EXISTS report_schedules(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,report_key VARCHAR(100) NOT NULL,name VARCHAR(120) NOT NULL,format VARCHAR(10) NOT NULL CHECK(format IN('pdf','docx','xlsx')),frequency VARCHAR(20) NOT NULL CHECK(frequency IN('Daily','Weekly','Monthly')),recipient_emails TEXT[] NOT NULL DEFAULT '{}',filters JSONB NOT NULL DEFAULT '{}'::jsonb,enabled BOOLEAN NOT NULL DEFAULT TRUE,next_run_at TIMESTAMPTZ NOT NULL,last_run_at TIMESTAMPTZ,last_status VARCHAR(20),last_error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS report_schedules_due_idx ON report_schedules(enabled,next_run_at);
CREATE TABLE IF NOT EXISTS report_signoffs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),report_key VARCHAR(100) NOT NULL,filters JSONB NOT NULL DEFAULT '{}'::jsonb,report_snapshot JSONB NOT NULL,report_hash VARCHAR(64) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'Signed Off' CHECK(status IN('Signed Off','Revoked')),signed_by UUID NOT NULL REFERENCES users(id),signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),revoked_by UUID REFERENCES users(id),revoked_at TIMESTAMPTZ,comments TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS report_signoffs_lookup_idx ON report_signoffs(report_key,signed_at DESC);
CREATE TABLE IF NOT EXISTS report_runtime_metrics(id BIGSERIAL PRIMARY KEY,report_key VARCHAR(100) NOT NULL,user_id UUID REFERENCES users(id) ON DELETE SET NULL,duration_ms INTEGER NOT NULL,row_count INTEGER NOT NULL DEFAULT 0,succeeded BOOLEAN NOT NULL,error_message TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS report_runtime_metrics_recent_idx ON report_runtime_metrics(created_at DESC,report_key);
CREATE TABLE IF NOT EXISTS report_definition_overrides(report_key VARCHAR(100) PRIMARY KEY,enabled BOOLEAN NOT NULL DEFAULT TRUE,access_note TEXT NOT NULL DEFAULT '',updated_by UUID NOT NULL REFERENCES users(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE report_decisions ADD COLUMN IF NOT EXISTS filters JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE report_decisions ADD COLUMN IF NOT EXISTS due_date DATE;
CREATE INDEX IF NOT EXISTS assignments_reporting_idx ON assignments(created_at,status,division,priority,due_date);
CREATE INDEX IF NOT EXISTS research_projects_reporting_idx ON research_projects(created_at,status);
CREATE INDEX IF NOT EXISTS knowledge_items_reporting_idx ON knowledge_items(created_at,status,category,is_archived);
