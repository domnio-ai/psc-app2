import { type Dispatch, type SetStateAction } from "react";
import {
  api,
  type KnowledgeItem,
  type ResearchProject,
  type ResearchReportSection,
  type ResearchReportVersion,
  type ResearchRepositoryDocument,
  type ResearchSource,
} from "../../../api";
import FelixAdvicePanel from "../../../components/felix/FelixAdvicePanel";
import ResearchReferencePanel from "./ResearchReferencePanel";

type ResearchTemplateOption = {
  template_key: string;
  name: string;
  description: string;
  section_count: number;
};

type TeamReviewerOption = {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
};

type Props = {
  token: string;
  selectedResearch: ResearchProject;
  researchReport: ResearchReportSection[];
  setResearchReport: Dispatch<SetStateAction<ResearchReportSection[]>>;
  researchReportVersions: ResearchReportVersion[];
  researchTab: string;
  selectedReportSection: ResearchReportSection | null;
  setSelectedReportSection: Dispatch<SetStateAction<ResearchReportSection | null>>;
  reportContent: string;
  setReportContent: Dispatch<SetStateAction<string>>;
  reportSaving: boolean;
  canReview: boolean;
  team: TeamReviewerOption[];
  reviewerOptions: { id: string; name: string; role: string }[];
  researchSources: ResearchSource[];
  researchRepositoryDocuments: ResearchRepositoryDocument[];
  knowledgeRows: KnowledgeItem[];
  researchSupportingDocumentIds: string[];
  setResearchSupportingDocumentIds: Dispatch<SetStateAction<string[]>>;
  researchTemplateLibrary: readonly ResearchTemplateOption[];
  researchTemplateDownloadId: string;
  setResearchTemplateDownloadId: Dispatch<SetStateAction<string>>;
  researchTemplateApplying: boolean;
  setResearchTemplateApplying: Dispatch<SetStateAction<boolean>>;
  researchReportPreviewOpen: boolean;
  setResearchReportPreviewOpen: Dispatch<SetStateAction<boolean>>;
  setResearchWorkspaceNotice: Dispatch<SetStateAction<string>>;
  saveResearchSectionDraft: (contentOverride?: string) => Promise<boolean | void>;
  saveResearchSectionStatus: (status: ResearchReportSection["status"]) => Promise<void> | void;
  renderSectionHtml: (value: string) => string;
  onOpenRepository: () => void;
  onOpenSectionEditor: (section?: ResearchReportSection) => void | Promise<void>;
  onOpenSectionReview: () => void;
  onGoToReview: () => void;
  onProceedToReview: () => void;
};

function wordCount(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  const text = (div.textContent || "").trim();
  return text ? text.split(/\s+/).length : 0;
}

export default function ResearchReportBuilderPanel({
  token,
  selectedResearch,
  researchReport,
  setResearchReport,
  researchReportVersions,
  researchTab,
  selectedReportSection,
  setSelectedReportSection,
  setReportContent,
  reviewerOptions,
  researchSources,
  researchRepositoryDocuments,
  knowledgeRows,
  researchSupportingDocumentIds,
  setResearchSupportingDocumentIds,
  researchTemplateLibrary,
  researchTemplateDownloadId,
  setResearchTemplateDownloadId,
  researchTemplateApplying,
  setResearchTemplateApplying,
  setResearchReportPreviewOpen,
  setResearchWorkspaceNotice,
  onOpenSectionEditor,
  onOpenSectionReview,
}: Props) {
  const draftedCount = researchReport.filter((section) => section.content.trim()).length;
  const readyCount = researchReport.filter((section) => section.status === "Ready for Review").length;
  const approvedCount = researchReport.filter((section) => section.status === "Approved").length;
  const totalWords = researchReport.reduce((sum, section) => sum + wordCount(section.content), 0);
  const estimatedPages = Math.max(1, Math.ceil(totalWords / 430));
  const hasDraftContent = draftedCount > 0;
  const latestVersion = researchReportVersions[0];
  const selectedReviewer = selectedReportSection?.reviewer_id
    ? reviewerOptions.find((item) => item.id === selectedReportSection.reviewer_id)
    : undefined;

  const selectSection = (section: ResearchReportSection) => {
    setSelectedReportSection(section);
    setReportContent(section.content || "");
  };

  return (
    <>
      <ResearchReferencePanel project={selectedResearch} stage="Report" />

      <section className="research-report-builder research-report-panel research-report-control-centre">
        <div className="report-builder-head">
          <div className="report-builder-intro">
            <p>REPORT CONTROL CENTRE</p>
            <h3>Research report</h3>
            <span>
              Monitor structure, progress, evidence and review readiness here. All report writing and formatting is completed in the governed REDESY Report Builder.
            </span>
          </div>

          <label className="research-builder-template-control">
            <span>Report template</span>
            <select
              value={researchTemplateDownloadId}
              disabled={researchTemplateApplying}
              onChange={async (event) => {
                const templateKey = event.target.value;
                setResearchTemplateDownloadId(templateKey);
                if (!templateKey) return;

                const template = researchTemplateLibrary.find(
                  (item) => item.template_key === templateKey,
                );
                if (!template) {
                  setResearchWorkspaceNotice("The selected research template could not be found.");
                  setResearchTemplateDownloadId("");
                  return;
                }

                if (
                  hasDraftContent &&
                  !window.confirm(
                    `This report already contains drafted content. Applying "${template.name}" will replace the current Report Outline. Matching section content is preserved where possible. Continue?`,
                  )
                ) {
                  setResearchTemplateDownloadId("");
                  return;
                }

                setResearchTemplateApplying(true);
                setResearchWorkspaceNotice(`Applying ${template.name} to the Report Outline...`);
                try {
                  const result = await api.applyResearchReportTemplate(token, selectedResearch.id, {
                    templateKey: template.template_key,
                    replaceExisting: hasDraftContent,
                  });
                  const refreshed = await api.researchReport(token, selectedResearch.id);
                  const nextSections = refreshed.length ? refreshed : result.sections;
                  setResearchReport(nextSections);
                  setSelectedReportSection(nextSections[0] || null);
                  setReportContent(nextSections[0]?.content || "");
                  setResearchWorkspaceNotice(
                    `${result.template.name} applied. The Report Outline now has ${nextSections.length} section${nextSections.length === 1 ? "" : "s"}.`,
                  );
                  if (!researchReport.length && nextSections[0]) {
                    await onOpenSectionEditor(nextSections[0]);
                  }
                } catch (error) {
                  setResearchWorkspaceNotice(
                    error instanceof Error ? error.message : "The report template could not be applied.",
                  );
                } finally {
                  setResearchTemplateApplying(false);
                  setResearchTemplateDownloadId("");
                }
              }}
            >
              <option value="">
                {researchTemplateApplying ? "Applying template..." : "Choose template"}
              </option>
              {researchTemplateLibrary.map((template) => (
                <option key={template.template_key} value={template.template_key}>
                  {template.name}
                </option>
              ))}
            </select>
            <small>{researchTemplateLibrary.length} governed report structures</small>
          </label>
        </div>

        <div className="research-report-readiness">
          <span><small>Sections drafted</small><strong>{draftedCount}/{researchReport.length}</strong></span>
          <span><small>Ready for review</small><strong>{readyCount}</strong></span>
          <span><small>Approved sections</small><strong>{approvedCount}</strong></span>
          <span><small>Controlled evidence</small><strong>{researchSources.length + researchRepositoryDocuments.length}</strong></span>
          <span><small>Estimated pages</small><strong>{estimatedPages}</strong></span>
          <span><small>Latest version</small><strong>{latestVersion?.status || "Draft"}</strong></span>
        </div>

        <div className="research-report-control-actions">
          <button
            type="button"
            className="research-report-preview-action"
            onClick={() => setResearchReportPreviewOpen(true)}
            disabled={!hasDraftContent}
            title={!hasDraftContent ? "Draft at least one section to preview the complete report." : "Preview the complete saved report"}
          >
            Preview complete report
          </button>
        </div>

        <div className="report-builder-layout research-report-control-layout">
          <aside className="report-outline">
            <header className="report-outline-head">
              <small>REPORT OUTLINE</small>
              <strong>{researchReport.length} sections · {estimatedPages} est. pages</strong>
              <span>Select a section, then open it in Report Builder.</span>
            </header>
            {researchReport.map((section) => (
              <button
                key={section.id}
                type="button"
                className={selectedReportSection?.id === section.id ? "active" : ""}
                onClick={() => selectSection(section)}
              >
                <span>{String(section.section_order).padStart(2, "0")}</span>
                <div>
                  <strong>{section.title}</strong>
                  <small>
                    {section.status}
                    {section.owner_name ? ` · ${section.owner_name}` : " · Unassigned"}
                    {` · ${Math.max(1, Math.ceil(wordCount(section.content) / 430))} p`}
                  </small>
                </div>
              </button>
            ))}
          </aside>

          <main className="research-report-control-summary">
            {selectedReportSection ? (
              <>
                <header>
                  <small>SELECTED SECTION</small>
                  <h3>{selectedReportSection.title}</h3>
                  <p>
                    {selectedReportSection.status} · {wordCount(selectedReportSection.content)} words · {selectedReportSection.owner_name || "Unassigned owner"}
                  </p>
                </header>

                <div className="research-section-readiness" aria-label="Selected section readiness">
                  <h4>Section governance</h4>
                  <div className="research-section-governance-grid">
                    <div className="research-section-governance-item">
                      <small>Owner</small>
                      <strong>{selectedReportSection.owner_name || "Unassigned"}</strong>
                    </div>
                    <div className="research-section-governance-item">
                      <small>Reviewer</small>
                      <strong>{selectedReportSection.reviewer_name || selectedReviewer?.name || "Not assigned"}</strong>
                    </div>
                    <div className="research-section-governance-item">
                      <small>Status</small>
                      <strong>{selectedReportSection.status}</strong>
                    </div>
                  </div>
                  <p className="research-section-status-message" role="status">
                    {selectedReportSection.status === "Approved"
                      ? "Approved and locked. Open the Report Builder to read the approved section."
                      : selectedReportSection.content.trim()
                        ? "Draft content exists. Continue editing in the governed Report Builder."
                        : "No draft content yet. Open the Report Builder to write this section."}
                  </p>
                </div>

                <button
                  type="button"
                  className="save-draft"
                  onClick={() => {
                    if (selectedReportSection.status === "Approved") onOpenSectionReview();
                    else onOpenSectionEditor();
                  }}
                >
                  {selectedReportSection.status === "Approved" ? "Open approved section" : "Open Report Builder"}
                </button>
              </>
            ) : (
              <div className="empty-state">
                <strong>No report section selected</strong>
                <p>Select a section from the Report Outline.</p>
              </div>
            )}
          </main>
        </div>

        <details className="research-supporting-documents">
          <summary>
            <span><strong>Supporting documents</strong><small>Controlled Repository documents attached to the report.</small></span>
            <b>{researchSupportingDocumentIds.length}</b>
          </summary>
          <div>
            {knowledgeRows
              .filter((item) => researchRepositoryDocuments.some((linked) => linked.id === item.id))
              .map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={researchSupportingDocumentIds.includes(item.id)}
                    onChange={(event) =>
                      setResearchSupportingDocumentIds(
                        event.target.checked
                          ? [...researchSupportingDocumentIds, item.id]
                          : researchSupportingDocumentIds.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span><strong>{item.title}</strong><small>{item.category} · {item.status} · v{item.latest_version}</small></span>
                </label>
              ))}
            {!researchRepositoryDocuments.length && <p>No linked Repository evidence is available. Add evidence from Evidence first.</p>}
          </div>
        </details>

        {researchTab === "Report" && (
          <details className="research-report-felix-advice">
            <summary><span>Professor Felix Advice</span><small>Optional research-quality guidance</small></summary>
            <div>
              <FelixAdvicePanel
                token={token}
                contextType="Report"
                compact
                entry={{
                  title: `${selectedResearch.title} — Research Report`,
                  status: latestVersion?.status || "Draft",
                  reviewer_id: latestVersion?.reviewer_id || selectedResearch.reviewers[0]?.reviewer_id || null,
                  section_count: researchReport.length,
                  completed_sections: draftedCount,
                  approved_sections: approvedCount,
                  evidence_count: researchSources.length + researchRepositoryDocuments.length,
                }}
              />
            </div>
          </details>
        )}
      </section>
    </>
  );
}
