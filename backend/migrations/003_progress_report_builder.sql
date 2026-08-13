BEGIN;
UPDATE document_templates
SET name='Progress Report',context='Assignment',description='Structured assignment progress report.',version=2,governance_status='Approved',active=TRUE,updated_at=NOW(),
    sections='[{"key":"executive_summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"assignment_objectives","title":"Assignment Objectives"},{"key":"activities_undertaken","title":"Activities Undertaken"},{"key":"progress_against_plan","title":"Progress Against Plan"},{"key":"key_achievements","title":"Key Achievements"},{"key":"challenges_risks","title":"Challenges / Risks"},{"key":"corrective_actions","title":"Corrective Actions"},{"key":"next_steps","title":"Next Steps"},{"key":"recommendations","title":"Recommendations"},{"key":"appendices","title":"Appendices"}]'::jsonb
WHERE template_key='progress-report';
COMMIT;
