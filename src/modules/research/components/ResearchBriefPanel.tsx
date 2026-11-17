import type { Dispatch, SetStateAction } from "react";
import { api, type ResearchActivity, type ResearchProject } from "../../../api";

type ResearchPlanDraft = {
  summary: string;
  researchQuestion: string;
  objectives: string;
  methodology: string;
  startDate: string;
  endDate: string;
};

type Props = {
  token: string;
  userId?: string;
  selectedResearch: ResearchProject;
  isManager: boolean;
  researchPlanDraft: ResearchPlanDraft;
  setResearchPlanDraft: Dispatch<SetStateAction<ResearchPlanDraft>>;
  researchPlanSaving: boolean;
  setResearchPlanSaving: Dispatch<SetStateAction<boolean>>;
  researchBriefOpen: boolean;
  setResearchBriefOpen: Dispatch<SetStateAction<boolean>>;
  researchBriefEditing: boolean;
  setResearchBriefEditing: Dispatch<SetStateAction<boolean>>;
  researchBriefRequestOpen: boolean;
  setResearchBriefRequestOpen: Dispatch<SetStateAction<boolean>>;
  researchBriefChangeReason: string;
  setResearchBriefChangeReason: Dispatch<SetStateAction<string>>;
  researchBriefRequesting: boolean;
  setResearchBriefRequesting: Dispatch<SetStateAction<boolean>>;
  setResearchRows: Dispatch<SetStateAction<ResearchProject[]>>;
  setSelectedResearch: Dispatch<SetStateAction<ResearchProject | null>>;
  setResearchActivity: Dispatch<SetStateAction<ResearchActivity[]>>;
  setResearchWorkspaceNotice: Dispatch<SetStateAction<string>>;
};

export default function ResearchBriefPanel(props: Props) {
  const {
    token, userId, selectedResearch, isManager,
    researchPlanDraft, setResearchPlanDraft,
    researchPlanSaving, setResearchPlanSaving,
    researchBriefOpen, setResearchBriefOpen,
    researchBriefEditing, setResearchBriefEditing,
    researchBriefRequestOpen, setResearchBriefRequestOpen,
    researchBriefChangeReason, setResearchBriefChangeReason,
    researchBriefRequesting, setResearchBriefRequesting,
    setResearchRows, setSelectedResearch, setResearchActivity, setResearchWorkspaceNotice,
  } = props;

  const closeBrief = () => {
    setResearchBriefOpen(false);
    setResearchBriefEditing(false);
    setResearchBriefRequestOpen(false);
  };

  const openBrief = () => {
    setResearchBriefOpen(true);
    setResearchBriefEditing(false);
    setResearchBriefRequestOpen(false);
  };

  const requestChange = async () => {
    try {
      setResearchBriefRequesting(true);
      await api.requestResearchBriefChange(token, selectedResearch.id, researchBriefChangeReason.trim());
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setResearchBriefChangeReason("");
      setResearchBriefRequestOpen(false);
      setResearchWorkspaceNotice("Research Brief change request sent to the research managers.");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research Brief change request could not be sent.");
    } finally {
      setResearchBriefRequesting(false);
    }
  };

  const startResearch = async () => {
    try {
      await api.updateResearchStatus(token, selectedResearch.id, "Active");
      const projects = await api.research(token);
      setResearchRows(projects);
      setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setResearchBriefOpen(false);
      setResearchWorkspaceNotice("Research started. The project is now active.");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research could not be started.");
    }
  };

  const saveBrief = async () => {
    try {
      setResearchPlanSaving(true);
      const updated = await api.updateResearchPlan(token, selectedResearch.id, {
        ...researchPlanDraft,
        startDate: researchPlanDraft.startDate || null,
        endDate: researchPlanDraft.endDate || null,
      });
      const projects = await api.research(token);
      const refreshed = projects.find((item) => item.id === updated.id) || { ...selectedResearch, ...updated };
      setResearchRows(projects);
      setSelectedResearch(refreshed);
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setResearchBriefEditing(false);
      setResearchWorkspaceNotice("Research Brief updated and recorded in project activity.");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research Brief could not be updated.");
    } finally {
      setResearchPlanSaving(false);
    }
  };

  return (
    <>
      <section className="research-brief-card">
        <header><div><small>RESEARCH BRIEF</small><h3>Research mandate</h3><p>The summary, research question, objectives and methodology were defined when this research was created.</p></div><button type="button" onClick={openBrief}>Preview Research Brief</button></header>
      </section>
      {researchBriefOpen && (
        <div className="research-brief-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="research-brief-preview-title">
          <div className="research-brief-preview">
            <header><div><small>RESEARCH BRIEF</small><h2 id="research-brief-preview-title">{selectedResearch.title}</h2></div><button type="button" className="brief-close" onClick={closeBrief}>Close</button></header>
            <div className="research-brief-paper">
              <div className="brief-meta"><span><small>Reference</small><strong>{`RES-${selectedResearch.id.slice(0, 8).toUpperCase()}`}</strong></span><span><small>Lead</small><strong>{selectedResearch.lead_name}</strong></span><span><small>Status</small><strong>{selectedResearch.status}</strong></span><span><small>Target date</small><strong>{selectedResearch.end_date ? new Date(selectedResearch.end_date).toLocaleDateString("en-KE") : "Not set"}</strong></span></div>
              {researchBriefEditing ? (
                <>
                  <label>Research summary<textarea value={researchPlanDraft.summary} onChange={(event) => setResearchPlanDraft({ ...researchPlanDraft, summary: event.target.value })} /></label>
                  <label>Primary research question<textarea value={researchPlanDraft.researchQuestion} onChange={(event) => setResearchPlanDraft({ ...researchPlanDraft, researchQuestion: event.target.value })} /></label>
                  <label>Objectives<textarea value={researchPlanDraft.objectives} onChange={(event) => setResearchPlanDraft({ ...researchPlanDraft, objectives: event.target.value })} /></label>
                  <label>Methodology<textarea value={researchPlanDraft.methodology} onChange={(event) => setResearchPlanDraft({ ...researchPlanDraft, methodology: event.target.value })} /></label>
                  <div className="research-plan-dates"><label>Start date<input type="date" value={researchPlanDraft.startDate} onChange={(event) => setResearchPlanDraft({ ...researchPlanDraft, startDate: event.target.value })} /></label><label>Target completion<input type="date" min={researchPlanDraft.startDate || undefined} value={researchPlanDraft.endDate} onChange={(event) => setResearchPlanDraft({ ...researchPlanDraft, endDate: event.target.value })} /></label></div>
                </>
              ) : (
                <><section><h3>Research summary</h3><p>{selectedResearch.summary || "No summary recorded."}</p></section><section><h3>Primary research question</h3><p>{selectedResearch.research_question || "No research question recorded."}</p></section><section><h3>Objectives</h3><p>{selectedResearch.objectives || "No objectives recorded."}</p></section><section><h3>Methodology</h3><p>{selectedResearch.methodology || "No methodology recorded."}</p></section></>
              )}
            </div>
            {researchBriefRequestOpen && !isManager && (
              <div className="research-brief-request-box"><strong>Request a brief change</strong><textarea value={researchBriefChangeReason} onChange={(event) => setResearchBriefChangeReason(event.target.value)} placeholder="Explain what should change and why." /><button type="button" className="primary" disabled={researchBriefRequesting || !researchBriefChangeReason.trim()} onClick={() => void requestChange()}>{researchBriefRequesting ? "Sending Request..." : "Send Change Request"}</button></div>
            )}
            <div className="research-brief-actions">
              {isManager && selectedResearch.status === "Planning" && !researchBriefEditing && <button type="button" className="primary" onClick={() => void startResearch()}>Start Research</button>}
              {isManager && !researchBriefEditing && <button type="button" onClick={() => setResearchBriefEditing(true)}>Edit Research Brief</button>}
              {!isManager && selectedResearch.lead_id === userId && !researchBriefRequestOpen && <button type="button" onClick={() => setResearchBriefRequestOpen(true)}>Request Brief Change</button>}
              {isManager && researchBriefEditing && <><button type="button" onClick={() => setResearchBriefEditing(false)}>Cancel</button><button type="button" className="primary" disabled={researchPlanSaving} onClick={() => void saveBrief()}>{researchPlanSaving ? "Saving..." : "Save Brief"}</button></>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
