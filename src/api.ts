const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export type ApiUser = { id: string; name: string; email: string; role: string; division: string; status: string; active_assignments?: number; completed_assignments?: number }
export type ApiAssignment = { id: string; title: string; description: string; division: string; status: string; priority: string; due_date: string | null; members: { id: string; name: string; role: string }[] }

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(data?.error || 'The PSC service could not complete your request.')
  return data as T
}

export const api = {
  login: (email: string, password: string) => request<{ token: string; user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  users: (token: string) => request<ApiUser[]>('/users', {}, token),
  updateRole: (token: string, id: string, role: string) => request<ApiUser>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, token),
  assignments: (token: string) => request<ApiAssignment[]>('/assignments', {}, token),
  updateStatus: (token: string, id: string, status: string) => request<ApiAssignment>(`/assignments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  addMember: (token: string, assignmentId: string, userId: string) => request<void>(`/assignments/${assignmentId}/members`, { method: 'POST', body: JSON.stringify({ userId, memberRole: 'Contributor' }) }, token),
  comments: (token: string, assignmentId: string) => request<{ id: string; body: string; author_name: string; created_at: string }[]>(`/assignments/${assignmentId}/comments`, {}, token),
  addComment: (token: string, assignmentId: string, body: string) => request(`/assignments/${assignmentId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }, token),
  alerts: (token: string) => request<{ id: string; title: string; body: string; created_at: string }[]>('/alerts', {}, token),
  publishAlert: (token: string, body: string) => request('/alerts', { method: 'POST', body: JSON.stringify({ title: 'Management update', body, severity: 'Important', audienceRole: null }) }, token),
}
