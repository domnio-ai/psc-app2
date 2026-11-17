export type NormalizedResearchSnapshotSection = {
  id: string;
  title: string;
  content: string;
};

export type NormalizedResearchSnapshotTeamMember = {
  id: string;
  name: string;
  role: string;
};

export type NormalizedResearchReportSnapshot = {
  sections: NormalizedResearchSnapshotSection[];
  team: NormalizedResearchSnapshotTeamMember[];
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("[") && !trimmed.startsWith("{"))) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toList(value: unknown): unknown[] {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.rows)) return record.rows;
    return Object.values(record);
  }
  return [];
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function normalizeSection(value: unknown, index: number): NormalizedResearchSnapshotSection | null {
  const parsed = parseMaybeJson(value);
  if (typeof parsed === "string") {
    const content = parsed.trim();
    return content
      ? { id: `legacy-section-${index + 1}`, title: `Section ${index + 1}`, content }
      : null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const item = parsed as Record<string, unknown>;
  const title = text(item.title, text(item.name, `Section ${index + 1}`));
  const content = text(item.content, text(item.html, text(item.body, "")));
  const id = text(item.id, text(item.section_id, `snapshot-section-${index + 1}`));
  return { id, title, content };
}

function normalizeTeamMember(value: unknown, index: number): NormalizedResearchSnapshotTeamMember | null {
  const parsed = parseMaybeJson(value);
  if (typeof parsed === "string") {
    const name = parsed.trim();
    return name ? { id: `legacy-team-${index + 1}`, name, role: "Research Team" } : null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const item = parsed as Record<string, unknown>;
  const name = text(item.name, text(item.full_name, text(item.user_name, ""))).trim();
  if (!name) return null;
  return {
    id: text(item.id, text(item.user_id, `snapshot-team-${index + 1}`)),
    name,
    role: text(item.role, text(item.review_role, "Research Team")),
  };
}

export function normalizeResearchReportSnapshot(snapshot: unknown): NormalizedResearchReportSnapshot {
  const parsed = parseMaybeJson(snapshot);
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};

  const sections = toList(root.sections)
    .map(normalizeSection)
    .filter((item): item is NormalizedResearchSnapshotSection => Boolean(item));

  const team = toList(root.team)
    .map(normalizeTeamMember)
    .filter((item): item is NormalizedResearchSnapshotTeamMember => Boolean(item));

  return { sections, team };
}
