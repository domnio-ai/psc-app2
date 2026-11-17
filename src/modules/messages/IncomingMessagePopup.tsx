import type {IncomingMessagePreview} from "../../api";
import "./message-popup.css";

type Props={
  message:IncomingMessagePreview|null;
  currentUserId?:string;
  onOpen:(conversationId:string)=>void;
  onDismiss:()=>void;
};

const conversationName=(message:IncomingMessagePreview,currentUserId?:string)=>{
  if(message.kind==="Group")return message.title||"Group conversation";
  return message.members.find(member=>member.id!==currentUserId)?.name||message.sender_name;
};

export default function IncomingMessagePopup({message,currentUserId,onOpen,onDismiss}:Props){
  if(!message)return null;
  const threadName=conversationName(message,currentUserId);
  return <aside className="message-popup" role="status" aria-live="polite" aria-label="New REDESY message">
    <button className="message-popup-close" type="button" onClick={onDismiss} aria-label="Dismiss message">×</button>
    <div className="message-popup-heading">
      <span className="message-popup-avatar">{message.sender_name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")}</span>
      <div>
        <small>NEW MESSAGE</small>
        <strong>{message.sender_name}</strong>
        {message.kind==="Group"&&<span>{threadName}</span>}
      </div>
    </div>
    <p>{message.body}</p>
    <div className="message-popup-footer">
      <time>{new Date(message.created_at).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"})}</time>
      <button type="button" onClick={()=>onOpen(message.conversation_id)}>Open chat</button>
    </div>
  </aside>;
}
