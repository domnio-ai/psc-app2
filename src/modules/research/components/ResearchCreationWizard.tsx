import type { Dispatch, FormEvent, SetStateAction } from "react";

export type ResearchFormState = {
  title: string;
  summary: string;
  researchQuestion: string;
  objectives: string;
  methodology: string;
  startDate: string;
  endDate: string;
  leadId: string;
  assignmentId: string;
  collaboratorIds: string[];
  reviewerIds: string[];
  knowledgeIds: string[];
};

export type ResearchFormStep = 1 | 2 | 3;

type ResearchWizardTeamMember = {
  id: string;
  name: string;
  role: string;
  division: string;
  enabled: boolean;
  supervisorId?: string | null;
};

type Props = {
  researchForm: ResearchFormState;
  setResearchForm: Dispatch<SetStateAction<ResearchFormState>>;
  researchFormStep: ResearchFormStep;
  setResearchFormStep: Dispatch<SetStateAction<ResearchFormStep>>;
  researchBriefComplete: boolean;
  researchBriefMissing: string[];
  researchTimelineComplete: boolean;
  researchCreateNotice: string;
  researchCreating: boolean;
  team: ResearchWizardTeamMember[];
  saveResearch: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  setResearchOpen: Dispatch<SetStateAction<boolean>>;
  setResearchCreateNotice: Dispatch<SetStateAction<string>>;
};

export default function ResearchCreationWizard({
  researchForm,
  setResearchForm,
  researchFormStep,
  setResearchFormStep,
  researchBriefComplete,
  researchBriefMissing,
  researchTimelineComplete,
  researchCreateNotice,
  researchCreating,
  team,
  saveResearch,
  setResearchOpen,
  setResearchCreateNotice,
}: Props) {
  return (
    <div
      className="research-wizard-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="research-wizard-title"
    >
      <header className="research-wizard-header">
        <button
          type="button"
          onClick={() => {
            setResearchOpen(false);
            setResearchFormStep(1);
          }}
        >
          Back
        </button>
        <div>
          <p>APP2 RESEARCH WORKSPACE</p>
          <h1 id="research-wizard-title">Create a research project</h1>
          <span>
            Define the mandate, appoint the team and confirm the delivery
            plan.
          </span>
        </div>
        <button
          type="button"
          aria-label="Close research wizard"
          onClick={() => {
            setResearchOpen(false);
            setResearchFormStep(1);
          }}
        >
          ×
        </button>
      </header>
      <div className="research-wizard-body">
        <aside className="research-wizard-steps">
          {(
            [
              {
                step: 1,
                title: "Research brief",
                detail: "Purpose and decision question",
              },
              {
                step: 2,
                title: "Team & ownership",
                detail: "Lead and collaborators",
              },
              {
                step: 3,
                title: "Timeline & review",
                detail: "Dates and confirmation",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.step}
              type="button"
              className={
                researchFormStep === item.step
                  ? "active"
                  : researchFormStep > item.step
                    ? "complete"
                    : ""
              }
              disabled={
                (item.step > 1 && !researchBriefComplete) ||
                (item.step > 2 && !researchForm.leadId)
              }
              onClick={() => setResearchFormStep(item.step)}
            >
              <b>{researchFormStep > item.step ? "✓" : item.step}</b>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
            </button>
          ))}
          <div className="research-wizard-help">
            <strong>What happens next?</strong>
            <p>
              The project begins in Planning. The team adds accountable
              milestones and evidence before manager approval.
            </p>
          </div>
        </aside>
        <form className="research-wizard-form" onSubmit={saveResearch}>
          {researchCreateNotice && <p className="research-wizard-error" role="alert">{researchCreateNotice}</p>}
          {researchFormStep === 1 && (
            <section>
              <header>
                <small>STEP 1 OF 3</small>
                <h2>Research brief</h2>
                <p>
                  State what the research must answer and how it will
                  support a Commission decision.
                </p>
              </header>
              <label>
                Project title
                <small className={researchForm.title.trim().length > 0 && researchForm.title.trim().length < 4 ? "research-field-guidance invalid" : "research-field-guidance"}>Minimum 4 characters · {researchForm.title.trim().length}/4</small>
                <input
                  autoFocus
                  value={researchForm.title}
                  onChange={(event) =>
                    setResearchForm({
                      ...researchForm,
                      title: event.target.value,
                    })
                  }
                  required
                  minLength={4}
                  placeholder="e.g. Public service digital capability assessment"
                />
              </label>
              <label>
                Executive summary
                <small className={researchForm.summary.trim().length > 0 && researchForm.summary.trim().length < 10 ? "research-field-guidance invalid" : "research-field-guidance"}>Minimum 10 characters · {researchForm.summary.trim().length}/10</small>
                <textarea
                  value={researchForm.summary}
                  onChange={(event) =>
                    setResearchForm({
                      ...researchForm,
                      summary: event.target.value,
                    })
                  }
                  placeholder="Describe the policy need, scope and intended outcome."
                  required
                  minLength={10}
                />
              </label>
              <label>
                Primary research question
                <small className={researchForm.researchQuestion.trim().length > 0 && researchForm.researchQuestion.trim().length < 10 ? "research-field-guidance invalid" : "research-field-guidance"}>Minimum 10 characters · {researchForm.researchQuestion.trim().length}/10</small>
                <textarea
                  value={researchForm.researchQuestion}
                  onChange={(event) =>
                    setResearchForm({
                      ...researchForm,
                      researchQuestion: event.target.value,
                    })
                  }
                  placeholder="What decision or evidence gap must this project address?"
                  required
                  minLength={10}
                />
              </label>
              <div className="research-wizard-two">
                <label>
                  Objectives
                  <small className={researchForm.objectives.trim().length > 0 && researchForm.objectives.trim().length < 10 ? "research-field-guidance invalid" : "research-field-guidance"}>Minimum 10 characters · {researchForm.objectives.trim().length}/10</small>
                  <textarea
                    value={researchForm.objectives}
                    onChange={(event) =>
                      setResearchForm({
                        ...researchForm,
                        objectives: event.target.value,
                      })
                    }
                    placeholder="List measurable objectives."
                    required
                    minLength={10}
                  />
                </label>
                <label>
                  Methodology
                  <small className={researchForm.methodology.trim().length > 0 && researchForm.methodology.trim().length < 10 ? "research-field-guidance invalid" : "research-field-guidance"}>Minimum 10 characters · {researchForm.methodology.trim().length}/10</small>
                  <textarea
                    value={researchForm.methodology}
                    onChange={(event) =>
                      setResearchForm({
                        ...researchForm,
                        methodology: event.target.value,
                      })
                    }
                    placeholder="Describe evidence collection and analysis."
                    required
                    minLength={10}
                  />
                </label>
              </div>
            </section>
          )}
          {researchFormStep === 2 && (
            <section>
              <header>
                <small>STEP 2 OF 3</small>
                <h2>Team and accountability</h2>
                <p>
                  Appoint one accountable lead and the colleagues who will
                  contribute or review.
                </p>
              </header>
              <label>
                Lead researcher
                <select
                  autoFocus
                  value={researchForm.leadId}
                  onChange={(event) =>
                    setResearchForm({
                      ...researchForm,
                      leadId: event.target.value,
                      collaboratorIds:
                        researchForm.collaboratorIds.filter(
                          (id) => id !== event.target.value,
                        ),
                    })
                  }
                  required
                >
                  <option value="">Select lead researcher</option>
                  {team
                    .filter(
                      (member) =>
                        member.enabled &&
                        (member.role === "Researcher" ||
                          member.role === "Deputy Director"),
                    )
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} — {member.role}
                      </option>
                    ))}
                </select>
              </label>
              <fieldset className="research-team-picker">
                <legend>
                  Research collaborators{" "}
                  <small>
                    {researchForm.collaboratorIds.length} selected
                  </small>
                </legend>
                {team
                  .filter(
                    (member) =>
                      member.enabled && [
                        "Researcher",
                        "Deputy Director",
                      ].includes(member.role) &&
                      member.id !== researchForm.leadId,
                  )
                  .map((member) => (
                    <label key={member.id}>
                      <input
                        type="checkbox"
                        checked={researchForm.collaboratorIds.includes(
                          member.id,
                        )}
                        onChange={(event) =>
                          setResearchForm({
                            ...researchForm,
                            collaboratorIds: event.target.checked
                              ? [
                                  ...researchForm.collaboratorIds,
                                  member.id,
                                ]
                              : researchForm.collaboratorIds.filter(
                                  (id) => id !== member.id,
                                ),
                          })
                        }
                      />
                      <b>
                        {member.name
                          .split(" ")
                          .map((name) => name[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </b>
                      <span>
                        <strong>{member.name}</strong>
                        <small>
                          {member.role} · {member.division}
                        </small>
                      </span>
                    </label>
                  ))}
              </fieldset>
              <fieldset className="research-team-picker research-reviewer-picker-wizard">
                <legend>
                  Formal reviewers <small>{researchForm.reviewerIds.length} selected</small>
                </legend>
                <p className="research-reviewer-help">Management oversight belongs to the Research Lead&apos;s immediate supervisor. Choose that supervisor or another active officer in the supervisor&apos;s team.</p>
                {team
                  .filter((member) => {
                    const lead = team.find((candidate) => candidate.id === researchForm.leadId);
                    const supervisorId = lead?.supervisorId;
                    return Boolean(
                      member.enabled &&
                      supervisorId &&
                      member.role !== "System Admin" &&
                      member.id !== researchForm.leadId &&
                      (member.id === supervisorId || member.supervisorId === supervisorId),
                    );
                  })
                  .map((member) => (
                    <label key={member.id}>
                      <input
                        type="checkbox"
                        checked={researchForm.reviewerIds.includes(member.id)}
                        onChange={(event) => setResearchForm({
                          ...researchForm,
                          reviewerIds: event.target.checked
                            ? [...researchForm.reviewerIds, member.id]
                            : researchForm.reviewerIds.filter((id) => id !== member.id),
                        })}
                      />
                      <b>{member.name.split(" ").map((name) => name[0]).slice(0, 2).join("").toUpperCase()}</b>
                      <span><strong>{member.name}</strong><small>{member.role} · {member.division}</small></span>
                    </label>
                  ))}
              </fieldset>
            </section>
          )}
          {researchFormStep === 3 && (
            <section>
              <header>
                <small>STEP 3 OF 3</small>
                <h2>Timeline and confirmation</h2>
                <p>
                  Set the delivery window and confirm the project. Related assignments are created or linked from the Work tab after creation.
                </p>
              </header>
              <div className="research-wizard-two">
                <label>
                  Start date
                  <input
                    type="date"
                    name="research-start-date"
                    min={new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })}
                    value={researchForm.startDate}
                    required
                    onChange={(event) => {
                      const startDate = event.currentTarget.value;
                      setResearchForm((current) => ({
                        ...current,
                        startDate,
                        endDate:
                          current.endDate && startDate && current.endDate < startDate
                            ? ""
                            : current.endDate,
                      }));
                    }}
                  />
                </label>
                <label>
                  Target completion date
                  <input
                    type="date"
                    name="research-target-completion-date"
                    min={researchForm.startDate || new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })}
                    value={researchForm.endDate}
                    required
                    onChange={(event) => {
                      const endDate = event.currentTarget.value;
                      setResearchForm((current) => ({
                        ...current,
                        endDate,
                      }));
                    }}
                  />
                </label>
              </div>
              <div className="research-wizard-summary">
                <div>
                  <small>PROJECT</small>
                  <strong>
                    {researchForm.title || "Title not entered"}
                  </strong>
                  <span>
                    {researchForm.researchQuestion ||
                      "Research question not entered"}
                  </span>
                </div>
                <div>
                  <small>ACCOUNTABLE LEAD</small>
                  <strong>
                    {team.find(
                      (member) => member.id === researchForm.leadId,
                    )?.name || "Not selected"}
                  </strong>
                  <span>
                    {researchForm.collaboratorIds.length} collaborator{researchForm.collaboratorIds.length === 1 ? "" : "s"} · {researchForm.reviewerIds.length} reviewer{researchForm.reviewerIds.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div>
                  <small>DELIVERY WINDOW</small>
                  <strong>
                    {researchForm.startDate || "Start date required"} →{" "}
                    {researchForm.endDate || "Finish date required"}
                  </strong>
                  <span>Initial status: Planning</span>
                </div>
              </div>
            </section>
          )}
          <footer>
            <button
              type="button"
              disabled={researchFormStep === 1}
              onClick={() =>
                setResearchFormStep((value) => (value - 1) as 1 | 2 | 3)
              }
            >
              Previous
            </button>
            <span className={researchFormStep === 1 && !researchBriefComplete ? "research-footer-requirement" : ""}>
              {researchFormStep === 1 && !researchBriefComplete
                ? `Needs: ${researchBriefMissing.join(", ")}`
                : researchFormStep === 2 && !researchForm.leadId
                  ? "Select an accountable lead to continue"
                  : `Step ${researchFormStep} of 3`}
            </span>
            {researchFormStep < 3 ? (
              <button
                className="primary"
                type="button"
                onClick={() => {
                  if (researchFormStep === 1 && !researchBriefComplete) {
                    setResearchCreateNotice(`Complete these fields before continuing: ${researchBriefMissing.join(", ")}.`);
                    return;
                  }
                  if (researchFormStep === 2 && !researchForm.leadId) {
                    setResearchCreateNotice("Select one accountable research lead before continuing.");
                    return;
                  }
                  setResearchCreateNotice("");
                  setResearchFormStep((value) => (value + 1) as 1 | 2 | 3);
                }}
              >
                Continue
              </button>
            ) : (
              <button
                className="primary"
                type="submit"
                disabled={
                  researchCreating || !researchBriefComplete || !researchForm.leadId || !researchTimelineComplete
                }
              >
                {researchCreating ? "Creating project..." : "Create project & open workspace"}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
