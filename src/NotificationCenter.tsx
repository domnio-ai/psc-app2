import type { ApiNotification } from './api'

type Props={items:ApiNotification[];loading:boolean;onOpen:(item:ApiNotification)=>Promise<void>;onMarkAll:()=>Promise<void>;onClearRead:()=>Promise<void>;onRefresh:()=>Promise<void>}
export default function NotificationCenter({items,loading,onOpen,onMarkAll,onClearRead,onRefresh}:Props){
  const unread=items.filter(item=>!item.read_at).length
  return <section className="notification-centre">
    <div className="notification-toolbar"><div><strong>{unread} unread</strong><small>{items.length} notifications in your inbox</small></div><div><button type="button" onClick={onRefresh} disabled={loading}>{loading?'Refreshing…':'Refresh'}</button><button type="button" onClick={onMarkAll} disabled={!unread||loading}>Mark all read</button><button type="button" onClick={onClearRead} disabled={items.length===unread||loading}>Clear read</button></div></div>
    <div className="live-notification-list">{items.map(item=><button type="button" className={item.read_at?'read':'unread'} key={item.id} onClick={()=>onOpen(item)}><i aria-hidden="true">{item.entity_type==='assignment'?'▣':item.entity_type==='knowledge'?'▤':item.entity_type==='notice'?'◁':'♧'}</i><span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString('en-KE')}</time></span>{!item.read_at&&<b>New</b>}</button>)}{!items.length&&<div className="notification-empty"><strong>Your inbox is clear</strong><p>Assignment, review, approval and Notice Board updates will appear here automatically.</p></div>}</div>
  </section>
}
