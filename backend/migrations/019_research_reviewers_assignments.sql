-- Phase 2: formal research reviewers and one-research-to-many-assignment linkage.
-- Idempotent and backwards-compatible with research_projects.assignment_id.

CREATE TABLE IF NOT EXISTS research_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  review_role VARCHAR(40) NOT NULL DEFAULT 'Reviewer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_research_reviewers_project_active
  ON research_reviewers(project_id, active);
CREATE INDEX IF NOT EXISTS idx_research_reviewers_reviewer_active
  ON research_reviewers(reviewer_id, active);

CREATE TABLE IF NOT EXISTS research_assignment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  relation_type VARCHAR(60) NOT NULL DEFAULT 'Research Work',
  linked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, assignment_id),
  UNIQUE(assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_research_assignment_links_project
  ON research_assignment_links(project_id);

-- Preserve existing singular links as the first relation in the new model.
INSERT INTO research_assignment_links(project_id, assignment_id, relation_type, linked_by)
SELECT p.id, p.assignment_id, 'Legacy linked assignment', p.lead_id
FROM research_projects p
WHERE p.assignment_id IS NOT NULL
ON CONFLICT (assignment_id) DO NOTHING;

-- Preserve legacy collaborator-reviewer assignments as formal reviewers.
INSERT INTO research_reviewers(project_id, reviewer_id, assigned_by, review_role, active)
SELECT rc.project_id, rc.user_id, p.lead_id, 'Reviewer', TRUE
FROM research_collaborators rc
JOIN research_projects p ON p.id=rc.project_id
WHERE rc.role='Reviewer'
ON CONFLICT (project_id, reviewer_id) DO UPDATE SET active=TRUE;
