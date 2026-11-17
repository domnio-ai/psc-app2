import {useEffect,useMemo,useRef,useState} from "react";
import type {MessageRealtimeEvent} from "./messageRealtime";
import {api,type AppMessage,type MessageConversation,type MessageConversationEvent,type MessageConversationInfo,type MessagePresence,type MessageUser} from "../../api";
import "./messages.css";

type Props={
  token:string;
  currentUserId?:string;
  onUnreadCountChange?:(count:number)=>void;
  onBack?:()=>void;
  onDashboard?:()=>void;
  onClose?:()=>void;
};

const MESSAGE_GROUP_MEMBER_LIMIT=600;
const MESSAGE_GROUP_INVITEE_LIMIT=MESSAGE_GROUP_MEMBER_LIMIT-1;

const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("");

export default function MessagesWorkspace({token,currentUserId,onUnreadCountChange,onBack,onDashboard,onClose}:Props){
  const [conversations,setConversations]=useState<MessageConversation[]>([]);
  const [selectedId,setSelectedId]=useState<string>("");
  const [messages,setMessages]=useState<AppMessage[]>([]);
  const [users,setUsers]=useState<MessageUser[]>([]);
  const [search,setSearch]=useState("");
  const [messageSearch,setMessageSearch]=useState("");
  const [draft,setDraft]=useState("");
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [replyTo,setReplyTo]=useState<AppMessage|null>(null);
  const fileInputRef=useRef<HTMLInputElement|null>(null);
  const [notice,setNotice]=useState("");
  const [newOpen,setNewOpen]=useState(false);
  const [selectedUsers,setSelectedUsers]=useState<string[]>([]);
  const [groupTitle,setGroupTitle]=useState("");
  const [events,setEvents]=useState<MessageConversationEvent[]>([]);
  const [groupInfo,setGroupInfo]=useState<MessageConversationInfo|null>(null);
  const [groupInfoOpen,setGroupInfoOpen]=useState(false);
  const [memberManagerOpen,setMemberManagerOpen]=useState(false);
  const [renameTitle,setRenameTitle]=useState("");
  const [addMemberIds,setAddMemberIds]=useState<string[]>([]);
  const [groupBusy,setGroupBusy]=useState(false);
  const [presence,setPresence]=useState<Record<string,MessagePresence>>({});
  const [typingUsers,setTypingUsers]=useState<Record<string,string>>({});
  const typingTimerRef=useRef<number|undefined>(undefined);
  const endRef=useRef<HTMLDivElement|null>(null);

  const refreshConversations=async()=>{
    const rows=await api.messageConversations(token);
    setConversations(rows);
    const unread=rows.reduce((sum,item)=>sum+Number(item.unread_count||0),0);
    onUnreadCountChange?.(unread);
    if(!selectedId&&rows.length)setSelectedId(rows[0].id);
    if(selectedId&&!rows.some(item=>item.id===selectedId))setSelectedId(rows[0]?.id||"");
  };

  const loadMessages=async(conversationId:string)=>{
    if(!conversationId){setMessages([]);setEvents([]);setGroupInfo(null);return}
    const [rows,eventRows,info]=await Promise.all([
      api.conversationMessages(token,conversationId),
      api.messageConversationEvents(token,conversationId),
      api.messageConversationInfo(token,conversationId),
    ]);
    setMessages(rows);
    setEvents(eventRows);
    setGroupInfo(info);
    setRenameTitle(info.title||"");
    await api.markConversationRead(token,conversationId);
    await refreshConversations();
    requestAnimationFrame(()=>endRef.current?.scrollIntoView({block:"end"}));
  };

  useEffect(()=>{
    const requested=sessionStorage.getItem("app2-open-message-conversation");
    if(requested){
      setSelectedId(requested);
      sessionStorage.removeItem("app2-open-message-conversation");
    }
  },[]);

  useEffect(()=>{
    let live=true;
    setLoading(true);
    Promise.all([api.messageUsers(token),api.messageConversations(token),api.messagePresence(token)])
      .then(([directory,rows,presenceRows])=>{
        if(!live)return;
        setUsers(directory);setConversations(rows);setPresence(Object.fromEntries(presenceRows.map(item=>[item.userId,item])));
        onUnreadCountChange?.(rows.reduce((sum,item)=>sum+Number(item.unread_count||0),0));
        if(rows.length)setSelectedId(current=>current||rows[0].id);
      })
      .catch(error=>live&&setNotice(error instanceof Error?error.message:"Messages could not be loaded."))
      .finally(()=>live&&setLoading(false));
    return()=>{live=false};
  },[token]);

  useEffect(()=>{if(selectedId)void loadMessages(selectedId)},[selectedId]);

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      void refreshConversations();
      if(selectedId)void Promise.all([
        api.conversationMessages(token,selectedId),
        api.messageConversationEvents(token,selectedId),
      ]).then(([messageRows,eventRows])=>{setMessages(messageRows);setEvents(eventRows)}).catch(()=>{});
    },30000);
    return()=>window.clearInterval(timer);
  },[token,selectedId]);

  useEffect(()=>{
    const handleRealtime=(event:Event)=>{
      const detail=(event as CustomEvent<MessageRealtimeEvent>).detail;if(!detail)return;
      const conversationId=String(detail.data.conversationId||"");
      if(detail.type==="message"){void refreshConversations().catch(()=>{});if(conversationId===selectedId)void loadMessages(selectedId).catch(()=>{})}
      if((detail.type==="read"||detail.type==="delivered"||detail.type==="reaction")&&conversationId===selectedId)void api.conversationMessages(token,selectedId).then(setMessages).catch(()=>{});
      if(detail.type==="presence"){const item=detail.data as unknown as MessagePresence;if(item.userId)setPresence(current=>({...current,[item.userId]:item}))}
      if(detail.type==="typing"&&conversationId===selectedId){
        const userId=String(detail.data.userId||"");const userName=String(detail.data.userName||"");
        if(userId&&userId!==currentUserId)setTypingUsers(current=>{const next={...current};if(detail.data.typing)next[userId]=userName||"Someone";else delete next[userId];return next});
      }
    };
    window.addEventListener("app2-message-realtime",handleRealtime as EventListener);
    return()=>window.removeEventListener("app2-message-realtime",handleRealtime as EventListener);
  },[token,selectedId,currentUserId]);
  useEffect(()=>{setTypingUsers({})},[selectedId]);


  const selected=conversations.find(item=>item.id===selectedId)||null;

  useEffect(()=>{
    if(!selected)return;
    const name=selected.kind==="Group"
      ? selected.title||"Group conversation"
      : selected.members.find(member=>member.id!==currentUserId)?.name||selected.members.map(member=>member.name).join(", ");
    window.dispatchEvent(new CustomEvent("app2-pin-chat",{detail:{conversationId:selected.id,name}}));
  },[selectedId]);
  const visibleConversations=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return conversations;
    return conversations.filter(item=>{
      const names=item.members.map(member=>member.name).join(" ");
      return `${item.title||""} ${names} ${item.last_message||""}`.toLowerCase().includes(q);
    });
  },[conversations,search]);

  const visibleMessages=useMemo(()=>{
    const q=messageSearch.trim().toLowerCase();
    if(!q)return messages;
    return messages.filter(item=>`${item.sender_name} ${item.body} ${item.context_title||""}`.toLowerCase().includes(q));
  },[messages,messageSearch]);

  const timeline=useMemo(()=>{
    const messageRows=visibleMessages.map(item=>({kind:"message" as const,created_at:item.created_at,item}));
    const q=messageSearch.trim().toLowerCase();
    const eventRows=events
      .filter(item=>!q||`${item.actor_name} ${item.event_type} ${item.target_user_name||""}`.toLowerCase().includes(q))
      .map(item=>({kind:"event" as const,created_at:item.created_at,item}));
    return [...messageRows,...eventRows].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
  },[visibleMessages,events,messageSearch]);

  const conversationName=(item:MessageConversation)=>{
    if(item.kind==="Group")return item.title||"Group conversation";
    return item.members.find(member=>member.id!==currentUserId)?.name||item.members.map(member=>member.name).join(", ");
  };

  const signalTyping=(value:string)=>{
    if(!selectedId)return;window.clearTimeout(typingTimerRef.current);
    if(value.trim()){void api.setConversationTyping(token,selectedId,true).catch(()=>{});typingTimerRef.current=window.setTimeout(()=>void api.setConversationTyping(token,selectedId,false).catch(()=>{}),1800)}
    else void api.setConversationTyping(token,selectedId,false).catch(()=>{});
  };

  const toggleReaction=async(message:AppMessage,emoji:string)=>{
    try{
      const current=message.reactions?.find(item=>item.emoji===emoji);
      if(current?.me)await api.removeMessageReaction(token,message.id,emoji);
      else await api.reactToMessage(token,message.id,emoji);
      if(selectedId)await loadMessages(selectedId);
    }catch(error){setNotice(error instanceof Error?error.message:"Reaction could not be updated.")}
  };

  const uploadAttachment=async(file:File)=>{
    if(!selectedId)return;
    setUploading(true);setNotice("");
    try{await api.uploadMessageAttachment(token,selectedId,file);await loadMessages(selectedId)}
    catch(error){setNotice(error instanceof Error?error.message:"Attachment could not be sent.")}
    finally{setUploading(false);if(fileInputRef.current)fileInputRef.current.value=""}
  };

  const send=async(event:React.FormEvent)=>{
    event.preventDefault();
    const body=draft.trim();
    if(!body||!selectedId)return;
    setSending(true);setNotice("");
    try{
      await api.sendConversationMessage(token,selectedId,{body,replyToMessageId:replyTo?.id||null});
      window.clearTimeout(typingTimerRef.current);void api.setConversationTyping(token,selectedId,false).catch(()=>{});
      setDraft("");
      setReplyTo(null);
      await loadMessages(selectedId);
    }catch(error){setNotice(error instanceof Error?error.message:"Message could not be sent.")}
    finally{setSending(false)}
  };

  const createConversation=async()=>{
    if(!selectedUsers.length)return setNotice("Choose at least one person.");
    setNotice("");
    try{
      const row=await api.createMessageConversation(token,{
        participantIds:selectedUsers,
        title:selectedUsers.length>1&&groupTitle.trim()?groupTitle.trim():undefined
      });
      setNewOpen(false);setSelectedUsers([]);setGroupTitle("");
      await refreshConversations();
      setSelectedId(row.id);
    }catch(error){setNotice(error instanceof Error?error.message:"Conversation could not be created.")}
  };

  const refreshGroupInfo=async()=>{
    if(!selectedId)return;
    const info=await api.messageConversationInfo(token,selectedId);
    setGroupInfo(info);
    setRenameTitle(info.title||"");
    await refreshConversations();
  };

  const renameGroup=async()=>{
    if(!selectedId||!renameTitle.trim())return;
    setGroupBusy(true);setNotice("");
    try{
      await api.renameMessageConversation(token,selectedId,renameTitle.trim());
      await loadMessages(selectedId);
    }catch(error){setNotice(error instanceof Error?error.message:"Group could not be renamed.")}
    finally{setGroupBusy(false)}
  };

  const addGroupMembers=async()=>{
    if(!selectedId||!addMemberIds.length)return;
    setGroupBusy(true);setNotice("");
    try{
      await api.addMessageConversationMembers(token,selectedId,addMemberIds);
      setAddMemberIds([]);
      await loadMessages(selectedId);
    }catch(error){setNotice(error instanceof Error?error.message:"Members could not be added.")}
    finally{setGroupBusy(false)}
  };

  const removeGroupMember=async(userId:string)=>{
    if(!selectedId)return;
    setGroupBusy(true);setNotice("");
    try{
      await api.removeMessageConversationMember(token,selectedId,userId);
      await loadMessages(selectedId);
    }catch(error){setNotice(error instanceof Error?error.message:"Member could not be removed.")}
    finally{setGroupBusy(false)}
  };


  const unreadTotal=conversations.reduce((sum,item)=>sum+Number(item.unread_count||0),0);
  const onlineCount=Object.values(presence).filter(item=>String(item?.status||"").toLowerCase()==="online").length;

  return <section className="messages-workspace team-chat-workspace">
    {notice&&<div className="messages-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>×</button></div>}

    <section className="team-chat-command-centre" aria-label="Team Chat command centre">
      <div className="team-chat-command-head">
        <div><small>COLLABORATION & REAL-TIME COMMUNICATION</small><h2>Team Chat</h2><p>Coordinate direct and group conversations in the same governed REDESY workspace.</p></div>
        <div className="collaboration-header-actions">
          <button type="button" className="collaboration-nav-button collaboration-nav-back" onClick={onBack} title="Back" aria-label="Back">Back</button>
          <button type="button" className="collaboration-nav-button collaboration-nav-dashboard" onClick={onDashboard} title="Dashboard" aria-label="Dashboard">Dashboard</button>
          <button type="button" className="collaboration-nav-button collaboration-nav-close" onClick={onClose} title="Close" aria-label="Close">Close</button>
          <button className="team-chat-start" type="button" onClick={()=>setNewOpen(true)}>+ New chat</button>
        </div>
      </div>
      <div className="team-chat-kpis">
        <button type="button" onClick={()=>setSearch("")}><strong>{conversations.length}</strong><span>Active chats</span><small>Direct & group conversations</small></button>
        <button type="button" onClick={()=>setSearch("")}><strong>{unreadTotal}</strong><span>Unread</span><small>Messages requiring attention</small></button>
        <button type="button" onClick={()=>setSearch("")}><strong>{onlineCount}</strong><span>Online now</span><small>Available colleagues</small></button>
      </div>
    </section>

    <div className={`messages-layout ${groupInfoOpen&&selected?.kind==="Group"?"group-info-open":""}`}>
      <aside className="messages-conversations">
        <div className="messages-chatlist-header">
          <div><strong>Chats</strong><span>{conversations.length} active</span></div>
          <button className="messages-new" type="button" onClick={()=>setNewOpen(true)} aria-label="New message" title="New message">+</button>
        </div>
        <label className="messages-search messages-search-box"><span>Search conversations</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats"/></label>
        <div className="messages-conversation-list">
          {loading&&<p className="messages-empty">Loading conversations…</p>}
          {!loading&&visibleConversations.map(item=><button
            key={item.id}
            type="button"
            className={selectedId===item.id?"active":""}
            onClick={()=>setSelectedId(item.id)}
          >
            <span className="messages-avatar">{initials(conversationName(item))}</span>
            <span className="messages-conversation-copy">
              <strong>{conversationName(item)} {item.kind==="Direct"&&(()=>{const peer=item.members.find(member=>member.id!==currentUserId);const status=peer?presence[peer.id]?.status:"Offline";return <i className={`messages-presence-dot ${String(status||"Offline").toLowerCase()}`} title={status||"Offline"}/>})()}</strong>
              <small>{item.last_message||"No messages yet"}</small>
            </span>
            <span className="messages-conversation-meta">
              {item.last_message_at&&<time>{new Date(item.last_message_at).toLocaleDateString("en-KE",{day:"2-digit",month:"short"})}</time>}
              {Number(item.unread_count)>0&&<b>{item.unread_count}</b>}
            </span>
          </button>)}
          {!loading&&!visibleConversations.length&&<p className="messages-empty">No conversations yet. Start a new message.</p>}
        </div>
      </aside>

      <main className="messages-thread">
        {!selected?<div className="messages-thread-empty"><strong>Select a conversation</strong><p>Choose a conversation or start a new message.</p></div>:
        <>
          <header className="messages-thread-header">
            <div><strong>{conversationName(selected)}</strong><span>{selected.kind==="Group"?`${selected.members.length} members`:(()=>{const peer=selected.members.find(member=>member.id!==currentUserId);return peer?presence[peer.id]?.status||"Offline":"Offline"})()}</span>
              {Object.keys(typingUsers).length>0&&<em className="messages-typing">{Object.values(typingUsers).slice(0,2).join(", ")} {Object.keys(typingUsers).length===1?"is":"are"} typing…</em>}</div>
            <div className="messages-thread-tools">
              <input value={messageSearch} onChange={e=>setMessageSearch(e.target.value)} placeholder="Search" aria-label="Search this conversation"/>
              {selected.kind==="Group"&&<button type="button" onClick={()=>setGroupInfoOpen(value=>!value)}>{groupInfoOpen?"Hide group":"Group info"}</button>}
              <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("app2-pin-chat",{detail:{conversationId:selected.id,name:conversationName(selected)}}))}>Pin chat</button>
            </div>
          </header>
          <div className="messages-thread-scroll">
            {timeline.map(entry=>{
              if(entry.kind==="event"){
                const item=entry.item;
                const text=item.event_type==="Group Renamed"
                  ? `${item.actor_name} renamed the group`
                  : item.event_type==="Member Added"
                    ? `${item.actor_name} added ${item.target_user_name||"a member"}`
                    : `${item.actor_name} removed ${item.target_user_name||String(item.details?.name||"a member")}`;
                return <div key={`event-${item.id}`} className="messages-system-event"><span>{text}</span><time>{new Date(item.created_at).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"})}</time></div>;
              }
              const item=entry.item;
              const mine=item.sender_id===currentUserId;
              return <article key={item.id} className={mine?"mine":"theirs"}>
                {!mine&&<span className="messages-avatar small">{initials(item.sender_name)}</span>}
                <div className="messages-bubble">
                  {!mine&&<strong>{item.sender_name}</strong>}
                  {item.reply_to_message_id&&<div className="messages-reply-quote"><strong>{item.reply_sender_name||"Message"}</strong><span>{item.reply_body||"Original message unavailable"}</span></div>}
                  <p>{item.body}</p>
                  {item.context_title&&<small className="messages-context">Linked: {item.context_title}</small>}
                  {item.attachments?.map(file=><button key={file.id} type="button" className="messages-attachment-card" onClick={()=>void api.downloadMessageAttachment(token,file.id,file.original_name)}><span>📎</span><span><strong>{file.original_name}</strong><small>{Math.max(1,Math.round(file.size_bytes/1024))} KB</small></span></button>)}
                  <div className="messages-bubble-actions"><button type="button" onClick={()=>setReplyTo(item)}>Reply</button>{['👍','❤️','✅','👏','😂'].map(emoji=><button key={emoji} type="button" onClick={()=>void toggleReaction(item,emoji)} aria-label={`React ${emoji}`}>{emoji}</button>)}</div>
                  {!!item.reactions?.length&&<div className="messages-reactions">{item.reactions.map(reaction=><button key={reaction.emoji} type="button" className={reaction.me?"mine":""} onClick={()=>void toggleReaction(item,reaction.emoji)}>{reaction.emoji} {reaction.count}</button>)}</div>}
                  {mine&&<small className="messages-receipt">{Number(item.read_count||0)>0?(Number(item.recipient_count||0)>1?`Read by ${item.read_count}`:"Read"):Number(item.delivered_count||0)>0?(Number(item.recipient_count||0)>1?`Delivered to ${item.delivered_count}`:"Delivered"):"Sent"}</small>}
                  <time>{new Date(item.created_at).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"})}</time>
                </div>
              </article>
            })}
            <div ref={endRef}/>
          </div>
          <form className="messages-composer" onSubmit={send}>
            {replyTo&&<div className="messages-replying"><span><strong>Replying to {replyTo.sender_name}</strong><small>{replyTo.body}</small></span><button type="button" onClick={()=>setReplyTo(null)}>×</button></div>}
            <input ref={fileInputRef} className="messages-file-input" type="file" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadAttachment(file)}} />
            <div className="messages-composer-row">
              <button
                type="button"
                className="messages-attach-button"
                onClick={()=>fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="Attach file"
                title="Attach file"
              >{uploading?"…":"📎"}</button>
              <textarea
                value={draft}
                onChange={e=>{setDraft(e.target.value);signalTyping(e.target.value)}}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}
                rows={1}
                maxLength={8000}
                placeholder="Type a message"
                aria-label="Write a message"
                title="Enter to send · Shift+Enter for new line"
              />
              <button className="messages-send-button" type="submit" disabled={!draft.trim()||sending} aria-label="Send message">{sending?"…":"Send"}</button>
            </div>
          </form>
        </>}
      </main>
      {groupInfoOpen&&selected?.kind==="Group"&&groupInfo&&<aside className="messages-group-panel">
        <header><div><small>GROUP</small><strong>{groupInfo.title||"Group conversation"}</strong><span>{groupInfo.members.length} members</span></div><button type="button" onClick={()=>setGroupInfoOpen(false)}>×</button></header>
        {groupInfo.can_manage&&<section className="messages-group-manage">
          <label><span>Group name</span><div><input value={renameTitle} onChange={e=>setRenameTitle(e.target.value)} maxLength={160}/><button type="button" onClick={renameGroup} disabled={groupBusy||!renameTitle.trim()}>Rename</button></div></label>
        </section>}
        <section className="messages-group-members">
          <div className="messages-group-section-title"><strong>Members</strong><span>{groupInfo.members.length}/{MESSAGE_GROUP_MEMBER_LIMIT}</span></div>
          {groupInfo.members.map(member=><div key={member.id} className="messages-group-member">
            <span className="messages-avatar small">{initials(member.name)}</span>
            <span><strong>{member.name} <i className={`messages-presence-dot ${String(presence[member.id]?.status||"Offline").toLowerCase()}`}/></strong><small>{member.is_owner?"Owner":member.role} · {presence[member.id]?.status||"Offline"}</small></span>
            {groupInfo.can_manage&&!member.is_owner&&member.id!==currentUserId&&<button type="button" onClick={()=>removeGroupMember(member.id)} disabled={groupBusy}>Remove</button>}
          </div>)}
        </section>
        {groupInfo.can_manage&&<section className="messages-group-manage-members">
          <button
            type="button"
            className="messages-manage-members-button"
            onClick={()=>setMemberManagerOpen(true)}
          >
            Manage members
          </button>
          <small>View, remove or add group members in a larger window.</small>
        </section>}
      </aside>}
    </div>

    {memberManagerOpen&&selected?.kind==="Group"&&groupInfo&&<div
      className="messages-member-manager-backdrop"
      role="presentation"
      onMouseDown={()=>setMemberManagerOpen(false)}
    >
      <section
        className="messages-member-manager"
        role="dialog"
        aria-modal="true"
        aria-label="Manage group members"
        onMouseDown={e=>e.stopPropagation()}
      >
        <header className="messages-member-manager-header">
          <div>
            <small>GROUP MEMBERS</small>
            <h3>Manage members</h3>
            <p>{groupInfo.title||"Group conversation"} Â· {groupInfo.members.length}/{MESSAGE_GROUP_MEMBER_LIMIT} members</p>
          </div>
          <button
            type="button"
            className="messages-member-manager-close"
            onClick={()=>setMemberManagerOpen(false)}
            aria-label="Close member manager"
          >
            Close
          </button>
        </header>

        <div className="messages-member-manager-body">
          <section className="messages-member-manager-section">
            <div className="messages-member-manager-section-head">
              <div>
                <strong>Current members</strong>
                <span>{groupInfo.members.length} people</span>
              </div>
            </div>

            <div className="messages-member-current-list">
              {groupInfo.members.map(member=><div key={member.id} className="messages-member-current-row">
                <span className="messages-avatar">{initials(member.name)}</span>
                <span className="messages-member-current-copy">
                  <strong>
                    {member.name}
                    <i className={`messages-presence-dot ${String(presence[member.id]?.status||"Offline").toLowerCase()}`}/>
                  </strong>
                  <small>{member.is_owner?"Owner":member.role} Â· {presence[member.id]?.status||"Offline"}</small>
                </span>

                {groupInfo.can_manage&&!member.is_owner&&member.id!==currentUserId
                  ? <button
                      type="button"
                      className="messages-member-remove-button"
                      onClick={()=>removeGroupMember(member.id)}
                      disabled={groupBusy}
                    >
                      Remove
                    </button>
                  : <span className="messages-member-protected">{member.is_owner?"Owner":"Current user"}</span>}
              </div>)}
            </div>
          </section>

          {groupInfo.can_manage&&groupInfo.members.length<MESSAGE_GROUP_MEMBER_LIMIT&&<section className="messages-member-manager-section">
            <div className="messages-member-manager-section-head">
              <div>
                <strong>Add members</strong>
                <span>Select people to add to this group</span>
              </div>
              <span>{addMemberIds.length} selected</span>
            </div>

            <div className="messages-member-add-list">
              {users
                .filter(person=>!groupInfo.members.some(member=>member.id===person.id))
                .map(person=><label key={person.id} className="messages-member-add-row">
                  <input
                    type="checkbox"
                    checked={addMemberIds.includes(person.id)}
                    onChange={()=>setAddMemberIds(current=>
                      current.includes(person.id)
                        ? current.filter(id=>id!==person.id)
                        : [...current,person.id].slice(0,MESSAGE_GROUP_MEMBER_LIMIT-groupInfo.members.length)
                    )}
                  />
                  <span className="messages-avatar">{initials(person.name)}</span>
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.role} Â· {person.division}</small>
                  </span>
                </label>)}
            </div>
          </section>}
        </div>

        <footer className="messages-member-manager-footer">
          <span>
            {addMemberIds.length
              ? `${addMemberIds.length} selected to add`
              : "Select members above to add them to the group"}
          </span>

          <div>
            <button type="button" className="messages-member-manager-cancel" onClick={()=>setMemberManagerOpen(false)}>
              Done
            </button>

            {groupInfo.can_manage&&groupInfo.members.length<MESSAGE_GROUP_MEMBER_LIMIT&&<button
              type="button"
              className="messages-member-manager-add"
              onClick={async()=>{
                if(!addMemberIds.length)return;
                await addGroupMembers();
              }}
              disabled={groupBusy||!addMemberIds.length}
            >
              {groupBusy?"Updating...":"Add selected"}
            </button>}
          </div>
        </footer>
      </section>
    </div>}
    {newOpen&&<div className="messages-modal-backdrop" role="presentation" onMouseDown={()=>setNewOpen(false)}>
      <section className="messages-modal" role="dialog" aria-modal="true" aria-label="New message" onMouseDown={e=>e.stopPropagation()}>
        <header><div><p>NEW MESSAGE</p><h3>Choose recipients</h3></div><button type="button" onClick={()=>setNewOpen(false)}>×</button></header>
        {selectedUsers.length>1&&<label className="messages-group-name">
          <span>Group name <small>(optional)</small></span>
          <input
            value={groupTitle}
            onChange={e=>setGroupTitle(e.target.value)}
            maxLength={160}
            placeholder="Leave blank to use participant names"
          />
        </label>}
        <div className="messages-modal-body">
          <div className="messages-user-list">
            {users.map(person=><label key={person.id}>
              <input type="checkbox" checked={selectedUsers.includes(person.id)}
                onChange={()=>setSelectedUsers(current=>current.includes(person.id)?current.filter(id=>id!==person.id):current.length>=MESSAGE_GROUP_INVITEE_LIMIT?current:[...current,person.id])}/>
              <span className="messages-avatar small">{initials(person.name)}</span>
              <span><strong>{person.name}</strong><small>{person.role} · {person.division}</small></span>
            </label>)}
          </div>
        </div>
        <footer className="messages-modal-footer">
          <span>{selectedUsers.length} selected{selectedUsers.length>1?` · group conversation · ${selectedUsers.length+1}/${MESSAGE_GROUP_MEMBER_LIMIT} members`:""}</span>
          <button type="button" onClick={createConversation} disabled={!selectedUsers.length}>
            {selectedUsers.length>1?"Start group conversation":"Start conversation"}
          </button>
        </footer>
      </section>
    </div>}
  </section>;
}
