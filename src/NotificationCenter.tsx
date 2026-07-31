import { useState } from 'react'
import type { ApiNotification } from './api'

type Props={items:ApiNotification[];loading:boolean;onOpen:(item:ApiNotification)=>Promise<void>;onNavigate:(item:ApiNotification)=>void;onMarkAll:()=>Promise<void>;onClearRead:()=>Promise<void>;onRefresh:()=>Promise<void>}
export default function NotificationCenter({items,loading,onOpen,onNavigate,onMarkAll,onClearRead,onRefresh}:Props){
  const [selected,setSelected]=useState<ApiNotification|null>(null)
  const unread=items.filter(item=>!item.read_at).length
  const inspect=async(item:ApiNotification)=>{setSelected(item);await onOpen(item)}
  return <section className="notification-centre">
    <div className="notification-toolbar"><div><strong>{unread} unread</strong><small>{items.length} notifications in your inbox</small></div><div><button type="button" onClick={onRefresh} disabled={loading}>{loading?'Refreshing…':'Refresh'}</button><button type="button" onClick={onMarkAll} disabled={!unread||loading}>Mark all read</button><button type="button" onClick={onClearRead} disabled={items.length===unread||loading}>Clear read</button></div></div>
    <div className="live-notification-list">{items.map(item=><button type="button" className={item.read_at?'read':'unread'} key={item.id} onClick={()=>inspect(item)}><i aria-hidden="true">{item.entity_type?.startsWith('assignment')?'▣':item.entity_type==='knowledge'?'▤':item.entity_type==='notice'?'◁':'♧'}</i><span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString('en-KE')}</time></span>{!item.read_at&&<b>New</b>}</button>)}{!items.length&&<div className="notification-empty"><strong>Your inbox is clear</strong><p>Assignment, review, approval and Notice Board updates will appear here automatically.</p></div>}</div>
    {selected&&<div className="notification-detail-backdrop" onClick={()=>setSelected(null)}><article className="notification-detail" onClick={event=>event.stopPropagation()}><button className="notification-detail-close" onClick={()=>setSelected(null)} aria-label="Close notification details">×</button><small>{selected.entity_type?.replaceAll('_',' ')||'system notification'}</small><h3>{selected.title}</h3><p>{selected.body}</p><time>{new Date(selected.created_at).toLocaleString('en-KE',{dateStyle:'full',timeStyle:'short'})}</time><div><button type="button" onClick={()=>setSelected(null)}>Close</button>{selected.entity_id&&<button type="button" className="primary" onClick={()=>{onNavigate(selected);setSelected(null)}}>View related item</button>}</div></article></div>}
  </section>
}
