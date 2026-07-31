const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'http://127.0.0.1:8100/api'
let unauthorizedHandler: (() => void) | null = null

export type ApiUser = { id: string; name: string; email: string; role: string; division: string; status: string; active:boolean;must_change_password?:boolean;active_assignments?: number; completed_assignments?: number }
export type ApiAssignment = { id: string; title: string; description: string; division: string; status: string; priority: string; due_date: string | null; created_at?: string; members: { id: string; name: string; role: string }[] }
export type AssignmentInput = { title: string; description: string; division: string; dueDate: string | null; priority: string; memberIds: string[] }
export type ApiAttachment = { id: string; original_name: string; mime_type: string; size_bytes: number; created_at: string; uploader_name: string }
export type ApiHistory = { id: string; action: string; details: Record<string, unknown>; created_at: string; user_name: string }
export type KnowledgeItem = { id:string;title:string;description:string;category:string;tags:string[];status:string;assignment_id:string|null;created_at:string;created_by_name:string;latest_version:number;original_name:string;size_bytes:number }
export type KnowledgeVersion = { id:string;version_number:number;original_name:string;mime_type:string;size_bytes:number;created_at:string;created_by_name:string }
export type ResearchProject={id:string;title:string;summary:string;research_question:string;objectives:string;methodology:string;status:string;start_date:string|null;end_date:string|null;lead_name:string;collaborators:{id:string;name:string;role:string}[];milestones:{id:string;title:string;due_date:string|null;status:string}[]}
export type AiResearchEngine={mode:string;provider:string;ollamaConnected:boolean;gptResearcherConnected:boolean;researchMateConnected:boolean;paidProvidersEnabled:boolean}
export type AiResearchJob={id:string;title:string;question:string;scope:string;source_mode:string;depth:string;provider:string;status:string;progress:number;plan:{step:number;title:string;description:string}[];draft_report:string;error_message?:string;created_by_name:string;created_at:string;updated_at:string;sources:{id:string;title:string;url?:string;excerpt:string;citation_number:number}[];events:{id:number;event:string;details:Record<string,unknown>;created_at:string}[]}
export type DocumentItem=KnowledgeItem&{locked_by_name?:string;locked_at?:string;expires_at?:string;retention_until?:string}
export type ReviewEvent={id:number;action:string;comments:string;created_at:string;actor_name:string;reviewer_name?:string}
export type ReviewItem=DocumentItem&{reviewer_id?:string;reviewer_name?:string;review_history:ReviewEvent[]}
export type ApiNotification={id:string;title:string;body:string;entity_type?:string;entity_id?:string;read_at:string|null;created_at:string}
export type AnalyticsReport={
  summary:{total:number;completed:number;overdue:number;completion_rate:number;pending_reviews:number;published_documents:number;active_research:number}
  assignmentStatuses:{status:string;total:number}[]
  divisions:{division:string;total:number;completed:number}[]
  documentStatuses:{status:string;total:number}[]
  researchStatuses:{status:string;total:number}[]
  reviewers:{id:string;name:string;approved:number;rejected:number;pending:number}[]
  trends:{month:string;created:number;completed:number}[]
  people:{id:string;name:string;role:string;division:string;assigned:number;completed:number;overdue:number;completion_rate:number}[]
}
export type AuditLog={id:number;user_id:string|null;user_name:string;user_email?:string;action:string;entity_type:string;entity_id:string|null;details:Record<string,unknown>;created_at:string}
export type AuditResponse={items:AuditLog[];total:number;actions:string[];entityTypes:string[]}
export type SettingsResponse={
  system:{organization_name:string;department_name:string;support_email:string;session_minutes:number;max_upload_mb:number;default_retention_days:number;document_categories:string[];maintenance_mode:boolean;email_notifications:boolean;updated_at:string}
  preferences:{email_notifications:boolean;in_app_notifications:boolean;compact_layout:boolean;updated_at?:string}
  health:{api:string;database:string;environment:string;database_time:string;configured_upload_limit_mb:number;configured_session:string}
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const data = response.status === 204 ? null : await response.json()
  if (response.status === 401 && token) unauthorizedHandler?.()
  if (!response.ok) {
    const fieldErrors=data?.details?.fieldErrors as Record<string,string[]|undefined>|undefined
    const specific=fieldErrors?Object.entries(fieldErrors).flatMap(([field,messages])=>(messages||[]).map(message=>`${field.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase())}: ${message}`))[0]:undefined
    throw new Error(specific||data?.error||'The PSC service could not complete your request.')
  }
  return data as T
}

async function aiRequest<T>(path:string,options:RequestInit={},token?:string):Promise<T>{
  try{
    const response=await fetch(`${AI_API_URL}${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers}})
    const data=response.status===204?null:await response.json()
    if(response.status===401&&token)unauthorizedHandler?.()
    if(!response.ok)throw new Error(data?.detail||data?.error||'The AI Researcher could not complete your request.')
    return data as T
  }catch(error){
    if(error instanceof TypeError)throw new Error('The separate AI Researcher service is offline. App2 is still available.')
    throw error
  }
}

export const api = {
  onUnauthorized: (handler: (() => void) | null) => { unauthorizedHandler = handler },
  login: (email: string, password: string) => request<{ token: string; user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: (token: string) => request<ApiUser>('/auth/me', {}, token),
  logout: (token: string) => request<void>('/auth/logout', { method: 'POST' }, token),
  changePassword: (token: string, currentPassword: string, newPassword: string) => request<{ token: string; user: ApiUser }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }, token),
  forgotPassword: (email: string) => request<{ message: string; resetToken?: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (resetToken: string, newPassword: string) => request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, newPassword }) }),
  users: (token: string) => request<ApiUser[]>('/users', {}, token),
  createUser:(token:string,input:{name:string;email:string;role:string;division:string;temporaryPassword?:string})=>request<ApiUser&{temporary_password:string}>('/users',{method:'POST',body:JSON.stringify(input)},token),
  updateUser:(token:string,id:string,input:{name:string;email:string;role:string;division:string;status:string;active:boolean})=>request<ApiUser>(`/users/${id}`,{method:'PATCH',body:JSON.stringify(input)},token),
  updateRole: (token: string, id: string, role: string) => request<ApiUser>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, token),
  resetUserPassword:(token:string,id:string)=>request<{message:string;temporaryPassword:string}>(`/users/${id}/reset-password`,{method:'POST'},token),
  assignments: (token: string) => request<ApiAssignment[]>('/assignments', {}, token),
  createAssignment: (token: string, input: AssignmentInput) => request<ApiAssignment>('/assignments', { method: 'POST', body: JSON.stringify(input) }, token),
  updateAssignment: (token: string, id: string, input: Omit<AssignmentInput, 'memberIds'>) => request<ApiAssignment>(`/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, token),
  deleteAssignment: (token: string, id: string) => request<void>(`/assignments/${id}`, { method: 'DELETE' }, token),
  updateStatus: (token: string, id: string, status: string) => request<ApiAssignment>(`/assignments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  addMember: (token: string, assignmentId: string, userId: string) => request<void>(`/assignments/${assignmentId}/members`, { method: 'POST', body: JSON.stringify({ userId, memberRole: 'Contributor' }) }, token),
  comments: (token: string, assignmentId: string) => request<{ id: string; body: string; author_name: string; created_at: string }[]>(`/assignments/${assignmentId}/comments`, {}, token),
  addComment: (token: string, assignmentId: string, body: string) => request(`/assignments/${assignmentId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }, token),
  history: (token: string, assignmentId: string) => request<ApiHistory[]>(`/assignments/${assignmentId}/history`, {}, token),
  attachments: (token: string, assignmentId: string) => request<ApiAttachment[]>(`/assignments/${assignmentId}/attachments`, {}, token),
  uploadAttachment: async (token: string, assignmentId: string, file: File) => {
    const response = await fetch(`${API_URL}/assignments/${assignmentId}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name), 'X-File-Type': file.type || 'application/octet-stream' }, body: file })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || 'Attachment could not be uploaded.')
    return data as ApiAttachment
  },
  downloadAttachment: async (token: string, attachmentId: string, fileName: string) => {
    const response = await fetch(`${API_URL}/attachments/${attachmentId}/download`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error('Attachment could not be downloaded.')
    const url = URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;anchor.click();URL.revokeObjectURL(url)
  },
  knowledge: (token:string, search='') => request<KnowledgeItem[]>(`/knowledge${search?`?search=${encodeURIComponent(search)}`:''}`,{},token),
  uploadKnowledge: async (token:string,file:File,metadata:{title:string;description:string;category:string;tags:string;assignmentId?:string}) => {
    const response=await fetch(`${API_URL}/knowledge`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-File-Type':file.type||'application/octet-stream','X-Title':encodeURIComponent(metadata.title),'X-Description':encodeURIComponent(metadata.description),'X-Category':encodeURIComponent(metadata.category),'X-Tags':encodeURIComponent(metadata.tags),...(metadata.assignmentId?{'X-Assignment-Id':metadata.assignmentId}:{})},body:file})
    const data=await response.json();if(!response.ok)throw new Error(data?.error||'Knowledge item could not be uploaded.');return data as KnowledgeItem
  },
  approveKnowledge:(token:string,id:string,approved:boolean,reason?:string)=>request<KnowledgeItem>(`/knowledge/${id}/approve`,{method:'PATCH',body:JSON.stringify({approved,reason})},token),
  submitKnowledge:(token:string,id:string)=>request<KnowledgeItem>(`/document-reviews/${id}/submit`,{method:'POST'},token),
  knowledgeVersions:(token:string,id:string)=>request<KnowledgeVersion[]>(`/knowledge/${id}/versions`,{},token),
  uploadKnowledgeVersion:async(token:string,id:string,file:File)=>{const response=await fetch(`${API_URL}/knowledge/${id}/versions`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-File-Type':file.type||'application/octet-stream'},body:file});const data=await response.json();if(!response.ok)throw new Error(data?.error||'Version could not be uploaded.');return data},
  downloadKnowledgeVersion:async(token:string,id:string,fileName:string)=>{const response=await fetch(`${API_URL}/knowledge/versions/${id}/download`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('Document could not be downloaded.');const url=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;anchor.click();URL.revokeObjectURL(url)},
  research:(token:string)=>request<ResearchProject[]>('/research',{},token),
  createResearch:(token:string,input:Record<string,unknown>)=>request<ResearchProject>('/research',{method:'POST',body:JSON.stringify(input)},token),
  updateResearchStatus:(token:string,id:string,status:string)=>request<ResearchProject>(`/research/${id}/status`,{method:'PATCH',body:JSON.stringify({status})},token),
  addResearchMilestone:(token:string,id:string,title:string,dueDate:string|null)=>request(`/research/${id}/milestones`,{method:'POST',body:JSON.stringify({title,dueDate})},token),
  aiResearchEngine:(token:string)=>aiRequest<AiResearchEngine>('/engine',{},token),
  aiResearchJobs:(token:string)=>aiRequest<AiResearchJob[]>('/jobs',{},token),
  createAiResearchJob:(token:string,input:{title:string;question:string;scope:string;sourceMode:string;depth:string})=>aiRequest<AiResearchJob>('/jobs',{method:'POST',body:JSON.stringify(input)},token),
  startAiResearchJob:(token:string,id:string)=>aiRequest<AiResearchJob>(`/jobs/${id}/start`,{method:'POST'},token),
  updateAiResearchStatus:(token:string,id:string,status:string,comments='')=>aiRequest<AiResearchJob>(`/jobs/${id}/status`,{method:'PATCH',body:JSON.stringify({status,comments})},token),
  documents:(token:string)=>request<DocumentItem[]>('/documents',{},token),
  checkoutDocument:(token:string,id:string)=>request(`/documents/${id}/checkout`,{method:'POST'},token),
  checkinDocument:(token:string,id:string)=>request<void>(`/documents/${id}/checkin`,{method:'POST'},token),
  retainDocument:(token:string,id:string,retentionUntil:string|null,archive=false)=>request<DocumentItem>(`/documents/${id}/retention`,{method:'PATCH',body:JSON.stringify({retentionUntil,archive})},token),
  documentReviews:(token:string)=>request<ReviewItem[]>('/document-reviews',{},token),
  assignDocumentReviewer:(token:string,id:string,reviewerId:string)=>request<ReviewItem>(`/document-reviews/${id}/assign`,{method:'PATCH',body:JSON.stringify({reviewerId})},token),
  decideDocumentReview:(token:string,id:string,approved:boolean,comments:string)=>request<DocumentItem>(`/document-reviews/${id}/decision`,{method:'POST',body:JSON.stringify({approved,comments})},token),
  documentReviewHistory:(token:string,id:string)=>request<ReviewEvent[]>(`/document-reviews/${id}/history`,{},token),
  notifications:(token:string)=>request<ApiNotification[]>('/notifications',{},token),
  readNotification:(token:string,id:string)=>request<ApiNotification>(`/notifications/${id}/read`,{method:'PATCH'},token),
  analytics:(token:string,filters:{from:string;to:string;division:string;status:string})=>request<AnalyticsReport>(`/analytics/reports?${new URLSearchParams(filters)}`,{},token),
  auditLogs:(token:string,filters:{search:string;userId:string;action:string;entityType:string;from:string;to:string})=>request<AuditResponse>(`/audit-logs?${new URLSearchParams(filters)}`,{},token),
  settings:(token:string)=>request<SettingsResponse>('/settings',{},token),
  updateSystemSettings:(token:string,input:{organizationName:string;departmentName:string;supportEmail:string;sessionMinutes:number;maxUploadMb:number;defaultRetentionDays:number;documentCategories:string[];maintenanceMode:boolean;emailNotifications:boolean})=>request('/settings/system',{method:'PATCH',body:JSON.stringify(input)},token),
  updatePreferences:(token:string,input:{emailNotifications:boolean;inAppNotifications:boolean;compactLayout:boolean})=>request('/settings/preferences',{method:'PATCH',body:JSON.stringify(input)},token),
  alerts: (token: string) => request<{ id: string; title: string; body: string; created_at: string }[]>('/alerts', {}, token),
  publishAlert: (token: string, body: string) => request('/alerts', { method: 'POST', body: JSON.stringify({ title: 'Management update', body, severity: 'Important', audienceRole: null }) }, token),
}
