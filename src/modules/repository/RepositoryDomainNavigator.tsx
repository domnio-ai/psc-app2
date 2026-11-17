import { useEffect, useMemo, useState } from "react";
import { api, type RepositoryGroup } from "../../api";
import "./repository-domain-navigator.css";

const domains: Array<{ value: RepositoryGroup["domain"]; label: string }> = [
  { value: "Research", label: "Research" },
  { value: "Assignment", label: "Assignments" },
  { value: "Task", label: "Tasks" },
  { value: "Other", label: "Other documents" },
];

type Props = {
  token: string;
  onOpenDocument: (documentId: string) => void;
};

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));

export default function RepositoryDomainNavigator({ token, onOpenDocument }: Props) {
  const [domain, setDomain] = useState<RepositoryGroup["domain"]>("Research");
  const [groups, setGroups] = useState<RepositoryGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setSelectedId(null);
    api.repositoryGroups(token, domain)
      .then((rows) => current && setGroups(rows))
      .catch((reason) => current && setError(reason instanceof Error ? reason.message : "Repository groups could not be loaded."))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [token, domain]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) =>
      [group.work_title, group.owner_name, ...group.documents.map((document) => document.title)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [groups, search]);
  const selected = filtered.find((group) => group.group_id === selectedId) || null;

  return (
    <section className="repository-domain-navigator" aria-labelledby="repository-domain-title">
      <header>
        <div>
          <small>WORKSPACE NAVIGATOR</small>
          <h3 id="repository-domain-title">Browse by source of work</h3>
          <p>Documents are grouped by their authoritative Research, Assignment or Task record.</p>
        </div>
        <label>
          <span>Search this workspace</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, owner or document" />
        </label>
      </header>

      <div className="repository-domain-tabs" role="tablist" aria-label="Repository workspaces">
        {domains.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={domain === item.value}
            className={domain === item.value ? "active" : ""} onClick={() => setDomain(item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      {loading && <div className="repository-domain-state" role="status">Loading grouped documents…</div>}
      {!loading && error && <div className="repository-domain-state error" role="alert">{error}</div>}
      {!loading && !error && !selected && (
        <div className="repository-domain-grid">
          {filtered.map((group) => (
            <button className="repository-domain-card" type="button" key={`${group.domain}-${group.group_id}`}
              onClick={() => setSelectedId(group.group_id)}>
              <span className="repository-domain-card-top">
                <small>{group.domain}</small>
                {group.final_report_available && <b>Final report available</b>}
              </span>
              <strong>{group.work_title}</strong>
              <span>{group.owner_name || "Institutional document group"}</span>
              <footer>
                <span>{group.document_count} document{group.document_count === 1 ? "" : "s"}</span>
                <span>Updated {dateLabel(group.latest_activity)}</span>
              </footer>
            </button>
          ))}
          {filtered.length === 0 && <div className="repository-domain-state">No grouped documents match this view.</div>}
        </div>
      )}

      {!loading && !error && selected && (
        <div className="repository-domain-detail">
          <header>
            <button type="button" onClick={() => setSelectedId(null)}>← Back to {domains.find((item) => item.value === domain)?.label}</button>
            <div>
              <small>{selected.domain} workspace</small>
              <h4>{selected.work_title}</h4>
              <span>{selected.owner_name || "Institutional document group"} · {selected.document_count} documents</span>
            </div>
          </header>
          <div className="repository-domain-documents">
            {selected.documents.map((document) => (
              <article key={document.id}>
                <div>
                  <strong>{document.title}</strong>
                  <span>{document.document_type} · Version {document.current_version}</span>
                </div>
                <span className={`repository-domain-status status-${document.status.toLowerCase().replaceAll(" ", "-")}`}>{document.status}</span>
                <button type="button" onClick={() => onOpenDocument(document.id)}>Read document</button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
