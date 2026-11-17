import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type App2TabItem<T extends string> = {
  id: T;
  label: ReactNode;
  panelId?: string;
  disabled?: boolean;
};

type Props<T extends string> = {
  activeTab: T;
  ariaLabel: string;
  className?: string;
  idPrefix: string;
  items: App2TabItem<T>[];
  onChange: (tab: T) => void;
};

export default function App2Tabs<T extends string>({
  activeTab,
  ariaLabel,
  className = "",
  idPrefix,
  items,
  onChange,
}: Props<T>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const available = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled);
    if (!available.length) return;
    const current = available.findIndex(({ item }) => item.id === activeTab);
    const nextPosition = event.key === "Home"
      ? 0
      : event.key === "End"
        ? available.length - 1
        : (Math.max(0, current) + (event.key === "ArrowRight" ? 1 : -1) + available.length) % available.length;
    const next = available[nextPosition];
    event.preventDefault();
    onChange(next.item.id);
    requestAnimationFrame(() => buttons.current[next.index]?.focus());
  };

  return (
    <div
      className={`app2-tabs ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={moveFocus}
    >
      {items.map((item, index) => {
        const selected = item.id === activeTab;
        const tabId = `${idPrefix}-tab-${String(item.id).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        return (
          <button
            ref={(node) => { buttons.current[index] = node; }}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={selected}
            aria-controls={item.panelId}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={selected ? "active" : ""}
            key={item.id}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
