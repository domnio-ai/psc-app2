import { useEffect, useState } from 'react'
import { api, type AiResearchEngine, type AiResearchJob, type AnalyticsReport, type ApiAssignment, type ApiAttachment, type ApiHistory, type ApiNotification, type ApiUser, type AssignmentInput, type AuditLog, type CalendarItem, type DocumentItem, type EmailDeliveryStatus, type KnowledgeItem, type KnowledgeVersion, type NoticeItem, type ResearchProject, type ReviewItem, type SettingsResponse, type UpdateStatus } from './api'
import CalendarView from './CalendarView'
import NoticeComposer from './NoticeComposer'
import NotificationCenter from './NotificationCenter'

type IconName = keyof typeof icons
type Role = 'Administrator' | 'Research Manager' | 'Research Officer' | 'Reviewer'
type User = { name: string; email: string; role: Role; initials: string; rights: string[]; mustChangePassword?:boolean }
type TeamMember = User & { id: string; division: string; active: number; completed: number; status: 'Available' | 'Busy' | 'Away' }
type StoredSession = { token: string; user: User }
const SESSION_KEY = 'psc-app2-session'

const localDateTimeToIso = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('Choose a valid event date and time.')
  return parsed.toISOString()
}

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as StoredSession : null
  } catch {
    return null
  }
}

const tokenExpiresAt = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return Number(payload.exp) * 1000
  } catch {
    return 0
  }
}

const demoUsers: User[] = [
  { name: 'Dominic Kibet', email: 'dominic.kibet@publicservice.go.ke', role: 'Research Officer', initials: 'DK', rights: ['View assignments', 'Update assigned work', 'Add knowledge', 'Collaborate'] },
  { name: 'Mary Wanjiku', email: 'mary.wanjiku@publicservice.go.ke', role: 'Research Manager', initials: 'MW', rights: ['Create assignments', 'Assign members', 'Approve work', 'Manage research'] },
  { name: 'Grace Muturi', email: 'grace.muturi@publicservice.go.ke', role: 'Reviewer', initials: 'GM', rights: ['Review submissions', 'Comment', 'Request changes', 'Approve knowledge'] },
  { name: 'System Administrator', email: 'admin@publicservice.go.ke', role: 'Administrator', initials: 'SA', rights: ['Manage users', 'Manage roles', 'Audit activity', 'Full system access'] },
]

const initialTeam: TeamMember[] = [
  { ...demoUsers[0], id:'1', division: 'Digital Government', active: 3, completed: 8, status: 'Busy' },
  { ...demoUsers[1], id:'2', division: 'Research & Policy', active: 2, completed: 14, status: 'Available' },
  { ...demoUsers[2], id:'3', division: 'Quality Assurance', active: 4, completed: 11, status: 'Busy' },
  { id:'4', name: 'John Kamau', email: 'john.kamau@publicservice.go.ke', role: 'Research Officer', initials: 'JK', rights: ['View assignments', 'Update assigned work', 'Collaborate'], division: 'HR Research', active: 1, completed: 9, status: 'Available' },
  { id:'5', name: 'Faith Njeri', email: 'faith.njeri@publicservice.go.ke', role: 'Reviewer', initials: 'FN', rights: ['Review submissions', 'Comment', 'Approve knowledge'], division: 'Governance', active: 2, completed: 12, status: 'Away' },
  { ...demoUsers[3], id:'6', division: 'ICT', active: 0, completed: 3, status: 'Available' },
]

const icons = {
  dashboard: '▦', assignments: '▣', knowledge: '▤', research: '◉', documents: '▱',
  team: '♙', reports: '▥', notifications: '♧', calendar: '▦', audit: '♢',
  settings: '⚙', plus: '⊕', upload: '♧', menu: '☰', search: '⌕',
  bell: '♧', arrow: '→', clock: '◷', check: '✓', warning: '!', announce: '◁',
}

const navItems: [IconName, string][] = [
  ['dashboard', 'Dashboard'], ['assignments', 'Assignments'],
  ['knowledge', 'Knowledge Repository'], ['research', 'Research Repository'],
  ['research', 'AI Researcher'],
  ['documents', 'Documents'], ['team', 'Team & Users'], ['reports', 'Reports & Analytics'],
  ['notifications', 'Notifications'], ['announce','Notice Board'], ['calendar', 'Calendar'], ['audit', 'Audit Logs'],
  ['settings', 'Settings'],
]

const stats: [IconName, string, string, string][] = [
  ['assignments', 'Active Assignments', '12', 'yellow'],
  ['check', 'Completed Assignments', '28', 'orange'],
  ['knowledge', 'Knowledge Items', '156', 'yellow'],
  ['documents', 'Documents', '342', 'orange'],
  ['team', 'Team Members', '24', 'yellow'],
]

const assignments = [
  ['clock', 'Policy Review on Performance Management', 'HR Policy & Governance', 'Due: 02 Aug 2026', 'In Progress', 'yellow'],
  ['clock', 'Research on Public Service Digital Transformation', 'Digital Government', 'Due: 10 Aug 2026', 'In Progress', 'orange'],
  ['calendar', 'Analysis of Establishment Register Data', 'Establishment & Organisational Management', 'Due: 15 Aug 2026', 'Due Soon', 'yellow'],
  ['warning', 'Study on Talent Management Practices', 'Talent Management Division', 'Due: 20 Jul 2026', 'Overdue', 'orange'],
  ['check', 'Benchmarking Report on Public Service Commissions', 'Completed', 'Completed: 18 Jul 2026', 'Completed', 'green'],
]

const announcements = [
  ['announce', 'Research Guidelines Updated', 'The Research Department guidelines have been updated. Please review.', '28 Jul 2026'],
  ['calendar', 'Quarterly Research Review Meeting', 'The Q3 review meeting is scheduled for 6th August 2026.', '27 Jul 2026'],
  ['documents', 'New Knowledge Upload Protocol', 'All staff to follow the new knowledge upload protocol effective immediately.', '25 Jul 2026'],
]

const knowledge = [
  ['Public Service Regulations 2024', 'Regulations · Added by Mary Wanjiku', '27 Jul 2026'],
  ['Performance Management Best Practices', 'Best Practice · Added by John Kamau', '25 Jul 2026'],
  ['Talent Management Handbook', 'Handbook · Added by Grace Muturi', '24 Jul 2026'],
]

const activity = [
  ['upload', 'You uploaded a document', 'Policy Review Framework.pdf', '2h ago', 'green'],
  ['assignments', 'Assignment updated', 'Research on Digital Transformation', '3h ago', 'orange'],
  ['team', 'New user added', 'Mary Wanjiku was added to the system', '5h ago', 'yellow'],
  ['check', 'Assignment completed', 'Benchmarking Report on PSCs', '1d ago', 'green'],
]

const roleNavigation: Record<Role, string[]> = {
  Administrator: navItems.map(([, label]) => label),
  'Research Manager': navItems.map(([, label]) => label).filter(label => label !== 'Audit Logs'),
  'Research Officer': ['Dashboard', 'Assignments', 'Knowledge Repository', 'Research Repository', 'AI Researcher', 'Documents', 'Team & Users', 'Notifications', 'Notice Board', 'Calendar', 'Settings'],
  Reviewer: ['Dashboard', 'Assignments', 'Knowledge Repository', 'Documents', 'Notifications', 'Notice Board', 'Calendar', 'Settings'],
}

const navigationDescriptions:Record<string,string>={
  Dashboard:'Open the department overview, workload summaries, announcements and recent activity.',Assignments:'Create, assign, track and complete departmental work.',
  'Knowledge Repository':'Search and manage approved institutional knowledge and document versions.','Research Repository':'Plan and monitor research projects, methods, collaborators and milestones.',
  'AI Researcher':'Open the separate AI-assisted research planning workspace.',Documents:'Upload, review, approve, retain and archive controlled documents.',
  'Team & Users':'Manage staff accounts, roles, divisions, availability and workload.','Reports & Analytics':'View live performance measures and export management reports.',
  Notifications:'Open your assignment, review, approval and security notification inbox.','Notice Board':'Read approved public information or submit a notice for management approval.',Calendar:'Open live assignment deadlines and approved notice events.',
  'Audit Logs':'Inspect the read-only record of security and system activity.',Settings:'Configure organization defaults, themes, email, maintenance and updates.',
  General:'Configure organization information, personal notifications and account security.',Themes:'Choose display theme, accent colour and layout density.',
  'Email Notifications':'Configure system email delivery and your personal notification channels.',Maintenance:'Review service health and control approved maintenance settings.',
  Updates:'Check installed App2 component versions without downloading or installing software.'
}

const statDestinations:Record<string,string>={'Active Assignments':'Assignments','Completed Assignments':'Assignments','Knowledge Items':'Knowledge Repository',Documents:'Documents','Team Members':'Team & Users'}

function Icon({ name }: { name: IconName }) {
  return <span className="icon" aria-hidden="true">{icons[name]}</span>
}

export default function App() {
  const [now, setNow] = useState(new Date())
  const [active, setActive] = useState('Dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [token, setToken] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  const [rememberMe, setRememberMe] = useState(true)
  const [sessionMessage, setSessionMessage] = useState('')
  const [passwordMode, setPasswordMode] = useState<'change' | 'forgot' | null>(null)
  const [showLogout, setShowLogout] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState([
    { author: 'Mary Wanjiku', text: 'Please review the evidence matrix before Friday.', time: '10:24 AM' },
    { author: 'Grace Muturi', text: 'I have added review notes to section three.', time: '11:08 AM' },
  ])
  const [team, setTeam] = useState(initialTeam)
  const [alertText, setAlertText] = useState('')
  const [systemAlerts, setSystemAlerts] = useState(['Quarterly research review meeting is scheduled for 6 August 2026.'])
  const [workAllocation, setWorkAllocation] = useState([
    { id:'1', title: 'Policy Review on Performance Management', assignee: 'Dominic Kibet', status: 'In Progress', division:'HR Policy & Governance', dueDate:'2026-08-02' },
    { id:'2', title: 'Public Service Digital Transformation', assignee: 'John Kamau', status: 'In Progress', division:'Digital Government', dueDate:'2026-08-10' },
    { id:'3', title: 'Establishment Register Analysis', assignee: 'Grace Muturi', status: 'Ready for Review', division:'Establishment Management', dueDate:'2026-08-15' },
  ])
  const [dashboardAssignmentFilter,setDashboardAssignmentFilter]=useState('All')
  const [assignmentRows, setAssignmentRows] = useState<ApiAssignment[]>([])
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [assignmentStatus, setAssignmentStatus] = useState('All')
  const [assignmentPriority, setAssignmentPriority] = useState('All')
  const [assignmentEditor, setAssignmentEditor] = useState<ApiAssignment | 'new' | null>(null)
  const [assignmentForm, setAssignmentForm] = useState<AssignmentInput>({title:'',description:'',division:'',dueDate:null,priority:'Normal',memberIds:[]})
  const [assignmentFiles, setAssignmentFiles] = useState<ApiAttachment[]>([])
  const [assignmentHistory, setAssignmentHistory] = useState<ApiHistory[]>([])
  const [assignmentNotice, setAssignmentNotice] = useState('')
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [knowledgeRows,setKnowledgeRows]=useState<KnowledgeItem[]>([])
  const [knowledgeSearch,setKnowledgeSearch]=useState('')
  const [knowledgeCategory,setKnowledgeCategory]=useState('All')
  const [knowledgeUploadOpen,setKnowledgeUploadOpen]=useState(false)
  const [knowledgeFile,setKnowledgeFile]=useState<File|null>(null)
  const [knowledgeForm,setKnowledgeForm]=useState({title:'',description:'',category:'Policy',tags:'',assignmentId:''})
  const [knowledgeNotice,setKnowledgeNotice]=useState('')
  const [selectedKnowledge,setSelectedKnowledge]=useState<KnowledgeItem|null>(null)
  const [knowledgeVersions,setKnowledgeVersions]=useState<KnowledgeVersion[]>([])
  const [researchRows,setResearchRows]=useState<ResearchProject[]>([])
  const [aiResearchJobs,setAiResearchJobs]=useState<AiResearchJob[]>([])
  const [aiResearchEngine,setAiResearchEngine]=useState<AiResearchEngine|null>(null)
  const [aiResearchOpen,setAiResearchOpen]=useState(false)
  const [aiResearchNotice,setAiResearchNotice]=useState('')
  const [aiResearchForm,setAiResearchForm]=useState({title:'',question:'',scope:'',sourceMode:'All',depth:'Standard'})
  const [researchOpen,setResearchOpen]=useState(false)
  const [researchForm,setResearchForm]=useState({title:'',summary:'',researchQuestion:'',objectives:'',methodology:'',startDate:'',endDate:'',assignmentId:'',collaboratorIds:[] as string[],knowledgeIds:[] as string[]})
  const [documentRows,setDocumentRows]=useState<DocumentItem[]>([])
  const [documentSearch,setDocumentSearch]=useState('')
  const [documentStatus,setDocumentStatus]=useState('All')
  const [documentNotice,setDocumentNotice]=useState('')
  const [retentionDocument,setRetentionDocument]=useState<DocumentItem|null>(null)
  const [retentionDate,setRetentionDate]=useState('')
  const [reviewDocument,setReviewDocument]=useState<DocumentItem|null>(null)
  const [rejectionReason,setRejectionReason]=useState('')
  const [reviewRows,setReviewRows]=useState<ReviewItem[]>([])
  const [reviewers,setReviewers]=useState<ApiUser[]>([])
  const [notifications,setNotifications]=useState<ApiNotification[]>([])
  const [notificationsLoading,setNotificationsLoading]=useState(false)
  const [noticeRows,setNoticeRows]=useState<NoticeItem[]>([])
  const [calendarRows,setCalendarRows]=useState<CalendarItem[]>([])
  const [noticeForm,setNoticeForm]=useState({title:'',body:'',severity:'Information',audienceRole:'',eventStart:'',eventEnd:''})
  const [noticeNotice,setNoticeNotice]=useState('')
  const [reviewingNotice,setReviewingNotice]=useState<NoticeItem|null>(null)
  const [noticeReason,setNoticeReason]=useState('')
  const [report,setReport]=useState<AnalyticsReport|null>(null)
  const [reportFilters,setReportFilters]=useState({from:'',to:'',division:'',status:''})
  const [reportNotice,setReportNotice]=useState('')
  const [userRows,setUserRows]=useState<ApiUser[]>([])
  const [userSearch,setUserSearch]=useState('')
  const [userRoleFilter,setUserRoleFilter]=useState('All')
  const [userEditor,setUserEditor]=useState<ApiUser|'new'|null>(null)
  const [userForm,setUserForm]=useState({name:'',email:'',role:'Research Officer',division:'',status:'Available',active:true,temporaryPassword:''})
  const [userNotice,setUserNotice]=useState('')
  const [temporaryCredential,setTemporaryCredential]=useState('')
  const [createdAccount,setCreatedAccount]=useState<{name:string;email:string;password:string}|null>(null)
  const [savingUser,setSavingUser]=useState(false)
  const [userFormError,setUserFormError]=useState('')
  const [auditRows,setAuditRows]=useState<AuditLog[]>([])
  const [auditTotal,setAuditTotal]=useState(0)
  const [auditActions,setAuditActions]=useState<string[]>([])
  const [auditEntityTypes,setAuditEntityTypes]=useState<string[]>([])
  const [auditFilters,setAuditFilters]=useState({search:'',userId:'',action:'',entityType:'',from:'',to:''})
  const [selectedAudit,setSelectedAudit]=useState<AuditLog|null>(null)
  const [auditNotice,setAuditNotice]=useState('')
  const [settingsData,setSettingsData]=useState<SettingsResponse|null>(null)
  const [settingsTab,setSettingsTab]=useState<'General'|'Themes'|'Email Notifications'|'Maintenance'|'Updates'>('General')
  const [updateStatus,setUpdateStatus]=useState<UpdateStatus|null>(null)
  const [checkingUpdates,setCheckingUpdates]=useState(false)
  const [emailDelivery,setEmailDelivery]=useState<EmailDeliveryStatus|null>(null)
  const [testingEmail,setTestingEmail]=useState(false)
  const [systemForm,setSystemForm]=useState({organizationName:'',departmentName:'',supportEmail:'',sessionMinutes:480,maxUploadMb:100,defaultRetentionDays:2555,documentCategories:'',maintenanceMode:false,emailNotifications:true})
  const [preferenceForm,setPreferenceForm]=useState<{emailNotifications:boolean;inAppNotifications:boolean;compactLayout:boolean;themeMode:'Dark'|'Light'|'System';accentColor:'Gold'|'Blue'|'Green'}>({emailNotifications:true,inAppNotifications:true,compactLayout:false,themeMode:'Dark',accentColor:'Gold'})
  const [settingsNotice,setSettingsNotice]=useState('')
  const [savingSettings,setSavingSettings]=useState(false)
  const isManager = user?.role === 'Administrator' || user?.role === 'Research Manager'
  const canReview=['Administrator','Research Manager','Reviewer'].includes(user?.role||'')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const clearSession = (message = '') => {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
    setToken('')
    setPassword('')
    setActive('Dashboard')
    setSessionMessage(message)
  }

  useEffect(() => {
    api.onUnauthorized(() => clearSession('Your session expired. Please sign in again.'))
    const stored = readStoredSession()
    if (!stored || tokenExpiresAt(stored.token) <= Date.now()) {
      clearSession(stored ? 'Your session expired. Please sign in again.' : '')
      setAuthLoading(false)
      return () => api.onUnauthorized(null)
    }
    setToken(stored.token)
    setUser(stored.user)
    api.me(stored.token)
      .then(member => {
        const profile = mapUser(member)
        setUser(profile)
        return loadLiveData(stored.token, profile)
      })
      .catch(() => clearSession('Your saved session is no longer valid. Please sign in again.'))
      .finally(() => setAuthLoading(false))
    return () => api.onUnauthorized(null)
  }, [])

  useEffect(() => {
    if (!token) return
    const remaining = tokenExpiresAt(token) - Date.now()
    if (remaining <= 0) {
      clearSession('Your session expired. Please sign in again.')
      return
    }
    const timer = window.setTimeout(() => clearSession('Your session expired. Please sign in again.'), remaining)
    return () => window.clearTimeout(timer)
  }, [token])

  useEffect(() => {
    if (user && active !== 'Profile' && !roleNavigation[user.role].includes(active)) setActive('Dashboard')
  }, [active, user])

  useEffect(()=>{if(active==='Knowledge Repository'&&token)api.knowledge(token).then(setKnowledgeRows).catch(error=>setKnowledgeNotice(error instanceof Error?error.message:'Knowledge repository could not be loaded.'))},[active,token])
  useEffect(()=>{if(active==='Research Repository'&&token)api.research(token).then(setResearchRows)},[active,token])
  useEffect(()=>{if(active==='AI Researcher'&&token)Promise.all([api.aiResearchJobs(token),api.aiResearchEngine(token)]).then(([jobs,engine])=>{setAiResearchJobs(jobs);setAiResearchEngine(engine)}).catch(error=>setAiResearchNotice(error.message))},[active,token])
  useEffect(()=>{if(active==='Documents'&&token)Promise.all([api.documents(token),...(canReview?[api.documentReviews(token)]:[])]).then(([documents,reviews])=>{setDocumentRows(documents as DocumentItem[]);if(reviews)setReviewRows(reviews as ReviewItem[])}).catch(error=>setDocumentNotice(error instanceof Error?error.message:'Documents could not be loaded.'))},[active,token])
  useEffect(()=>{if(!token)return;const load=()=>api.notifications(token).then(setNotifications).catch(()=>{});load();const timer=window.setInterval(load,10000);return()=>window.clearInterval(timer)},[token])
  useEffect(()=>{if(token&&active==='Notice Board')api.alerts(token).then(setNoticeRows).catch(error=>setNoticeNotice(error instanceof Error?error.message:'Notice Board could not be loaded.'))},[token,active])
  useEffect(()=>{if(!token||active!=='Calendar')return;const load=()=>api.calendar(token).then(setCalendarRows).catch(()=>setCalendarRows([]));load();const timer=window.setInterval(load,15000);return()=>window.clearInterval(timer)},[token,active,assignmentRows,noticeRows])
  useEffect(()=>{if(token&&isManager&&active==='Documents')api.users(token).then(rows=>setReviewers(rows.filter(member=>['Reviewer','Research Manager','Administrator'].includes(member.role)))).catch(()=>{})},[token,active])
  useEffect(()=>{if(token&&isManager&&active==='Reports & Analytics')api.analytics(token,reportFilters).then(setReport).catch(error=>setReportNotice(error instanceof Error?error.message:'Reports could not be loaded.'))},[token,active,reportFilters])
  useEffect(()=>{if(token&&isManager&&active==='Team & Users')api.users(token).then(setUserRows).catch(error=>setUserNotice(error instanceof Error?error.message:'Users could not be loaded.'))},[token,active])
  useEffect(()=>{if(token&&user?.role==='Administrator'&&active==='Audit Logs')api.auditLogs(token,auditFilters).then(result=>{setAuditRows(result.items);setAuditTotal(result.total);setAuditActions(result.actions);setAuditEntityTypes(result.entityTypes)}).catch(error=>setAuditNotice(error instanceof Error?error.message:'Audit logs could not be loaded.'))},[token,active,auditFilters,user?.role])
  useEffect(()=>{if(token&&active==='Settings')api.settings(token).then(result=>{setSettingsData(result);setSystemForm({organizationName:result.system.organization_name,departmentName:result.system.department_name,supportEmail:result.system.support_email,sessionMinutes:result.system.session_minutes,maxUploadMb:result.system.max_upload_mb,defaultRetentionDays:result.system.default_retention_days,documentCategories:result.system.document_categories.join(', '),maintenanceMode:result.system.maintenance_mode,emailNotifications:result.system.email_notifications});setPreferenceForm({emailNotifications:result.preferences.email_notifications,inAppNotifications:result.preferences.in_app_notifications,compactLayout:result.preferences.compact_layout,themeMode:result.preferences.theme_mode||'Dark',accentColor:result.preferences.accent_color||'Gold'})}).catch(error=>setSettingsNotice(error instanceof Error?error.message:'Settings could not be loaded.'))},[token,active])
  useEffect(()=>{if(token&&active==='Settings'&&user?.role==='Administrator')api.emailDeliveryStatus(token).then(setEmailDelivery).catch(()=>setEmailDelivery(null))},[token,active,user?.role])
  useEffect(()=>{const resolved=preferenceForm.themeMode==='System'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):preferenceForm.themeMode.toLowerCase();document.documentElement.dataset.theme=resolved;document.documentElement.dataset.accent=preferenceForm.accentColor.toLowerCase()},[preferenceForm.themeMode,preferenceForm.accentColor])
  useEffect(()=>{const describe=()=>{document.querySelectorAll<HTMLElement>('button,[role="tab"],select').forEach(element=>{if(element.title)return;const label=(element.getAttribute('aria-label')||element.textContent||'').trim().replace(/\s+/g,' ');const exact=navigationDescriptions[label];if(exact)element.title=exact;else if(element.tagName==='SELECT')element.title=`Choose ${label||'an option'} from this dropdown menu.`;else if(label)element.title=`Use ${label} to continue to the described action.`})};describe();const observer=new MutationObserver(describe);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[])

  const rightsFor = (role: Role) => role === 'Administrator' ? ['Manage users','Manage roles','Audit activity','Full system access'] : role === 'Research Manager' ? ['Create assignments','Assign members','Approve work','Manage research'] : role === 'Reviewer' ? ['Review submissions','Comment','Request changes','Approve knowledge'] : ['View assignments','Update assigned work','Add knowledge','Collaborate']
  const initialsFor = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase()
  const mapUser = (member: ApiUser): User => ({ name:member.name,email:member.email,role:member.role as Role,initials:initialsFor(member.name),rights:rightsFor(member.role as Role),mustChangePassword:member.must_change_password })
  const mapTeamMember = (member: ApiUser): TeamMember => ({...mapUser(member),id:member.id,division:member.division,active:member.active_assignments||0,completed:member.completed_assignments||0,status:member.status as TeamMember['status']})
  const navigateTo=(destination:string)=>{setActive(destination);setMenuOpen(false)}

  const loadLiveData = async (accessToken: string, profile: User) => {
    const [assignmentRows, alertRows] = await Promise.all([api.assignments(accessToken), api.alerts(accessToken)])
    setAssignmentRows(assignmentRows)
    setWorkAllocation(assignmentRows.map((item: ApiAssignment) => ({id:item.id,title:item.title,assignee:item.members[0]?.name||'Unassigned',status:item.status,division:item.division,dueDate:item.due_date||''})))
    setSystemAlerts(alertRows.filter(item=>item.status==='Published').map(item=>item.body))
    if (profile.role === 'Administrator' || profile.role === 'Research Manager') {const members=await api.users(accessToken);setTeam(members.map(mapTeamMember));setUserRows(members)}
  }

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoggingIn(true);setLoginError('')
    try{const result=await api.login(email,password);const profile=mapUser(result.user);const session={token:result.token,user:profile};localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);(rememberMe?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify(session));setToken(result.token);setUser(profile);setSessionMessage('');if(result.user.must_change_password){setCurrentPassword(password);setPasswordMode('change');setPasswordMessage('Set a private password before continuing.')}await loadLiveData(result.token,profile)}
    catch(error){setLoginError(error instanceof Error?error.message:'The PSC service could not complete your login.')}
    finally{setLoggingIn(false)}
  }

  const signOut = async () => {
    const accessToken = token
    clearSession()
    if (accessToken) try { await api.logout(accessToken) } catch { /* Local sign-out still succeeds. */ }
  }

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (newPassword !== confirmPassword) return setPasswordMessage('New passwords do not match.')
    setSavingPassword(true);setPasswordMessage('')
    try {
      const result = await api.changePassword(token, currentPassword, newPassword)
      const profile = mapUser(result.user)
      const session = { token: result.token, user: profile }
      const storage = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage
      storage.setItem(SESSION_KEY, JSON.stringify(session))
      setToken(result.token);setUser(profile);setPasswordMessage('Password changed successfully.')
      setCurrentPassword('');setNewPassword('');setConfirmPassword('')
    } catch (error) { setPasswordMessage(error instanceof Error ? error.message : 'Password could not be changed.') }
    finally { setSavingPassword(false) }
  }

  const requestReset = async () => {
    if (!email) return setPasswordMessage('Enter your official PSC email address first.')
    setSavingPassword(true);setPasswordMessage('')
    try {
      const result = await api.forgotPassword(email)
      if (result.resetToken) setResetToken(result.resetToken)
      setPasswordMessage(result.resetToken ? 'Reset request created. Enter a new password below.' : result.message)
    } catch (error) { setPasswordMessage(error instanceof Error ? error.message : 'Reset request could not be created.') }
    finally { setSavingPassword(false) }
  }

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (newPassword !== confirmPassword) return setPasswordMessage('New passwords do not match.')
    if (!resetToken) return requestReset()
    setSavingPassword(true);setPasswordMessage('')
    try {
      const result = await api.resetPassword(resetToken, newPassword)
      setPasswordMessage(result.message);setResetToken('');setNewPassword('');setConfirmPassword('')
    } catch (error) { setPasswordMessage(error instanceof Error ? error.message : 'Password could not be reset.') }
    finally { setSavingPassword(false) }
  }

  const addComment = async () => {
    if (!comment.trim() || !user || !token || !selectedAssignmentId) return
    try{await api.addComment(token,selectedAssignmentId,comment.trim())}catch(error){alert(error instanceof Error?error.message:'Comment could not be saved.');return}
    setComments([...comments, { author: user.name, text: comment.trim(), time: now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) }])
    setComment('')
  }

  const updateMemberRole = async (emailAddress: string, role: Role) => {const member=team.find(item=>item.email===emailAddress);if(!member||!token)return;try{await api.updateRole(token,member.id,role);setTeam(team.map(item=>item.email===emailAddress?{...item,role}:item))}catch(error){alert(error instanceof Error?error.message:'Role could not be updated.')}}
  const updateAllocation = async (index: number, field: 'assignee' | 'status', value: string) => {const item=workAllocation[index];if(!token)return;try{if(field==='status')await api.updateStatus(token,item.id,value);else{const member=team.find(person=>person.name===value);if(member)await api.addMember(token,item.id,member.id)}setWorkAllocation(workAllocation.map((row,itemIndex)=>itemIndex===index?{...row,[field]:value}:row))}catch(error){alert(error instanceof Error?error.message:'Assignment could not be updated.')}}
  const publishAlert = async () => {
    if (!alertText.trim()||!token) return
    try{await api.submitNotice(token,{title:'Management update',body:alertText.trim(),severity:'Important',audienceRole:null,eventStart:null,eventEnd:null});setNoticeNotice('Notice submitted for approval.')}catch(error){alert(error instanceof Error?error.message:'Notice could not be submitted.');return}
    setAlertText('')
  }
  const refreshNotifications=async()=>{setNotificationsLoading(true);try{setNotifications(await api.notifications(token))}finally{setNotificationsLoading(false)}}
  const openNotification=async(item:ApiNotification)=>{if(!item.read_at){await api.readNotification(token,item.id);await refreshNotifications()}if(item.entity_type==='knowledge')setActive('Documents');else if(item.entity_type==='assignment')setActive('Assignments');else if(item.entity_type==='notice')setActive('Notice Board')}
  const markAllNotificationsRead=async()=>{setNotificationsLoading(true);try{await api.readAllNotifications(token);setNotifications(await api.notifications(token))}finally{setNotificationsLoading(false)}}
  const clearReadNotifications=async()=>{setNotificationsLoading(true);try{await api.clearReadNotifications(token);setNotifications(await api.notifications(token))}finally{setNotificationsLoading(false)}}
  const submitNotice=async(event:React.FormEvent)=>{event.preventDefault();setNoticeNotice('');try{if(noticeForm.eventEnd&&!noticeForm.eventStart)throw new Error('Choose an event start before choosing an end.');if(noticeForm.eventStart&&noticeForm.eventEnd&&noticeForm.eventEnd<noticeForm.eventStart)throw new Error('Event end must be after the event start.');await api.submitNotice(token,{title:noticeForm.title,body:noticeForm.body,severity:noticeForm.severity,audienceRole:noticeForm.audienceRole||null,eventStart:noticeForm.eventStart?localDateTimeToIso(noticeForm.eventStart):null,eventEnd:noticeForm.eventEnd?localDateTimeToIso(noticeForm.eventEnd):null});setNoticeForm({title:'',body:'',severity:'Information',audienceRole:'',eventStart:'',eventEnd:''});setNoticeRows(await api.alerts(token));setNoticeNotice('Notice submitted successfully and is awaiting approval.')}catch(error){setNoticeNotice(error instanceof Error?error.message:'Notice could not be submitted.')}}
  const reviewNotice=async(approved:boolean)=>{if(!reviewingNotice)return;try{await api.reviewNotice(token,reviewingNotice.id,approved,noticeReason);setReviewingNotice(null);setNoticeReason('');const [alerts,notifications,calendar]=await Promise.all([api.alerts(token),api.notifications(token),api.calendar(token)]);setNoticeRows(alerts);setNotifications(notifications);setCalendarRows(calendar);setNoticeNotice(approved?'Notice approved, published and synchronized with Calendar.':'Notice returned to its author.')}catch(error){setNoticeNotice(error instanceof Error?error.message:'Notice review could not be saved.')}}
  const openAssignment = async (title: string, id?: string) => {
    setSelectedAssignment(title)
    setSelectedAssignmentId(id || null)
    if (id && token) {
      try {
        const rows = await api.comments(token, id)
        setComments(rows.map(item => ({
          author: item.author_name,
          text: item.body,
          time: new Date(item.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        })))
      } catch {
        setComments([])
      }
    }
  }

  const refreshAssignments = async () => {
    if (!token) return
    const rows = await api.assignments(token)
    setAssignmentRows(rows)
    setWorkAllocation(rows.map(item => ({id:item.id,title:item.title,assignee:item.members[0]?.name||'Unassigned',status:item.status,division:item.division,dueDate:item.due_date||''})))
  }

  const startAssignment = (assignment?: ApiAssignment) => {
    setAssignmentNotice('')
    setAssignmentEditor(assignment || 'new')
    setAssignmentForm(assignment ? {title:assignment.title,description:assignment.description,division:assignment.division,dueDate:assignment.due_date,priority:assignment.priority,memberIds:assignment.members.map(member=>member.id)} : {title:'',description:'',division:'',dueDate:null,priority:'Normal',memberIds:[]})
  }

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();if(!token)return
    setSavingAssignment(true);setAssignmentNotice('')
    try {
      if (assignmentEditor === 'new') await api.createAssignment(token, assignmentForm)
      else if (assignmentEditor) {
        await api.updateAssignment(token, assignmentEditor.id, assignmentForm)
        for (const memberId of assignmentForm.memberIds) await api.addMember(token, assignmentEditor.id, memberId)
      }
      await refreshAssignments();setAssignmentEditor(null);setAssignmentNotice('Assignment saved successfully.')
    } catch(error) { setAssignmentNotice(error instanceof Error?error.message:'Assignment could not be saved.') }
    finally { setSavingAssignment(false) }
  }

  const removeAssignment = async (assignment: ApiAssignment) => {
    if(!token||!window.confirm(`Delete “${assignment.title}”? This cannot be undone.`))return
    try { await api.deleteAssignment(token,assignment.id);await refreshAssignments();setAssignmentNotice('Assignment deleted.') }
    catch(error){setAssignmentNotice(error instanceof Error?error.message:'Assignment could not be deleted.')}
  }

  const openAssignmentDetails = async (assignment: ApiAssignment) => {
    setSelectedAssignment(assignment.title);setSelectedAssignmentId(assignment.id)
    try {
      const [commentRows,files,history]=await Promise.all([api.comments(token,assignment.id),api.attachments(token,assignment.id),api.history(token,assignment.id)])
      setComments(commentRows.map(item=>({author:item.author_name,text:item.body,time:new Date(item.created_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})})))
      setAssignmentFiles(files);setAssignmentHistory(history)
    } catch(error){setAssignmentNotice(error instanceof Error?error.message:'Assignment details could not be loaded.')}
  }

  const uploadAssignmentFile = async (file?: File) => {
    if(!file||!selectedAssignmentId||!token)return
    try { await api.uploadAttachment(token,selectedAssignmentId,file);setAssignmentFiles(await api.attachments(token,selectedAssignmentId));setAssignmentHistory(await api.history(token,selectedAssignmentId)) }
    catch(error){alert(error instanceof Error?error.message:'Attachment could not be uploaded.')}
  }

  const filteredAssignments = assignmentRows.filter(item => {
    const text=`${item.title} ${item.description} ${item.division}`.toLowerCase()
    return text.includes(assignmentSearch.toLowerCase())&&(assignmentStatus==='All'||item.status===assignmentStatus)&&(assignmentPriority==='All'||item.priority===assignmentPriority)
  })

  const uploadKnowledge=async(event:React.FormEvent)=>{event.preventDefault();if(!knowledgeFile||!token)return setKnowledgeNotice('Choose a document first.');try{const created=await api.uploadKnowledge(token,knowledgeFile,knowledgeForm);await api.submitKnowledge(token,created.id);setKnowledgeRows(await api.knowledge(token));if(canReview)await refreshReviews();setKnowledgeUploadOpen(false);setKnowledgeFile(null);setKnowledgeNotice('Document submitted for review.')}catch(error){setKnowledgeNotice(error instanceof Error?error.message:'Document could not be uploaded.')}}
  const openKnowledge=async(item:KnowledgeItem)=>{setSelectedKnowledge(item);try{setKnowledgeVersions(await api.knowledgeVersions(token,item.id))}catch(error){setKnowledgeNotice(error instanceof Error?error.message:'Versions could not be loaded.')}}
  const filteredKnowledge=knowledgeRows.filter(item=>(`${item.title} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(knowledgeSearch.toLowerCase()))&&(knowledgeCategory==='All'||item.category===knowledgeCategory))
  const saveResearch=async(event:React.FormEvent)=>{event.preventDefault();if(researchForm.startDate&&researchForm.endDate&&researchForm.endDate<researchForm.startDate){alert('Research end date must be on or after its start date.');return}await api.createResearch(token,{...researchForm,startDate:researchForm.startDate||null,endDate:researchForm.endDate||null,assignmentId:researchForm.assignmentId||null});setResearchRows(await api.research(token));setResearchOpen(false)}
  const saveAiResearch=async(event:React.FormEvent)=>{event.preventDefault();try{await api.createAiResearchJob(token,aiResearchForm);setAiResearchJobs(await api.aiResearchJobs(token));setAiResearchOpen(false);setAiResearchForm({title:'',question:'',scope:'',sourceMode:'All',depth:'Standard'});setAiResearchNotice('Research plan created with zero API cost.')}catch(error){setAiResearchNotice(error instanceof Error?error.message:'The research plan could not be created.')}}
  const startAiResearch=async(job:AiResearchJob)=>{try{setAiResearchNotice('Checking the free local research engine...');await api.startAiResearchJob(token,job.id)}catch(error){setAiResearchNotice(error instanceof Error?error.message:'The local research engine could not be started.')}}
  const refreshDocuments=async()=>setDocumentRows(await api.documents(token))
  const toggleDocumentLock=async(item:DocumentItem)=>{try{if(item.locked_by_name)await api.checkinDocument(token,item.id);else await api.checkoutDocument(token,item.id);await refreshDocuments();setDocumentNotice(item.locked_by_name?'Document checked in.':'Document checked out for two hours.')}catch(error){setDocumentNotice(error instanceof Error?error.message:'Document lock could not be changed.')}}
  const openDocumentVersions=async(item:DocumentItem)=>{setSelectedKnowledge(item);setKnowledgeVersions(await api.knowledgeVersions(token,item.id))}
  const filteredDocuments=documentRows.filter(item=>(`${item.title} ${item.description} ${item.category}`.toLowerCase().includes(documentSearch.toLowerCase()))&&(documentStatus==='All'||item.status===documentStatus))
  const refreshReviews=async()=>{if(canReview)setReviewRows(await api.documentReviews(token))}
  const reviewDocumentAction=async(approved:boolean)=>{if(!reviewDocument)return;try{await api.decideDocumentReview(token,reviewDocument.id,approved,rejectionReason);await Promise.all([refreshDocuments(),refreshReviews()]);setKnowledgeRows(await api.knowledge(token));setDocumentNotice(approved?'Document approved and published. The author has been notified.':'Document rejected and returned for correction. The author has been notified.');setReviewDocument(null);setRejectionReason('')}catch(error){setDocumentNotice(error instanceof Error?error.message:'Review could not be completed.')}}
  const assignReviewer=async(item:ReviewItem,reviewerId:string)=>{try{await api.assignDocumentReviewer(token,item.id,reviewerId);await refreshReviews();setDocumentNotice('Reviewer assigned and notified.')}catch(error){setDocumentNotice(error instanceof Error?error.message:'Reviewer could not be assigned.')}}
  const exportReportCsv=()=>{if(!report)return;const rows=[['Section','Name','Total','Completed / Approved','Rejected / Pending'],...report.assignmentStatuses.map(row=>['Assignments',row.status,row.total,'','']),...report.divisions.map(row=>['Division',row.division,row.total,row.completed,'']),...report.documentStatuses.map(row=>['Documents',row.status,row.total,'','']),...report.researchStatuses.map(row=>['Research',row.status,row.total,'','']),...report.reviewers.map(row=>['Reviewer',row.name,row.approved+row.rejected+row.pending,row.approved,`${row.rejected} rejected; ${row.pending} pending`]),...report.people.map(row=>['Person',row.name,row.assigned,row.completed,`${row.overdue} overdue; ${row.completion_rate}% completion`])];const csv=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`psc-analytics-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);setReportNotice('CSV report exported.')}
  const filteredUsers=userRows.filter(member=>(`${member.name} ${member.email} ${member.division}`.toLowerCase().includes(userSearch.toLowerCase()))&&(userRoleFilter==='All'||member.role===userRoleFilter))
  const openUserEditor=(member?:ApiUser)=>{if(member){setUserEditor(member);setUserForm({name:member.name,email:member.email,role:member.role,division:member.division,status:member.status,active:member.active,temporaryPassword:''})}else{setUserEditor('new');setUserForm({name:'',email:'',role:'Research Officer',division:'',status:'Available',active:true,temporaryPassword:''})}setTemporaryCredential('');setUserFormError('');setSavingUser(false)}
  const saveUser=async(event:React.FormEvent)=>{event.preventDefault();if(savingUser)return;setSavingUser(true);setUserFormError('');try{if(userEditor==='new'){const created=await api.createUser(token,{name:userForm.name,email:userForm.email,role:userForm.role,division:userForm.division,...(userForm.temporaryPassword?{temporaryPassword:userForm.temporaryPassword}:{})});setCreatedAccount({name:created.name,email:created.email,password:created.temporary_password});setUserNotice('Account created successfully.');setUserEditor(null)}else if(userEditor){await api.updateUser(token,userEditor.id,{name:userForm.name,email:userForm.email,role:userForm.role,division:userForm.division,status:userForm.status,active:userForm.active});setUserNotice('Account updated and audited.');setUserEditor(null)}setUserRows(await api.users(token))}catch(error){setUserFormError(error instanceof Error?error.message:'Account could not be saved.')}finally{setSavingUser(false)}}
  const resetMemberPassword=async(member:ApiUser)=>{try{const result=await api.resetUserPassword(token,member.id);setTemporaryCredential(result.temporaryPassword);setUserNotice(`${member.name}'s sessions were ended. Share the temporary password securely.`)}catch(error){setUserNotice(error instanceof Error?error.message:'Password could not be reset.')}}
  const auditLabel=(action:string)=>action.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase())
  const auditDescription=(item:AuditLog)=>{const subject=item.entity_type==='session'?'the system':`${item.entity_type} record${item.entity_id?` ${item.entity_id.slice(0,8)}`:''}`;return `${item.user_name} performed “${auditLabel(item.action)}” on ${subject}.`}
  const isSecurityAudit=(action:string)=>['LOGIN_FAILED','ROLE_CHANGED','USER_PASSWORD_RESET','USER_UPDATED','USER_CREATED','LOGOUT'].includes(action)
  const exportAuditCsv=()=>{const rows=[['Date','User','Email','Action','Module','Record','Details'],...auditRows.map(item=>[new Date(item.created_at).toISOString(),item.user_name,item.user_email||'',auditLabel(item.action),item.entity_type,item.entity_id||'',JSON.stringify(item.details)])];const csv=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`psc-audit-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);setAuditNotice('Filtered audit records exported to CSV.')}
  const saveSystemSettings=async(event:React.FormEvent)=>{event.preventDefault();setSavingSettings(true);setSettingsNotice('');try{await api.updateSystemSettings(token,{...systemForm,documentCategories:systemForm.documentCategories.split(',').map(value=>value.trim()).filter(Boolean)});setSettingsData(await api.settings(token));setSettingsNotice('System settings saved and recorded in the audit log. Runtime limits take effect after service restart.')}catch(error){setSettingsNotice(error instanceof Error?error.message:'System settings could not be saved.')}finally{setSavingSettings(false)}}
  const savePreferences=async(event:React.FormEvent)=>{event.preventDefault();setSavingSettings(true);setSettingsNotice('');try{await api.updatePreferences(token,preferenceForm);setSettingsData(await api.settings(token));setSettingsNotice('Your preferences were saved.')}catch(error){setSettingsNotice(error instanceof Error?error.message:'Preferences could not be saved.')}finally{setSavingSettings(false)}}
  const checkUpdates=async()=>{setCheckingUpdates(true);setSettingsNotice('');try{setUpdateStatus(await api.settingsUpdateStatus(token));setSettingsNotice('Installed components checked successfully. No update was downloaded or installed.')}catch(error){setSettingsNotice(error instanceof Error?error.message:'Update status could not be checked.')}finally{setCheckingUpdates(false)}}
  const sendTestEmail=async()=>{if(!user)return;setTestingEmail(true);setSettingsNotice('');try{const result=await api.sendTestEmail(token,user.email);setSettingsNotice(result.message)}catch(error){setSettingsNotice(error instanceof Error?error.message:'Test email could not be sent.')}finally{setTestingEmail(false)}}

  if (authLoading) return <div className="auth-loading"><div className="login-spinner" /><strong>Restoring your secure session…</strong></div>

  if (!user) {
    return <div className="login-page">
      <div className="login-glow one" /><div className="login-glow two" />
      <section className="login-brand">
        <div className="dual-logos"><img src="/psc-logo.png" alt="Public Service Commission logo" /><img src="/gok-logo.png" alt="Government of Kenya coat of arms" /></div>
        <p className="login-kicker">PUBLIC SERVICE COMMISSION · KENYA</p>
        <h1>Research Department</h1>
        <h2>Assignment & Knowledge Management System</h2>
        <p>Collaborate on assignments, preserve institutional knowledge and turn research into better public service.</p>
        <div className="login-values"><span>HONOUR</span><i /><span>COMMITMENT</span><i /><span>TRUST</span></div>
      </section>
      <section className="login-card">
        <div className="login-time">{now.toLocaleDateString('en-KE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · {now.toLocaleTimeString('en-KE')}</div>
        <p className="login-kicker">MEMBER ACCESS</p><h2>Welcome back</h2><p>Sign in using your official PSC email address.</p>
        <form onSubmit={signIn}>
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@publicservice.go.ke" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required /></label>
          <div className="form-options"><label><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Remember me</label><button type="button" onClick={() => {setPasswordMode('forgot');setPasswordMessage('');setResetToken('')}}>Forgot password?</button></div>
          {sessionMessage && <div className="session-message" role="status">{sessionMessage}</div>}
          {loginError && <div className="login-error" role="alert"><strong>Login unsuccessful</strong>{loginError}</div>}
          <button className="sign-in" type="submit" disabled={loggingIn}>{loggingIn?'Connecting securely…':'Sign in securely'} {!loggingIn&&<Icon name="arrow" />}</button>
        </form>
        <div className="demo-accounts"><strong>Test profiles</strong>{demoUsers.map(member => <button key={member.email} onClick={() => { setEmail(member.email); setPassword('PSC@2026') }}><span>{member.initials}</span><div>{member.name}<small>{member.role}</small></div></button>)}<p>Password for testing: <b>PSC@2026</b></p></div>
      </section>
      {passwordMode === 'forgot' && <div className="modal-backdrop" onClick={() => setPasswordMode(null)}>
        <section className="profile-modal password-modal" onClick={event => event.stopPropagation()}>
          <button className="close" onClick={() => setPasswordMode(null)}>×</button>
          <h2>Reset password</h2>
          <p>Request a secure, single-use reset for your official PSC account.</p>
          <form onSubmit={resetPassword}>
            <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
            {resetToken && <>
              <label>New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={10} required /></label>
              <label>Confirm new password<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={10} required /></label>
            </>}
            {passwordMessage && <div className="session-message" role="status">{passwordMessage}</div>}
            {!resetToken
              ? <button className="sign-in" type="button" disabled={savingPassword} onClick={requestReset}>{savingPassword ? 'Preparing reset…' : 'Request password reset'}</button>
              : <button className="sign-in" type="submit" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Set new password'}</button>}
          </form>
        </section>
      </div>}
    </div>
  }

  return (
    <div className={`dashboard-shell ${preferenceForm.compactLayout?'compact-layout':''}`}>
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <img src="/psc-logo.png" alt="Public Service Commission logo" />
          <div><strong>PUBLIC SERVICE COMMISSION</strong><span>KENYA</span><small>HONOUR · COMMITMENT · TRUST</small></div>
        </div>
        <nav aria-label="Main navigation">
          {navItems.filter(([, label]) => roleNavigation[user.role].includes(label)).map(([icon, label]) => (
            <button key={label} title={navigationDescriptions[label]} data-tooltip={navigationDescriptions[label]} className={active === label ? 'active' : ''} onClick={() => navigateTo(label)}>
              <Icon name={icon} /><span>{label}</span>{label === 'Notifications' && notifications.filter(item=>!item.read_at).length>0&&<b>{notifications.filter(item=>!item.read_at).length}</b>}
            </button>
          ))}
        </nav>
        <section className="quick-access">
          <h3>Quick Access</h3>
          {([['plus', 'Create Assignment'], ['upload', 'Upload Document'], ['knowledge', 'Add Knowledge'], ['documents', 'New Research']] as [IconName, string][]).filter(([,label]) => label !== 'Create Assignment' || isManager).map(([icon, label]) =>
            <button key={label} title={label==='Create Assignment'?'Open the assignment form and allocate work to staff.':label==='Upload Document'?'Open Documents and select a file for controlled review.':label==='Add Knowledge'?'Open the knowledge upload form for a new institutional record.':'Open the form for a new research project.'} onClick={() => {if(label==='Create Assignment'){setActive('Assignments');startAssignment()}else if(label==='Upload Document'){setActive('Documents');setKnowledgeUploadOpen(true)}else if(label==='Add Knowledge'){setActive('Knowledge Repository');setKnowledgeUploadOpen(true)}else if(label==='New Research'){setActive('Research Repository');setResearchOpen(true)}setMenuOpen(false)}}><Icon name={icon} />{label}</button>
          )}
        </section>
      </aside>

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Icon name="menu" /></button>
          <div className="title">
            <h1>RESEARCH DEPARTMENT</h1>
            <p>ASSIGNMENT & KNOWLEDGE MANAGEMENT SYSTEM</p>
          </div>
          <div className="header-actions">
            <div className="live-time"><span>{now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</span><strong>{now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></div>
            <label className="header-search"><Icon name="search" /><input aria-label="Search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" /></label>
            <button className="notification-button" aria-label="Notifications" data-tooltip="Open notifications about document assignments, approvals, rejections and other system activity." onClick={()=>setActive('Notifications')}><Icon name="bell" />{notifications.filter(item=>!item.read_at).length>0&&<b>{notifications.filter(item=>!item.read_at).length}</b>}</button>
            <button className="user" title="Open your profile menu to review access rights, change your password or sign out." onClick={() => setActive('Profile')}><span className="user-icon">{user.initials}</span><div><strong>{user.name}</strong><small>{user.role}</small></div><span>⌄</span></button>
          </div>
        </header>

        <div className={`dashboard-content ${active === 'Assignments' ? 'assignments-active' : active==='Knowledge Repository'?'knowledge-active':active==='Research Repository'?'research-active':active==='AI Researcher'?'ai-research-active':active==='Documents'?'documents-active':active==='Notifications'?'notifications-active':active==='Notice Board'?'notice-board-active':active==='Calendar'?'calendar-active':active==='Reports & Analytics'?'reports-active':active==='Team & Users'?'users-active':active==='Audit Logs'?'audit-active':active==='Settings'?'settings-active':''}`}>
          <section className="settings-management-view">
            <div className="assignment-page-head"><div><p>SETTINGS</p><h2>System configuration and preferences</h2><span>Administrator controls are separated from your personal notification and display preferences.</span></div></div>
            {settingsNotice&&<div className="session-message">{settingsNotice}</div>}
            <div className="settings-tabs" role="tablist">{(['General','Themes','Email Notifications','Maintenance','Updates'] as const).filter(tab=>!['Maintenance','Updates'].includes(tab)||user?.role==='Administrator').map(tab=><button role="tab" title={navigationDescriptions[tab]} data-tooltip={navigationDescriptions[tab]} aria-selected={settingsTab===tab} className={settingsTab===tab?'active':''} key={tab} onClick={()=>setSettingsTab(tab)}>{tab}</button>)}</div>
            {settingsData&&<>
              {settingsTab==='Email Notifications'&&user?.role==='Administrator'&&<div className={`email-delivery-banner ${emailDelivery?.ready?'ready':'pending'}`}><div><strong>{emailDelivery?.ready?'SMTP delivery ready':'SMTP delivery not yet active'}</strong><span>{emailDelivery?.ready?`${emailDelivery.host}:${emailDelivery.port} · ${emailDelivery.from}`:'Add approved SMTP credentials to backend/.env, install nodemailer, and restart the backend.'}</span></div><button type="button" disabled={!emailDelivery?.ready||testingEmail} onClick={sendTestEmail}>{testingEmail?'Sending...':'Send test email to me'}</button></div>}
              {settingsTab==='Email Notifications'&&<div className="settings-grid email-notification-settings">{user?.role==='Administrator'&&<form className="settings-panel" onSubmit={saveSystemSettings}><header><div><p>ADMINISTRATOR</p><h3>Email delivery policy</h3></div><span data-tooltip="This master switch controls workflow email. Delivery also requires an approved mail service.">System-wide</span></header><div className={`maintenance-status ${systemForm.emailNotifications?'normal':'enabled'}`}><strong>{systemForm.emailNotifications?'Email notifications allowed':'Email notifications disabled'}</strong><span>{systemForm.emailNotifications?'Workflow emails may be delivered after the mail service is configured.':'App2 will continue creating in-app notifications only.'}</span></div><label className="setting-toggle"><input type="checkbox" checked={systemForm.emailNotifications} onChange={event=>setSystemForm({...systemForm,emailNotifications:event.target.checked})}/><span><strong>Enable system email notifications</strong><small>Allow assignment, review, approval, rejection and security workflows to generate email notices.</small></span></label><label>Reply and support address<input type="email" value={systemForm.supportEmail} onChange={event=>setSystemForm({...systemForm,supportEmail:event.target.value})} required/></label><button className="settings-save" disabled={savingSettings}>{savingSettings?'Saving...':'Save email policy'}</button></form>}<form className="settings-panel" onSubmit={savePreferences}><header><div><p>PERSONAL</p><h3>My notification channels</h3></div><span data-tooltip="Your personal choice cannot override a system-wide email shutdown.">Your account</span></header><label className="setting-toggle"><input type="checkbox" checked={preferenceForm.emailNotifications} onChange={event=>setPreferenceForm({...preferenceForm,emailNotifications:event.target.checked})}/><span><strong>Email notifications</strong><small>Send important workflow updates to {user.email} when system email delivery is available.</small></span></label><label className="setting-toggle"><input type="checkbox" checked={preferenceForm.inAppNotifications} onChange={event=>setPreferenceForm({...preferenceForm,inAppNotifications:event.target.checked})}/><span><strong>In-app notifications</strong><small>Keep a notification copy inside App2 for assignments, reviews and decisions.</small></span></label><div className="email-event-list"><strong>Email events</strong><ul><li>New assignment or reassignment</li><li>Upcoming due date and overdue work</li><li>Document review request</li><li>Approval, rejection or correction request</li><li>Password and account security notice</li></ul></div><button className="settings-save" disabled={savingSettings}>{savingSettings?'Saving...':'Save notification preferences'}</button></form></div>}
              {settingsTab==='General'&&<div className="settings-grid">{user?.role==='Administrator'&&<form className="settings-panel system-settings" onSubmit={saveSystemSettings}><header><div><p>ADMINISTRATOR</p><h3>Organization defaults</h3></div><span data-tooltip="Shared labels and document classifications used throughout App2.">Application scope</span></header><div className="form-pair"><label>Organization name<input value={systemForm.organizationName} onChange={event=>setSystemForm({...systemForm,organizationName:event.target.value})} required minLength={3}/></label><label>Department name<input value={systemForm.departmentName} onChange={event=>setSystemForm({...systemForm,departmentName:event.target.value})} required minLength={3}/></label></div><label>Support email<input type="email" value={systemForm.supportEmail} onChange={event=>setSystemForm({...systemForm,supportEmail:event.target.value})} required/></label><label>Document categories<textarea value={systemForm.documentCategories} onChange={event=>setSystemForm({...systemForm,documentCategories:event.target.value})}/></label><label className="setting-toggle"><input type="checkbox" checked={systemForm.emailNotifications} onChange={event=>setSystemForm({...systemForm,emailNotifications:event.target.checked})}/><span><strong>System email notifications</strong><small>Allow workflows to generate email notices when a mail service is connected.</small></span></label><button className="settings-save" disabled={savingSettings}>{savingSettings?'Saving…':'Save general settings'}</button></form>}<form className="settings-panel preference-settings" onSubmit={savePreferences}><header><div><p>PERSONAL</p><h3>Notifications and security</h3></div><span data-tooltip="These choices apply only to your account.">Personal scope</span></header><label className="setting-toggle"><input type="checkbox" checked={preferenceForm.inAppNotifications} onChange={event=>setPreferenceForm({...preferenceForm,inAppNotifications:event.target.checked})}/><span><strong>In-app notifications</strong><small>Show assignments, decisions and system activity in your inbox.</small></span></label><label className="setting-toggle"><input type="checkbox" checked={preferenceForm.emailNotifications} onChange={event=>setPreferenceForm({...preferenceForm,emailNotifications:event.target.checked})}/><span><strong>Email notifications</strong><small>Receive email updates when the mail service is configured.</small></span></label><button className="settings-save" disabled={savingSettings}>{savingSettings?'Saving…':'Save my preferences'}</button><div className="settings-account"><h4>Account security</h4><p>Change your password regularly and sign out from shared devices.</p><button type="button" onClick={()=>setPasswordMode('change')}>Change my password</button></div></form></div>}
              {settingsTab==='Themes'&&<form className="settings-panel theme-settings" onSubmit={savePreferences}><header><div><p>APPEARANCE</p><h3>Theme and display</h3></div><span data-tooltip="Preview changes immediately, then save them to your account.">Personal scope</span></header><h4>Colour theme</h4><div className="theme-options">{(['Dark','Light','System'] as const).map(theme=><button type="button" className={preferenceForm.themeMode===theme?'selected':''} onClick={()=>setPreferenceForm({...preferenceForm,themeMode:theme})} key={theme}><i className={`theme-preview ${theme.toLowerCase()}`}/><strong>{theme}</strong><small>{theme==='System'?'Follow this device':`${theme} dashboard`}</small></button>)}</div><h4>Accent colour</h4><div className="accent-options">{(['Gold','Blue','Green'] as const).map(accent=><button type="button" className={preferenceForm.accentColor===accent?'selected':''} onClick={()=>setPreferenceForm({...preferenceForm,accentColor:accent})} key={accent}><i className={accent.toLowerCase()}/><span>{accent}</span></button>)}</div><label className="setting-toggle"><input type="checkbox" checked={preferenceForm.compactLayout} onChange={event=>setPreferenceForm({...preferenceForm,compactLayout:event.target.checked})}/><span><strong>Compact layout</strong><small>Use denser tables and shorter spacing on supported screens.</small></span></label><button className="settings-save" disabled={savingSettings}>{savingSettings?'Saving…':'Save theme'}</button></form>}
              {settingsTab==='Maintenance'&&user?.role==='Administrator'&&<><div className="settings-health"><article><span>API service</span><strong className="healthy">{settingsData.health.api}</strong></article><article><span>PostgreSQL</span><strong className="healthy">{settingsData.health.database}</strong></article><article><span>Environment</span><strong>{settingsData.health.environment}</strong></article><article><span>Configured session</span><strong>{settingsData.health.configured_session}</strong></article><article><span>Runtime upload limit</span><strong>{settingsData.health.configured_upload_limit_mb} MB</strong></article><article><span>Database time</span><strong>{new Date(settingsData.health.database_time).toLocaleString('en-KE')}</strong></article></div><form className="settings-panel maintenance-settings" onSubmit={saveSystemSettings}><header><div><p>ADMINISTRATOR</p><h3>Maintenance and operational limits</h3></div><span data-tooltip="Use maintenance mode only during an approved service window. Runtime limits require a backend restart.">Restricted controls</span></header><div className={`maintenance-status ${systemForm.maintenanceMode?'enabled':'normal'}`}><strong>{systemForm.maintenanceMode?'Maintenance mode prepared':'System operating normally'}</strong><span>{systemForm.maintenanceMode?'Save to record the planned maintenance state.':'Users can access all available services.'}</span></div><label className="setting-toggle maintenance"><input type="checkbox" checked={systemForm.maintenanceMode} onChange={event=>setSystemForm({...systemForm,maintenanceMode:event.target.checked})}/><span><strong>Maintenance mode</strong><small>Record App2 as undergoing planned maintenance. Existing administrators retain access.</small></span></label><div className="form-triple"><label>Session minutes<input type="number" min={15} max={1440} value={systemForm.sessionMinutes} onChange={event=>setSystemForm({...systemForm,sessionMinutes:Number(event.target.value)})}/></label><label>Upload limit (MB)<input type="number" min={1} max={500} value={systemForm.maxUploadMb} onChange={event=>setSystemForm({...systemForm,maxUploadMb:Number(event.target.value)})}/></label><label>Retention days<input type="number" min={30} max={7300} value={systemForm.defaultRetentionDays} onChange={event=>setSystemForm({...systemForm,defaultRetentionDays:Number(event.target.value)})}/></label></div><button className="settings-save" disabled={savingSettings}>{savingSettings?'Saving…':'Save maintenance settings'}</button></form></>}
              {settingsTab==='Updates'&&user?.role==='Administrator'&&<section className="settings-panel update-settings"><header><div><p>ADMINISTRATOR</p><h3>Application updates</h3></div><span data-tooltip="This check reads installed component versions only. It never downloads or installs software.">Safe check</span></header><div className="update-banner"><div><strong>{updateStatus?.status||'Ready to check installed components'}</strong><span>Updates remain manual and require administrator approval.</span></div><button type="button" onClick={checkUpdates} disabled={checkingUpdates}>{checkingUpdates?'Checking…':'Check for updates'}</button></div>{updateStatus&&<div className="update-details"><article><span>Application</span><strong>{updateStatus.application} {updateStatus.applicationVersion}</strong></article><article><span>API</span><strong>Version {updateStatus.apiVersion}</strong></article><article><span>Runtime</span><strong>Node {updateStatus.runtime}</strong></article><article><span>Database</span><strong>{updateStatus.databaseVersion}</strong></article><article><span>Update channel</span><strong>{updateStatus.updateChannel}</strong></article><article><span>Last checked</span><strong>{new Date(updateStatus.checkedAt).toLocaleString('en-KE')}</strong></article></div>}<div className="update-policy"><strong>Update policy</strong><ul><li>No automatic downloads or installations.</li><li>Back up App2 and PostgreSQL before applying an update.</li><li>Test updates locally before publishing them to staff.</li><li>Record production updates in the audit and maintenance log.</li></ul></div></section>}
            </>}
          </section>
          <section className="audit-management-view">
            <div className="assignment-page-head"><div><p>AUDIT LOGS</p><h2>System accountability record</h2><span>Read-only evidence of security events and changes across every module.</span></div><div className="audit-export"><button data-tooltip="Download the currently filtered audit records as a CSV file." onClick={exportAuditCsv}>Export CSV</button><button data-tooltip="Open the print dialog. Select Save as PDF to create a protected report copy." onClick={()=>window.print()}>Print / PDF</button></div></div>
            <div className="audit-summary"><article><span>Matching events</span><strong>{auditTotal}</strong></article><article><span>Security-sensitive</span><strong>{auditRows.filter(item=>isSecurityAudit(item.action)).length}</strong></article><article><span>Displayed</span><strong>{auditRows.length}</strong></article></div>
            <div className="audit-filters"><label className="audit-search"><Icon name="search"/><input value={auditFilters.search} onChange={event=>setAuditFilters({...auditFilters,search:event.target.value})} placeholder="Search user, action, module or details"/></label><select aria-label="Audit user" value={auditFilters.userId} onChange={event=>setAuditFilters({...auditFilters,userId:event.target.value})}><option value="">All users</option>{userRows.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select><select aria-label="Audit action" value={auditFilters.action} onChange={event=>setAuditFilters({...auditFilters,action:event.target.value})}><option value="">All actions</option>{auditActions.map(value=><option key={value}>{value}</option>)}</select><select aria-label="Audit module" value={auditFilters.entityType} onChange={event=>setAuditFilters({...auditFilters,entityType:event.target.value})}><option value="">All modules</option>{auditEntityTypes.map(value=><option key={value}>{value}</option>)}</select><input aria-label="Audit from date" type="date" value={auditFilters.from} onChange={event=>setAuditFilters({...auditFilters,from:event.target.value})}/><input aria-label="Audit to date" type="date" value={auditFilters.to} onChange={event=>setAuditFilters({...auditFilters,to:event.target.value})}/><button onClick={()=>setAuditFilters({search:'',userId:'',action:'',entityType:'',from:'',to:''})}>Clear</button></div>
            {auditNotice&&<div className="session-message">{auditNotice}</div>}
            <div className="audit-list"><div className="audit-list-head"><span>Time</span><span>Activity</span><span>User</span><span>Module</span><span>Record</span><span>Details</span></div>{auditRows.map(item=><article className={isSecurityAudit(item.action)?'security-event':''} key={item.id}><time>{new Date(item.created_at).toLocaleString('en-KE')}</time><div><strong>{auditLabel(item.action)}</strong><small>{auditDescription(item)}</small></div><div><strong>{item.user_name}</strong><small>{item.user_email||'No account email'}</small></div><span>{item.entity_type}</span><code>{item.entity_id?.slice(0,12)||'—'}</code><button onClick={()=>setSelectedAudit(item)}>Inspect</button></article>)}</div>
            {!auditRows.length&&<div className="assignment-empty"><Icon name="audit"/><h3>No audit records match</h3><p>Clear the filters or choose a broader date range.</p></div>}
          </section>
          <section className="user-management-view">
            <div className="assignment-page-head"><div><p>USER & ROLE MANAGEMENT</p><h2>People, access and workload</h2><span>Manage active accounts, organizational roles, divisions and secure access.</span></div>{user?.role==='Administrator'&&<button onClick={()=>openUserEditor()}>+ Create account</button>}</div>
            {!isManager?<div className="assignment-empty"><Icon name="team"/><h3>Staff directory access only</h3><p>Account and role management is restricted to administrators and research managers.</p></div>:<><div className="assignment-toolbar"><label><Icon name="search"/><input value={userSearch} onChange={event=>setUserSearch(event.target.value)} placeholder="Search name, email or division"/></label><select value={userRoleFilter} onChange={event=>setUserRoleFilter(event.target.value)}>{['All','Administrator','Research Manager','Research Officer','Reviewer'].map(value=><option key={value}>{value}</option>)}</select><span>{filteredUsers.length} people</span></div>{userNotice&&<div className="session-message">{userNotice}</div>}{temporaryCredential&&<div className="temporary-credential"><div><strong>Temporary password</strong><span>{temporaryCredential}</span><small>Copy it now and share it through an approved secure channel. It is not stored in readable form.</small></div><button onClick={()=>navigator.clipboard.writeText(temporaryCredential)}>Copy password</button><button onClick={()=>setTemporaryCredential('')}>Dismiss</button></div>}<div className="user-table"><div className="user-table-head"><span>Member</span><span>Role & division</span><span>Workload</span><span>Availability</span><span>Account</span><span>Actions</span></div>{filteredUsers.map(member=><article key={member.id}><div className="managed-user"><b>{initialsFor(member.name)}</b><span><strong>{member.name}</strong><small>{member.email}</small></span></div><div><strong>{member.role}</strong><small>{member.division}</small></div><div><strong>{member.active_assignments||0} active</strong><small>{member.completed_assignments||0} completed</small></div><span>{member.status}</span><b className={member.active?'account-active':'account-disabled'}>{member.active?'Active':'Disabled'}</b><div className="user-actions">{user?.role==='Administrator'?<><button data-tooltip="Edit the member’s identity, role, division, availability and account status." onClick={()=>openUserEditor(member)}>Edit</button><button data-tooltip="Create a temporary password and immediately end all existing sessions for this account." onClick={()=>resetMemberPassword(member)}>Reset password</button></>:<span>View only</span>}</div></article>)}</div><section className="permission-matrix"><header><div><p>ROLE PERMISSIONS</p><h3>System access matrix</h3></div><span data-tooltip="Permissions are enforced by the backend API. This table is a readable summary for administrators.">How access is enforced</span></header><div className="matrix-table"><div><b>Capability</b><b>Administrator</b><b>Research Manager</b><b>Reviewer</b><b>Research Officer</b></div>{[['Manage accounts','✓','View','—','—'],['Create assignments','✓','✓','—','—'],['Approve documents','✓','✓','✓','—'],['Manage research','✓','✓','Review','Assigned'],['Reports & analytics','✓','✓','—','—'],['Audit logs','✓','—','—','—']].map(row=><div key={row[0]}>{row.map((cell,index)=><span key={`${row[0]}-${index}`}>{cell}</span>)}</div>)}</div></section></>}
          </section>
          <section className="reports-management-view">
            <div className="assignment-page-head"><div><p>REPORTS & ANALYTICS</p><h2>Department performance overview</h2><span>Live assignment, document, research and reviewer performance from PostgreSQL.</span></div><div className="report-export"><button data-tooltip="Download the currently filtered report as a spreadsheet-compatible CSV file." onClick={exportReportCsv}>Export CSV</button><button data-tooltip="Open the browser print dialog. Choose Save as PDF to create a PDF report." onClick={()=>window.print()}>Print / PDF</button></div></div>
            <div className="report-filters"><label>From<input type="date" value={reportFilters.from} onChange={event=>setReportFilters({...reportFilters,from:event.target.value})}/></label><label>To<input type="date" value={reportFilters.to} onChange={event=>setReportFilters({...reportFilters,to:event.target.value})}/></label><label>Division<select value={reportFilters.division} onChange={event=>setReportFilters({...reportFilters,division:event.target.value})}><option value="">All divisions</option>{[...new Set(assignmentRows.map(item=>item.division))].map(value=><option key={value}>{value}</option>)}</select></label><label>Assignment status<select value={reportFilters.status} onChange={event=>setReportFilters({...reportFilters,status:event.target.value})}><option value="">All statuses</option>{['Not Started','In Progress','Ready for Review','Completed','Overdue'].map(value=><option key={value}>{value}</option>)}</select></label><button onClick={()=>setReportFilters({from:'',to:'',division:'',status:''})}>Clear filters</button></div>
            {reportNotice&&<div className="session-message">{reportNotice}</div>}
            {report&&<><div className="report-kpis"><article><span>Total assignments</span><strong>{report.summary.total}</strong></article><article><span>Completion rate</span><strong>{report.summary.completion_rate}%</strong></article><article><span>Overdue</span><strong>{report.summary.overdue}</strong></article><article><span>Pending reviews</span><strong>{report.summary.pending_reviews}</strong></article><article><span>Published documents</span><strong>{report.summary.published_documents}</strong></article><article><span>Active research</span><strong>{report.summary.active_research}</strong></article></div>
            <div className="report-grid"><article className="report-panel"><header><h3>Assignment status</h3><span data-tooltip="Shows how the filtered assignments are distributed across each workflow stage.">What this means</span></header>{report.assignmentStatuses.map(row=><div className="metric-row" key={row.status}><span>{row.status}</span><i><b style={{width:`${Math.max(4,row.total/Math.max(1,report.summary.total)*100)}%`}}/></i><strong>{row.total}</strong></div>)}</article><article className="report-panel"><header><h3>Six-month trend</h3><span data-tooltip="Created shows new assignments opened each month; completed shows assignments whose current status is Completed.">How to read</span></header><div className="trend-chart">{report.trends.map(row=><div key={row.month}><span><i style={{height:`${Math.max(8,row.created*14)}px`}}/><i className="completed" style={{height:`${Math.max(5,row.completed*14)}px`}}/></span><small>{row.month.split(' ')[0]}</small><b>{row.created}/{row.completed}</b></div>)}</div></article><article className="report-panel"><header><h3>Documents</h3><span data-tooltip="Tracks documents at every stage, including items waiting for approval, published records and rejected submissions.">Status guide</span></header>{report.documentStatuses.map(row=><div className="simple-metric" key={row.status}><span>{row.status}</span><strong>{row.total}</strong></div>)}</article><article className="report-panel"><header><h3>Research portfolio</h3><span data-tooltip="Shows live research projects grouped by their current lifecycle status.">Status guide</span></header>{report.researchStatuses.map(row=><div className="simple-metric" key={row.status}><span>{row.status}</span><strong>{row.total}</strong></div>)}</article></div>
            <div className="report-panel reviewer-report"><header><h3>Reviewer performance and workload</h3><span data-tooltip="Approved and rejected count recorded decisions in the selected period. Pending is the reviewer’s current assigned queue.">Metric definitions</span></header><div className="reviewer-table"><div><b>Reviewer</b><b>Approved</b><b>Rejected</b><b>Pending</b></div>{report.reviewers.map(row=><div key={row.id}><strong>{row.name}</strong><span>{row.approved}</span><span>{row.rejected}</span><span>{row.pending}</span></div>)}</div></div>
            <div className="report-panel people-performance"><header><h3>Performance per person</h3><span data-tooltip="Completion percentage is completed assignments divided by assignments allocated to the person. Overdue includes work marked Overdue or past its due date.">How performance is calculated</span></header><div className="people-chart">{report.people.map(person=><article key={person.id}><div><strong>{person.name}</strong><small>{person.role} · {person.division}</small></div><div className="person-bar"><i><b style={{width:`${person.completion_rate}%`}}/></i><strong>{person.completion_rate}%</strong></div><dl><div><dt>Assigned</dt><dd>{person.assigned}</dd></div><div><dt>Completed</dt><dd>{person.completed}</dd></div><div className={person.overdue?'has-overdue':''}><dt>Overdue</dt><dd>{person.overdue}</dd></div></dl></article>)}</div></div>
            <div className="report-panel division-report"><header><h3>Performance by division</h3><span data-tooltip="Compares total assignments created by each division with how many are currently completed.">Metric definitions</span></header>{report.divisions.map(row=><div className="metric-row" key={row.division}><span>{row.division}</span><i><b style={{width:`${Math.max(4,row.completed/Math.max(1,row.total)*100)}%`}}/></i><strong>{row.completed}/{row.total}</strong></div>)}</div></>}
          </section>
          <section className="notice-board-view">
            <div className="assignment-page-head"><div><p>NOTICE BOARD</p><h2>Approved public information</h2><span>Every member may submit information. Administrators and Research Managers review it before publication.</span></div></div>
            {noticeNotice&&<div className="session-message">{noticeNotice}</div>}
            <NoticeComposer form={noticeForm} setForm={setNoticeForm} onSubmit={submitNotice}/>
            <div className="notice-board-grid"><form className="notice-composer" onSubmit={submitNotice}><h3>Submit a public notice</h3><label>Title<input value={noticeForm.title} onChange={event=>setNoticeForm({...noticeForm,title:event.target.value})} minLength={3} maxLength={200} required/></label><label>Information<textarea value={noticeForm.body} onChange={event=>setNoticeForm({...noticeForm,body:event.target.value})} minLength={3} maxLength={4000} required/></label><div className="form-pair"><label>Importance<select value={noticeForm.severity} onChange={event=>setNoticeForm({...noticeForm,severity:event.target.value})}><option>Information</option><option>Important</option><option>Urgent</option></select></label><label>Audience<select value={noticeForm.audienceRole} onChange={event=>setNoticeForm({...noticeForm,audienceRole:event.target.value})}><option value="">All members</option>{['Administrator','Research Manager','Research Officer','Reviewer'].map(role=><option key={role}>{role}</option>)}</select></label></div><div className="form-pair"><label>Event starts (optional)<input type="datetime-local" value={noticeForm.eventStart} onChange={event=>setNoticeForm({...noticeForm,eventStart:event.target.value})}/></label><label>Event ends (optional)<input type="datetime-local" value={noticeForm.eventEnd} min={noticeForm.eventStart} onChange={event=>setNoticeForm({...noticeForm,eventEnd:event.target.value})}/></label></div><button className="settings-save">Submit for approval</button></form><div className="notice-list"><h3>Published notices</h3>{noticeRows.filter(item=>item.status==='Published').map(item=><article className={item.severity.toLowerCase()} key={item.id}><header><b>{item.severity}</b><time>{new Date(item.created_at).toLocaleString('en-KE')}</time></header><h4>{item.title}</h4><p>{item.body}</p><small>Posted by {item.created_by_name}{item.event_start?` · Event ${new Date(item.event_start).toLocaleString('en-KE')}`:''}</small></article>)}{!noticeRows.some(item=>item.status==='Published')&&<p className="queue-empty">No approved notices are currently published.</p>}</div></div>
            {isManager&&<section className="notice-approval"><h3>Approval queue</h3>{noticeRows.filter(item=>item.status==='Pending Approval').map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.created_by_name} · {item.severity}</small><p>{item.body}</p></div><button onClick={()=>{setReviewingNotice(item);setNoticeReason('')}}>Review</button></article>)}{!noticeRows.some(item=>item.status==='Pending Approval')&&<p className="queue-empty">No notices are awaiting approval.</p>}</section>}
          </section>
          <section className="calendar-management-view">
            <div className="assignment-page-head"><div><p>CALENDAR</p><h2>Deadlines and approved events</h2><span>Live assignment due dates and dated Notice Board posts visible to your role.</span></div></div>
            <CalendarView items={calendarRows}/>
          </section>
          <section className="notification-management-view">
            <div className="assignment-page-head"><div><p>NOTIFICATIONS</p><h2>My activity inbox</h2><span>Review assignments, approval decisions and required corrections appear here.</span></div><b>{notifications.filter(item=>!item.read_at).length} unread</b></div>
            <NotificationCenter items={notifications} loading={notificationsLoading} onOpen={openNotification} onMarkAll={markAllNotificationsRead} onClearRead={clearReadNotifications} onRefresh={refreshNotifications}/>
            <div className="notification-list">{notifications.map(item=><button className={item.read_at?'read':'unread'} key={item.id} onClick={async()=>{if(!item.read_at){await api.readNotification(token,item.id);setNotifications(await api.notifications(token))}if(item.entity_type==='knowledge')setActive('Documents');else if(item.entity_type==='assignment')setActive('Assignments');else if(item.entity_type==='notice')setActive('Notice Board')}}><Icon name="notifications"/><span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString('en-KE')}</time></span></button>)}{!notifications.length&&<div className="assignment-empty"><Icon name="notifications"/><h3>No notifications yet</h3><p>Assignments, review decisions and Notice Board activity will appear here.</p></div>}</div>
          </section>
          <section className="document-management-view">
            <div className="assignment-page-head"><div><p>DOCUMENT MANAGEMENT</p><h2>Controlled document library</h2><span>Secure versions, editing locks, retention, archival and linked institutional records.</span></div><button onClick={()=>setKnowledgeUploadOpen(true)}>+ Upload document</button></div>
            <div className="assignment-toolbar"><label><Icon name="search"/><input value={documentSearch} onChange={event=>setDocumentSearch(event.target.value)} placeholder="Search title, description or category"/></label><select value={documentStatus} onChange={event=>setDocumentStatus(event.target.value)}>{['All','Draft','Pending Approval','Published','Rejected','Archived'].map(value=><option key={value}>{value}</option>)}</select><span>{filteredDocuments.length} documents</span></div>
            {documentNotice&&<div className="session-message">{documentNotice}</div>}
            {canReview&&<section className="review-queue"><header><div><p>REVIEW QUEUE</p><h3>{reviewRows.length} document{reviewRows.length===1?'':'s'} awaiting a decision</h3></div><span data-tooltip="Step 1: open Versions and inspect the latest file. Step 2: assign a reviewer when required. Step 3: approve for publication or reject with clear correction notes.">How review works</span></header>{reviewRows.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.category} · Submitted by {item.created_by_name}</small></div>{isManager?<select aria-label={`Reviewer for ${item.title}`} value={item.reviewer_id||''} onChange={event=>assignReviewer(item,event.target.value)}><option value="">Unassigned</option>{reviewers.map(reviewer=><option key={reviewer.id} value={reviewer.id}>{reviewer.name} · {reviewer.role}</option>)}</select>:<span>{item.reviewer_name||'Available to review'}</span>}<button data-tooltip="Inspect every uploaded version before recording a decision." onClick={()=>openDocumentVersions(item)}>Inspect versions</button><button className="approve" data-tooltip="Open the review form. Approval publishes the latest version and notifies its author." onClick={()=>{setReviewDocument(item);setRejectionReason('')}}>Review now</button></article>)}{!reviewRows.length&&<p className="queue-empty">The review queue is clear. Newly submitted documents will appear here automatically.</p>}</section>}
            <div className="document-table"><div className="document-table-head"><span>Document</span><span>Category</span><span>Status</span><span>Control</span><span>Retention</span><span>Actions</span></div>{filteredDocuments.map(item=><article key={item.id}><div className="document-name"><Icon name="documents"/><span><strong>{item.title}</strong><small>{item.created_by_name}</small></span></div><span>{item.category}</span><b className={`doc-state ${item.status.toLowerCase().replace(' ','-')}`}>{item.status}</b><span className={item.locked_by_name?'document-locked':'document-free'}>{item.locked_by_name?`Checked out by ${item.locked_by_name}`:'Available'}</span><span>{item.retention_until?new Date(item.retention_until).toLocaleDateString('en-KE'):'Not set'}</span><div className="document-actions"><button data-tooltip="Open the complete version history. You can inspect who uploaded each version and securely download the required copy." onClick={()=>openDocumentVersions(item)}>Versions</button><button data-tooltip={item.locked_by_name?'Release the editing lock so another authorized user can update this document.':'Reserve this document for editing for two hours. Other users can still view it but cannot take the editing lock.'} onClick={()=>toggleDocumentLock(item)}>{item.locked_by_name?'Check in':'Check out'}</button>{isManager&&<button data-tooltip="Set how long the document must be retained, or move it into the archive without deleting its history." onClick={()=>{setRetentionDocument(item);setRetentionDate(item.retention_until||'')}}>Retention</button>}{canReview&&item.status==='Pending Approval'&&<><button className="approve" data-tooltip="Approve this reviewed document. It becomes Published and available to authorized users." onClick={()=>{setReviewDocument(item);setRejectionReason('')}}>Approve</button><button className="reject" data-tooltip="Reject this submission and record the correction required before it can be submitted again." onClick={()=>{setReviewDocument(item);setRejectionReason('')}}>Reject</button></>}</div></article>)}</div>
            {!filteredDocuments.length&&<div className="assignment-empty"><Icon name="documents"/><h3>No documents found</h3><p>Upload a document or adjust the filters.</p></div>}
          </section>
          <section className="research-management-view"><div className="assignment-page-head"><div><p>RESEARCH REPOSITORY</p><h2>Research project portfolio</h2><span>Questions, objectives, methods, collaborators, evidence and milestones.</span></div>{isManager&&<button onClick={()=>setResearchOpen(true)}>+ New research project</button>}</div><div className="research-grid">{researchRows.map(project=><article key={project.id}><span>{project.status}</span><h3>{project.title}</h3><p>{project.summary}</p><dl><div><dt>Lead</dt><dd>{project.lead_name}</dd></div><div><dt>Timeline</dt><dd>{project.start_date||'Not set'} — {project.end_date||'Open'}</dd></div></dl><h4>Research question</h4><p>{project.research_question||'Not defined'}</p><div>{project.collaborators.map(person=><b key={person.id}>{person.name}</b>)}</div><select value={project.status} onChange={async event=>{await api.updateResearchStatus(token,project.id,event.target.value);setResearchRows(await api.research(token))}}>{['Planning','Active','Under Review','Completed','Archived'].map(value=><option key={value}>{value}</option>)}</select></article>)}</div></section>
          <section className="ai-research-management-view">
            <div className="assignment-page-head"><div><p>AI RESEARCHER</p><h2>Evidence-led research workspace</h2><span>Combine deep web research with approved App2 documents while keeping every result under human review.</span></div><button onClick={()=>setAiResearchOpen(true)}>+ Plan research</button></div>
            <div className="ai-engine-card"><div><strong>Free Local mode</strong><span>No paid provider can run automatically.</span></div><b className={aiResearchEngine?.ollamaConnected?'connected':'offline'}>{aiResearchEngine?.ollamaConnected?'Ollama connected':'Local engine offline'}</b><div className="engine-parts"><span className={aiResearchEngine?.gptResearcherConnected?'ready':''}>GPT Researcher adapter</span><span className={aiResearchEngine?.researchMateConnected?'ready':''}>ResearchMate adapter</span><span className="ready">PostgreSQL job store</span></div></div>
            {aiResearchNotice&&<div className="session-message">{aiResearchNotice}</div>}
            <div className="ai-research-grid">{aiResearchJobs.map(job=><article key={job.id}><header><span>{job.status}</span><b>{job.depth}</b></header><h3>{job.title}</h3><p>{job.question}</p><dl><div><dt>Sources</dt><dd>{job.source_mode}</dd></div><div><dt>Created by</dt><dd>{job.created_by_name}</dd></div><div><dt>Provider</dt><dd>{job.provider}</dd></div><div><dt>Cost policy</dt><dd>Zero API cost</dd></div></dl><div className="ai-plan">{job.plan.map(item=><div key={item.step}><b>{item.step}</b><span><strong>{item.title}</strong><small>{item.description}</small></span></div>)}</div><footer><button onClick={()=>startAiResearch(job)}>Run locally</button><span>{job.progress}% complete</span></footer></article>)}{!aiResearchJobs.length&&<div className="assignment-empty"><Icon name="research"/><h3>No AI research plans yet</h3><p>Create a question and choose whether the researcher should use the web, App2 documents, or both.</p></div>}</div>
          </section>
          <section className="knowledge-management-view">
            <div className="assignment-page-head"><div><p>KNOWLEDGE REPOSITORY</p><h2>Institutional knowledge library</h2><span>Policies, reports, circulars, research papers, books and reusable templates.</span></div><button onClick={()=>setKnowledgeUploadOpen(true)}>+ Upload knowledge</button></div>
            <div className="assignment-toolbar"><label><Icon name="search"/><input value={knowledgeSearch} onChange={event=>setKnowledgeSearch(event.target.value)} placeholder="Search documents, descriptions or tags"/></label><select value={knowledgeCategory} onChange={event=>setKnowledgeCategory(event.target.value)}>{['All','Policy','Report','Circular','Research Paper','Book','Template'].map(value=><option key={value}>{value}</option>)}</select><span>{filteredKnowledge.length} items</span></div>
            {knowledgeNotice&&<div className="session-message">{knowledgeNotice}</div>}
            <div className="knowledge-library">{filteredKnowledge.map(item=><article key={item.id}><div><Icon name="documents"/><span>{item.category}</span><em>{item.status}</em></div><h3>{item.title}</h3><p>{item.description||'No description provided.'}</p><small>{item.original_name} · {Math.ceil(item.size_bytes/1024)} KB</small><div className="tag-row">{item.tags.map(tag=><b key={tag}>{tag}</b>)}</div><footer><span>v{item.latest_version} · {item.created_by_name}</span><button onClick={()=>openKnowledge(item)}>Versions & download</button>{canReview&&item.status==='Pending Approval'&&<button data-tooltip="Approve and publish this document after reviewing its metadata and latest version." onClick={async()=>{await api.approveKnowledge(token,item.id,true);setKnowledgeRows(await api.knowledge(token))}}>Publish</button>}</footer></article>)}</div>
          </section>
          <section className="assignment-management-view">
            <div className="assignment-page-head"><div><p>ASSIGNMENT MANAGEMENT</p><h2>Research work pipeline</h2><span>Create, allocate, track, review and preserve every assignment record.</span></div>{isManager&&<button onClick={()=>startAssignment()}>+ New assignment</button>}</div>
            <div className="assignment-toolbar"><label><Icon name="search"/><input value={assignmentSearch} onChange={event=>setAssignmentSearch(event.target.value)} placeholder="Search title, division or description"/></label><select value={assignmentStatus} onChange={event=>setAssignmentStatus(event.target.value)}>{['All','Not Started','In Progress','Ready for Review','Completed','Overdue'].map(value=><option key={value}>{value}</option>)}</select><select value={assignmentPriority} onChange={event=>setAssignmentPriority(event.target.value)}>{['All','Low','Normal','High','Critical'].map(value=><option key={value}>{value}</option>)}</select><span>{filteredAssignments.length} assignments</span></div>
            {assignmentNotice&&<div className="session-message">{assignmentNotice}</div>}
            <div className="assignment-board">
              {filteredAssignments.map(item=><article className="assignment-card" key={item.id}>
                <div className="assignment-card-top"><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span><em>{item.status}</em></div>
                <h3>{item.title}</h3><p>{item.description||'No description provided.'}</p>
                <dl><div><dt>Division</dt><dd>{item.division}</dd></div><div><dt>Due date</dt><dd>{item.due_date?new Date(item.due_date).toLocaleDateString('en-KE'):'Not set'}</dd></div></dl>
                <div className="assignment-members">{item.members.map(member=><span key={member.id} title={`${member.name} · ${member.role}`}>{initialsFor(member.name)}</span>)}{!item.members.length&&<small>Unassigned</small>}</div>
                <div className="assignment-card-actions"><button onClick={()=>openAssignmentDetails(item)}>Open workspace</button>{isManager&&<><button onClick={()=>startAssignment(item)}>Edit</button><button className="danger" onClick={()=>removeAssignment(item)}>Delete</button></>}</div>
                <select value={item.status} onChange={async event=>{try{await api.updateStatus(token,item.id,event.target.value);await refreshAssignments()}catch(error){setAssignmentNotice(error instanceof Error?error.message:'Status could not be updated.')}}}><option>Not Started</option><option>In Progress</option><option>Ready for Review</option><option>Completed</option><option>Overdue</option></select>
              </article>)}
              {!filteredAssignments.length&&<div className="assignment-empty"><Icon name="assignments"/><h3>No assignments match these filters</h3><p>Clear the filters or create a new assignment.</p></div>}
            </div>
          </section>
          <section className="stats-grid">
            {stats.map(([icon, label, value, tone]) => (
              <article className={`stat-card ${tone}`} key={label}><Icon name={icon} /><div><span>{label}</span><strong>{value}</strong><button title={`Open ${statDestinations[label]} and view the records behind this total.`} onClick={()=>navigateTo(statDestinations[label])}>View all <Icon name="arrow" /></button></div></article>
            ))}
          </section>

          {isManager && <section className="management-area">
            <div className="management-heading"><div><p>MANAGEMENT OVERVIEW</p><h2>Team control centre</h2></div><span>{user.role} access</span></div>
            <div className="management-grid">
              <article className="panel members-panel">
                <div className="panel-title"><h2>All Members</h2><button>{team.length} active profiles</button></div>
                <div className="member-table">
                  <div className="member-table-head"><span>Member</span><span>Division</span><span>Role</span><span>Workload</span><span>Status</span></div>
                  {team.map(member => <div className="member-record" key={member.email}>
                    <div className="member-name"><span>{member.initials}</span><div><strong>{member.name}</strong><small>{member.email}</small></div></div>
                    <span>{member.division}</span>
                    {user.role === 'Administrator' ? <select value={member.role} onChange={e => updateMemberRole(member.email, e.target.value as Role)}><option>Administrator</option><option>Research Manager</option><option>Research Officer</option><option>Reviewer</option></select> : <em>{member.role}</em>}
                    <span>{member.active} active</span><b className={`presence ${member.status.toLowerCase()}`}>{member.status}</b>
                  </div>)}
                </div>
              </article>

              <article className="panel alerts-panel">
                <div className="panel-title"><h2>Alerts & Updates</h2></div>
                <div className="alert-composer"><textarea value={alertText} onChange={e => setAlertText(e.target.value)} placeholder="Write a notice for management approval..." /><button onClick={publishAlert}>Submit for approval <Icon name="arrow" /></button></div>
                <div className="published-alerts">{systemAlerts.map((alert, index) => <div key={`${alert}-${index}`}><Icon name="notifications" /><p>{alert}<small>{index === 0 ? 'Just now · All members' : 'Management update · All members'}</small></p></div>)}</div>
              </article>
            </div>

            <div className="management-grid lower">
              <article className="panel allocations-panel">
                <div className="panel-title"><h2>Assignment Allocation</h2><button onClick={() => {setActive('Assignments');startAssignment()}}>+ Create assignment</button></div>
                {workAllocation.map((item, index) => <div className="allocation-row" key={item.title}><strong>{item.title}</strong><select value={item.assignee} onChange={e => updateAllocation(index, 'assignee', e.target.value)}>{team.filter(member => member.role !== 'Administrator').map(member => <option key={member.email}>{member.name}</option>)}</select><select value={item.status} onChange={e => updateAllocation(index, 'status', e.target.value)}><option>Not Started</option><option>In Progress</option><option>Ready for Review</option><option>Completed</option><option>Overdue</option></select></div>)}
              </article>
              <article className="panel analytics-panel">
                <div className="panel-title"><h2>Workload by Member</h2><button title="Open Reports & Analytics where the workload report can be filtered and exported." onClick={()=>navigateTo('Reports & Analytics')}>Export report</button></div>
                <div className="bar-chart">{team.filter(member => member.role !== 'Administrator').map(member => <div className="bar-column" key={member.email}><div className="bar-value">{member.active}</div><div className="bar-track"><i style={{ height: `${Math.max(18, member.active * 20)}%` }} /></div><span>{member.initials}</span></div>)}</div>
                <div className="chart-legend"><span><i className="yellow-dot" />Active assignments</span><strong>14 total</strong></div>
              </article>
              <article className="panel progress-panel">
                <div className="panel-title"><h2>Assignment Progress</h2></div>
                <div className="donut-chart"><div><strong>72%</strong><span>On track</span></div></div>
                <div className="progress-legend"><span><i className="green-dot" />Completed <b>28</b></span><span><i className="yellow-dot" />In progress <b>12</b></span><span><i className="orange-dot" />Overdue <b>4</b></span></div>
              </article>
            </div>
          </section>}

          <section className="primary-grid">
            <article className="panel assignments-panel">
              <div className="panel-title"><h2>My Assignments</h2><button onClick={()=>setActive('Assignments')}>View all assignments <Icon name="arrow" /></button></div>
              <div className="tabs" role="tablist">{['All', 'In Progress', 'Due Soon', 'Overdue', 'Completed'].map(tab => <button role="tab" title={`Show ${tab.toLowerCase()} assignments in this dashboard list.`} aria-selected={dashboardAssignmentFilter===tab} onClick={()=>setDashboardAssignmentFilter(tab)} className={dashboardAssignmentFilter===tab?'active':''} key={tab}>{tab}</button>)}</div>
              {workAllocation.filter(item=>dashboardAssignmentFilter==='All'||item.status===dashboardAssignmentFilter||(dashboardAssignmentFilter==='Due Soon'&&item.status!=='Completed'&&new Date(item.dueDate).getTime()<=Date.now()+7*86400000&&new Date(item.dueDate).getTime()>=Date.now())).map(item => (
                <button className="assignment-row" key={item.id} onClick={() => openAssignment(item.title,item.id)}>
                  <span className={`status-icon ${item.status==='Completed'?'green':item.status==='Overdue'?'orange':'yellow'}`}><Icon name={item.status==='Completed'?'check':item.status==='Overdue'?'warning':'clock'} /></span>
                  <div className="grow"><strong>{item.title}</strong><small>{item.division} · {item.assignee}</small></div>
                  <div className="due"><span>{item.dueDate?`Due: ${new Date(item.dueDate).toLocaleDateString('en-KE')}`:'No due date'}</span><em className={item.status==='Completed'?'green':item.status==='Overdue'?'orange':'yellow'}>{item.status}</em></div><span className="more">⋮</span>
                </button>
              ))}
            </article>

            <div className="right-stack">
              <article className="panel">
                <div className="panel-title"><h2>Announcements</h2><button title="Open Notifications to review published department alerts." onClick={()=>navigateTo('Notifications')}>View all <Icon name="arrow" /></button></div>
                {announcements.map(([icon, title, text, date]) => <div className="announcement" key={title}><span className="square-icon orange"><Icon name={icon as IconName} /></span><div className="grow"><strong>{title}</strong><small>{text}</small></div><time>{date}</time></div>)}
              </article>
              <article className="panel calendar-panel">
                <div className="panel-title"><h2>Calendar</h2><button title="Keep the dashboard calendar in view and review scheduled events." onClick={()=>navigateTo('Calendar')}>View calendar <Icon name="arrow" /></button></div>
                <div className="calendar-body"><div className="date-card"><span>AUG</span><strong>06</strong><small>WED</small></div><div className="events"><p><b>Quarterly Research Review Meeting</b><span>10:00 AM – 12:00 PM</span></p><p><b>Due: Policy Review on PM</b><span>All day</span></p></div></div>
              </article>
            </div>
          </section>

          <section className="bottom-grid">
            <article className="panel knowledge-panel">
              <div className="panel-title"><h2>Recent Knowledge Added</h2><button title="Open the full Knowledge Repository." onClick={()=>navigateTo('Knowledge Repository')}>View all <Icon name="arrow" /></button></div>
              {knowledge.map(([title, meta, date]) => <div className="knowledge-row" key={title}><span className="square-icon"><Icon name="documents" /></span><div className="grow"><strong>{title}</strong><small>{meta}</small></div><time>{date}</time></div>)}
            </article>
            <article className="panel quick-links">
              <div className="panel-title"><h2>Quick Links</h2></div>
              <div>{([['knowledge', 'Knowledge Repository'], ['research', 'Research Repository'], ['documents', 'Documents'], ['reports', 'Reports & Analytics'], ['team', 'Team & Users'], ['audit', 'Audit Logs'], ['notifications', 'Notifications'], ['announce','Notice Board'],['calendar','Calendar'], ['settings', 'Settings']] as [IconName, string][]).filter(([,label]) => roleNavigation[user.role].includes(label)).map(([icon, label]) => <button key={label} title={navigationDescriptions[label]} data-tooltip={navigationDescriptions[label]} onClick={() => navigateTo(label)}><Icon name={icon} /><span>{label}</span>{label === 'Notifications' && <b>{notifications.filter(item=>!item.read_at).length}</b>}</button>)}</div>
            </article>
            <article className="panel activity-panel">
              <div className="panel-title"><h2>Activity Feed</h2><button title="Open Audit Logs to inspect the complete recorded activity history." onClick={()=>navigateTo(user.role==='Administrator'?'Audit Logs':'Notifications')}>View all <Icon name="arrow" /></button></div>
              {activity.map(([icon, title, text, time, tone]) => <div className="activity-row" key={title}><span className={`round-icon ${tone}`}><Icon name={icon as IconName} /></span><div className="grow"><strong>{title}</strong><small>{text}</small></div><time>{time}</time></div>)}
            </article>
          </section>
          <footer><span>© 2026 Public Service Commission, Kenya. All rights reserved.</span><div><a href="#">Privacy Policy</a><i /><a href="#">Terms of Use</a></div></footer>
        </div>
      </main>
      {active === 'Profile' && <div className="modal-backdrop" onClick={() => setActive('Dashboard')}><section className="profile-modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setActive('Dashboard')}>×</button><div className="profile-avatar">{user.initials}</div><h2>{user.name}</h2><p>{user.email}</p><em>{user.role}</em><h3>Access rights</h3><ul>{user.rights.map(right => <li key={right}><Icon name="check" />{right}</li>)}</ul><button className="change-password-button" onClick={() => {setPasswordMode('change');setPasswordMessage('');setActive('Dashboard')}}>Change password</button><button className="sign-out" onClick={() => setShowLogout(true)}>Sign out everywhere</button></section></div>}
      {passwordMode === 'change' && <div className="modal-backdrop" onClick={() => setPasswordMode(null)}>
        <section className="profile-modal password-modal" onClick={event => event.stopPropagation()}>
          <button className="close" onClick={() => setPasswordMode(null)}>×</button>
          <h2>Change password</h2><p>Your old sessions will be revoked immediately.</p>
          <form onSubmit={changePassword}>
            <label>Current password<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></label>
            <label>New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={10} required /></label>
            <label>Confirm new password<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={10} required /></label>
            {passwordMessage && <div className="session-message" role="status">{passwordMessage}</div>}
            <button className="sign-in" type="submit" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Change password'}</button>
          </form>
        </section>
      </div>}
      {assignmentEditor&&<div className="modal-backdrop" onClick={()=>setAssignmentEditor(null)}><section className="assignment-editor" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setAssignmentEditor(null)}>×</button><h2>{assignmentEditor==='new'?'Create assignment':'Edit assignment'}</h2><form onSubmit={saveAssignment}><label>Title<input value={assignmentForm.title} onChange={event=>setAssignmentForm({...assignmentForm,title:event.target.value})} required minLength={4}/></label><label>Description<textarea value={assignmentForm.description} onChange={event=>setAssignmentForm({...assignmentForm,description:event.target.value})}/></label><div className="form-pair"><label>Division<input value={assignmentForm.division} onChange={event=>setAssignmentForm({...assignmentForm,division:event.target.value})} required/></label><label>Due date<input type="date" value={assignmentForm.dueDate||''} onChange={event=>setAssignmentForm({...assignmentForm,dueDate:event.target.value||null})}/></label></div><label>Priority<select value={assignmentForm.priority} onChange={event=>setAssignmentForm({...assignmentForm,priority:event.target.value})}><option>Low</option><option>Normal</option><option>High</option><option>Critical</option></select></label><fieldset><legend>Assign members</legend>{team.filter(member=>member.role!=='Administrator').map(member=><label key={member.id}><input type="checkbox" checked={assignmentForm.memberIds.includes(member.id)} onChange={event=>setAssignmentForm({...assignmentForm,memberIds:event.target.checked?[...assignmentForm.memberIds,member.id]:assignmentForm.memberIds.filter(id=>id!==member.id)})}/>{member.name}<small>{member.role}</small></label>)}</fieldset><button className="sign-in" disabled={savingAssignment}>{savingAssignment?'Saving…':'Save assignment'}</button></form></section></div>}
      {selectedAudit&&<div className="modal-backdrop" onClick={()=>setSelectedAudit(null)}><section className="assignment-editor audit-detail" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setSelectedAudit(null)}>×</button><p>AUDIT EVENT #{selectedAudit.id}</p><h2>{auditLabel(selectedAudit.action)}</h2><div className="audit-detail-grid"><div><small>Performed by</small><strong>{selectedAudit.user_name}</strong><span>{selectedAudit.user_email||'System event'}</span></div><div><small>Date and time</small><strong>{new Date(selectedAudit.created_at).toLocaleString('en-KE')}</strong></div><div><small>Module</small><strong>{selectedAudit.entity_type}</strong></div><div><small>Record ID</small><strong>{selectedAudit.entity_id||'Not applicable'}</strong></div></div><h3>Event description</h3><p className="audit-description">{auditDescription(selectedAudit)}</p><h3>Recorded details</h3><pre>{JSON.stringify(selectedAudit.details,null,2)}</pre><small className="read-only-note">Audit records are read-only and cannot be changed from this system.</small></section></div>}
      {createdAccount&&<div className="modal-backdrop"><section className="assignment-editor account-success" role="dialog" aria-modal="true" aria-labelledby="account-success-title"><div className="success-mark">✓</div><p>ACCOUNT CREATED</p><h2 id="account-success-title">User account created successfully</h2><span>{createdAccount.name} can now sign in using <strong>{createdAccount.email}</strong>.</span><div className="success-password"><small>Temporary password</small><strong>{createdAccount.password}</strong><button onClick={()=>navigator.clipboard.writeText(createdAccount.password)}>Copy password</button></div><small className="security-note">Share this password through an approved secure channel. The user will be asked to create a private password after signing in.</small><h3>What would you like to do next?</h3><div className="success-actions"><button className="add-another" onClick={()=>{setCreatedAccount(null);openUserEditor()}}>+ Add another user</button><button onClick={()=>{setCreatedAccount(null);setTemporaryCredential('')}}>Exit</button></div></section></div>}
      {userEditor&&<div className="modal-backdrop" onClick={()=>{if(!savingUser)setUserEditor(null)}}><section className="assignment-editor user-editor" onClick={event=>event.stopPropagation()}><button className="close" disabled={savingUser} onClick={()=>setUserEditor(null)}>×</button><h2>{userEditor==='new'?'Create staff account':'Edit staff account'}</h2><form onSubmit={saveUser}><label>Full name<input value={userForm.name} onChange={event=>setUserForm({...userForm,name:event.target.value})} required minLength={3} disabled={savingUser}/><small>Enter at least 3 characters.</small></label><label>Official email<input type="email" value={userForm.email} onChange={event=>setUserForm({...userForm,email:event.target.value})} required disabled={savingUser}/><small>Use a complete email address, for example name@publicservice.go.ke.</small></label><div className="form-pair"><label>Role<select value={userForm.role} onChange={event=>setUserForm({...userForm,role:event.target.value})} disabled={savingUser}>{['Administrator','Research Manager','Research Officer','Reviewer'].map(value=><option key={value}>{value}</option>)}</select></label><label>Division<input value={userForm.division} onChange={event=>setUserForm({...userForm,division:event.target.value})} required minLength={2} disabled={savingUser}/><small>Enter at least 2 characters.</small></label></div>{userEditor==='new'?<label>Temporary password <small>Leave blank to generate one, or use at least 10 characters with uppercase, lowercase and a number.</small><input type="password" value={userForm.temporaryPassword} onChange={event=>setUserForm({...userForm,temporaryPassword:event.target.value})} minLength={10} pattern={userForm.temporaryPassword?'(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,128}':undefined} title="Use at least 10 characters including uppercase, lowercase and a number." disabled={savingUser}/></label>:<><label>Availability<select value={userForm.status} onChange={event=>setUserForm({...userForm,status:event.target.value})} disabled={savingUser}>{['Available','Busy','Away'].map(value=><option key={value}>{value}</option>)}</select></label><label className="account-switch"><input type="checkbox" checked={userForm.active} onChange={event=>setUserForm({...userForm,active:event.target.checked})} disabled={savingUser}/><span>Account active</span></label></>}{userFormError&&<div className="user-form-error" role="alert">{userFormError}</div>}<button className="sign-in" disabled={savingUser}>{savingUser?(userEditor==='new'?'Creating account…':'Saving changes…'):(userEditor==='new'?'Create account':'Save changes')}</button></form></section></div>}
      {knowledgeUploadOpen&&<div className="modal-backdrop" onClick={()=>setKnowledgeUploadOpen(false)}><section className="assignment-editor" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setKnowledgeUploadOpen(false)}>×</button><h2>Upload knowledge</h2><form onSubmit={uploadKnowledge}><label>Document<input type="file" onChange={event=>setKnowledgeFile(event.target.files?.[0]||null)} required/></label><label>Title<input value={knowledgeForm.title} onChange={event=>setKnowledgeForm({...knowledgeForm,title:event.target.value})} required/></label><label>Description<textarea value={knowledgeForm.description} onChange={event=>setKnowledgeForm({...knowledgeForm,description:event.target.value})}/></label><div className="form-pair"><label>Category<select value={knowledgeForm.category} onChange={event=>setKnowledgeForm({...knowledgeForm,category:event.target.value})}>{['Policy','Report','Circular','Research Paper','Book','Template'].map(value=><option key={value}>{value}</option>)}</select></label><label>Tags<input value={knowledgeForm.tags} onChange={event=>setKnowledgeForm({...knowledgeForm,tags:event.target.value})} placeholder="governance, HR, digital"/></label></div><label>Linked assignment<select value={knowledgeForm.assignmentId} onChange={event=>setKnowledgeForm({...knowledgeForm,assignmentId:event.target.value})}><option value="">None</option>{assignmentRows.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}</select></label><button className="sign-in">Upload for review</button></form></section></div>}
      {selectedKnowledge&&<div className="modal-backdrop" onClick={()=>setSelectedKnowledge(null)}><section className="assignment-editor" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setSelectedKnowledge(null)}>×</button><h2>{selectedKnowledge.title}</h2><p>{selectedKnowledge.description}</p><div className="version-list">{knowledgeVersions.map(version=><div key={version.id}><span><strong>Version {version.version_number}</strong><small>{version.original_name} · {version.created_by_name}</small></span><button onClick={()=>api.downloadKnowledgeVersion(token,version.id,version.original_name)}>Download</button></div>)}</div><label className="version-upload">Upload new version<input type="file" onChange={async event=>{const file=event.target.files?.[0];if(file){await api.uploadKnowledgeVersion(token,selectedKnowledge.id,file);setKnowledgeVersions(await api.knowledgeVersions(token,selectedKnowledge.id))}}}/></label></section></div>}
      {researchOpen&&<div className="modal-backdrop" onClick={()=>setResearchOpen(false)}><section className="assignment-editor" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setResearchOpen(false)}>x</button><h2>New research project</h2><form onSubmit={saveResearch}><label>Project title<input value={researchForm.title} onChange={event=>setResearchForm({...researchForm,title:event.target.value})} required/></label><label>Summary<textarea value={researchForm.summary} onChange={event=>setResearchForm({...researchForm,summary:event.target.value})}/></label><label>Research question<textarea value={researchForm.researchQuestion} onChange={event=>setResearchForm({...researchForm,researchQuestion:event.target.value})}/></label><label>Objectives<textarea value={researchForm.objectives} onChange={event=>setResearchForm({...researchForm,objectives:event.target.value})}/></label><label>Methodology<textarea value={researchForm.methodology} onChange={event=>setResearchForm({...researchForm,methodology:event.target.value})}/></label><div className="form-pair"><label>Start date<input type="date" value={researchForm.startDate} onChange={event=>setResearchForm({...researchForm,startDate:event.target.value})}/></label><label>End date<input type="date" value={researchForm.endDate} onChange={event=>setResearchForm({...researchForm,endDate:event.target.value})}/></label></div><button className="sign-in">Create research project</button></form></section></div>}
      {aiResearchOpen&&<div className="modal-backdrop" onClick={()=>setAiResearchOpen(false)}><section className="assignment-editor ai-research-editor" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setAiResearchOpen(false)}>x</button><p>FREE LOCAL MODE</p><h2>Plan AI-assisted research</h2><form onSubmit={saveAiResearch}><label>Research title<input value={aiResearchForm.title} onChange={event=>setAiResearchForm({...aiResearchForm,title:event.target.value})} minLength={4} required/></label><label>Primary research question<textarea value={aiResearchForm.question} onChange={event=>setAiResearchForm({...aiResearchForm,question:event.target.value})} minLength={10} required placeholder="What decision should this research help the Commission make?"/></label><label>Scope and boundaries<textarea value={aiResearchForm.scope} onChange={event=>setAiResearchForm({...aiResearchForm,scope:event.target.value})} placeholder="Countries, period, population, exclusions or required policy context"/></label><div className="form-pair"><label>Evidence sources<select value={aiResearchForm.sourceMode} onChange={event=>setAiResearchForm({...aiResearchForm,sourceMode:event.target.value})}><option>All</option><option>Web</option><option>App2 Documents</option></select></label><label>Research depth<select value={aiResearchForm.depth} onChange={event=>setAiResearchForm({...aiResearchForm,depth:event.target.value})}><option>Quick</option><option>Standard</option><option>Deep</option></select></label></div><div className="zero-cost-note"><strong>Cost safeguard</strong><span>This plan uses Local Ollama only. It will stop instead of calling a paid provider.</span></div><button className="sign-in">Create research plan</button></form></section></div>}
      {retentionDocument&&<div className="modal-backdrop" onClick={()=>setRetentionDocument(null)}><section className="assignment-editor retention-editor" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setRetentionDocument(null)}>x</button><h2>Retention & archival</h2><p>{retentionDocument.title}</p><label>Retain until<input type="date" value={retentionDate} onChange={event=>setRetentionDate(event.target.value)}/></label><div className="retention-actions"><button onClick={async()=>{await api.retainDocument(token,retentionDocument.id,retentionDate||null,false);await refreshDocuments();setRetentionDocument(null);setDocumentNotice('Retention date updated.')}}>Save retention</button><button className="danger" onClick={async()=>{if(window.confirm('Archive this document?')){await api.retainDocument(token,retentionDocument.id,retentionDate||null,true);await refreshDocuments();setRetentionDocument(null);setDocumentNotice('Document archived.')}}}>Archive document</button></div></section></div>}
      {reviewDocument&&<div className="modal-backdrop" onClick={()=>setReviewDocument(null)}><section className="assignment-editor review-editor" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setReviewDocument(null)}>x</button><h2>Review document</h2><p><strong>{reviewDocument.title}</strong></p><ol><li><b>Inspect versions</b><span>Confirm the latest file is complete, readable and correctly classified.</span></li><li><b>Verify content</b><span>Check accuracy, policy compliance, ownership and linked assignment context.</span></li><li><b>Record a decision</b><span>Approve to publish, or explain the correction required when rejecting.</span></li></ol><label>Reviewer comments / rejection reason<textarea value={rejectionReason} onChange={event=>setRejectionReason(event.target.value)} placeholder="Add review notes. A reason is required when rejecting."/></label><div className="review-actions"><button className="approve" data-tooltip="Publish the approved document and record you as its reviewer." onClick={()=>reviewDocumentAction(true)}>Approve & publish</button><button className="reject" data-tooltip="Return the document to its owner with your correction instructions." disabled={!rejectionReason.trim()} onClick={()=>reviewDocumentAction(false)}>Reject with reason</button></div></section></div>}
      {reviewingNotice&&<div className="modal-backdrop" onClick={()=>setReviewingNotice(null)}><section className="assignment-editor review-editor" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setReviewingNotice(null)}>x</button><p>NOTICE APPROVAL</p><h2>{reviewingNotice.title}</h2><p>{reviewingNotice.body}</p><small>Submitted by {reviewingNotice.created_by_name} · {reviewingNotice.severity}</small>{reviewingNotice.event_start&&<div className="notice-event-summary">Calendar event: {new Date(reviewingNotice.event_start).toLocaleString('en-KE')}</div>}<label>Reviewer comments / rejection reason<textarea value={noticeReason} onChange={event=>setNoticeReason(event.target.value)} placeholder="A reason is required when rejecting."/></label><div className="review-actions"><button className="approve" onClick={()=>reviewNotice(true)}>Approve & publish</button><button className="reject" disabled={!noticeReason.trim()} onClick={()=>reviewNotice(false)}>Reject with reason</button></div></section></div>}
      {selectedAssignment && <div className="collab-drawer">
        <div className="drawer-head"><div><p>COLLABORATION WORKSPACE</p><h2>{selectedAssignment}</h2></div><button onClick={() => {setSelectedAssignment(null);setSelectedAssignmentId(null)}}>×</button></div>
        <div className="collab-members"><span className="avatar-chip">DK</span><span className="avatar-chip orange">MW</span><span className="avatar-chip green">GM</span><button>+ Add member</button></div>
        <div className="assignment-actions"><label>Attach document · max 100 MB<input type="file" onChange={event=>uploadAssignmentFile(event.target.files?.[0])}/></label><button onClick={()=>setActive('Assignments')}><Icon name="assignments" /> Assignment list</button></div>
        <div className="attachment-list">{assignmentFiles.map(file=><button key={file.id} onClick={()=>api.downloadAttachment(token,file.id,file.original_name)}><Icon name="documents"/><span>{file.original_name}<small>{Math.ceil(file.size_bytes/1024)} KB · {file.uploader_name}</small></span></button>)}{!assignmentFiles.length&&<small>No files attached yet.</small>}</div>
        <h3>Team conversation</h3><div className="comments">{comments.map((item, index) => <div className="comment" key={`${item.author}-${index}`}><span>{item.author.split(' ').map(n => n[0]).join('')}</span><div><strong>{item.author}<time>{item.time}</time></strong><p>{item.text}</p></div></div>)}</div>
        <div className="comment-box"><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write an update or mention a team member with @..." /><button onClick={addComment}>Send update <Icon name="arrow" /></button></div>
        <h3>Activity history</h3><div className="history-list">{assignmentHistory.map(item=><div key={item.id}><strong>{item.action.replaceAll('_',' ')}</strong><span>{item.user_name||'System'} · {new Date(item.created_at).toLocaleString('en-KE')}</span></div>)}</div>
      </div>}
      {showLogout && <div className="modal-backdrop" onClick={() => setShowLogout(false)}>
        <section className="profile-modal logout-modal" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowLogout(false)}>×</button>
          <h2>Sign out</h2>
          <p>You are about to sign out of the dashboard. This will end your session and return you to the sign-in screen.</p>
          <div className="logout-actions">
            <button className="danger" onClick={() => { setShowLogout(false); signOut(); }}>Sign out</button>
            <button onClick={() => setShowLogout(false)}>Cancel</button>
          </div>
        </section>
      </div>}
    </div>
  )
}
