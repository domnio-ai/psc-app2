import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { NoticeItem } from './api'
import NoticeComposer, { type NoticeFormState } from './NoticeComposer'

type Props={rows:NoticeItem[];form:NoticeFormState;setForm:Dispatch<SetStateAction<NoticeFormState>>;notice:string;isManager:boolean;onSubmit:(event:FormEvent)=>void;onReview:(item:NoticeItem)=>void;onDelete:(item:NoticeItem)=>Promise<void>}
export default function NoticeBoardWorkspace({rows,form,setForm,notice,isManager,onSubmit,onReview,onDelete}:Props){
  const [tab,setTab]=useState<'Notices'|'Manage'>('Notices')
  const published=rows.filter(item=>item.status==='Published')
  const pending=rows.filter(item=>item.status==='Pending Approval')
  return <section className="notice-workspace">
    <div className="notice-workspace-tabs" role="tablist"><button role="tab" aria-selected={tab==='Notices'} className={tab==='Notices'?'active':''} onClick={()=>setTab('Notices')}>Published notices</button><button role="tab" aria-selected={tab==='Manage'} className={tab==='Manage'?'active':''} onClick={()=>setTab('Manage')}>Add, review & delete</button></div>
    {notice&&<div className="session-message">{notice}</div>}
    {tab==='Notices'&&<div className="notice-public-grid">{published.map(item=><article className={item.severity.toLowerCase()} key={item.id}><header><b>{item.severity}</b><time>{new Date(item.created_at).toLocaleString('en-KE')}</time></header><h3>{item.title}</h3><p>{item.body}</p><footer>Posted by {item.created_by_name}{item.event_start?` · Event ${new Date(item.event_start).toLocaleString('en-KE')}`:''}</footer></article>)}{!published.length&&<div className="notice-empty"><strong>No published notices</strong><p>Approved public information will appear here.</p></div>}</div>}
    {tab==='Manage'&&<div className="notice-manage-grid"><NoticeComposer form={form} setForm={setForm} onSubmit={onSubmit}/><section className="notice-records"><h3>Notice records</h3>{rows.map(item=><article key={item.id}><div><span className={`notice-status ${item.status.toLowerCase().replaceAll(' ','-')}`}>{item.status}</span><strong>{item.title}</strong><small>{item.created_by_name} · {new Date(item.created_at).toLocaleString('en-KE')}</small></div><div>{isManager&&item.status==='Pending Approval'&&<button onClick={()=>onReview(item)}>Review</button>}<button className="danger" onClick={()=>onDelete(item)}>Delete</button></div></article>)}{!rows.length&&<p className="queue-empty">No notice records are available.</p>}</section></div>}
    {tab==='Manage'&&isManager&&pending.length>0&&<p className="notice-review-hint">{pending.length} notice{pending.length===1?' is':'s are'} awaiting management review.</p>}
  </section>
}
