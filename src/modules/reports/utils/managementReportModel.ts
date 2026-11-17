import type {InstitutionalIntelligence} from '../../../api'

export type ManagementRecord = {
  id: string; type: string; title: string; status: string; team: string;
  people: {id:string;name:string;role:string}[]; due: string; updated: string;
  alerts: string[]; action: string; overdueDays: number;
}
const text=(value:unknown)=>String(value??'').trim()
export function reportDay(value:unknown):string {
  const raw=text(value)
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw
  const date=new Date(raw)
  return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
}
export function managementRecords(data:InstitutionalIntelligence):ManagementRecord[] {
  const asOf=reportDay(data.generatedAt)
  const contributions=data.capabilities.people?data.contributions:[]
  const source=[...data.overview.records,...data.attention.filter(r=>r.type==='Research')]
  const seen=new Set<string>()
  return source.flatMap(row=>{
    const id=text(row.id),type=text(row.type)||'Assignment',key=`${type}:${id}`
    if(!id||seen.has(key))return []
    seen.add(key)
    const people=contributions.filter(c=>text(c.work_id)===id&&text(c.work_type)===type).map(c=>({id:text(c.user_id),name:text(c.name),role:text(c.contribution_role)}))
    const due=reportDay(row.due_date),updated=reportDay(row.updated_at),status=text(row.status)
    const closed=['completed','archived','cancelled','canceled'].includes(status.toLowerCase())
    const remaining=due?(Date.parse(due)-Date.parse(asOf))/86400000:null
    const alerts:string[]=[]
    if(!closed){
      if(remaining!==null&&remaining<0)alerts.push('Overdue')
      if(remaining!==null&&remaining>=0&&remaining<=7)alerts.push('Due within 7 days')
      if(['Ready for Review','Awaiting Review','Under Review'].includes(status))alerts.push('Awaiting review')
      if(!due)alerts.push('Missing deadline')
      if((updated&&(Date.parse(asOf)-Date.parse(updated))/86400000>=30)||text(row.reason).includes('30+ days'))alerts.push('No update for 30 days')
      if(['Changes Requested','Revision Requested'].includes(status))alerts.push('Revision required')
    }
    const action=closed?'Retain the approved output and confirm repository filing.':alerts.includes('Overdue')?'Agree a recovery date with the responsible team; identify blockers and confirm the next deliverable.':alerts.includes('Awaiting review')?'Confirm the authorised reviewer and agree a decision date; check whether evidence is complete.':alerts.includes('Revision required')?'Clarify reviewer feedback and agree a resubmission date.':alerts.includes('No update for 30 days')?'Ask for a factual progress update and record blockers before drawing a performance conclusion.':alerts.includes('Missing deadline')?'Agree and record a realistic due date with the responsible team.':alerts.length?'Confirm readiness and resolve dependencies before the deadline.':'Confirm the next milestone at the regular team check-in.'
    return [{id,type,title:text(row.title),status,team:text(row.responsible_team||row.division)||'Unassigned team',people:people.length?people:row.owner_name?[{id:'',name:text(row.owner_name),role:'Research lead'}]:[],due,updated,alerts,action,overdueDays:remaining!==null&&remaining<0&&!closed?-remaining:0}]
  })
}
