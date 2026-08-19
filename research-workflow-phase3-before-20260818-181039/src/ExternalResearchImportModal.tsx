import { useMemo, useState } from "react";
import { api, type ExternalResearchImport } from "./api";

type ReviewerCandidate = { id: string; name: string; role: string; division: string; active: boolean | number };
type Props = {
  token: string;
  users: ReviewerCandidate[];
  onClose: () => void;
  onCreated: (item: ExternalResearchImport) => void;
};

export default function ExternalResearchImportModal({ token, users, onClose, onCreated }: Props) {
  const reviewers = useMemo(() => users.filter((person) => person.active && ["Reviewer", "Research Manager", "Administrator"].includes(person.role)), [users]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", author: "", institution: "", directorate: "",
    researchType: "Research Report", researchDate: "", tags: "", classification: "INTERNAL",
    reviewerIds: [] as string[], felixEnabled: true,
  });
  const toggleReviewer = (id: string) => setForm((current) => ({ ...current, reviewerIds: current.reviewerIds.includes(id) ? current.reviewerIds.filter((value) => value !== id) : [...current.reviewerIds, id] }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !form.title.trim() || !form.reviewerIds.length) return;
    try {
      setBusy(true); setError("");
      const created = await api.createExternalResearchImport(token, file, form);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Completed research could not be imported.");
    } finally { setBusy(false); }
  };
  return <div className="modal-backdrop external-research-import-backdrop" onClick={onClose}>
    <form className="external-research-import-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
      <header><div><p>EXTERNAL COMPLETED RESEARCH</p><h2>Import for review</h2><span>This path creates no workspace, assignments or tasks. The file opens directly in the controlled review reader.</span></div><button type="button" className="external-close" onClick={onClose}>×</button></header>
      {error && <div className="external-import-error" role="alert">{error}</div>}
      <div className="external-import-grid">
        <label className="external-file-field"><span>Completed research file *</span><input type="file" accept=".pdf,.docx,.txt,.md" onChange={(event) => setFile(event.target.files?.[0] || null)} required/><small>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "PDF or DOCX recommended for comfortable review."}</small></label>
        <label><span>Research title *</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required/></label>
        <label><span>Author / researcher</span><input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })}/></label>
        <label><span>Institution</span><input value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })}/></label>
        <label><span>Directorate / division</span><input value={form.directorate} onChange={(event) => setForm({ ...form, directorate: event.target.value })}/></label>
        <label><span>Research type</span><select value={form.researchType} onChange={(event) => setForm({ ...form, researchType: event.target.value })}>{["Research Report","Research Paper","Policy Research","Evaluation","Survey Study","Baseline Study","Other"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Research date</span><input type="date" value={form.researchDate} onChange={(event) => setForm({ ...form, researchDate: event.target.value })}/></label>
        <label><span>Classification</span><select value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })}>{["PUBLIC","INTERNAL","CONFIDENTIAL","RESTRICTED"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="external-wide"><span>Topic / tags</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="public service, HR, digital transformation"/></label>
        <label className="external-wide"><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3}/></label>
      </div>
      <section className="external-reviewer-picker"><div><strong>Assigned reviewer(s) *</strong><span>Review responsibility applies only to this imported research item.</span></div><div>{reviewers.map((person) => <label key={person.id} className={form.reviewerIds.includes(person.id) ? "selected" : ""}><input type="checkbox" checked={form.reviewerIds.includes(person.id)} onChange={() => toggleReviewer(person.id)}/><span><strong>{person.name}</strong><small>{person.role} · {person.division}</small></span></label>)}</div></section>
      <label className="external-felix-toggle"><input type="checkbox" checked={form.felixEnabled} onChange={(event) => setForm({ ...form, felixEnabled: event.target.checked })}/><span><strong>Allow Felix after approval</strong><small>No draft, revision-requested or rejected version is indexed.</small></span></label>
      <footer><button type="button" className="external-secondary" onClick={onClose}>Cancel</button><button type="submit" className="external-primary" disabled={busy || !file || !form.title.trim() || !form.reviewerIds.length}>{busy ? "Importing…" : "Upload for review"}</button></footer>
    </form>
  </div>;
}
