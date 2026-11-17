export const moduleForEntity = type => ({assignment_task:'Tasks',assignment_task_request:'Tasks',external_research_import:'Research Repository',research_section:'Research Repository',task:'Tasks',assignment:'Assignments',research:'Research Repository',research_deadline:'Research Repository',research_milestone:'Research Repository',knowledge:'Document Repository',generated_document:'Reports & Analytics',document_review:'Reviews & Approvals',notice:'Notice Board',custom_event:'Calendar',document_deletion_request:'Document Repository'}[type] || (type?.startsWith('assignment')?'Assignments':'Notifications'))
export const entityKey = row => `${['task','assignment_task'].includes(row.entity_type)?'task':row.entity_type?.startsWith('assignment')?'assignment':row.entity_type}:${row.entity_id || row.id}`
export function unreadNotifications(rows){
  const seen=new Set()
  return rows.filter(row=>{
    if(row.read_at||row.archived_at)return false
    const key=entityKey(row)
    if(seen.has(key))return false
    seen.add(key);return true
  })
}
export const dayKey = value => value ? new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)) : null
export function buildPulse(records, notifications, calendar, now=new Date()){
  const today=dayKey(now), week=dayKey(new Date(now.getTime()+7*86400000))
  const closed=status=>['Completed','Final','Finalised','Published','Cancelled','Archived','Accepted'].includes(status)
  const unread=unreadNotifications(notifications)
  const badges={Notifications:unread.length}
  for(const n of unread){
    const module=moduleForEntity(n.entity_type)
    if(module!=='Notifications')badges[module]=(badges[module]||0)+1
    const legacyLeaveReview=n.entity_type==='leave_request'&&/leave request awaiting review/i.test(n.title||'')
    if((n.notification_category==='Review'||legacyLeaveReview)&&module!=='Reviews & Approvals')badges['Reviews & Approvals']=(badges['Reviews & Approvals']||0)+1
  }
  const modules=Object.fromEntries(['Assignments','Tasks','Research Repository','Reviews & Approvals','Reports & Analytics','Document Repository','Notice Board'].map(name=>[name,{rows:[],counts:{All:0,Active:0,Assigned:0,'In Progress':0,'Almost Due':0,Overdue:0,'Under Review':0,Returned:0,Completed:0,'My Reviews':0}}]))
  for(const row of records){
    row.key=`${row.module}:${row.type}:${row.id}`
    row.buckets=['All',row.status].filter((v,i,a)=>v&&a.indexOf(v)===i)
    const due=dayKey(row.dueDate)
    if(closed(row.status))row.buckets.push('Completed')
    else if(row.module==='Research Repository'){
      // Research uses Current as the umbrella lifecycle bucket so the literal
      // Active card remains status-specific instead of counting every open project.
      row.buckets.push('Current')
      if(due&&due<today)row.buckets.push('Overdue')
      if(due&&due>=today&&due<=week)row.buckets.push('Due Soon')
    }else{
      row.buckets.push('Active')
      if(due&&due<today)row.buckets.push('Overdue')
      if(due&&due>=today&&due<=week)row.buckets.push('Almost Due')
    }
    if(['Not Started','Assigned','Planning'].includes(row.status))row.buckets.push('Assigned')
    if(['In Progress','Active'].includes(row.status))row.buckets.push('In Progress')
    if(['Submitted','Under Review','Ready for Integration','Pending Approval'].includes(row.status))row.buckets.push('Under Review')
    if(['Changes Requested','Rejected','Returned'].includes(row.status))row.buckets.push('Returned')
    if(row.myReview)row.buckets.push('My Reviews')
    // needsAction may strengthen an open item, but it must never resurrect a
    // completed/approved terminal record into the personal attention queue.
    const terminalAttention=['Approved','Completed','Final','Finalised','Published','Cancelled','Archived','Accepted','Closed'].includes(row.status)
    const explicitAction=Boolean(row.needsAction)&&!terminalAttention
    const personallyOwned=Boolean(row.owned)
    const newlyAssigned=personallyOwned&&['Not Started','Assigned','Planning'].includes(row.status)
    const returnedToMe=personallyOwned&&row.buckets.includes('Returned')
    const deadlineAction=personallyOwned&&(row.buckets.includes('Overdue')||row.buckets.includes('Due Soon')||row.buckets.includes('Almost Due'))
    const readyToPublish=personallyOwned&&row.module==='Research Repository'&&row.status==='Ready to Publish'
    if(newlyAssigned)row.buckets.push('Newly Assigned')
    if(returnedToMe)row.buckets.push('Returned to Me')
    if(row.buckets.includes('Due Soon')||row.buckets.includes('Almost Due'))row.buckets.push('Due Soon')
    if(explicitAction)row.buckets.push('Action Required')
    if(readyToPublish)row.buckets.push('Ready to Publish')
    if(!terminalAttention&&(newlyAssigned||returnedToMe||deadlineAction||row.myReview||explicitAction||readyToPublish))row.buckets.push('Needs Attention')
    row.buckets=[...new Set(row.buckets)]
    const module=modules[row.module] ||= {rows:[],counts:{}}
    module.rows.push(row)
    for(const bucket of row.buckets)module.counts[bucket]=(module.counts[bucket]||0)+1
  }
  const read=notifications.filter(n=>n.read_at&&!n.archived_at)
  const notificationRows=[...unread,...read].map(n=>({id:n.id,key:`notification:${n.id}`,title:n.title,status:n.read_at?'Read':'Unread',module:'Notifications',type:'Notification',destination:'Notifications',contextId:n.entity_id,buckets:['All',n.read_at?'Read':'Unread',moduleForEntity(n.entity_type)]}))
  modules.Notifications={rows:notificationRows,counts:{All:notificationRows.length,Unread:unread.length,Read:read.length}}
  const calendarRows=calendar.filter(row=>!closed(row.status)).map(row=>({...row,day:dayKey(row.start_at)}))
  const calendarCounts={Today:calendarRows.filter(r=>r.day===today).length,'Next 7 days':calendarRows.filter(r=>r.day>today&&r.day<=week).length,'Past Due':calendarRows.filter(r=>r.day<today&&!['notice','custom_event'].includes(r.type)).length}
  badges.Calendar=calendarCounts.Today
  // The attention queue is personal/actionable. Merge duplicate work/review
  // representations of the same underlying destination entity while retaining reasons.
  const attentionMap=new Map()
  for(const row of records.filter(r=>r.buckets.includes('Needs Attention'))){
    const key=`${row.destination||row.module}:${row.id}`
    const existing=attentionMap.get(key)
    if(!existing)attentionMap.set(key,{...row,buckets:[...row.buckets]})
    else{
      existing.buckets=[...new Set([...existing.buckets,...row.buckets])]
      existing.myReview=Boolean(existing.myReview||row.myReview)
      existing.owned=Boolean(existing.owned||row.owned)
      existing.reviewKind=existing.reviewKind||row.reviewKind
    }
  }
  const attention=[...attentionMap.values()]
  // One authoritative card-count contract feeds both the dashboard landing cards
  // and the left navigation. Counts are derived only from the exact scoped rows
  // returned in this pulse snapshot so they cannot drift from drill-down data.
  const cardCounts={
    'Needs My Attention':attention.length,
    Assignments:modules.Assignments?.counts?.All||0,
    Tasks:modules.Tasks?.counts?.All||0,
    'Research Repository':modules['Research Repository']?.counts?.All||0,
    'Reviews & Approvals':modules['Reviews & Approvals']?.counts?.All||0,
    Notifications:unread.length,
    Calendar:calendarRows.length,
    'Reports & Analytics':modules['Reports & Analytics']?.counts?.All||0,
    'Document Repository':modules['Document Repository']?.counts?.All||0,
    'Notice Board':modules['Notice Board']?.counts?.All||0,
    'Team & Users':modules['Team & Users']?.counts?.All||0,
  }
  return {generatedAt:now.toISOString(),today,week,modules,badges,unread,attention,calendar:calendarRows,calendarAll:calendar,calendarCounts,cardCounts}
}
