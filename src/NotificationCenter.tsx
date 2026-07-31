import { useState } from 'react'
import type { ApiNotification } from './api'

type Props={items:ApiNotification[];loading:boolean;onOpen:(item:ApiNotification)=>Promise<void>;onNavigate:(item:ApiNotification)=>void;onMarkAll:()=>Promise<void>;onRefresh:()=>Promise<void>}
export default function NotificationCenter({items,loading,onOpen,onNavigate,onMarkAll,onRefresh}:Props){
  const [selected,setSelected]=useState<ApiNotification|null>(null)
  const [filter,setFilter]=useState<'All'|'Unread'|'Read'>('All')
  const unread=items.filter(item=>!item.read_at).length
  const visible=items.filter(item=>filter==='All'||(filter==='Unread'?!item.read_at:Boolean(item.read_at)))
  const inspect=async(item:ApiNotification)=>{setSelected(item);await onOpen(item)}
  return <section className="notification-centre">
    <div className="notification-toolbar"><div><strong>{unread} unread</strong><small>{items.length} notifications retained for reference</small></div><div><button type="button" onClick={onRefresh} disabled={loading}>{loading?'Refreshing…':'Refresh'}</button><button type="button" onClick={onMarkAll} disabled={!unread||loading}>Mark all read</button></div></div>
    <div className="notification-filters" role="tablist">{(['All','Unread','Read'] as const).map(value=><button role="tab" aria-selected={filter===value} className={filter===value?'active':''} key={value} onClick={()=>setFilter(value)}>{value}{value==='Unread'?` (${unread})`:value==='Read'?` (${items.length-unread})`:` (${items.length})`}</button>)}</div>
    <div className="live-notification-list">{visible.map(item=><button type="button" className={item.read_at?'read':'unread'} key={item.id} onClick={()=>inspect(item)}><i aria-hidden="true">{item.entity_type?.startsWith('assignment')?'▣':item.entity_type==='knowledge'?'▤':item.entity_type==='notice'?'◁':'♧'}</i><span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString('en-KE')}</time></span>{!item.read_at&&<b>New</b>}</button>)}{!visible.length&&<div className="notification-empty"><strong>No {filter.toLowerCase()} notifications</strong><p>Notifications are retained here after they are read so they remain available for reference.</p></div>}</div>
    {selected&&<div className="notification-detail-backdrop" onClick={()=>setSelected(null)}><article className="notification-detail" onClick={event=>event.stopPropagation()}><button className="notification-detail-close" onClick={()=>setSelected(null)} aria-label="Close notification details">×</button><small>{selected.entity_type?.replaceAll('_',' ')||'system notification'}</small><h3>{selected.title}</h3><p>{selected.body}</p><time>{new Date(selected.created_at).toLocaleString('en-KE',{dateStyle:'full',timeStyle:'short'})}</time><div><button type="button" onClick={()=>setSelected(null)}>Close</button>{selected.entity_id&&<button type="button" className="primary" onClick={()=>{onNavigate(selected);setSelected(null)}}>View related item</button>}</div></article></div>}
  </section>
}
