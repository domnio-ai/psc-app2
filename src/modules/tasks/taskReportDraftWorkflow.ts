export type TaskReportDraftLike = {
  owner_id?: string | null;
  reviewer_id?: string | null;
  contribution_status?: string | null;
};

export const isEditableTaskReportDraft = (
  task: TaskReportDraftLike | null | undefined,
  userId: string | null | undefined,
) => Boolean(task && userId && task.owner_id === userId && task.contribution_status === "Draft");

export const shouldUseDraftTaskPreview = isEditableTaskReportDraft;

export const canChangeTaskReportReviewer = isEditableTaskReportDraft;

export const taskReportTemplatePreferenceKey = (identity: string) =>
  `app2-task-report-template:${encodeURIComponent(identity.trim())}`;

/** Reconcile a browser's cached mode with the authoritative mode saved on the task. */
export const syncTaskReportTemplateMode = (
  identity: string,
  reportMode: string | null | undefined,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) => {
  if (reportMode !== "blank" && reportMode !== "structured") return;
  const key = taskReportTemplatePreferenceKey(identity);
  try {
    const cached = storage.getItem(key);
    if (reportMode === "blank") {
      storage.setItem(key, "__blank__");
    } else if (cached === "__blank__") {
      storage.removeItem(key);
    }
  } catch {
    // The server's task data remains authoritative when browser storage is unavailable.
  }
};

const escapedReportTagPattern = /&(?:amp;)*lt;\s*\/?\s*(?:p|br|hr|div|span|h[1-6]|strong|b|em|i|u|s|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|colgroup|col|a|img)\b/gi;

/** Recover task report markup that older saves repeatedly HTML-escaped. */
export const recoverTaskReportMarkup = (value: unknown): string => {
  const source = String(value ?? "");
  if ((source.match(escapedReportTagPattern) || []).length < 2) return source;
  return source
    .replace(/&(?:amp;)*lt;/gi, "<")
    .replace(/&(?:amp;)*gt;/gi, ">")
    .replace(/&(?:amp;)*quot;/gi, '"')
    .replace(/&(?:amp;)*(?:#0*39;|apos;)/gi, "'");
};


export type TaskReportDocumentMode = "structured" | "blank";

export const taskReportDocumentModeFromTemplateId = (
  templateId: string | null | undefined,
): TaskReportDocumentMode => (templateId === "__blank__" ? "blank" : "structured");
