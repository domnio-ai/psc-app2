import {repairDisplayText} from '../../utils/repairDisplayText';
import {useEffect,useState} from 'react';
import type {PulseData,PulseRow,PulseCalendar} from './pulseTypes';
import type { TaskDashboardShortcutLabel } from '../tasks/taskDashboardShortcut';
import DashboardRecordPickerModal, { type DashboardRecordChoice, type DashboardPickerAction } from './DashboardRecordPickerModal';
import {
 readDashboardNavigationMemory,
 toggleDashboardWorkspacePin,
} from './dashboardNavigationMemory';
import DashboardCommandPalette from './DashboardCommandPalette';
import './pulse.css';
import './dashboard-task-command-centre.css';
import './dashboard-drilldown.css';
const dashboardDay=(value?:string)=>value?(/^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))):undefined;
const filters:Record<string,string[]>={'Needs My Attention':['All','Newly Assigned','Overdue','Due Soon','Returned to Me','My Reviews'],Tasks:['All','Assigned','In Progress','Almost Due','Overdue','Under Review','Returned','Completed'],Assignments:['All','Active','Almost Due','Overdue','Under Review','Returned','Completed'],'Research Repository':['Current','Planning','Active','Under Review','Changes Requested','Ready to Publish','Due Soon','Overdue'],'Reviews & Approvals':['All','My Reviews'],'Reports & Analytics':['All','Draft','Under Review','Returned','Approved','Completed'],'Document Repository':['All','Draft','Under Review','Returned','Published'],'Notice Board':['All','Urgent','Important','Information'],'Team & Users':['All','On Leave','Available','Busy','Away','Researcher','Assistant Director','Deputy Director','Director','System Admin'],Notifications:['All','Unread','Read'],Calendar:['All','Today','Next 7 days','Past Due']};
const modules=['Needs My Attention','Assignments','Tasks','Research Repository','Reviews & Approvals','Notifications','Notice Board','Calendar','Meetings','Reports & Analytics','Document Repository','Team & Users','AI Researcher','Felix Administration','Audit Logs','Settings'];
type ModuleMeta={eyebrow:string;description:string;tone:string};
type DashboardTaskRequestChoice = {
 id:string;
 title:string;
 requested_by_name?:string;
 assignment_title?:string;
 priority?:string;
 due_date?:string|null;
 created_at?:string;
 status:string;
};
type RecordPickerState = { title:string; description:string; items:DashboardRecordChoice[]; actions?:DashboardPickerAction[]; emptyMessage:string } | null;

const moduleMeta:Record<string,ModuleMeta>={
 'Needs My Attention':{eyebrow:'Immediate action',description:'New assignments, deadlines, returned work and reviews requiring your action',tone:'danger'},
 'Assignments':{eyebrow:'Delivery',description:'Assignments in your authorised work context',tone:'blue'},
 'Tasks':{eyebrow:'Execution',description:'Tasks assigned to you and work in progress',tone:'teal'},
 'Research Repository':{eyebrow:'Research',description:'Current governed research and review work',tone:'violet'},
 'Reviews & Approvals':{eyebrow:'Governance',description:'Items waiting for your review or decision',tone:'amber'},
 'Notifications':{eyebrow:'Updates',description:'Unread changes across REDESY',tone:'indigo'},
 'Notice Board':{eyebrow:'Institution',description:'Important institutional notices',tone:'gold'},
 'Calendar':{eyebrow:'Schedule',description:'Upcoming deadlines, meetings and events',tone:'cyan'},
 'Meetings':{eyebrow:'Collaboration',description:'Schedule meetings, agendas, minutes and decisions',tone:'teal'},
 'Reports & Analytics':{eyebrow:'Insight',description:'Reports and decision-support analytics',tone:'green'},
 'Document Repository':{eyebrow:'Knowledge',description:'Governed documents and published records',tone:'slate'},
 'Team & Users':{eyebrow:'People',description:'Team and user workspace',tone:'rose'},
 'AI Researcher':{eyebrow:'Felix',description:'Research and institutional AI support',tone:'purple'},
 'Felix Administration':{eyebrow:'Administration',description:'Felix health, indexing and assurance controls',tone:'indigo'},
 'Audit Logs':{eyebrow:'Assurance',description:'Audit and governance records',tone:'orange'},
 'Settings':{eyebrow:'System',description:'Preferences and workspace settings',tone:'neutral'},
};


export default function ProgressiveDashboard({
 data,error,onOpen,onNavigate,canSee,onRefresh,onCalendar,initialModule='',onModuleChange,
 showTaskRequestApprovalCard=false,taskRequestApprovalCount=0,taskRequestApprovalItems=[],onOpenTaskRequestApprovals,onOpenTaskDashboardShortcut,
}:{
 initialModule?:string;
 onModuleChange?:(module:string)=>void;
 showTaskRequestApprovalCard?:boolean;
 taskRequestApprovalCount?:number;
 taskRequestApprovalItems?:DashboardTaskRequestChoice[];
 onOpenTaskRequestApprovals?:(requestId:string)=>void;
 onOpenTaskDashboardShortcut?:(label:TaskDashboardShortcutLabel,taskIds:string[])=>void;
 data:PulseData|null;
 error:string;
 onOpen:(r:PulseRow)=>void;
 onNavigate:(s:string)=>void;
 canSee:(s:string)=>boolean;
 onRefresh:()=>void;
 onCalendar:(r:PulseCalendar)=>void;
}){
 const [module,setModule]=useState('');
 const [navigationMemory,setNavigationMemory]=useState(readDashboardNavigationMemory);
 const [recordPicker,setRecordPicker]=useState<RecordPickerState>(null);
 useEffect(()=>{setModule(initialModule)},[initialModule]);
 const choose=(value:string)=>{
  onModuleChange?.(value);setModule(value);
 };
 if(!data)return <section className="pulse-dashboard" role="status"><p>{error||'Loading your dashboard…'}</p><button onClick={onRefresh}>Retry</button></section>;
 const managementView=data.scope!=='Own work and assigned reviews';
 const dashboardRows=[...new Map(Object.values(data.modules).flatMap(entry=>entry?.rows||[]).map(row=>[row.key,row])).values()];
 const authorisedWorkspaces=modules.filter(value=>value==='Needs My Attention'||canSee(value));
 const commandRecords=dashboardRows.map(row=>({key:row.key,title:repairDisplayText(row.title),module:row.module==='Research Repository'?'Research':repairDisplayText(row.module),status:repairDisplayText(row.status)}));
 const rowByKey=new Map(dashboardRows.map(row=>[row.key,row]));
 const openCommandRecord=(key:string)=>{const row=rowByKey.get(key);if(row)onOpen(row)};
 const commandWorkspaceLabel=(value:string)=>value==='Research Repository'?'Research Workspace':value;
 const openFullWorkspace=(value:string)=>onNavigate(value==='Needs My Attention'?'Reviews & Approvals':value);
 const toggleWorkspacePin=(label:string)=>setNavigationMemory(current=>toggleDashboardWorkspacePin(current,label));
 const teamUserMatches=(r:PulseRow,label:string)=>{const person=r as PulseRow&{availabilityStatus?:string;role?:string};return label==='All'||person.availabilityStatus===label||person.role===label||r.status===label};
 const openModuleActionPicker=(targetModule:string,label:string)=>{
  const sourceRows=targetModule==='Needs My Attention'?data.attention:(data.modules[targetModule]?.rows||[]);
  const matchingRows=label==='All'?sourceRows:targetModule==='Team & Users'?sourceRows.filter(row=>teamUserMatches(row,label)):sourceRows.filter(row=>row.buckets.includes(label));
  const moduleActionLabels:Record<string,{label:string;description:string}>={
   'Needs My Attention':{label:'Open review queue',description:'Open the governed review and decision workspace.'},
   'Reviews & Approvals':{label:'Open review queue',description:'Review items assigned to you within your authorised scope.'},
   'Notifications':{label:'Open notification centre',description:'Read updates, follow required actions and manage your inbox.'},
   'Notice Board':{label:'Open notice board',description:'Read institutional notices and announcements.'},
   'Calendar':{label:'Open calendar',description:'Review deadlines, meetings and scheduled events.'},
   'Reports & Analytics':{label:'Open reports and analytics',description:'Explore available reports and management insights.'},
   'Document Repository':{label:'Open document repository',description:'Search and open governed documents in your permitted scope.'},
   'Team & Users':{label:'Open team and users',description:'View team members and available user-management actions.'},
  };
  const action=moduleActionLabels[targetModule]||{label:`Open ${targetModule}`,description:`Continue in the ${targetModule} workspace.`};
  const recordItems:DashboardRecordChoice[]=targetModule==='Calendar'
   ?data.calendar.filter(event=>label==='All'||(label==='Today'?event.day===data.today:label==='Next 7 days'?event.day>data.today&&event.day<=data.week:label==='Past Due'?event.day<data.today:event.status===label)).map(event=>({
     key:`calendar:${event.id}`,title:repairDisplayText(event.title),kind:repairDisplayText(event.type||'Calendar event'),
     detail:event.start_at?new Date(event.start_at).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short'}):'Scheduled event',
     status:repairDisplayText(event.status),date:dashboardDay(event.day),onSelect:()=>onCalendar(event),
    }))
   :matchingRows.map(row=>({key:row.key,title:repairDisplayText(row.title),kind:repairDisplayText(row.type||row.module),
     detail:row.buckets.filter(bucketLabel=>bucketLabel!==label&&bucketLabel!=='All').join(' · '),
     status:repairDisplayText(row.status),date:dashboardDay(row.dueDate),onSelect:()=>onOpen(row),
    }));
  const workspace=targetModule==='Needs My Attention'?'Reviews & Approvals':targetModule;
  setRecordPicker({
   title:`${label==='All'?'All':label} · ${targetModule==='Research Repository'?'Research':targetModule}`,
   description:`Choose a module action or open a specific record matching ${label==='All'?'this workspace':`“${label}”`} in your authorised scope.`,
   emptyMessage:`There are no ${targetModule.toLowerCase()} records matching “${label}” in your authorised scope.`,
   actions:[
    {key:'module-workspace',label:action.label,description:action.description,onSelect:()=>onNavigate(workspace)},
   ],
   items:recordItems,
  });
 };
 const rows=module==='Needs My Attention'?data.attention:data.modules[module]?.rows||[];
 const counts=module==='Calendar'?{All:data.calendar.length,...data.calendarCounts}:module==='Needs My Attention'?{All:rows.length}:data.modules[module]?.counts;
 const attentionMatches=(r:PulseRow,label:string)=>label==='All'||r.buckets.includes(label);
 const attentionFilterLabels=module==='Needs My Attention'?[...(filters[module]||['All']),'Action Required','Ready to Publish']:filters[module];
 const attentionCounts=module==='Needs My Attention'?Object.fromEntries((attentionFilterLabels||['All']).map(label=>[label,rows.filter(r=>attentionMatches(r,label)).length])):null;
 const teamUserCounts=module==='Team & Users'?Object.fromEntries((filters[module]||['All']).map(label=>[label,rows.filter(r=>teamUserMatches(r,label)).length])):null;
 const resolvedCounts=module==='Needs My Attention'?attentionCounts:module==='Team & Users'?teamUserCounts:counts;
 const visibleCounts=resolvedCounts&&attentionFilterLabels?Object.fromEntries(attentionFilterLabels.map(label=>[label,resolvedCounts[label]||0])):resolvedCounts;
 return <section className={`pulse-dashboard ${!module?'pulse-dashboard-home':'pulse-dashboard-module'}`} aria-label="Progressive dashboard">
  <a className="pulse-skip-link" href="#pulse-dashboard-content">Skip to dashboard content</a>
  <nav className="pulse-breadcrumb pulse-command-bar" aria-label="Dashboard breadcrumb">
    <div className="pulse-command-path">
      <button onClick={()=>choose('')}>Dashboard</button>
      {module&&<><span>›</span><span>{module}</span></>}
    </div>
    <div className="pulse-command-status">
      <span className="pulse-live-dot" aria-hidden="true"/>
      <small>{data.scope} · Updated {new Date(data.generatedAt).toLocaleTimeString()}</small>
      <DashboardCommandPalette workspaces={authorisedWorkspaces} records={commandRecords} labelForWorkspace={commandWorkspaceLabel} onInspectWorkspace={choose} onOpenWorkspace={openFullWorkspace} onOpenRecord={openCommandRecord}/>
      <button onClick={onRefresh}>Refresh</button>
    </div>
  </nav>

  {error&&<p className="pulse-refresh-warning" role="alert">Refresh failed. Showing the last successful snapshot. {repairDisplayText(error)}</p>}

  <main id="pulse-dashboard-content" className="pulse-dashboard-content" tabIndex={-1}>
  {!module?(
    <div className="pulse-landing pulse-card-first-landing dashboard-task-command-home">
      <section className="pulse-card-first-header module-command-centre-head dashboard-task-command-head" aria-label="Dashboard overview">
        <div>
          <span className="pulse-hero-eyebrow">REDESY DASHBOARD</span>
          <h1>{managementView?'Management overview':'My work'}</h1>
          <p>{managementView?'Authorised priorities and operational status. Select a card for detail.':'Your work, decisions and updates. Select a card for detail.'}</p>
        </div>
        <div className="pulse-card-first-scope"><span>Scope</span><strong>{data.scope}</strong><small>Authorised view</small></div>
      </section>

      <section className="pulse-card-first-grid module-kpi-strip dashboard-task-command-kpis" aria-label="Dashboard work areas">
        {[

          'Assignments',
          'Tasks',
          'Research Repository',
          'Reviews & Approvals',
          'Notifications',
          'Calendar',
          'Meetings',
          'Notice Board',
          'Document Repository',
          ...(managementView&&canSee('Team & Users')?['Team & Users']:[]),
          'Reports & Analytics',
        ].filter(value=>canSee(value)).map(m=>{
          const meta=moduleMeta[m]||{eyebrow:'Workspace',description:'Open workspace',tone:'neutral'};
          const value=m==='Meetings'?'Open':data.cardCounts?.[m]??(m==='Needs My Attention'?data.attention.length:m==='Notifications'?data.unread.length:m==='Calendar'?data.calendar.length:data.modules[m]?.counts.All??0);
          const detail=m==='Meetings'?'Schedule meetings, agendas, minutes and decisions':m==='Needs My Attention'?'Items requiring action':m==='Notifications'?`${data.unread.length} unread update${data.unread.length===1?'':'s'}`:m==='Calendar'?`${data.calendar.length} scheduled · ${data.calendarCounts.Today||0} today · ${data.calendarCounts['Next 7 days']||0} next 7 days`:m==='Research Repository'?'Current governed research, including ready to publish':m==='Team & Users'?'People in authorised scope':meta.description;
          const alert=m==='Needs My Attention'&&Number(value)>0;
          return <button key={m} type="button" className={`pulse-card-first-card pulse-tone-${meta.tone} ${alert?'pulse-card-first-alert':''}`} onClick={()=>m==='Meetings'?onNavigate('Meetings'):["Tasks", "Assignments", "Research Repository"].includes(m)?choose(m):openModuleActionPicker(m,"All")}>
            <span>{meta.eyebrow}</span>
            <strong>{m==='Research Repository'?'Research Workspace':m}</strong>
            <b>{value}</b>
            <small>{detail}</small>
            <em>View details <i aria-hidden="true">→</i></em>
          </button>;
        })}
      </section>

      <section className="pulse-card-first-guidance" aria-label="Dashboard guidance">
        <strong>Details appear only when you select a card.</strong>
        <span>This keeps the landing dashboard concise. Choose a status card to select a specific record or open the relevant workspace.</span>
      </section>
    </div>
  ):(
    <div className="pulse-module-overview dashboard-task-subtree dashboard-drilldown-home">
      <header className="pulse-module-hero module-command-centre-head dashboard-task-subtree-head dashboard-drilldown-head">
        <div>
          <span>{moduleMeta[module]?.eyebrow||'Workspace'}</span>
          <h1>{module==='Research Repository'?'Research Workspace':module}</h1>
          <p>{moduleMeta[module]?.description||'Explore this workspace by status or category.'} <strong>{data.scope}</strong> scope.</p>
        </div>
        <div className="pulse-module-actions">
          <button className="pulse-pin-workspace" type="button" onClick={()=>toggleWorkspacePin(module)} aria-pressed={navigationMemory.pinnedWorkspaces.includes(module)}>{navigationMemory.pinnedWorkspaces.includes(module)?'Unpin workspace':'Pin workspace'}</button>
          <button className="pulse-full-workspace" onClick={()=>onNavigate(module==='Needs My Attention'?'Reviews & Approvals':module)}>Open full workspace <span aria-hidden="true">→</span></button>
        </div>
      </header>
      <div className="pulse-cards pulse-child-cards module-kpi-strip dashboard-task-subtree-kpis dashboard-drilldown-kpis">
        {visibleCounts?Object.entries(visibleCounts).map(([label,count])=>{
          const state=count>0&&["Overdue","Past Due","Returned","Changes Requested","Urgent","Action Required"].includes(label)?"pulse-critical":count>0&&["Almost Due","My Reviews","Under Review","Unread","Important","Today","Ready to Publish"].includes(label)?"pulse-highlight":"";
          const openCard = () => {
            if (["Tasks", "Assignments", "Research Repository"].includes(module)) {
              const sourceRows = data.modules[module]?.rows || [];
              const matchingRows = label === "All" ? sourceRows : sourceRows.filter((row) => row.buckets.includes(label));
              const workspaceLabel = module === "Research Repository" ? "research" : module.toLowerCase();
              setRecordPicker({
                title: `${label === "All" ? "All" : label} ${workspaceLabel}`,
                description: `Choose a specific ${workspaceLabel === "research" ? "research project" : workspaceLabel === "assignments" ? "assignment" : "task"} to open.`,
                emptyMessage: `There are no ${workspaceLabel} records matching “${label}” in your authorised scope.`,
                items: matchingRows.map((row) => ({
                  key: row.key,
                  title: repairDisplayText(row.title),
                  kind: repairDisplayText(row.type || row.module),
                  detail: row.buckets.filter((bucketLabel) => bucketLabel !== label && bucketLabel !== "All").join(" · "),
                  status: repairDisplayText(row.status),
                  date: dashboardDay(row.dueDate),
                  onSelect: () => onOpen(row),
                })),
              });
              return;
            }
            openModuleActionPicker(module,label);
          };
          const chooserModule = ["Tasks", "Assignments", "Research Repository"].includes(module);
          const itemWord = module === "Tasks" ? "task" : module === "Assignments" ? "assignment" : "research item";
          const countLabel = chooserModule
            ? `${count} ${itemWord}${count === 1 ? "" : "s"}`
            : count === 1 ? "1 matching record" : `${count} matching records`;
          return <button type="button" className={`pulse-card pulse-child-card ${state}`} key={label} onClick={openCard} aria-label={chooserModule ? `Choose ${label} ${itemWord}${count === 1 ? "" : "s"}` : undefined}>
            <span className="pulse-card-title">{label}</span>
            <strong>{count}</strong>
            <small>{countLabel}</small>
            <span className="pulse-card-open">{chooserModule ? "Choose item" : "View"} <b aria-hidden="true">→</b></span>
          </button>;
        }):<button className="pulse-card pulse-child-card" onClick={()=>onNavigate(module)}>
          <span className="pulse-card-eyebrow">Workspace</span>
          <span className="pulse-card-title">Open {module}</span>
          <strong>→</strong>
          <small>Continue in the full workspace</small>
        </button>}
        {module === "Tasks" && showTaskRequestApprovalCard && (
          <button
            type="button"
            className={`pulse-card pulse-child-card pulse-task-request-approval-card ${taskRequestApprovalCount > 0 ? "pulse-highlight" : ""}`}
            onClick={() => setRecordPicker({
              title: "Task Requests Awaiting Approval",
              description: "Choose the request you want to review. Selecting a request opens its approval form.",
              emptyMessage: "There are no pending Task Requests awaiting your decision in your authorised scope.",
              items: taskRequestApprovalItems.map((request) => ({
                key: request.id,
                title: repairDisplayText(request.title),
                kind: "Task Request",
                detail: [request.assignment_title, request.requested_by_name ? `Requested by ${request.requested_by_name}` : "", request.priority ? `Priority ${request.priority}` : ""].filter(Boolean).join(" · "),
                status: repairDisplayText(request.status),
                date: dashboardDay(request.due_date || undefined),
                onSelect: () => onOpenTaskRequestApprovals?.(request.id),
              })),
            })}
            aria-label={`Choose a Task Request to approve, ${taskRequestApprovalCount} pending`}
          >
            <span className="pulse-card-title">Task Requests Awaiting Approval</span>
            <strong>{taskRequestApprovalCount}</strong>
            <small>{taskRequestApprovalCount === 0 ? "No requests awaiting your decision" : taskRequestApprovalCount === 1 ? "1 request awaiting your decision" : `${taskRequestApprovalCount} requests awaiting your decision`}</small>
            <span className="pulse-card-open">Choose request <b aria-hidden="true">→</b></span>
          </button>
        )}
      </div>
    </div>
  )}
  </main>
  <DashboardRecordPickerModal
    open={Boolean(recordPicker)}
    title={recordPicker?.title || "Select a record"}
    description={recordPicker?.description || "Choose a record to continue."}
    items={recordPicker?.items || []}
    actions={recordPicker?.actions}
    emptyMessage={recordPicker?.emptyMessage}
    onClose={() => setRecordPicker(null)}
  />
 </section>
}

export function PulseBell({data,arrival,onOpen,onNavigate}:{data:PulseData|null;arrival:boolean;onOpen:(id:string)=>void;onNavigate:()=>void}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[open]);
 return <div className="pulse-bell"><button className={`notification-button ${arrival?'pulse-arrival':''}`} aria-label={`Notifications, ${data?.unread.length||0} unread`} aria-expanded={open} onClick={()=>setOpen(!open)}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{!!data?.unread.length&&<b>{data.unread.length}</b>}</button>{arrival&&<span className="pulse-announcement" role="status">New activity received</span>}{open&&<section className="pulse-inbox" aria-label="Notifications"><header><strong>What changed</strong><button onClick={()=>setOpen(false)} aria-label="Close notifications">×</button></header>{data?.unread.slice(0,8).map(n=><button key={n.id} onClick={()=>{setOpen(false);onOpen(n.id)}}><strong>{repairDisplayText(n.title)}</strong><span>{repairDisplayText(n.body)}</span><small>Open →</small></button>)}{!data?.unread.length&&<p>You’re up to date.</p>}<button onClick={()=>{setOpen(false);onNavigate()}}>Open notification centre{(data?.unread.length||0)>8?` (${data?.unread.length})`:''}</button></section>}</div>
}
