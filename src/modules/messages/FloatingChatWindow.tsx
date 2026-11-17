import {useEffect,useRef,useState} from "react";
import type {MessageRealtimeEvent} from "./messageRealtime";
import {api,type AppMessage} from "../../api";
import "./floating-chat.css";

type Props={
  token:string;
  currentUserId?:string;
  conversationId:string;
  name:string;
  onClose:()=>void;
  onExpand:()=>void;
};

export default function FloatingChatWindow({token,currentUserId,conversationId,name,onClose,onExpand}:Props){
  const [messages,setMessages]=useState<AppMessage[]>([]);
  const [draft,setDraft]=useState("");
  const [sending,setSending]=useState(false);
  const [minimized,setMinimized]=useState(false);
  const [typingName,setTypingName]=useState("");
  const typingTimerRef=useRef<number|undefined>(undefined);
  const endRef=useRef<HTMLDivElement|null>(null);

  const refresh=async()=>{
    const rows=await api.conversationMessages(token,conversationId);
    setMessages(rows);
    await api.markConversationRead(token,conversationId);
    requestAnimationFrame(()=>endRef.current?.scrollIntoView({block:"end"}));
  };

  useEffect(()=>{
    void refresh();
    const timer=window.setInterval(()=>void refresh().catch(()=>{}),30000);
    return()=>window.clearInterval(timer);
  },[token,conversationId]);

  useEffect(()=>{
    const handleRealtime=(event:Event)=>{
      const detail=(event as CustomEvent<MessageRealtimeEvent>).detail;
      if(!detail||String(detail.data.conversationId||"")!==conversationId)return;
      if(detail.type==="message"||detail.type==="read"||detail.type==="delivered")void refresh().catch(()=>{});
      if(detail.type==="typing"&&String(detail.data.userId||"")!==currentUserId)setTypingName(detail.data.typing?String(detail.data.userName||"Someone"):"");
    };
    window.addEventListener("app2-message-realtime",handleRealtime as EventListener);
    return()=>window.removeEventListener("app2-message-realtime",handleRealtime as EventListener);
  },[conversationId,currentUserId]);


  const signalTyping=(value:string)=>{
    window.clearTimeout(typingTimerRef.current);
    if(value.trim()){void api.setConversationTyping(token,conversationId,true).catch(()=>{});typingTimerRef.current=window.setTimeout(()=>void api.setConversationTyping(token,conversationId,false).catch(()=>{}),1800)}
    else void api.setConversationTyping(token,conversationId,false).catch(()=>{});
  };

  const send=async(event:React.FormEvent)=>{
    event.preventDefault();
    const body=draft.trim();
    if(!body)return;
    setSending(true);
    try{
      await api.sendConversationMessage(token,conversationId,{body});
      window.clearTimeout(typingTimerRef.current);void api.setConversationTyping(token,conversationId,false).catch(()=>{});
      setDraft("");
      await refresh();
    }finally{setSending(false)}
  };

  return <aside className={`floating-chat ${minimized?"minimized":""}`} aria-label={`Chat with ${name}`}>
    <header>
      <div><small>CHAT</small><strong>{name}</strong></div>
      <div className="floating-chat-controls">
        <button type="button" onClick={()=>setMinimized(value=>!value)} aria-label={minimized?"Restore chat":"Minimize chat"}>{minimized?"▢":"—"}</button>
        <button type="button" onClick={onExpand} aria-label="Open full messages">↗</button>
        <button type="button" onClick={onClose} aria-label="Close chat">×</button>
      </div>
    </header>
    {!minimized&&<>
      <div className="floating-chat-body">
        {messages.slice(-80).map(item=><article key={item.id} className={item.sender_id===currentUserId?"mine":"theirs"}>
          {item.sender_id!==currentUserId&&<strong>{item.sender_name}</strong>}
          <p>{item.body}</p>
          <time>{new Date(item.created_at).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"})}</time>
        </article>)}
        <div ref={endRef}/>
      </div>
      {typingName&&<div className="floating-chat-typing">{typingName} is typing…</div>}
      <form className="floating-chat-composer" onSubmit={send}>
        <textarea value={draft} onChange={e=>{setDraft(e.target.value);signalTyping(e.target.value)}} rows={2} maxLength={8000} placeholder="Message…"/>
        <button type="submit" disabled={!draft.trim()||sending}>{sending?"…":"Send"}</button>
      </form>
    </>}
  </aside>;
}
