import { useEffect, useState } from 'react'
import { api, type ApiAssignment, type ApiUser } from './api'

type IconName = keyof typeof icons
type Role = 'Administrator' | 'Research Manager' | 'Research Officer' | 'Reviewer'
type User = { name: string; email: string; role: Role; initials: string; rights: string[] }
type TeamMember = User & { id: string; division: string; active: number; completed: number; status: 'Available' | 'Busy' | 'Away' }

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
  ['documents', 'Documents'], ['team', 'Team & Users'], ['reports', 'Reports & Analytics'],
  ['notifications', 'Notifications'], ['calendar', 'Calendar'], ['audit', 'Audit Logs'],
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
  'Research Officer': ['Dashboard', 'Assignments', 'Knowledge Repository', 'Research Repository', 'Documents', 'Team & Users', 'Notifications', 'Calendar'],
  Reviewer: ['Dashboard', 'Assignments', 'Knowledge Repository', 'Documents', 'Notifications', 'Calendar'],
}

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const rightsFor = (role: Role) => role === 'Administrator' ? ['Manage users','Manage roles','Audit activity','Full system access'] : role === 'Research Manager' ? ['Create assignments','Assign members','Approve work','Manage research'] : role === 'Reviewer' ? ['Review submissions','Comment','Request changes','Approve knowledge'] : ['View assignments','Update assigned work','Add knowledge','Collaborate']
  const initialsFor = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase()
  const mapUser = (member: ApiUser): User => ({ name:member.name,email:member.email,role:member.role as Role,initials:initialsFor(member.name),rights:rightsFor(member.role as Role) })
  const mapTeamMember = (member: ApiUser): TeamMember => ({...mapUser(member),id:member.id,division:member.division,active:member.active_assignments||0,completed:member.completed_assignments||0,status:member.status as TeamMember['status']})

  const loadLiveData = async (accessToken: string, profile: User) => {
    const [assignmentRows, alertRows] = await Promise.all([api.assignments(accessToken), api.alerts(accessToken)])
    setWorkAllocation(assignmentRows.map((item: ApiAssignment) => ({id:item.id,title:item.title,assignee:item.members[0]?.name||'Unassigned',status:item.status,division:item.division,dueDate:item.due_date||''})))
    setSystemAlerts(alertRows.map(item=>item.body))
    if (profile.role === 'Administrator' || profile.role === 'Research Manager') setTeam((await api.users(accessToken)).map(mapTeamMember))
  }

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoggingIn(true);setLoginError('')
    try{const result=await api.login(email,password);const profile=mapUser(result.user);setToken(result.token);setUser(profile);await loadLiveData(result.token,profile)}
    catch(error){setLoginError(error instanceof Error?error.message:'The PSC service could not complete your login.')}
    finally{setLoggingIn(false)}
  }

  const addComment = async () => {
    if (!comment.trim() || !user || !token || !selectedAssignmentId) return
    try{await api.addComment(token,selectedAssignmentId,comment.trim())}catch(error){alert(error instanceof Error?error.message:'Comment could not be saved.');return}
    setComments([...comments, { author: user.name, text: comment.trim(), time: now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) }])
    setComment('')
  }

  const isManager = user?.role === 'Administrator' || user?.role === 'Research Manager'
  const updateMemberRole = async (emailAddress: string, role: Role) => {const member=team.find(item=>item.email===emailAddress);if(!member||!token)return;try{await api.updateRole(token,member.id,role);setTeam(team.map(item=>item.email===emailAddress?{...item,role}:item))}catch(error){alert(error instanceof Error?error.message:'Role could not be updated.')}}
  const updateAllocation = async (index: number, field: 'assignee' | 'status', value: string) => {const item=workAllocation[index];if(!token)return;try{if(field==='status')await api.updateStatus(token,item.id,value);else{const member=team.find(person=>person.name===value);if(member)await api.addMember(token,item.id,member.id)}setWorkAllocation(workAllocation.map((row,itemIndex)=>itemIndex===index?{...row,[field]:value}:row))}catch(error){alert(error instanceof Error?error.message:'Assignment could not be updated.')}}
  const publishAlert = async () => {
    if (!alertText.trim()||!token) return
    try{await api.publishAlert(token,alertText.trim())}catch(error){alert(error instanceof Error?error.message:'Alert could not be published.');return}
    setSystemAlerts([alertText.trim(), ...systemAlerts])
    setAlertText('')
  }
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
          <div className="form-options"><label><input type="checkbox" /> Remember me</label><button type="button" onClick={() => alert('Password recovery instructions will be sent to your official PSC email address.')}>Forgot password?</button></div>
          {loginError && <div className="login-error" role="alert"><strong>Login unsuccessful</strong>{loginError}</div>}
          <button className="sign-in" type="submit" disabled={loggingIn}>{loggingIn?'Connecting securely…':'Sign in securely'} {!loggingIn&&<Icon name="arrow" />}</button>
        </form>
        <div className="demo-accounts"><strong>Test profiles</strong>{demoUsers.map(member => <button key={member.email} onClick={() => { setEmail(member.email); setPassword('PSC@2026') }}><span>{member.initials}</span><div>{member.name}<small>{member.role}</small></div></button>)}<p>Password for testing: <b>PSC@2026</b></p></div>
      </section>
    </div>
  }

  return (
    <div className="dashboard-shell">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <img src="/psc-logo.png" alt="Public Service Commission logo" />
          <div><strong>PUBLIC SERVICE COMMISSION</strong><span>KENYA</span><small>HONOUR · COMMITMENT · TRUST</small></div>
        </div>
        <nav aria-label="Main navigation">
          {navItems.filter(([, label]) => roleNavigation[user.role].includes(label)).map(([icon, label]) => (
            <button key={label} className={active === label ? 'active' : ''} onClick={() => { setActive(label); setMenuOpen(false) }}>
              <Icon name={icon} /><span>{label}</span>{label === 'Notifications' && <b>8</b>}
            </button>
          ))}
        </nav>
        <section className="quick-access">
          <h3>Quick Access</h3>
          {([['plus', 'Create Assignment'], ['upload', 'Upload Document'], ['knowledge', 'Add Knowledge'], ['documents', 'New Research']] as [IconName, string][]).map(([icon, label]) =>
            <button key={label} onClick={() => label === 'Create Assignment' && openAssignment('Create a new assignment')}><Icon name={icon} />{label}</button>
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
            <button className="notification-button" aria-label="Notifications"><Icon name="bell" /><b>8</b></button>
            <button className="user" onClick={() => setActive('Profile')}><span className="user-icon">{user.initials}</span><div><strong>{user.name}</strong><small>{user.role}</small></div><span>⌄</span></button>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="stats-grid">
            {stats.map(([icon, label, value, tone]) => (
              <article className={`stat-card ${tone}`} key={label}><Icon name={icon} /><div><span>{label}</span><strong>{value}</strong><button>View all <Icon name="arrow" /></button></div></article>
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
                <div className="alert-composer"><textarea value={alertText} onChange={e => setAlertText(e.target.value)} placeholder="Write an alert or team status update..." /><button onClick={publishAlert}>Publish alert <Icon name="arrow" /></button></div>
                <div className="published-alerts">{systemAlerts.map((alert, index) => <div key={`${alert}-${index}`}><Icon name="notifications" /><p>{alert}<small>{index === 0 ? 'Just now · All members' : 'Management update · All members'}</small></p></div>)}</div>
              </article>
            </div>

            <div className="management-grid lower">
              <article className="panel allocations-panel">
                <div className="panel-title"><h2>Assignment Allocation</h2><button onClick={() => openAssignment('Create a new assignment')}>+ Create assignment</button></div>
                {workAllocation.map((item, index) => <div className="allocation-row" key={item.title}><strong>{item.title}</strong><select value={item.assignee} onChange={e => updateAllocation(index, 'assignee', e.target.value)}>{team.filter(member => member.role !== 'Administrator').map(member => <option key={member.email}>{member.name}</option>)}</select><select value={item.status} onChange={e => updateAllocation(index, 'status', e.target.value)}><option>Not Started</option><option>In Progress</option><option>Ready for Review</option><option>Completed</option><option>Overdue</option></select></div>)}
              </article>
              <article className="panel analytics-panel">
                <div className="panel-title"><h2>Workload by Member</h2><button>Export report</button></div>
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
              <div className="panel-title"><h2>My Assignments</h2><button>View all assignments <Icon name="arrow" /></button></div>
              <div className="tabs">{['All', 'In Progress', 'Due Soon', 'Overdue', 'Completed'].map((tab, i) => <button className={i === 0 ? 'active' : ''} key={tab}>{tab}</button>)}</div>
              {workAllocation.map(item => (
                <button className="assignment-row" key={item.id} onClick={() => openAssignment(item.title,item.id)}>
                  <span className={`status-icon ${item.status==='Completed'?'green':item.status==='Overdue'?'orange':'yellow'}`}><Icon name={item.status==='Completed'?'check':item.status==='Overdue'?'warning':'clock'} /></span>
                  <div className="grow"><strong>{item.title}</strong><small>{item.division} · {item.assignee}</small></div>
                  <div className="due"><span>{item.dueDate?`Due: ${new Date(item.dueDate).toLocaleDateString('en-KE')}`:'No due date'}</span><em className={item.status==='Completed'?'green':item.status==='Overdue'?'orange':'yellow'}>{item.status}</em></div><span className="more">⋮</span>
                </button>
              ))}
            </article>

            <div className="right-stack">
              <article className="panel">
                <div className="panel-title"><h2>Announcements</h2><button>View all <Icon name="arrow" /></button></div>
                {announcements.map(([icon, title, text, date]) => <div className="announcement" key={title}><span className="square-icon orange"><Icon name={icon as IconName} /></span><div className="grow"><strong>{title}</strong><small>{text}</small></div><time>{date}</time></div>)}
              </article>
              <article className="panel calendar-panel">
                <div className="panel-title"><h2>Calendar</h2><button>View calendar <Icon name="arrow" /></button></div>
                <div className="calendar-body"><div className="date-card"><span>AUG</span><strong>06</strong><small>WED</small></div><div className="events"><p><b>Quarterly Research Review Meeting</b><span>10:00 AM – 12:00 PM</span></p><p><b>Due: Policy Review on PM</b><span>All day</span></p></div></div>
              </article>
            </div>
          </section>

          <section className="bottom-grid">
            <article className="panel knowledge-panel">
              <div className="panel-title"><h2>Recent Knowledge Added</h2><button>View all <Icon name="arrow" /></button></div>
              {knowledge.map(([title, meta, date]) => <div className="knowledge-row" key={title}><span className="square-icon"><Icon name="documents" /></span><div className="grow"><strong>{title}</strong><small>{meta}</small></div><time>{date}</time></div>)}
            </article>
            <article className="panel quick-links">
              <div className="panel-title"><h2>Quick Links</h2></div>
              <div>{([['knowledge', 'Knowledge Repository'], ['research', 'Research Repository'], ['documents', 'Documents'], ['reports', 'Reports'], ['team', 'Team & Users'], ['audit', 'Audit Logs'], ['notifications', 'Notifications'], ['settings', 'Settings']] as [IconName, string][]).map(([icon, label]) => <button key={label}><Icon name={icon} /><span>{label}</span>{label === 'Notifications' && <b>8</b>}</button>)}</div>
            </article>
            <article className="panel activity-panel">
              <div className="panel-title"><h2>Activity Feed</h2><button>View all <Icon name="arrow" /></button></div>
              {activity.map(([icon, title, text, time, tone]) => <div className="activity-row" key={title}><span className={`round-icon ${tone}`}><Icon name={icon as IconName} /></span><div className="grow"><strong>{title}</strong><small>{text}</small></div><time>{time}</time></div>)}
            </article>
          </section>
          <footer><span>© 2026 Public Service Commission, Kenya. All rights reserved.</span><div><a href="#">Privacy Policy</a><i /><a href="#">Terms of Use</a></div></footer>
        </div>
      </main>
      {active === 'Profile' && <div className="modal-backdrop" onClick={() => setActive('Dashboard')}><section className="profile-modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setActive('Dashboard')}>×</button><div className="profile-avatar">{user.initials}</div><h2>{user.name}</h2><p>{user.email}</p><em>{user.role}</em><h3>Access rights</h3><ul>{user.rights.map(right => <li key={right}><Icon name="check" />{right}</li>)}</ul><button className="sign-out" onClick={() => { setUser(null);setToken('');setPassword('');setActive('Dashboard') }}>Sign out</button></section></div>}
      {selectedAssignment && <div className="collab-drawer">
        <div className="drawer-head"><div><p>COLLABORATION WORKSPACE</p><h2>{selectedAssignment}</h2></div><button onClick={() => {setSelectedAssignment(null);setSelectedAssignmentId(null)}}>×</button></div>
        <div className="collab-members"><span className="avatar-chip">DK</span><span className="avatar-chip orange">MW</span><span className="avatar-chip green">GM</span><button>+ Add member</button></div>
        <div className="assignment-actions"><label>Status<select defaultValue="In Progress"><option>Not Started</option><option>In Progress</option><option>Ready for Review</option><option>Completed</option></select></label><button><Icon name="upload" /> Attach document</button></div>
        <h3>Team conversation</h3><div className="comments">{comments.map((item, index) => <div className="comment" key={`${item.author}-${index}`}><span>{item.author.split(' ').map(n => n[0]).join('')}</span><div><strong>{item.author}<time>{item.time}</time></strong><p>{item.text}</p></div></div>)}</div>
        <div className="comment-box"><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write an update or mention a team member with @..." /><button onClick={addComment}>Send update <Icon name="arrow" /></button></div>
      </div>}
    </div>
  )
}
