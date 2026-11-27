import type { Dispatch, SetStateAction } from "react";
import "../evidence/research-evidence-guided.css";
import ResearchReferencePanel from "./ResearchReferencePanel";
import {
  api,
  type KnowledgeItem,
  type ResearchActivity,
  type ResearchProject,
  type ResearchRepositoryDocument,
  type ResearchSource,
} from "../../../api";

type ResearchSourceForm = {
  sourceType: string;
  title: string;
  author: string;
  publisher: string;
  publicationDate: string | null;
  url: string;
  identifier: string;
  notes: string;
  provenance: string;
  quality: string;
  relevance: string;
};

type ResearchTab = "Overview" | "Work" | "Resources" | "Report" | "Review" | "Activity";

type Props = {
  token: string;
  selectedResearch: ResearchProject;
  knowledgeRows: KnowledgeItem[];
  researchRepositoryDocuments: ResearchRepositoryDocument[];
  setResearchRepositoryDocuments: Dispatch<SetStateAction<ResearchRepositoryDocument[]>>;
  researchRepositoryLinkId: string;
  setResearchRepositoryLinkId: Dispatch<SetStateAction<string>>;
  researchSources: ResearchSource[];
  setResearchSources: Dispatch<SetStateAction<ResearchSource[]>>;
  researchSourceForm: ResearchSourceForm;
  setResearchSourceForm: Dispatch<SetStateAction<ResearchSourceForm>>;
  researchSourceSearch: string;
  setResearchSourceSearch: Dispatch<SetStateAction<string>>;
  researchSourceQuality: string;
  setResearchSourceQuality: Dispatch<SetStateAction<string>>;
  researchSourceRelevance: string;
  setResearchSourceRelevance: Dispatch<SetStateAction<string>>;
  setResearchActivity: Dispatch<SetStateAction<ResearchActivity[]>>;
  setResearchWorkspaceNotice: Dispatch<SetStateAction<string>>;
  setResearchTab: Dispatch<SetStateAction<ResearchTab>>;
  openRepositoryDocumentReader: (documentId: string) => void | Promise<void>;
};

export default function ResearchEvidencePanel({
  token,
  selectedResearch,
  knowledgeRows,
  researchRepositoryDocuments,
  setResearchRepositoryDocuments,
  researchRepositoryLinkId,
  setResearchRepositoryLinkId,
  researchSources,
  setResearchSources,
  researchSourceForm,
  setResearchSourceForm,
  researchSourceSearch,
  setResearchSourceSearch,
  researchSourceQuality,
  setResearchSourceQuality,
  researchSourceRelevance,
  setResearchSourceRelevance,
  setResearchActivity,
  setResearchWorkspaceNotice,
  setResearchTab,
  openRepositoryDocumentReader,
}: Props) {
  return (
    <>
      <ResearchReferencePanel project={selectedResearch} stage="Resources" />
      <section className="research-sources-panel research-repository-evidence-panel research-evidence-guided research-evidence-repository">
        <div className="research-evidence-intro">
          <div>
            <small>EVIDENCE</small>
            <h2>Build the evidence base</h2>
            <p>
              Evidence is the material that supports the research findings. Add the documents, publications,
              datasets, interviews or field material that the team will rely on when writing the report.
            </p>
          </div>
          <div className="research-evidence-guide-cards" aria-label="What counts as research evidence">
            <article>
              <strong>Repository document</strong>
              <span>Use when the supporting document is already published in APP2.</span>
            </article>
            <article>
              <strong>Published source</strong>
              <span>Journal articles, reports, legislation, books, websites or datasets.</span>
            </article>
            <article>
              <strong>Primary evidence</strong>
              <span>Interviews, field observations, original datasets or other first-hand material.</span>
            </article>
          </div>
          <p className="research-evidence-start-hint">
            <b>Start here:</b> If the source already exists in the APP2 Repository, link it below.
            Otherwise record it under <b>Other research sources</b>.
          </p>
        </div>

        <header className="research-sources-head">
          <div>
            <small>OPTION 1 · APP2 REPOSITORY</small>
            <h3>Link an existing Repository document</h3>
            <p>Choose this when the evidence already exists in APP2. Linking does not copy, move or change the original Repository document.</p>
          </div>
          <strong>{researchRepositoryDocuments.length} linked</strong>
        </header>
        <div className="research-source-form research-repository-link-form">
          <label className="research-evidence-field research-evidence-repository-select">
            <span>Published Repository document</span>
            <select value={researchRepositoryLinkId} onChange={(event) => setResearchRepositoryLinkId(event.target.value)}>
              <option value="">Choose a published document</option>
              {knowledgeRows
                .filter((item) => item.status === "Published" && !item.is_archived && !researchRepositoryDocuments.some((linked) => linked.id === item.id))
                .sort((a,b) => a.title.localeCompare(b.title))
                .map((item) => <option key={item.id} value={item.id}>{item.title} · {item.category}</option>)}
            </select>
            <small>Select only a document that genuinely supports this research.</small>
          </label>
          <button type="button" disabled={!researchRepositoryLinkId} onClick={async () => {
            if (!researchRepositoryLinkId) return;
            try {
              await api.linkResearchRepositoryDocument(token, selectedResearch.id, researchRepositoryLinkId);
              setResearchRepositoryLinkId("");
              setResearchRepositoryDocuments(await api.researchRepositoryDocuments(token, selectedResearch.id));
              setResearchActivity(await api.researchActivity(token, selectedResearch.id));
              setResearchWorkspaceNotice("Published Repository evidence linked. The original document was not copied or moved.");
            } catch (error) {
              setResearchWorkspaceNotice(error instanceof Error ? error.message : "Repository evidence could not be linked.");
            }
          }}>Link Document</button>
        </div>
        <div className="research-source-list research-repository-evidence-list">
          {researchRepositoryDocuments.map((item) => {
            return <article key={item.id}>
              <b>{item.category || "Document"}</b>
              <div>
                <strong>{item.title}</strong>
                <small>{item.document_type || "Repository document"} · {item.status} · v{item.latest_version || item.current_version || 1}</small>
                <span className="research-source-badges"><em>Published Repository evidence</em><em>No duplicate file</em></span>
              </div>
              <div className="research-source-governance">
                <button
                  type="button"
                  onClick={() => void openRepositoryDocumentReader(item.id)}
                  title={`Preview ${item.title} in Document Reader`}
                >
                  Preview
                </button>
                <button type="button" onClick={async () => {
                  if (!window.confirm(`Unlink “${item.title}” from this research project? The Repository document itself will not be deleted.`)) return;
                  try {
                    await api.unlinkResearchRepositoryDocument(token, selectedResearch.id, item.id);
                    setResearchRepositoryDocuments(await api.researchRepositoryDocuments(token, selectedResearch.id));
                    setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                    setResearchWorkspaceNotice("Repository evidence unlinked. The original Repository document remains unchanged.");
                  } catch (error) {
                    setResearchWorkspaceNotice(error instanceof Error ? error.message : "Repository evidence could not be unlinked.");
                  }
                }}>Unlink</button>
              </div>
            </article>;
          })}
          {!researchRepositoryDocuments.length && <p>No Repository evidence is linked yet. If a relevant published document already exists in APP2, select it above and link it to this research.</p>}
        </div>
      </section>

      <section className="research-sources-panel research-evidence-guided research-evidence-other">
        <header className="research-sources-head">
          <div>
            <small>OPTION 2 · OTHER SOURCES</small>
            <h3>Record another research source</h3>
            <p>
              Use this for evidence that is not already a published APP2 Repository document, such as journal articles, datasets, interviews, websites or field evidence.
            </p>
          </div>
          <strong>{researchSources.length} sources</strong>
        </header>
        <div className="research-evidence-rating-guide">
          <span><b>Quality</b> asks how trustworthy and methodologically sound the source is.</span>
          <span><b>Relevance</b> asks how important the source is to answering this research question.</span>
          <span><b>Provenance</b> records where the evidence came from.</span>
        </div>
        <div className="research-source-kpis">
          <span>
            <small>Core evidence</small>
            <strong>
              {
                researchSources.filter(
                  (source) => source.relevance === "Core",
                ).length
              }
            </strong>
          </span>
          <span>
            <small>High quality</small>
            <strong>
              {
                researchSources.filter(
                  (source) => source.quality === "High",
                ).length
              }
            </strong>
          </span>
          <span>
            <small>Primary evidence</small>
            <strong>
              {
                researchSources.filter(
                  (source) => source.provenance === "Primary Evidence",
                ).length
              }
            </strong>
          </span>
          <span
            className={
              researchSources.some(
                (source) => source.quality === "Unrated",
              )
                ? "attention"
                : ""
            }
          >
            <small>Needs rating</small>
            <strong>
              {
                researchSources.filter(
                  (source) => source.quality === "Unrated",
                ).length
              }
            </strong>
          </span>
        </div>
        <details
          className="research-source-add"
          open={!researchSources.length}
        >
          <summary>{researchSources.length ? "Add another source" : "Add first research source"}</summary>
          <div className="research-source-form research-evidence-source-form">
            <label className="research-evidence-field">
              <span>Source type</span>
              <select
                value={researchSourceForm.sourceType}
                onChange={(event) =>
                  setResearchSourceForm({
                    ...researchSourceForm,
                    sourceType: event.target.value,
                  })
                }
              >
                {[
                  "Journal Article",
                  "Report",
                  "Policy Document",
                  "Legislation",
                  "Institutional Report",
                  "Dataset",
                  "Website",
                  "Book",
                  "Interview",
                  "Field Evidence",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <small>Choose the category that best describes the evidence.</small>
            </label>

            <label className="research-evidence-field research-evidence-field-wide">
              <span>Source title</span>
              <input
                value={researchSourceForm.title}
                onChange={(event) =>
                  setResearchSourceForm({
                    ...researchSourceForm,
                    title: event.target.value,
                  })
                }
                placeholder="e.g. Public Service Commission Annual Report 2025/26"
              />
              <small>Use the official title where one exists.</small>
            </label>

            <label className="research-evidence-field">
              <span>Author or institution</span>
              <input
                value={researchSourceForm.author}
                onChange={(event) =>
                  setResearchSourceForm({
                    ...researchSourceForm,
                    author: event.target.value,
                  })
                }
                placeholder="Person, institution or organisation"
              />
            </label>

            <label className="research-evidence-field">
              <span>Provenance</span>
              <select
                value={researchSourceForm.provenance}
                onChange={(event) =>
                  setResearchSourceForm({
                    ...researchSourceForm,
                    provenance: event.target.value,
                  })
                }
              >
                <option>Internal</option>
                <option>External</option>
                <option>Primary Evidence</option>
                <option>Secondary Evidence</option>
              </select>
              <small>Where did this evidence originate?</small>
            </label>

            <label className="research-evidence-field">
              <span>Quality</span>
              <select
                value={researchSourceForm.quality}
                onChange={(event) =>
                  setResearchSourceForm({
                    ...researchSourceForm,
                    quality: event.target.value,
                  })
                }
              >
                <option>Unrated</option>
                <option>Low</option>
                <option>Moderate</option>
                <option>High</option>
              </select>
              <small>Rate reliability only when the team has assessed the source.</small>
            </label>

            <label className="research-evidence-field">
              <span>Relevance</span>
              <select
                value={researchSourceForm.relevance}
                onChange={(event) =>
                  setResearchSourceForm({
                    ...researchSourceForm,
                    relevance: event.target.value,
                  })
                }
              >
                <option>Background</option>
                <option>Supporting</option>
                <option>Core</option>
              </select>
              <small>Core evidence directly supports a major finding or conclusion.</small>
            </label>

            <details className="research-evidence-advanced">
              <summary>Optional citation details</summary>
              <div>
                <label className="research-evidence-field">
                  <span>DOI, ISBN or reference</span>
                  <input
                    value={researchSourceForm.identifier}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        identifier: event.target.value,
                      })
                    }
                    placeholder="Reference identifier"
                  />
                </label>
                <label className="research-evidence-field">
                  <span>Approved URL</span>
                  <input
                    value={researchSourceForm.url}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        url: event.target.value,
                      })
                    }
                    placeholder="https://... (optional)"
                  />
                </label>
              </div>
            </details>
            <button
              disabled={!researchSourceForm.title.trim()}
              onClick={async () => {
                try {
                  await api.addResearchSource(
                    token,
                    selectedResearch.id,
                    researchSourceForm,
                  );
                  setResearchSources(
                    await api.researchSources(token, selectedResearch.id),
                  );
                  setResearchActivity(
                    await api.researchActivity(
                      token,
                      selectedResearch.id,
                    ),
                  );
                  setResearchSourceForm({
                    sourceType: "Report",
                    title: "",
                    author: "",
                    publisher: "",
                    publicationDate: null,
                    url: "",
                    identifier: "",
                    notes: "",
                    provenance: "External",
                    quality: "Unrated",
                    relevance: "Supporting",
                  });
                  setResearchWorkspaceNotice(
                    "Controlled research source added.",
                  );
                } catch (error) {
                  setResearchWorkspaceNotice(
                    error instanceof Error
                      ? error.message
                      : "Source could not be added.",
                  );
                }
              }}
            >
              Add source
            </button>
          </div>
        </details>
        <div className="research-source-toolbar">
          <input
            type="search"
            value={researchSourceSearch}
            onChange={(event) =>
              setResearchSourceSearch(event.target.value)
            }
            placeholder="Search title, author or identifier"
          />
          <select
            value={researchSourceQuality}
            onChange={(event) =>
              setResearchSourceQuality(event.target.value)
            }
          >
            <option>All</option>
            <option>Unrated</option>
            <option>Low</option>
            <option>Moderate</option>
            <option>High</option>
          </select>
          <select
            value={researchSourceRelevance}
            onChange={(event) =>
              setResearchSourceRelevance(event.target.value)
            }
          >
            <option>All</option>
            <option>Background</option>
            <option>Supporting</option>
            <option>Core</option>
          </select>
        </div>
        <div className="research-source-list">
          {researchSources
            .filter(
              (source) =>
                `${source.title} ${source.author} ${source.publisher} ${source.identifier}`
                  .toLowerCase()
                  .includes(researchSourceSearch.toLowerCase()) &&
                (researchSourceQuality === "All" ||
                  source.quality === researchSourceQuality) &&
                (researchSourceRelevance === "All" ||
                  source.relevance === researchSourceRelevance),
            )
            .map((source) => (
              <article key={source.id}>
                <b>{source.source_type}</b>
                <div>
                  <strong>{source.title}</strong>
                  <small>
                    {[
                      source.author,
                      source.publisher,
                      source.publication_date,
                      source.identifier,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Metadata not supplied"}
                  </small>
                  <span className="research-source-badges">
                    <em>{source.provenance}</em>
                    <em
                      className={`quality-${source.quality.toLowerCase()}`}
                    >
                      {source.quality} quality
                    </em>
                    <em>{source.relevance} relevance</em>
                  </span>
                </div>
                <div className="research-source-governance">
                  <select
                    aria-label={`Quality for ${source.title}`}
                    value={source.quality}
                    onChange={async (event) => {
                      try {
                        await api.updateResearchSource(
                          token,
                          selectedResearch.id,
                          source.id,
                          {
                            provenance: source.provenance,
                            quality: event.target.value,
                            relevance: source.relevance,
                          },
                        );
                        setResearchSources(
                          await api.researchSources(
                            token,
                            selectedResearch.id,
                          ),
                        );
                        setResearchWorkspaceNotice(
                          "Evidence quality updated.",
                        );
                      } catch (error) {
                        setResearchWorkspaceNotice(
                          error instanceof Error
                            ? error.message
                            : "Source could not be updated.",
                        );
                      }
                    }}
                  >
                    <option>Unrated</option>
                    <option>Low</option>
                    <option>Moderate</option>
                    <option>High</option>
                  </select>
                  <select
                    aria-label={`Relevance for ${source.title}`}
                    value={source.relevance}
                    onChange={async (event) => {
                      try {
                        await api.updateResearchSource(
                          token,
                          selectedResearch.id,
                          source.id,
                          {
                            provenance: source.provenance,
                            quality: source.quality,
                            relevance: event.target.value,
                          },
                        );
                        setResearchSources(
                          await api.researchSources(
                            token,
                            selectedResearch.id,
                          ),
                        );
                        setResearchWorkspaceNotice(
                          "Evidence relevance updated.",
                        );
                      } catch (error) {
                        setResearchWorkspaceNotice(
                          error instanceof Error
                            ? error.message
                            : "Source could not be updated.",
                        );
                      }
                    }}
                  >
                    <option>Background</option>
                    <option>Supporting</option>
                    <option>Core</option>
                  </select>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Remove “${source.title}” from this research project?`,
                        )
                      )
                        return;
                      try {
                        await api.deleteResearchSource(
                          token,
                          selectedResearch.id,
                          source.id,
                        );
                        setResearchSources(
                          await api.researchSources(
                            token,
                            selectedResearch.id,
                          ),
                        );
                        setResearchActivity(
                          await api.researchActivity(
                            token,
                            selectedResearch.id,
                          ),
                        );
                        setResearchWorkspaceNotice(
                          "Research source removed.",
                        );
                      } catch (error) {
                        setResearchWorkspaceNotice(
                          error instanceof Error
                            ? error.message
                            : "Source could not be removed.",
                        );
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          {!researchSources.length && (
            <div className="research-evidence-empty">
              <strong>No other research sources recorded yet</strong>
              <p>
                Add the first source when the evidence is not already available as a published APP2 Repository document.
              </p>
            </div>
          )}
        </div>
        <div className="research-evidence-actions">
          <div>
            <small>NEXT STAGE</small>
            <strong>Build the research report</strong>
            <span>Continue when the evidence needed to support the report has been recorded.</span>
          </div>
          <button
            type="button"
            className="research-evidence-next"
            onClick={() => setResearchTab("Report")}
          >
            Continue to Report <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>



    </>
  );
}
