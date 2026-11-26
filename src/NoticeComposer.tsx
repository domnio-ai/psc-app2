import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { ApiUser, NoticeAudienceRule } from './api'

export type NoticeFormState = {
  title:string
  body:string
  severity:string
  audienceRole:string
  audienceRules:NoticeAudienceRule[]
  acknowledgementRequired:boolean
  eventStart:string
  eventEnd:string
  expiresAt:string
}
type Props = {
  form:NoticeFormState
  setForm:Dispatch<SetStateAction<NoticeFormState>>
  onSubmit:(event:FormEvent)=>void
  users:ApiUser[]
  canTargetSpecificRecipients:boolean
}
type AudienceType = NoticeAudienceRule['type']

const roles = ['System Admin','Director','Deputy Director','Assistant Director','Researcher']
const datePart = (value:string) => value.split('T')[0] || ''
const timePart = (value:string) => value.split('T')[1]?.slice(0,5) || ''
const combine = (date:string,time:string,fallback:string) => date ? date+'T'+(time || fallback) : ''

export default function NoticeComposer({form,setForm,onSubmit,users,canTargetSpecificRecipients}:Props){
  const [audienceType,setAudienceType]=useState<AudienceType>('ORGANISATION')
  const [audienceValue,setAudienceValue]=useState('*')
  const activeUsers=useMemo(()=>users.filter(user=>user.active).sort((a,b)=>a.name.localeCompare(b.name)),[users])
  const directorates=useMemo(()=>[...new Set(activeUsers.map(user=>user.division.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),[activeUsers])
  const selectedRules=form.audienceRules?.length?form.audienceRules:[{type:'ORGANISATION' as const,value:'*'}]

  const setStartDate=(value:string)=>setForm(current=>({...current,eventStart:combine(value,timePart(current.eventStart),'09:00'),eventEnd:current.eventEnd||combine(value,'','17:00')}))
  const setStartTime=(value:string)=>setForm(current=>({...current,eventStart:combine(datePart(current.eventStart),value,'09:00')}))
  const setEndDate=(value:string)=>setForm(current=>({...current,eventEnd:combine(value,timePart(current.eventEnd),'17:00')}))
  const setEndTime=(value:string)=>setForm(current=>({...current,eventEnd:combine(datePart(current.eventEnd),value,'17:00')}))

  const addAudience=()=>{
    const rule:NoticeAudienceRule={type:audienceType,value:audienceType==='ORGANISATION'?'*':audienceValue}
    if(rule.type!=='ORGANISATION'&&!rule.value)return
    setForm(current=>{
      const currentRules=current.audienceRules||[]
      const base=rule.type==='ORGANISATION'?[]:currentRules.filter(item=>item.type!=='ORGANISATION')
      if(base.some(item=>item.type===rule.type&&item.value===rule.value))return current
      return {
        ...current,
        audienceRules:[...base,rule],
        audienceRole:rule.type==='ROLE'&&base.length===0?rule.value:'',
      }
    })
  }
  const removeAudience=(rule:NoticeAudienceRule)=>{
    setForm(current=>{
      const remaining=(current.audienceRules||[]).filter(item=>item.type!==rule.type||item.value!==rule.value)
      return {
        ...current,
        audienceRules:remaining.length?remaining:[{type:'ORGANISATION',value:'*'}],
        audienceRole:'',
      }
    })
  }
  const labelFor=(rule:NoticeAudienceRule)=>{
    if(rule.type==='ORGANISATION')return 'All active members'
    if(rule.type==='ROLE')return 'Role: '+rule.value
    if(rule.type==='DIRECTORATE')return 'Directorate: '+rule.value
    return 'Individual: '+(activeUsers.find(user=>user.id===rule.value)?.name||'Selected account')
  }
  const choices=audienceType==='ROLE'
    ? roles.map(role=>({value:role,label:role}))
    : audienceType==='DIRECTORATE'
      ? directorates.map(value=>({value,label:value}))
      : audienceType==='USER'
        ? activeUsers.map(user=>({value:user.id,label:user.name+' · '+user.division}))
        : [{value:'*',label:'All active members'}]

  return <form className="notice-composer reliable-notice-composer" onSubmit={onSubmit}>
    <h3>Submit a public notice</h3>
    <label>Title<input value={form.title} onChange={event=>setForm(current=>({...current,title:event.target.value}))} minLength={3} maxLength={200} required/></label>
    <label>Information<textarea value={form.body} onChange={event=>setForm(current=>({...current,body:event.target.value}))} minLength={3} maxLength={4000} required/></label>

    <div className="form-pair">
      <label>Importance<select value={form.severity} onChange={event=>setForm(current=>({...current,severity:event.target.value}))}><option>Information</option><option>Important</option><option>Urgent</option></select></label>
      <label>Audience type
        <select value={audienceType} onChange={event=>{const next=event.target.value as AudienceType;setAudienceType(next);setAudienceValue(next==='ORGANISATION'?'*':'')}}>
          <option value="ORGANISATION">Organisation</option>
          <option value="ROLE">Role</option>
          {canTargetSpecificRecipients&&<option value="DIRECTORATE">Directorate</option>}
          {canTargetSpecificRecipients&&<option value="USER">Individual user</option>}
        </select>
      </label>
    </div>
    {audienceType!=='ORGANISATION'&&<label>Audience selection
      <select value={audienceValue} onChange={event=>setAudienceValue(event.target.value)} required>
        <option value="">Choose {audienceType.toLowerCase()}</option>
        {choices.map(choice=><option value={choice.value} key={choice.value}>{choice.label}</option>)}
      </select>
      {(audienceType==='DIRECTORATE'||audienceType==='USER')&&!choices.length&&<small>Account directory is not loaded. Open the Users workspace first or contact an administrator.</small>}
    </label>}
    <button type="button" className="notice-audience-add" onClick={addAudience} disabled={audienceType!=='ORGANISATION'&&!audienceValue}>Add audience</button>
    <div className="notice-audience-list" aria-label="Selected notice audiences">
      {selectedRules.map(rule=><span key={rule.type+':'+rule.value}>{labelFor(rule)}{selectedRules.length>1&&<button type="button" aria-label={'Remove '+labelFor(rule)} onClick={()=>removeAudience(rule)}>×</button>}</span>)}
    </div>
    <label className="notice-acknowledgement-option">
      <input type="checkbox" checked={Boolean(form.acknowledgementRequired)} onChange={event=>setForm(current=>({...current,acknowledgementRequired:event.target.checked}))}/>
      <span><strong>Require formal acknowledgement</strong><small>Recipients must actively confirm that they have read the notice. Opening it or marking its notification as read does not count.</small></span>
    </label>

    <label>Notice expiry <input type="datetime-local" value={form.expiresAt} min={new Date().toISOString().slice(0,16)} onChange={event=>setForm(current=>({...current,expiresAt:event.target.value}))} required/><small>Required. The notice will be removed automatically and you will be notified.</small></label>
    <fieldset className="notice-date-fields"><legend>Calendar event (optional)</legend>
      <div className="form-pair"><label>Start date<input type="date" value={datePart(form.eventStart)} onInput={event=>setStartDate(event.currentTarget.value)}/></label><label>Start time<input type="time" value={timePart(form.eventStart)} disabled={!form.eventStart} onInput={event=>setStartTime(event.currentTarget.value)}/></label></div>
      <div className="form-pair"><label>End date<input type="date" value={datePart(form.eventEnd)} min={datePart(form.eventStart)||undefined} disabled={!form.eventStart} onInput={event=>setEndDate(event.currentTarget.value)}/></label><label>End time<input type="time" value={timePart(form.eventEnd)} disabled={!form.eventEnd} onInput={event=>setEndTime(event.currentTarget.value)}/></label></div>
      <small>Choose the start date first. Times are saved using your local timezone.</small>
    </fieldset>
    <button className="settings-save">Submit for approval</button>
  </form>
}
