import type { AgendaItem, MeetingAction, MeetingApprovalAppointment, MeetingAttachment, MeetingDecision, MeetingDetail, MeetingMinute, MeetingScheduleApprovalItem, MeetingScheduleApprover, MeetingSummary, MeetingUser, TranscriptJob } from "./types";
import type { ConferenceProviderStatus, LiveConferenceSession, LivePresence } from "./live/types";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof Blob) && !(init.body instanceof ArrayBuffer) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Meeting request failed (${response.status}).`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const meetingsApi = {
  list: (token: string) => request<MeetingSummary[]>(token, "/meetings"),
  detail: (token: string, id: string) => request<MeetingDetail>(token, `/meetings/${id}`),
  users: (token: string) => request<MeetingUser[]>(token, "/meetings/eligible-users"),
  eligibleScheduleApprovers: (token: string) => request<MeetingScheduleApprover[]>(token, "/meetings/schedule-approval/eligible-approvers"),
  pendingScheduleApprovals: (token: string) => request<MeetingScheduleApprovalItem[]>(token, "/meetings/schedule-approvals/pending"),
  decideScheduleApproval: (token: string, id: string, decision: "Approved" | "Returned" | "Rejected", comments: string) => request<MeetingDetail>(token, `/meetings/${id}/schedule-decision`, { method: "POST", body: JSON.stringify({ decision, comments }) }),
  delegableUsers: (token: string) => request<MeetingUser[]>(token, "/meetings/schedule-approval/delegable-users"),
  approvalAppointments: (token: string) => request<MeetingApprovalAppointment[]>(token, "/meetings/schedule-approval/appointments"),
  appointApprovalDelegate: (token: string, subjectUserId: string, approverUserId: string, expiresAt: string, reason?: string) => request<MeetingApprovalAppointment>(token, "/meetings/schedule-approval/appointments", { method: "POST", body: JSON.stringify({ subjectUserId, approverUserId, expiresAt, reason }) }),
  revokeApprovalDelegate: (token: string, id: string) => request<{ ok: boolean }>(token, `/meetings/schedule-approval/appointments/${id}/revoke`, { method: "POST" }),
  create: (token: string, input: Record<string, unknown>) => request<MeetingDetail>(token, "/meetings", { method: "POST", body: JSON.stringify(input) }),
  update: (token: string, id: string, input: Record<string, unknown>) => request<MeetingDetail>(token, `/meetings/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  addParticipant: (token: string, id: string, input: Record<string, unknown>) => request<MeetingDetail>(token, `/meetings/${id}/participants`, { method: "POST", body: JSON.stringify(input) }),
  addParticipants: (token: string, id: string, participants: Array<{ userId: string; participantRole: string }>) => request<MeetingDetail>(token, `/meetings/${id}/participants/bulk`, { method: "POST", body: JSON.stringify({ participants }) }),
  updateParticipant: (token: string, id: string, participantId: string, input: Record<string, unknown>) => request<MeetingDetail>(token, `/meetings/${id}/participants/${participantId}`, { method: "PATCH", body: JSON.stringify(input) }),
  removeParticipant: (token: string, id: string, participantId: string) => request<MeetingDetail>(token, `/meetings/${id}/participants/${participantId}`, { method: "DELETE" }),
  sendInvitations: (token: string, id: string, userIds?: string[]) => request<{ inApp: number; emailSent: number; emailFailed: number; emailSkipped: number; status: string }>(token, `/meetings/${id}/invitations/send`, { method: "POST", body: JSON.stringify({ userIds: userIds || null }) }),
  uploadAttachment: (token: string, id: string, file: File) => request<MeetingAttachment>(token, `/meetings/${id}/attachments`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) }, body: file }),
  deleteAttachment: (token: string, id: string, attachmentId: string) => request<void>(token, `/meetings/${id}/attachments/${attachmentId}`, { method: "DELETE" }),
  downloadAttachment: async (token: string, id: string, attachment: MeetingAttachment) => {
    const response = await fetch(`${API_URL}/meetings/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachment.id)}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("The meeting supporting document could not be downloaded.");
    const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = attachment.original_filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  addAgenda: (token: string, id: string, input: Record<string, unknown>) => request<AgendaItem>(token, `/meetings/${id}/agenda`, { method: "POST", body: JSON.stringify(input) }),
  updateAgenda: (token: string, id: string, agendaId: string, input: Record<string, unknown>) => request<AgendaItem>(token, `/meetings/${id}/agenda/${agendaId}`, { method: "PATCH", body: JSON.stringify(input) }),
  transcript: (token: string, id: string) => request<TranscriptJob | null>(token, `/meetings/${id}/transcript`),
  uploadAudio: async (token: string, id: string, file: Blob, filename: string) => request<TranscriptJob>(token, `/meetings/${id}/transcription/audio`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "X-File-Name": filename },
    body: file,
  }),
  editSegment: (token: string, id: string, segmentId: string, input: { speakerLabel: string; text: string }) => request<TranscriptJob>(token, `/meetings/${id}/transcript/segments/${segmentId}`, { method: "PATCH", body: JSON.stringify(input) }),
  downloadMinutesPdf: async (token: string, id: string) => {
    const response = await fetch(`${API_URL}/meetings/${encodeURIComponent(id)}/minutes/export.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'The Meeting Minutes PDF could not be downloaded.');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const disposition = response.headers.get('Content-Disposition') || '';
    const fileNameMatch = /filename="?([^";]+)"?/i.exec(disposition);
    anchor.href = objectUrl;
    anchor.download = fileNameMatch?.[1] || `Meeting_Minutes_${id.slice(0, 8)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  },
  generateMinutes: (token: string, id: string) => request<MeetingMinute>(token, `/meetings/${id}/minutes/generate`, { method: "POST" }),
  saveMinutes: (token: string, id: string, content: string) => request<MeetingMinute>(token, `/meetings/${id}/minutes`, { method: "PATCH", body: JSON.stringify({ content }) }),
  submitMinutes: (token: string, id: string, reviewerId: string) => request<MeetingMinute>(token, `/meetings/${id}/minutes/submit`, { method: "POST", body: JSON.stringify({ reviewerId }) }),
  reviewMinutes: (token: string, id: string, decision: "Approved" | "Returned", comments: string) => request<MeetingMinute & { repository_document_id?: string; repository_document_title?: string; repository_record_number?: string; repository_version?: number }>(token, `/meetings/${id}/minutes/review`, { method: "POST", body: JSON.stringify({ decision, comments }) }),
  publishApprovedMinutesToRepository: (token: string, id: string) => request<MeetingMinute & { repository_document_id?: string; repository_document_title?: string; repository_record_number?: string; repository_version?: number }>(token, `/meetings/${id}/minutes/publish-approved`, { method: "POST" }),
  syncMinutesDraftToRepository: (token: string, id: string) => request<MeetingMinute & { repository_draft_document_id?: string; repository_draft_document_title?: string; repository_draft_document_status?: string; repository_draft_version?: number }>(token, `/meetings/${id}/minutes/sync-draft`, { method: "POST" }),
  addDecision: (token: string, id: string, text: string, agendaItemId?: string) => request<MeetingDecision>(token, `/meetings/${id}/decisions`, { method: "POST", body: JSON.stringify({ text, agendaItemId: agendaItemId || null }) }),
  addAction: (token: string, id: string, input: Record<string, unknown>) => request<MeetingAction>(token, `/meetings/${id}/actions`, { method: "POST", body: JSON.stringify(input) }),
  updateAction: (token: string, id: string, actionId: string, status: string) => request<MeetingAction>(token, `/meetings/${id}/actions/${actionId}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  meetingNotifications: (token: string) => request<Array<{ id: string; title?: string; entity_type?: string | null; target_workspace?: string | null; read_at: string | null; archived_at?: string | null }>>(token, "/notifications"),
  conferenceProviderStatus: (token: string) => request<ConferenceProviderStatus>(token, "/meetings-live/provider-status"),
  conference: (token: string, id: string) => request<LiveConferenceSession | null>(token, `/meetings/${id}/conference`),
  startConference: (token: string, id: string) => request<LiveConferenceSession>(token, `/meetings/${id}/conference/start`, { method: "POST" }),
  joinConference: (token: string, id: string) => request<LiveConferenceSession>(token, `/meetings/${id}/conference/join`, { method: "POST" }),
  leaveConference: (token: string, id: string) => request<void>(token, `/meetings/${id}/conference/leave`, { method: "POST" }),
  endConference: (token: string, id: string) => request<void>(token, `/meetings/${id}/conference/end`, { method: "POST" }),
  conferencePresence: (token: string, id: string) => request<LivePresence[]>(token, `/meetings/${id}/conference/presence`),
  complete: (token: string, id: string) => request<MeetingDetail>(token, `/meetings/${id}/complete`, { method: "POST" }),
};
