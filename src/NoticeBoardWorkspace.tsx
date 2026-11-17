import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api, type NoticeComment, type NoticeItem } from './api'
import NoticeComposer, { type NoticeFormState } from './NoticeComposer'

type Props={focusedId?:string|null;onFocusConsumed?:()=>void;onRead?:(id:string)=>Promise<void>;rows:NoticeItem[];form:NoticeFormState;setForm:Dispatch<SetStateAction<NoticeFormState>>;notice:string;isManager:boolean;token:string;onRowsChange:(rows:NoticeItem[])=>void;onSubmit:(event:FormEvent)=>void;onReview:(item:NoticeItem)=>void;onDelete:(item:NoticeItem)=>Promise<void>}
const newestFirst=(a:NoticeItem,b:NoticeItem)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()
const displayText=(value:string)=>{try{return /%[0-9a-f]{2}/i.test(value)?decodeURIComponent(value.replaceAll('+',' ')):value}catch{return value.replaceAll('%20',' ')}}
const formatDate=(value:string)=>new Date(value).toLocaleString('en-KE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
const severityRank:Record<string,number>={Urgent:3,Important:2,Information:1}

export default function NoticeBoardWorkspace({rows,form,setForm,notice,isManager,token,onRowsChange,onSubmit,onReview,onDelete,focusedId,onFocusConsumed,onRead}:Props){
  const [tab,setTab]=useState<'Notices'|'Manage'>('Notices')
  const [search,setSearch]=useState('')
  const [severity,setSeverity]=useState('All')
  const [lifecycle,setLifecycle]=useState('Current')
  const [sort,setSort]=useState('Priority')
  const [view,setView]=useState<'Cards'|'List'>('Cards')
  const [selected,setSelected]=useState<NoticeItem|null>(null)
  const [comments,setComments]=useState<NoticeComment[]>([])
  const [comment,setComment]=useState('')
  const [commentState,setCommentState]=useState('')
  const now=Date.now()
  const isExpired=(item:NoticeItem)=>Boolean(item.expires_at&&new Date(item.expires_at).getTime()<now)
  const isUpcoming=(item:NoticeItem)=>Boolean(item.event_start&&new Date(item.event_start).getTime()>now)
  const expiresSoon=(item:NoticeItem)=>Boolean(item.expires_at&&!isExpired(item)&&new Date(item.expires_at).getTime()-now<=7*86400000)
  const published=rows.filter(item=>item.status==='Published').sort(newestFirst)
  const pending=rows.filter(item=>item.status==='Pending Approval').sort(newestFirst)
  const manageable=rows.filter(item=>isManager||item.can_manage).sort(newestFirst)
  const current=published.filter(item=>!isExpired(item))
  const visible=published
    .filter(item=>(severity==='All'||item.severity===severity)
      &&(lifecycle==='All'||(lifecycle==='Current'&&!isExpired(item))||(lifecycle==='Upcoming'&&isUpcoming(item))||(lifecycle==='Expiring soon'&&expiresSoon(item)))
      &&`${item.title} ${item.body} ${item.created_by_name}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a,b)=>sort==='Newest'?newestFirst(a,b):sort==='Expiring'?((a.expires_at?new Date(a.expires_at).getTime():Number.MAX_SAFE_INTEGER)-(b.expires_at?new Date(b.expires_at).getTime():Number.MAX_SAFE_INTEGER)):(Number(Boolean(b.is_pinned))-Number(Boolean(a.is_pinned))||severityRank[b.severity]-severityRank[a.severity]||newestFirst(a,b)))
  const urgentCount=current.filter(item=>item.severity==='Urgent').length
  const upcomingCount=current.filter(isUpcoming).length
  const openNotice=async(item:NoticeItem)=>{setSelected(item);void onRead?.(item.id).catch(()=>{});setCommentState('Loading discussion...');try{setComments(await api.noticeComments(token,item.id));setCommentState('')}catch(error){setCommentState(error instanceof Error?error.message:'Discussion could not be loaded.')}}
  useEffect(()=>{if(!focusedId)return;const item=rows.find(r=>r.id===focusedId);if(item){void openNotice(item);onFocusConsumed?.()}},[focusedId,rows]);
  const submitComment=async(event:FormEvent)=>{event.preventDefault();if(!selected||!comment.trim())return;try{setCommentState('Posting...');const created=await api.commentOnNotice(token,selected.id,comment.trim());setComments(rows=>[...rows,created]);setComment('');setCommentState('')}catch(error){setCommentState(error instanceof Error?error.message:'Comment could not be posted.')}}
  const togglePin=async(item:NoticeItem)=>{await api.pinNotice(token,item.id,!item.is_pinned);onRowsChange(await api.alerts(token))}
  const expiryText=(item:NoticeItem)=>item.expires_at?`Expires ${formatDate(item.expires_at)}`:'No expiry date'

  return <section className="notice-workspace">
    <div className="notice-workspace-tabs" role="tablist"><button role="tab" aria-selected={tab==='Notices'} className={tab==='Notices'?'active':''} onClick={()=>setTab('Notices')}>Published</button><button role="tab" aria-selected={tab==='Manage'} className={tab==='Manage'?'active':''} onClick={()=>setTab('Manage')}>Manage notices {pending.length>0&&<b>{pending.length}</b>}</button></div>
    {notice&&<div className="session-message">{notice}</div>}
    {tab==='Notices'&&<>
      <header className="notice-overview"><div><span>ORGANISATION BULLETIN</span><h2>Notice Board</h2><p>Current approved information, priority announcements and scheduled organisation events.</p></div><div className="notice-overview-stats"><span><b>{current.length}</b> Current</span><span><b>{upcomingCount}</b> Upcoming</span><span className="urgent"><b>{urgentCount}</b> Urgent</span></div></header>
      {urgentCount>0&&<div className="notice-attention-summary" role="status"><strong>{urgentCount} urgent notice{urgentCount===1?'':'s'} require attention</strong><span>Urgent notices are prioritised at the top of the board.</span></div>}
      <div className="notice-toolbar"><label><span>Search notices</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Title, information or author"/></label><label><span>Importance</span><select value={severity} onChange={event=>setSeverity(event.target.value)}>{['All','Information','Important','Urgent'].map(value=><option key={value}>{value}</option>)}</select></label><label><span>Show</span><select value={lifecycle} onChange={event=>setLifecycle(event.target.value)}>{['Current','Upcoming','Expiring soon','All'].map(value=><option key={value}>{value}</option>)}</select></label><label><span>Sort by</span><select value={sort} onChange={event=>setSort(event.target.value)}>{['Priority','Newest','Expiring'].map(value=><option key={value}>{value}</option>)}</select></label><div className="notice-view-toggle" aria-label="Notice view"><button type="button" className={view==='Cards'?'active':''} onClick={()=>setView('Cards')}>Cards</button><button type="button" className={view==='List'?'active':''} onClick={()=>setView('List')}>List</button></div><button type="button" className="notice-clear-filters" disabled={!search&&severity==='All'&&lifecycle==='Current'&&sort==='Priority'} onClick={()=>{setSearch('');setSeverity('All');setLifecycle('Current');setSort('Priority')}}>Reset</button><strong>{visible.length} shown</strong></div>
      <div className={`notice-public-grid ${view.toLowerCase()}-view`}>{visible.map(item=><article className={`${item.severity.toLowerCase()} ${item.is_pinned?'pinned':''}`} key={item.id}><div className="notice-card-accent" aria-hidden="true"/><header><b>{item.is_pinned?'Pinned · ':''}{item.severity}</b><time>{formatDate(item.created_at)}</time></header><h3>{displayText(item.title)}</h3><p>{displayText(item.body)}</p><div className="notice-card-meta"><span>{expiryText(item)}</span>{item.event_start&&<span>Event · {formatDate(item.event_start)}</span>}</div><footer><span>Posted by <strong>{displayText(item.created_by_name)}</strong></span><button onClick={()=>openNotice(item)}>View & comment</button></footer></article>)}{!visible.length&&<div className="notice-empty"><span aria-hidden="true">◇</span><strong>No notices found</strong><p>{published.length?'Adjust the search or importance filter.':'Approved public information will appear here.'}</p></div>}</div>
    </>}
    {tab==='Manage'&&<div className="notice-manage-grid"><NoticeComposer form={form} setForm={setForm} onSubmit={onSubmit}/><section className="notice-records"><header><div><span>NOTICE RECORDS</span><h3>{isManager?'Review and manage':'My notice actions'}</h3></div><b>{pending.length} pending</b></header>{manageable.map(item=><article key={item.id}><div><span className={`notice-status ${item.status.toLowerCase().replaceAll(' ','-')}`}>{item.is_pinned?'Pinned · ':''}{item.status}</span><strong>{displayText(item.title)}</strong><small>{displayText(item.created_by_name)} · {formatDate(item.created_at)} · {expiryText(item)}</small></div><div>{isManager&&item.status==='Published'&&<button onClick={()=>togglePin(item)}>{item.is_pinned?'Unpin':'Pin'}</button>}{isManager&&item.status==='Pending Approval'&&<button onClick={()=>onReview(item)}>Review</button>}<button className="danger" onClick={()=>onDelete(item)}>Delete</button></div></article>)}{!manageable.length&&<p className="queue-empty">You have not submitted or actioned any notices.</p>}</section></div>}
    {tab==='Manage'&&isManager&&pending.length>0&&<p className="notice-review-hint">{pending.length} notice{pending.length===1?' is':'s are'} awaiting management review.</p>}
    {selected&&<div className="notice-detail-backdrop"><section className={`notice-detail ${selected.severity.toLowerCase()}`} role="dialog" aria-modal="true" aria-labelledby="notice-detail-title"><header><div><b>{selected.severity}</b><span>{expiryText(selected)}</span></div><button aria-label="Close notice" onClick={()=>setSelected(null)}>×</button></header><div className="notice-detail-body"><p className="notice-detail-kicker">NOTICE BOARD · {formatDate(selected.created_at)}</p><h2 id="notice-detail-title">{displayText(selected.title)}</h2><p>{displayText(selected.body)}</p><dl><div><dt>Posted by</dt><dd>{displayText(selected.created_by_name)}</dd></div>{selected.event_start&&<div><dt>Event starts</dt><dd>{formatDate(selected.event_start)}</dd></div>}{selected.event_end&&<div><dt>Event ends</dt><dd>{formatDate(selected.event_end)}</dd></div>}</dl></div><section className="notice-comments"><header><div><span>DISCUSSION</span><h3>{comments.length} comment{comments.length===1?'':'s'}</h3></div></header><div>{comments.map(item=><article key={item.id}><span>{item.user_name.split(' ').map(part=>part[0]).join('').slice(0,2)}</span><div><header><strong>{item.user_name}</strong><small>{item.user_role} · {formatDate(item.created_at)}</small></header><p>{item.body}</p></div></article>)}{!comments.length&&!commentState&&<p className="notice-comments-empty">No comments yet. Start the discussion.</p>}</div><form onSubmit={submitComment}><label><span>Add a comment</span><textarea value={comment} onChange={event=>setComment(event.target.value)} maxLength={2000} placeholder="Share a relevant question or update..." required/></label><footer><small>{commentState||`${comment.length}/2000`}</small><button disabled={!comment.trim()||commentState==='Posting...'}>Post comment</button></footer></form></section></section></div>}
  </section>
}
