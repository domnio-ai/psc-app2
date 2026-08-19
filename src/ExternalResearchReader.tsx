import { useEffect, useMemo, useState } from "react";
import { api, type ExternalResearchImport } from "./api";

type Props = { token: string; item: ExternalResearchImport; onClose: () => void; onUpdated: (item: ExternalResearchImport) => void; onOpenRepository: (knowledgeId: string) => void };
type ReaderState = { kind: "loading" } | { kind: "pdf"; url: string } | { kind: "html"; html: string } | { kind: "text"; text: string } | { kind: "error"; message: string };

export default function ExternalResearchReader({ token, item, onClose, onUpdated, onOpenRepository }: Props) {
  const [detail, setDetail] = useState(item);
  const [versionId, setVersionId] = useState<string | undefined>(item.current_version_id || undefined);
  const [reader, setReader] = useState<ReaderState>({ kind: "loading" });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const selectedVersion = useMemo(() => detail.versions?.find((version) => version.id === versionId) || detail.versions?.find((version) => version.is_current), [detail.versions, versionId]);
  const refresh = async () => { const next = await api.externalResearchImport(token, detail.id); setDetail(next); onUpdated(next); if (!versionId || !next.versions?.some((version) => version.id === versionId)) setVersionId(next.current_version_id || undefined); return next; };
  useEffect(() => { refresh().catch(() => {}); }, [detail.id]);
  useEffect(() => {
    let revoked = ""; let active = true; setReader({ kind: "loading" });
    api.loadDocumentReader(token, detail.knowledge_id, versionId).then((payload: any) => {
      if (!active) return;
      if (payload.format === "pdf") { revoked = URL.createObjectURL(payload.blob); setReader({ kind: "pdf", url: revoked }); return; }
      if (payload.html) { setReader({ kind: "html", html: payload.html }); return; }
      if (payload.text || payload.content) { setReader({ kind: "text", text: payload.text || payload.content }); return; }
      setReader({ kind: "error", message: "This file type cannot be rendered inline. Use Download from the version history." });
    }).catch((error) => active && setReader({ kind: "error", message: error instanceof Error ? error.message : "Reader could not be opened." }));
    return () => { active = false; if (revoked) URL.revokeObjectURL(revoked); };
  }, [token, detail.knowledge_id, versionId, detail.current_version]);
  const act = async (action: () => Promise<ExternalResearchImport>) => { try { setBusy(true); const next = await action(); setDetail(next); onUpdated(next); setNotes(""); } finally { setBusy(false); } };
  const uploadRevision = async () => { if (!revisionFile) return; try { setBusy(true); await api.uploadExternalResearchRevision(token, detail.id, revisionFile, revisionNotes); setRevisionFile(null); setRevisionNotes(""); const next = await refresh(); setVersionId(next.current_version_id || undefined); } finally { setBusy(false); } };
  return <div className="external-research-reader-shell">
    <header className="external-reader-header"><button className="external-reader-back" type="button" onClick={onClose}>â† Research Repository</button><div><p>IMPORTED RESEARCH Â· READER ONLY</p><h1>{detail.title}</h1><span>{detail.research_type} Â· Version {detail.current_version} Â· {detail.classification}</span></div><span className={`external-status status-${detail.status.toLowerCase().replaceAll(" ", "-")}`}>{detail.status}</span><button className="external-reader-close" type="button" onClick={onClose}>Ã—</button></header>
    <div className="external-reader-layout">
      <aside className="external-reader-versions"><div><small>VERSIONS</small><strong>{detail.versions?.length || 1}</strong></div>{detail.versions?.map((version) => <button type="button" key={version.id} className={(versionId || detail.current_version_id) === version.id ? "active" : ""} onClick={() => setVersionId(version.id)}><span>v{version.version_number}{version.is_current ? " Â· Current" : ""}</span><strong>{version.original_name}</strong><small>{new Date(version.created_at).toLocaleString("en-KE")} Â· {version.uploader_name}</small></button>)}</aside>
      <main className="external-reader-document">{reader.kind === "loading" && <div className="external-reader-loading">Opening secure documentâ€¦</div>}{reader.kind === "pdf" && <iframe title={`${detail.title} reader`} src={reader.url}/>} {reader.kind === "html" && <article className="external-reader-html" dangerouslySetInnerHTML={{ __html: reader.html }}/>} {reader.kind === "text" && <article className="external-reader-text"><pre>{reader.text}</pre></article>} {reader.kind === "error" && <div className="external-reader-error"><strong>Reader unavailable</strong><p>{reader.message}</p>{selectedVersion && <button onClick={() => api.downloadKnowledgeVersion(token, selectedVersion.id, selectedVersion.original_name)}>Download this version</button>}</div>}</main>
      <aside className="external-reader-review"><section className="external-review-metadata"><p>REVIEW CONTEXT</p><dl><div><dt>Submitted by</dt><dd>{detail.submitted_by_name}</dd></div><div><dt>Author</dt><dd>{detail.author || "Not recorded"}</dd></div><div><dt>Institution</dt><dd>{detail.institution || "Not recorded"}</dd></div><div><dt>Directorate</dt><dd>{detail.directorate || "Not recorded"}</dd></div><div><dt>Reviewer(s)</dt><dd>{detail.reviewers?.map((person) => person.name).join(", ") || "Not assigned"}</dd></div></dl></section>
        {(detail.status === "Pending Review" || detail.status === "Resubmitted") && detail.can_review && <section className="external-review-action"><strong>{detail.status === "Resubmitted" ? "Revised version ready" : "Review has not started"}</strong><p>Open the current version, then start the controlled review.</p><button className="external-primary" disabled={busy} onClick={() => act(() => api.startExternalResearchReview(token, detail.id))}>Start review</button></section>}
        {detail.status === "Under Review" && detail.can_review && <section className="external-review-decision"><label><span>Reviewer notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record specific, actionable review notesâ€¦" rows={6}/></label><button className="external-approve" disabled={busy} onClick={() => act(() => api.decideExternalResearch(token, detail.id, "Approve", notes))}>âœ“ Approve final report</button><button className="external-revision" disabled={busy || !notes.trim()} onClick={() => act(() => api.decideExternalResearch(token, detail.id, "Request Revision", notes))}>â†º Request revision</button><button className="external-reject" disabled={busy || !notes.trim()} onClick={() => window.confirm("Reject this imported research? Rejection closes this review path.") && act(() => api.decideExternalResearch(token, detail.id, "Reject", notes))}>âœ• Reject</button><small>Revision and rejection require notes. Approval finalises the current version and publishes it to the central Document Repository.</small></section>}
        {detail.status === "Revision Requested" && detail.can_upload_revision && <section className="external-revision-upload"><strong>Revision required</strong><p>Upload a new version. The reviewed version remains unchanged in history.</p><input type="file" accept=".pdf,.docx,.txt,.md" onChange={(event) => setRevisionFile(event.target.files?.[0] || null)}/><textarea value={revisionNotes} onChange={(event) => setRevisionNotes(event.target.value)} placeholder="Briefly describe the corrections made" rows={3}/>{!detail.revision_ready ? <button className="external-primary" disabled={busy || !revisionFile} onClick={uploadRevision}>{busy ? "Uploadingâ€¦" : "Upload revised version"}</button> : <button className="external-primary" disabled={busy} onClick={() => act(() => api.resubmitExternalResearch(token, detail.id))}>Resubmit for review â†’</button>}{detail.revision_ready && <small>Revised version uploaded. Review it in the reader before resubmitting.</small>}</section>}
        {detail.status === "Published" && <section className="external-published"><strong>âœ“ Approved final research report</strong><p>The reviewer-approved version is final and is now stored in the central Document Repository. No separate research workspace is created for the external import.</p><button className="external-primary" onClick={() => onOpenRepository(detail.knowledge_id)}>Open Document Repository</button></section>}
        {detail.status === "Rejected" && <section className="external-rejected"><strong>Rejected</strong><p>This review path is closed. The file and review history are retained for audit but are not published institutional knowledge.</p></section>}
        <section className="external-review-history"><header><strong>Review history</strong><span>{detail.reviews?.length || 0}</span></header>{detail.reviews?.map((review) => <article key={review.id}><div><strong>{review.decision}</strong><small>v{review.version_number} Â· {review.reviewer_name} Â· {new Date(review.created_at).toLocaleString("en-KE")}</small></div>{review.notes && <p>{review.notes}</p>}</article>)}{!detail.reviews?.length && <p>No review decisions recorded yet.</p>}</section>
      </aside>
    </div>
  </div>;
}

