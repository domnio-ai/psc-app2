import type { Dispatch, FormEvent, SetStateAction } from 'react'

export type NoticeFormState = { title:string; body:string; severity:string; audienceRole:string; eventStart:string; eventEnd:string; expiresAt:string }
type Props = { form:NoticeFormState; setForm:Dispatch<SetStateAction<NoticeFormState>>; onSubmit:(event:FormEvent)=>void }
const datePart = (value:string) => value.split('T')[0] || ''
const timePart = (value:string) => value.split('T')[1]?.slice(0,5) || ''
const combine = (date:string,time:string,fallback:string) => date ? `${date}T${time || fallback}` : ''

export default function NoticeComposer({form,setForm,onSubmit}:Props){
  const setStartDate=(value:string)=>setForm(current=>({...current,eventStart:combine(value,timePart(current.eventStart),'09:00'),eventEnd:current.eventEnd||combine(value,'','17:00')}))
  const setStartTime=(value:string)=>setForm(current=>({...current,eventStart:combine(datePart(current.eventStart),value,'09:00')}))
  const setEndDate=(value:string)=>setForm(current=>({...current,eventEnd:combine(value,timePart(current.eventEnd),'17:00')}))
  const setEndTime=(value:string)=>setForm(current=>({...current,eventEnd:combine(datePart(current.eventEnd),value,'17:00')}))
  return <form className="notice-composer reliable-notice-composer" onSubmit={onSubmit}>
    <h3>Submit a public notice</h3>
    <label>Title<input value={form.title} onChange={event=>setForm({...form,title:event.target.value})} minLength={3} maxLength={200} required/></label>
    <label>Information<textarea value={form.body} onChange={event=>setForm({...form,body:event.target.value})} minLength={3} maxLength={4000} required/></label>
    <div className="form-pair"><label>Importance<select value={form.severity} onChange={event=>setForm({...form,severity:event.target.value})}><option>Information</option><option>Important</option><option>Urgent</option></select></label><label>Audience<select value={form.audienceRole} onChange={event=>setForm({...form,audienceRole:event.target.value})}><option value="">All members</option>{['Administrator','Research Manager','Research Officer','Reviewer'].map(role=><option key={role}>{role}</option>)}</select></label></div>
    <label>Notice expiry <input type="datetime-local" value={form.expiresAt} min={new Date().toISOString().slice(0,16)} onChange={event=>setForm({...form,expiresAt:event.target.value})} required/><small>Required. The notice will be removed automatically and you will be notified.</small></label>
    <fieldset className="notice-date-fields"><legend>Calendar event (optional)</legend>
      <div className="form-pair"><label>Start date<input type="date" value={datePart(form.eventStart)} onInput={event=>setStartDate(event.currentTarget.value)}/></label><label>Start time<input type="time" value={timePart(form.eventStart)} disabled={!form.eventStart} onInput={event=>setStartTime(event.currentTarget.value)}/></label></div>
      <div className="form-pair"><label>End date<input type="date" value={datePart(form.eventEnd)} min={datePart(form.eventStart)||undefined} disabled={!form.eventStart} onInput={event=>setEndDate(event.currentTarget.value)}/></label><label>End time<input type="time" value={timePart(form.eventEnd)} disabled={!form.eventEnd} onInput={event=>setEndTime(event.currentTarget.value)}/></label></div>
      <small>Choose the start date first. Times are saved using your local timezone.</small>
    </fieldset>
    <button className="settings-save">Submit for approval</button>
  </form>
}
