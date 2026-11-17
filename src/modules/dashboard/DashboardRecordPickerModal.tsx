import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./dashboard-record-picker.css";

export type DashboardPickerAction = { key: string; label: string; description: string; onSelect: () => void | Promise<void> };

export type DashboardRecordChoice = {
  key: string;
  title: string;
  detail?: string;
  kind?: string;
  status?: string;
  date?: string;
  onSelect: () => void | Promise<void>;
};

type Props = {
  open: boolean;
  title: string;
  description: string;
  items: DashboardRecordChoice[];
  actions?: DashboardPickerAction[];
  emptyMessage?: string;
  onClose: () => void;
};

export default function DashboardRecordPickerModal({
  open,
  title,
  description,
  items,
  actions = [],
  emptyMessage = "No records match this card in your authorised scope.",
  onClose,
}: Props) {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState(false);
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.title, item.detail, item.kind, item.status, item.date]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [items, search]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setOpening(false);
      return;
    }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const selectItem = async (item: DashboardRecordChoice) => {
    if (opening) return;
    setOpening(true);
    try {
      await item.onSelect();
      onClose();
    } finally {
      setOpening(false);
    }
  };

  return (
    <div
      className="dashboard-record-picker-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="dashboard-record-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={opening}
      >
        <header className="dashboard-record-picker-header">
          <div>
            <span className="dashboard-record-picker-kicker">Dashboard selection</span>
            <h2 id={titleId}>{title}</h2>
            <p>{description}</p>
            <small>{items.length} {items.length === 1 ? "record" : "records"} available in your authorised scope</small>
          </div>
          <button type="button" className="dashboard-record-picker-close" onClick={onClose} aria-label="Close record selection" disabled={opening}>×</button>
        </header>
        {!!actions.length && (
          <section className="dashboard-picker-actions" aria-label="Available module actions">
            <h3>Choose an action</h3>
            <div className="dashboard-picker-action-grid">
              {actions.map((action) => (
                <button key={action.key} type="button" className="dashboard-picker-action" onClick={() => void selectItem({key: action.key, title: action.label, detail: action.description, onSelect: action.onSelect})} disabled={opening}>
                  <strong>{action.label}</strong><span>{action.description}</span><b aria-hidden="true">→</b>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="dashboard-record-picker-search">
          <label htmlFor={`${titleId}-search`}>Find a record</label>
          <input
            ref={searchRef}
            id={`${titleId}-search`}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, type, status or date"
          />
          <span>{visibleItems.length} shown</span>
        </div>
        <div className="dashboard-record-picker-list" aria-label="Matching records">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="dashboard-record-picker-item"
              onClick={() => void selectItem(item)}
              disabled={opening}
            >
              <span className="dashboard-record-picker-item-copy">
                <strong>{item.title}</strong>
                <small>{[item.kind, item.detail].filter(Boolean).join(" · ") || "Record"}</small>
              </span>
              <span className="dashboard-record-picker-item-state">
                {item.status && <em>{item.status}</em>}
                {item.date && <small>{item.date}</small>}
                <b aria-hidden="true">Open →</b>
              </span>
            </button>
          ))}
          {!visibleItems.length && (
            <div className="dashboard-record-picker-empty">
              <strong>{items.length ? "No matching search results" : "Nothing to select"}</strong>
              <p>{items.length ? "Try a shorter search term." : emptyMessage}</p>
            </div>
          )}
        </div>
        <footer className="dashboard-record-picker-footer">
          <span>Choose an action above or select a specific authorised record below.</span>
          <button type="button" onClick={onClose} disabled={opening}>Cancel</button>
        </footer>
      </section>
    </div>
  );
}
