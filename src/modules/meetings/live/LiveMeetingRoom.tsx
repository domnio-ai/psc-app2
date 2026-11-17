import { useEffect, useMemo, useState } from "react";
import { meetingsApi } from "../meetingsApi";
import type { MeetingDetail, MeetingUser } from "../types";
import type { ConferenceProviderStatus, LiveConferenceSession, LivePresence } from "./types";
import "./live-meeting.css";

type Props = {
  token: string;
  meeting: MeetingDetail;
  currentUser: { id: string; name: string; role: string };
  users: MeetingUser[];
  onClose: () => void;
  onChanged: (meeting: MeetingDetail) => void;
};

type SideTab = "People" | "Agenda" | "Transcript" | "Actions";

const elapsed=(start:string|null)=>{
  if(!start)return "00:00";
  const total=Math.max(0,Math.floor((Date.now()-new Date(start).getTime())/1000));
  const h=Math.floor(total/3600);const m=Math.floor((total%3600)/60);const s=total%60;
  return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
};

export default function LiveMeetingRoom({token,meeting,currentUser,users,onClose,onChanged}:Props){
  const [session,setSession]=useState<LiveConferenceSession|null>(null);
  const [provider,setProvider]=useState<ConferenceProviderStatus|null>(null);
  const [presence,setPresence]=useState<LivePresence[]>([]);
  const [sideTab,setSideTab]=useState<SideTab>("People");
  const [notice,setNotice]=useState("");
  const [clock,setClock]=useState("00:00");
  const [actionText,setActionText]=useState("");
  const [actionOwner,setActionOwner]=useState("");
  const [decisionText,setDecisionText]=useState("");

  useEffect(()=>{let cancelled=false;(async()=>{try{
    const providerStatus=await meetingsApi.conferenceProviderStatus(token);
    if(cancelled)return;
    setProvider(providerStatus);
    if(!providerStatus.configured||!providerStatus.reachable){
      setNotice(providerStatus.message);
      return;
    }
    const existing=await meetingsApi.conference(token,meeting.id);
    const joined=existing?.status==="Live"?await meetingsApi.joinConference(token,meeting.id):meeting.can_manage?await meetingsApi.startConference(token,meeting.id):await meetingsApi.joinConference(token,meeting.id);
    if(!cancelled)setSession(joined);
  }catch(error){if(!cancelled)setNotice(error instanceof Error?error.message:"Private live meeting could not start.")}})();return()=>{cancelled=true;if(session)void meetingsApi.leaveConference(token,meeting.id).catch(()=>undefined)}},[token,meeting.id]);

  useEffect(()=>{const timer=window.setInterval(()=>setClock(elapsed(session?.startedAt||null)),1000);return()=>window.clearInterval(timer)},[session?.startedAt]);
  useEffect(()=>{if(!session)return;const load=async()=>{try{setPresence(await meetingsApi.conferencePresence(token,meeting.id))}catch{/* room remains usable */}};void load();const timer=window.setInterval(()=>void load(),10000);return()=>window.clearInterval(timer)},[token,meeting.id,session?.sessionId]);

  const activeCount=useMemo(()=>presence.filter(p=>p.active).length,[presence]);
  const refreshMeeting=async()=>{const fresh=await meetingsApi.detail(token,meeting.id);onChanged(fresh)};
  const leave=async()=>{if(session)await meetingsApi.leaveConference(token,meeting.id).catch(()=>undefined);onClose()};
  const end=async()=>{if(!window.confirm("End this private live conference for REDESY participants? The governed meeting record will remain open for minutes and actions."))return;try{await meetingsApi.endConference(token,meeting.id);setSession(s=>s?{...s,status:"Ended",endedAt:new Date().toISOString()}:s);setNotice("Live conference ended. Meeting governance remains available in REDESY.")}catch(error){setNotice(error instanceof Error?error.message:"Conference could not be ended.")}};

  const addAction=async()=>{if(!actionText.trim())return;try{await meetingsApi.addAction(token,meeting.id,{title:actionText.trim(),description:"Created during live meeting",ownerId:actionOwner||null,dueDate:null});setActionText("");setActionOwner("");await refreshMeeting()}catch(error){setNotice(error instanceof Error?error.message:"Action could not be recorded.")}};
  const addDecision=async()=>{if(!decisionText.trim())return;try{await meetingsApi.addDecision(token,meeting.id,decisionText.trim());setDecisionText("");await refreshMeeting()}catch(error){setNotice(error instanceof Error?error.message:"Decision could not be recorded.")}};

  return <div className="live-room-shell" role="dialog" aria-label={`Live meeting room for ${meeting.title}`}>
    <header className="live-room-header">
      <div><span className="live-indicator"><i/> PRIVATE LIVE</span><h2>{meeting.title}</h2><small>{meeting.meeting_type} · {activeCount || meeting.participants.length} participants · {clock}</small></div>
      <div className="live-room-head-actions">{session?.isHost&&session.status!=="Ended"&&<button className="live-end" onClick={()=>void end()}>End for all</button>}<button onClick={()=>void leave()}>Leave room</button></div>
    </header>
    {provider&&<div className={`live-provider-status ${provider.reachable?"healthy":"unavailable"}`}><strong>Private Jitsi</strong><span>{provider.message}</span>{provider.providerBaseUrl&&<small>{provider.providerBaseUrl}</small>}</div>}
    {notice&&<div className="live-room-notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    <main className="live-room-main">
      <section className="live-video-stage">
        {session?.joinUrl&&session.status!=="Ended"?<iframe title="REDESY private live conference" src={session.joinUrl} allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write" allowFullScreen referrerPolicy="no-referrer"/>:<div className="live-room-ended"><strong>{session?.status==="Ended"?"Conference ended":provider?.configured===false?"Private conference service not configured":provider?.reachable===false?"Private conference service unavailable":"Preparing private meeting room…"}</strong><span>{session?.status==="Ended"?"Return to the meeting workspace to complete transcript, minutes, decisions and actions.":provider?.message||"App2 is preparing the self-hosted Jitsi media service."}</span></div>}
      </section>
      <aside className="live-side-panel">
        <nav>{(["People","Agenda","Transcript","Actions"] as SideTab[]).map(t=><button key={t} className={sideTab===t?"active":""} onClick={()=>setSideTab(t)}>{t}</button>)}</nav>
        {sideTab==="People"&&<div className="live-panel-list"><div className="live-panel-title"><strong>Participants</strong><span>{activeCount} active</span></div>{meeting.participants.map(p=>{const live=presence.find(x=>x.user_id===p.user_id)?.active;return <article key={p.id}><i className={live?"online":""}/><div><b>{p.user_name||p.guest_name||"Guest"}</b><small>{p.participant_role}{p.user_id===currentUser.id?" · You":""}</small></div></article>})}</div>}
        {sideTab==="Agenda"&&<div className="live-panel-list"><div className="live-panel-title"><strong>Agenda</strong><span>{meeting.agenda.length} items</span></div>{meeting.agenda.map(a=><article key={a.id}><span className="agenda-no">{a.item_no}</span><div><b>{a.title}</b><small>{a.owner_name||"No owner"} · {a.duration_minutes||0} min</small></div></article>)}</div>}
        {sideTab==="Transcript"&&<div className="live-transcript"><div className="live-panel-title"><strong>Transcript evidence</strong><span>{meeting.transcript?.status||"Not started"}</span></div><p>The self-hosted Jitsi media layer is isolated from REDESY governance. The official transcript continues through REDESY's governed transcription workflow.</p>{meeting.transcript?.segments?.slice(-12).map(s=><article key={s.id}><b>{s.speaker_label||"Speaker"}</b><span>{s.corrected_text||s.text}</span></article>)}</div>}
        {sideTab==="Actions"&&<div className="live-actions"><div className="live-panel-title"><strong>Decisions & actions</strong><span>Captured in REDESY</span></div><label>Decision<textarea value={decisionText} onChange={e=>setDecisionText(e.target.value)} placeholder="Record a resolution while the meeting is live"/><button onClick={()=>void addDecision()}>Record decision</button></label><label>Action<input value={actionText} onChange={e=>setActionText(e.target.value)} placeholder="Action item"/><select value={actionOwner} onChange={e=>setActionOwner(e.target.value)}><option value="">Owner later</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><button onClick={()=>void addAction()}>Assign action</button></label><div className="live-mini-actions">{meeting.actions.slice(-5).map(a=><article key={a.id}><b>{a.title}</b><small>{a.owner_name||"Unassigned"} · {a.status}</small></article>)}</div></div>}
      </aside>
    </main>
  </div>
}
