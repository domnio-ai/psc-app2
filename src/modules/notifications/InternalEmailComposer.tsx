import {useEffect,useMemo,useState} from "react";
import {api,type InternalEmailRecipient} from "../../api";

type Props={token:string;open:boolean;onClose:()=>void;onSent:()=>Promise<void>|void};

export default function InternalEmailComposer({token,open,onClose,onSent}:Props){
  const [recipients,setRecipients]=useState<InternalEmailRecipient[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [search,setSearch]=useState("");
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const [loading,setLoading]=useState(false);
  const [sending,setSending]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!open)return;
    setLoading(true);setMessage("");
    void api.internalEmailRecipients(token).then(setRecipients)
      .catch(error=>setMessage(error instanceof Error?error.message:"Recipient directory could not be loaded."))
      .finally(()=>setLoading(false));
  },[open,token]);

  const visible=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return q?recipients.filter(item=>`${item.name} ${item.email} ${item.role} ${item.division}`.toLowerCase().includes(q)):recipients;
  },[recipients,search]);

  const toggle=(id:string)=>setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);

  const send=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!selected.length)return setMessage("Choose at least one REDESY recipient.");
    if(!subject.trim())return setMessage("Enter an email subject.");
    if(!body.trim())return setMessage("Enter an email message.");
    setSending(true);setMessage("");
    try{
      const result=await api.sendInternalEmail(token,{recipientIds:selected,subject:subject.trim(),body:body.trim()});
      setMessage(`Email queued for ${result.recipientCount} recipient${result.recipientCount===1?"":"s"}.`);
      setSelected([]);setSubject("");setBody("");
      await onSent();
    }catch(error){setMessage(error instanceof Error?error.message:"Email could not be queued.")}
    finally{setSending(false)}
  };

  if(!open)return null;
  return <div className="internal-email-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="internal-email-composer" onSubmit={send} onMouseDown={event=>event.stopPropagation()}>
      <header><div><p>REDESY EMAIL</p><h3>Compose email</h3><span>Send to active REDESY users through the institutional email service.</span></div>
        <button type="button" onClick={onClose} aria-label="Close email composer">×</button></header>
      <div className="internal-email-scroll-area">
        <label><span>Recipients</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, role, division or email"/></label>
        <div className="internal-email-recipient-list">
          {loading&&<p>Loading recipients…</p>}
          {!loading&&visible.map(recipient=><label key={recipient.id}>
            <input type="checkbox" checked={selected.includes(recipient.id)} onChange={()=>toggle(recipient.id)}/>
            <span><strong>{recipient.name}</strong><small>{recipient.email} · {recipient.role} · {recipient.division}</small></span>
          </label>)}
          {!loading&&!visible.length&&<p>No matching REDESY users.</p>}
        </div>
        <div className="internal-email-selected">{selected.length} selected</div>
        <label><span>Subject</span><input maxLength={240} value={subject} onChange={event=>setSubject(event.target.value)}/></label>
        <label><span>Message</span><textarea rows={10} maxLength={20000} value={body} onChange={event=>setBody(event.target.value)}/></label>
        {message&&<p className="internal-email-message">{message}</p>}
      </div>
      <footer className="internal-email-footer">
        <button type="button" onClick={onClose}>Cancel</button>
        <button className="primary" type="submit" disabled={sending||loading}>{sending?"Sending…":"Send email"}</button>
      </footer>
    </form>
  </div>;
}
