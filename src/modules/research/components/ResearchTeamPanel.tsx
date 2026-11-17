import type { Dispatch, SetStateAction } from "react";
import { api, type ApiUser, type PermanentAccountRole, type ResearchActivity, type ResearchProject } from "../../../api";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: PermanentAccountRole;
  initials: string;
  rights: string[];
  division: string;
  active: number;
  enabled: boolean;
  completed: number;
  status: "Available" | "Busy" | "Away";
};

type TeamDraft = {
  leadId: string;
  collaborators: { userId: string; role: string }[];
};

type Props = {
  token: string;
  selectedResearch: ResearchProject;
  isManager: boolean;
  canManageResearchTeam: boolean;
  team: TeamMember[];
  setTeam: Dispatch<SetStateAction<TeamMember[]>>;
  mapTeamMember: (member: ApiUser) => TeamMember;
  researchTeamEditing: boolean;
  setResearchTeamEditing: Dispatch<SetStateAction<boolean>>;
  researchTeamDraft: TeamDraft;
  setResearchTeamDraft: Dispatch<SetStateAction<TeamDraft>>;
  researchTeamSaving: boolean;
  setResearchTeamSaving: Dispatch<SetStateAction<boolean>>;
  setResearchRows: Dispatch<SetStateAction<ResearchProject[]>>;
  setSelectedResearch: Dispatch<SetStateAction<ResearchProject | null>>;
  setResearchActivity: Dispatch<SetStateAction<ResearchActivity[]>>;
  setResearchWorkspaceNotice: Dispatch<SetStateAction<string>>;
  initialsFor: (name: string) => string;
};

export default function ResearchTeamPanel({
  token,
  selectedResearch,
  isManager,
  canManageResearchTeam,
  team,
  setTeam,
  mapTeamMember,
  researchTeamEditing,
  setResearchTeamEditing,
  researchTeamDraft,
  setResearchTeamDraft,
  researchTeamSaving,
  setResearchTeamSaving,
  setResearchRows,
  setSelectedResearch,
  setResearchActivity,
  setResearchWorkspaceNotice,
  initialsFor,
}: Props) {
  const openTeamManager = async () => {
    if (researchTeamEditing) {
      setResearchTeamEditing(false);
      return;
    }
    try {
      const members = await api.eligibleResearchTeamMembers(token, selectedResearch.id);
      setTeam(members.map(mapTeamMember));
      setResearchTeamEditing(true);
      setResearchWorkspaceNotice("");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Eligible team members could not be loaded.");
    }
  };

  const saveTeam = async () => {
    try {
      setResearchTeamSaving(true);
      if (!isManager) {
        const additions = researchTeamDraft.collaborators.filter(
          (item) => !selectedResearch.collaborators.some((person) => person.id === item.userId),
        );
        await api.requestResearchTeamExpansion(token, selectedResearch.id, additions);
        setResearchActivity(await api.researchActivity(token, selectedResearch.id));
        setResearchTeamEditing(false);
        setResearchWorkspaceNotice("Request for additional team members sent to Research Managers.");
        return;
      }
      await api.updateResearchTeam(token, selectedResearch.id, researchTeamDraft);
      const projects = await api.research(token);
      const refreshed = projects.find((item) => item.id === selectedResearch.id) || selectedResearch;
      setResearchRows(projects);
      setSelectedResearch(refreshed);
      setResearchTeamDraft({
        leadId: refreshed.lead_id,
        collaborators: refreshed.collaborators.map((person) => ({ userId: person.id, role: person.role })),
      });
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setResearchTeamEditing(false);
      setResearchWorkspaceNotice("Research team updated and recorded.");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research team request could not be saved.");
    } finally {
      setResearchTeamSaving(false);
    }
  };

  const hasNewRequestedMember = researchTeamDraft.collaborators.some(
    (item) => !selectedResearch.collaborators.some((person) => person.id === item.userId),
  );

  return (
    <section className="research-team-panel">
      <header>
        <div><small>PROJECT TEAM</small><h3>Research team</h3><p>The lead and project members who can work in this Research Workspace.</p></div>
        {canManageResearchTeam && (
          <button type="button" className="research-team-edit-button" onClick={() => void openTeamManager()}>
            {researchTeamEditing ? "Close" : isManager ? "Manage Team" : "Request More Members"}
          </button>
        )}
      </header>
      <div className="research-team-summary">
        <div className="research-team-person"><b>{initialsFor(selectedResearch.lead_name)}</b><span><strong>{selectedResearch.lead_name}</strong><small>Lead researcher</small></span></div>
        {selectedResearch.collaborators.map((person) => (
          <div className="research-team-person" key={person.id}><b>{initialsFor(person.name)}</b><span><strong>{person.name}</strong><small>{person.role}</small></span></div>
        ))}
      </div>
      <div className="research-team-management-wrap" hidden={!researchTeamEditing}>
        <div className="research-team-lead-card">
          <div><span>LEAD RESEARCHER</span><h3>{team.find((member) => member.id === researchTeamDraft.leadId)?.name || selectedResearch.lead_name}</h3><p>{isManager ? "Managers may update membership or transfer the accountable lead." : "Select additional colleagues and send the request to a Research Manager. Existing members remain unchanged."}</p></div>
          {isManager && (
            <label>Change accountable lead
              <select value={researchTeamDraft.leadId} onChange={(event) => setResearchTeamDraft({ leadId: event.target.value, collaborators: researchTeamDraft.collaborators.filter((item) => item.userId !== event.target.value) })}>
                {team.filter((member) => member.enabled && ["Researcher", "Deputy Director", "Assistant Director"].includes(member.role)).map((member) => <option key={member.id} value={member.id}>{member.name} — {member.role}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="research-team-management">
          <header><div><h3>Team members</h3><p>Select the users who need access to this research project.</p></div><small>{researchTeamDraft.collaborators.length} selected</small></header>
          <div className="research-team-selector">
            {team.filter((member) => member.enabled && ["Researcher", "Deputy Director", "Assistant Director"].includes(member.role) && member.id !== researchTeamDraft.leadId).map((member) => {
              const selected = researchTeamDraft.collaborators.find((item) => item.userId === member.id);
              const existing = selectedResearch.collaborators.some((person) => person.id === member.id);
              return (
                <article key={member.id} className={selected ? "selected" : ""}>
                  <label>
                    <input type="checkbox" disabled={!canManageResearchTeam || (!isManager && existing)} checked={Boolean(selected)} onChange={(event) => setResearchTeamDraft({ ...researchTeamDraft, collaborators: event.target.checked ? [...researchTeamDraft.collaborators, { userId: member.id, role: "Researcher" }] : researchTeamDraft.collaborators.filter((item) => item.userId !== member.id) })} />
                    <b>{initialsFor(member.name)}</b><span><strong>{member.name}</strong><small>{existing && !isManager ? "Current member" : `${member.role} · ${member.division}`}</small></span>
                  </label>
                  {selected && (
                    <select aria-label={`Project role for ${member.name}`} disabled={!canManageResearchTeam || (!isManager && existing)} value={selected.role} onChange={(event) => setResearchTeamDraft({ ...researchTeamDraft, collaborators: researchTeamDraft.collaborators.map((item) => item.userId === member.id ? { ...item, role: event.target.value } : item) })}>
                      <option>Researcher</option><option>Analyst</option><option>Subject Matter Expert</option>
                    </select>
                  )}
                </article>
              );
            })}
          </div>
        </div>
        <footer>
          <button type="button" disabled={!canManageResearchTeam || !researchTeamDraft.leadId || researchTeamSaving || (!isManager && !hasNewRequestedMember)} onClick={() => void saveTeam()}>
            {researchTeamSaving ? "Saving..." : isManager ? "Save Team" : "Send Request"}
          </button>
        </footer>
      </div>
    </section>
  );
}
