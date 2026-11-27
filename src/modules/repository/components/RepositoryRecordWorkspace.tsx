import { useEffect, useMemo, useState } from "react";
import WorkflowNextActionDialog from "../../../components/WorkflowNextActionDialog";
import "../../../components/workflow-next-action.css";
import { api, type DocumentItem, type RepositoryRecordDetail, type RepositoryRetentionSchedule, type FelixRecordContext, type RepositoryRecordAssurance } from "../../../api";

type Props={token:string;document:DocumentItem;isManager:boolean;documents:DocumentItem[];onClose:()=>void;onChanged:()=>Promise<void>};
type Tab="Overview"|"Assurance"|"Versions"|"Relationships"|"Protection"|"Review & Retention"|"Audit"|"Felix";

const daysUntil=(value?:string|null)=>{
  if(!value)return null;
  const ms=new Date(`${value.slice(0,10)}T23:59:59`).getTime()-Date.now();
  return Math.ceil(ms/86400000);
};
const humanDue=(days:number|null)=>{
  if(days===null)return "Not scheduled";
  if(days<0)return `${Math.abs(days)} day${Math.abs(days)===1?"":"s"} overdue`;
  if(days===0)return "Due today";
  if(days<=30)return `Due in ${days} day${days===1?"":"s"}`;
  return new Intl.DateTimeFormat("en-KE",{dateStyle:"medium"}).format(new Date(Date.now()+days*86400000));
};

export default function RepositoryRecordWorkspace({token,document,isManager,documents,onClose,onChanged}:Props){
  const[tab,setTab]=useState<Tab>("Overview");
  const[detail,setDetail]=useState<RepositoryRecordDetail|null>(null);
  const[schedules,setSchedules]=useState<RepositoryRetentionSchedule[]>([]);
  const[felix,setFelix]=useState<FelixRecordContext|null>(null);
  const[assurance,setAssurance]=useState<RepositoryRecordAssurance|null>(null);
  const[notice,setNotice]=useState("");
  const[saving,setSaving]=useState(false);
  const[governance,setGovernance]=useState({recordClass:document.record_class||document.document_type||"General Record",retentionScheduleId:"",nextReviewAt:document.next_review_at?.slice(0,10)||document.review_due_at?.slice(0,10)||""});
  const[replacementId,setReplacementId]=useState("");
  const[reviewOutcome,setReviewOutcome]=useState<"Confirm Current"|"Needs Improvement"|"Supersede Required">("Confirm Current");
  const[reviewComments,setReviewComments]=useState("");
  const[reviewNextDate,setReviewNextDate]=useState("");
  const[holdReason,setHoldReason]=useState("");
  const[dispositionReason,setDispositionReason]=useState("");
  const[governanceReviewResult,setGovernanceReviewResult]=useState<{title:string;outcome:string;nextAction:string}|null>(null);

  const load=async()=>{
    const[recordDetail,retention]=await Promise.all([api.repositoryRecordDetail(token,document.id),api.repositoryRetentionSchedules(token).catch(()=>[])]);
    setDetail(recordDetail);setSchedules(retention);
    setGovernance({recordClass:recordDetail.record.record_class||recordDetail.record.document_type||"General Record",retentionScheduleId:recordDetail.record.retention_schedule_id||"",nextReviewAt:(recordDetail.record.next_review_at||recordDetail.record.review_due_at||"").slice(0,10)});
  };
  useEffect(()=>{void load()},[document.id]);
  useEffect(()=>{if(tab==="Felix"&&!felix)api.felixRecordContext(token,document.id).then(setFelix).catch(error=>setNotice(error instanceof Error?error.message:"Felix record context unavailable."))},[tab,document.id]);
  useEffect(()=>{if(tab==="Assurance")api.repositoryRecordAssurance(token,document.id).then(setAssurance).catch(error=>setNotice(error instanceof Error?error.message:"Record assurance unavailable."))},[tab,document.id]);

  const replacements=useMemo(()=>documents.filter(item=>item.id!==document.id&&item.status==="Published"),[documents,document.id]);
  const reviewDays=daysUntil(detail?.record.next_review_at||detail?.record.review_due_at);
  const recordIsSuperseded=Boolean(detail?.record.superseded_by)||detail?.record.records_lifecycle_state==="Superseded";
  const reviewTone=reviewDays!==null&&reviewDays<0?"overdue":reviewDays!==null&&reviewDays<=30?"due":"normal";

  const nextAction=useMemo(()=>{
    if(!detail)return{title:"Loading",body:"Loading record governance."};
    if(recordIsSuperseded)return{title:"Historical record",body:"This record has been superseded. Use the replacement for current institutional work."};
    if(detail.record.status==="Draft")return{title:"Complete governance",body:detail.record.reviewer_name?"Continue controlled review and approval.":"Assign a reviewer before publication."};
    if(reviewDays!==null&&reviewDays<0)return{title:"Review overdue",body:"Governance review is overdue. A manager should confirm currency, update, or supersede the record."};
    if(reviewDays!==null&&reviewDays<=30)return{title:"Review approaching",body:"Prepare the scheduled governance review before the due date."};
    if(detail.record.status==="Published")return{title:"Active record",body:"Current approved record. Continue normal controlled use and monitor retention/review dates."};
    return{title:"Check lifecycle",body:"Confirm the record lifecycle, reviewer and retention controls."};
  },[detail,recordIsSuperseded,reviewDays]);

  const saveGovernance=async()=>{try{setSaving(true);await api.updateDocumentGovernance(token,document.id,{recordClass:governance.recordClass,retentionScheduleId:governance.retentionScheduleId||null,nextReviewAt:governance.nextReviewAt||null});await load();await onChanged();setNotice("Record governance updated.")}catch(error){setNotice(error instanceof Error?error.message:"Governance could not be updated.")}finally{setSaving(false)}};
  const supersede=async()=>{if(!replacementId)return;try{setSaving(true);await api.supersedeDocument(token,document.id,replacementId);await onChanged();await load();setNotice("Record superseded and preserved in history.")}catch(error){setNotice(error instanceof Error?error.message:"Record could not be superseded.")}finally{setSaving(false)}};

  const completeGovernanceReview=async()=>{
    if(reviewComments.trim().length<3)return setNotice("Add a short governance review comment.");
    if(reviewOutcome==="Confirm Current"&&!reviewNextDate)return setNotice("Set the next review date before confirming the record as current.");
    try{
      setSaving(true);
      await api.completeRepositoryGovernanceReview(token,document.id,{
        outcome:reviewOutcome,
        nextReviewAt:reviewOutcome==="Confirm Current"?reviewNextDate:null,
        comments:reviewComments.trim(),
      });
      setReviewComments("");
      setReviewNextDate("");
      await load();
      await onChanged();
      setNotice(`Governance review recorded: ${reviewOutcome}.`);
      setGovernanceReviewResult({title:"Repository governance review complete",outcome:`The record was marked “${reviewOutcome}”.`,nextAction:reviewOutcome==="Confirm Current"?`No further governance review is needed until ${reviewNextDate}.`:`The records manager must follow up on the ${reviewOutcome.toLowerCase()} action and update the record lifecycle when it is complete.`});
    }catch(error){setNotice(error instanceof Error?error.message:"Governance review could not be recorded.")}
    finally{setSaving(false)}
  };

  const updateLegalHold=async(place:boolean)=>{
    if(place&&holdReason.trim().length<3)return setNotice("Enter a legal/audit hold reason.");
    try{
      setSaving(true);
      await api.updateDocumentRecordsMetadata(token,document.id,{
        legalHold:place,
        legalHoldReason:place?holdReason.trim():null,
      });
      setHoldReason("");
      await load();
      await onChanged();
      setNotice(place?"Legal/audit hold applied.":"Legal/audit hold released.");
    }catch(error){setNotice(error instanceof Error?error.message:"Legal hold could not be updated.")}
    finally{setSaving(false)}
  };

  const setDisposition=async(action:"Review"|"Transfer"|"Permanent"|"Destroy")=>{
    if(dispositionReason.trim().length<3)return setNotice("Enter the reason for the disposition decision.");
    try{
      setSaving(true);
      await api.updateDocumentRecordsMetadata(token,document.id,{
        dispositionAction:action,
        legalHoldReason:detail?.record.legal_hold_reason||null,
      });
      if(action==="Destroy"){
        if(detail?.record.legal_hold)throw new Error("This record is under legal/audit hold and cannot enter destruction approval.");
        await api.requestDocumentDeletion(token,document.id,`Records disposition decision: ${dispositionReason.trim()}`);
      }
      setDispositionReason("");
      await load();
      await onChanged();
      setNotice(action==="Destroy"
        ?"Destruction request submitted to the existing approval workflow."
        :`Disposition decision recorded: ${action}.`);
    }catch(error){setNotice(error instanceof Error?error.message:"Disposition decision could not be recorded.")}
    finally{setSaving(false)}
  };

  return <div className="repository-record-workspace-backdrop">{governanceReviewResult&&<WorkflowNextActionDialog {...governanceReviewResult} onClose={()=>setGovernanceReviewResult(null)}/>}<section className="repository-record-workspace">
    <header className="repository-record-workspace-header">
      <div className="repository-record-heading-copy">
        <small>RECORD WORKSPACE</small>
        <h2>{detail?.record.title||document.title}</h2>
        <div className="repository-record-heading-meta">
          <span>{detail?.record.record_number||document.record_number||"Record number pending"}</span>
          <span>v{detail?.record.current_version||document.current_version||1}</span>
          <b className={`repository-lifecycle-badge ${recordIsSuperseded?"superseded":""}`}>{detail?.record.records_lifecycle_state||detail?.record.status||"Working Document"}</b>
        </div>
      </div>
      <button type="button" onClick={onClose}>× Close</button>
    </header>

    <nav className="repository-record-workspace-tabs">
      {(["Overview","Assurance","Versions","Relationships","Protection","Review & Retention","Audit","Felix"] as Tab[]).map(name=><button key={name} type="button" className={tab===name?"active":""} onClick={()=>setTab(name)}>{name}</button>)}
    </nav>

    {notice&&<div className="repository-record-workspace-notice">{notice}</div>}
    {!detail?<div className="repository-record-loading">Loading record…</div>:<>
      {tab==="Overview"&&<>
        <div className="repository-record-decision-strip">
          <div><small>NEXT ACTION</small><strong>{nextAction.title}</strong><span>{nextAction.body}</span></div>
          <div className={`repository-review-due ${reviewTone}`}><small>REVIEW</small><strong>{humanDue(reviewDays)}</strong><span>{detail.record.retention_schedule_name||"No retention schedule assigned"}</span></div>
        </div>
        <div className="repository-detail-grid">
          <article><small>Status</small><strong>{detail.record.status}</strong><span>{detail.record.records_lifecycle_state||"Working Document"}</span></article>
          <article><small>Class</small><strong>{detail.record.record_class||detail.record.category}</strong><span>{detail.record.document_type}</span></article>
          <article><small>Owner</small><strong>{detail.record.created_by_name}</strong><span>{detail.record.directorate||"Directorate not set"}</span></article>
          <article><small>Reviewer</small><strong>{detail.record.reviewer_name||"Not assigned"}</strong><span>{detail.record.approved_by_name?`Approved by ${detail.record.approved_by_name}`:"Approval pending"}</span></article>
          <article><small>Review</small><strong>{humanDue(reviewDays)}</strong><span>{detail.record.retention_schedule_name||"No retention schedule"}</span></article>
          <article><small>Protection</small><strong>{detail.protection?.reader_scope||"INHERITED"}</strong><span>{detail.protection?.watermark?"Watermarked":"Standard preview"}</span></article>
        </div>
      </>}

      {tab==="Assurance"&&<div className="repository-assurance-workspace">
        {!assurance?<div className="repository-record-loading">Running deterministic record assurance…</div>:<>
          <header className={`repository-assurance-summary ${assurance.overall.toLowerCase().replaceAll(" ","-")}`}>
            <div>
              <small>RECORD ASSURANCE</small>
              <strong>{assurance.overall}</strong>
              <span>Deterministic governance, integrity, protection and traceability checks. This is not a staff score.</span>
            </div>
            <div className="repository-assurance-counts">
              <span><b>{assurance.gaps}</b> gaps</span>
              <span><b>{assurance.warnings}</b> warnings</span>
            </div>
          </header>
          <div className="repository-assurance-checks">
            {assurance.checks.map(check=><article key={check.key} className={`repository-assurance-check ${check.status.toLowerCase()}`}>
              <div className="repository-assurance-check-state"><b>{check.status}</b><small>{check.area}</small></div>
              <div><strong>{check.label}</strong><span>{check.message}</span></div>
              <button type="button" onClick={()=>setTab(check.actionTab)}>Open {check.actionTab}</button>
            </article>)}
          </div>
        </>}
      </div>}

      {tab==="Versions"&&<div className="repository-workspace-list">{detail.versions.map(v=><article key={v.id}><div><strong>Version {v.version_number}</strong><span>{v.original_name}</span><small>{new Date(v.created_at).toLocaleString("en-KE")} · {Math.max(1,Math.round(v.size_bytes/1024))} KB</small></div>{v.version_number===detail.record.current_version&&<b>Current</b>}</article>)}</div>}

      {tab==="Relationships"&&<div className="repository-workspace-list">
        {detail.relationships.length===0?<div className="repository-empty-state"><strong>No relationships recorded</strong><span>Use More → Relationships / evidence to connect this record to an Assignment, Task, Research project or APP2 Report.</span></div>:detail.relationships.map(r=><article key={r.id}><div><strong>{r.relationship_type}</strong><span>{r.entity_title||r.entity_id}</span><small>{r.entity_type}{r.pinned_version_number?` · evidence pinned to v${r.pinned_version_number}`:" · follows current version"}</small></div></article>)}
      </div>}

      {tab==="Protection"&&<div className="repository-protection-summary">
        <div className="repository-protection-workspace-intro">
          <strong>{detail.protection?.reader_scope||"INHERITED"}</strong>
          <span>{[
            detail.protection?.allow_download===false?"Download blocked":"Download allowed",
            detail.protection?.allow_copy===false?"Copy blocked":"Copy allowed",
            detail.protection?.allow_print===false?"Print blocked":"Print allowed",
            detail.protection?.watermark?"Watermarked":"Standard preview",
          ].join(" · ")}</span>
          <small>{isManager?"Change policy from More → Protection & access.":"Protection is controlled by authorised management."}</small>
        </div>
        <details className="repository-protection-details">
          <summary>Protection details</summary>
          <div className="repository-detail-grid">
            <article><small>Download</small><strong>{detail.protection?.allow_download===false?"Blocked":"Allowed"}</strong></article>
            <article><small>Copy</small><strong>{detail.protection?.allow_copy===false?"Blocked":"Allowed"}</strong></article>
            <article><small>Print</small><strong>{detail.protection?.allow_print===false?"Blocked":"Allowed"}</strong></article>
            <article><small>Reuse / Link</small><strong>{detail.protection?.allow_link===false?"Blocked":"Allowed"}</strong></article>
          </div>
        </details>
      </div>}

      {tab==="Review & Retention"&&<div className="repository-governance-workspace">
        <div className="repository-governance-status-row">
          <div><small>Lifecycle</small><strong>{detail.record.records_lifecycle_state||detail.record.status}</strong></div>
          <div className={reviewTone}><small>Next review</small><strong>{humanDue(reviewDays)}</strong></div>
          <div><small>Retention</small><strong>{detail.record.retention_schedule_name||"Not assigned"}</strong></div>
        </div>

        {isManager?<>
          <section className="repository-governance-action-panel">
            <header><small>GOVERNANCE REVIEW</small><strong>Complete the record review</strong><span>Record the decision rather than only changing a date.</span></header>
            <div className="repository-governance-action-grid">
              <label>Outcome<select value={reviewOutcome} onChange={e=>setReviewOutcome(e.target.value as typeof reviewOutcome)}><option>Confirm Current</option><option>Needs Improvement</option><option>Supersede Required</option></select></label>
              <label>Next review date<input type="date" disabled={reviewOutcome!=="Confirm Current"} value={reviewNextDate} onChange={e=>setReviewNextDate(e.target.value)}/></label>
            </div>
            <label>Review comments<textarea rows={3} value={reviewComments} onChange={e=>setReviewComments(e.target.value)} placeholder="Evidence considered, changes required, or reason record remains current…"/></label>
            <button type="button" disabled={saving} onClick={()=>void completeGovernanceReview()}>{saving?"Saving…":"Record governance review"}</button>
          </section>

          <section className="repository-governance-action-panel">
            <header><small>LEGAL / AUDIT HOLD</small><strong>{detail.record.legal_hold?"Hold active":"No hold"}</strong><span>A hold blocks normal disposition decisions until released.</span></header>
            {detail.record.legal_hold?<div className="repository-hold-active"><p>{detail.record.legal_hold_reason||"No hold reason recorded."}</p><button type="button" disabled={saving} onClick={()=>void updateLegalHold(false)}>Release hold</button></div>:<><label>Hold reason<textarea rows={2} value={holdReason} onChange={e=>setHoldReason(e.target.value)} placeholder="Legal matter, audit, investigation or preservation reason…"/></label><button type="button" disabled={saving} onClick={()=>void updateLegalHold(true)}>Place legal / audit hold</button></>}
          </section>

          <section className="repository-governance-action-panel">
            <header><small>DISPOSITION DECISION</small><strong>{detail.record.disposition_action||"Review"}</strong><span>Destroy always enters APP2's existing independent deletion approval workflow.</span></header>
            <label>Decision reason<textarea rows={2} value={dispositionReason} onChange={e=>setDispositionReason(e.target.value)} placeholder="Why this retention/disposition decision is appropriate…"/></label>
            <div className="repository-disposition-actions">
              <button type="button" disabled={saving} onClick={()=>void setDisposition("Review")}>Keep under review</button>
              <button type="button" disabled={saving} onClick={()=>void setDisposition("Transfer")}>Transfer</button>
              <button type="button" disabled={saving} onClick={()=>void setDisposition("Permanent")}>Permanent</button>
              <button type="button" disabled={saving||Boolean(detail.record.legal_hold)} onClick={()=>void setDisposition("Destroy")}>Request destruction</button>
            </div>
            {detail.record.legal_hold&&<small className="repository-disposition-blocked">Destruction is blocked while legal/audit hold is active.</small>}
          </section>

          <details className="repository-governance-settings">
            <summary>Record class, retention schedule & next review settings</summary>
            <div className="repository-governance-editor">
              <label>Record class<input value={governance.recordClass} onChange={e=>setGovernance({...governance,recordClass:e.target.value})}/></label>
              <label>Retention schedule<select value={governance.retentionScheduleId} onChange={e=>setGovernance({...governance,retentionScheduleId:e.target.value})}><option value="">No schedule</option>{schedules.map(s=><option key={s.id} value={s.id}>{s.record_class} · {s.name}</option>)}</select></label>
              <label>Next review date<input type="date" value={governance.nextReviewAt} onChange={e=>setGovernance({...governance,nextReviewAt:e.target.value})}/></label>
              <button type="button" disabled={saving} onClick={()=>void saveGovernance()}>{saving?"Saving…":"Save governance"}</button>
            </div>
          </details>
        </>:<div className="repository-manager-only-note"><strong>Manager-controlled governance</strong><span>You can read the lifecycle, review and retention decisions, but cannot change them.</span></div>}

        {isManager&&detail.record.status!=="Archived"&&!recordIsSuperseded&&<div className="repository-supersession-editor"><h3>Supersede this record</h3><p>Use only when a newer approved record replaces this one. The old record remains searchable, auditable and linked to its replacement.</p><select value={replacementId} onChange={e=>setReplacementId(e.target.value)}><option value="">Choose approved replacement</option>{replacements.map(item=><option key={item.id} value={item.id}>{item.record_number||item.title} · {item.title}</option>)}</select><button type="button" disabled={!replacementId||saving} onClick={()=>void supersede()}>Mark as superseded</button></div>}
      </div>}

      {tab==="Audit"&&<div className="repository-workspace-list repository-audit-list">{detail.activity.length===0?<div className="repository-empty-state"><strong>No activity recorded</strong><span>New governed actions will appear here automatically.</span></div>:detail.activity.map(row=><article key={row.id}><div><strong>{row.action.replaceAll("_"," ")}</strong><span>{row.user_name}</span><small>{new Date(row.created_at).toLocaleString("en-KE")}</small></div></article>)}</div>}

      {tab==="Felix"&&<div className="repository-felix-intelligence">{!felix?<p>Loading record intelligence…</p>:<><div className={felix.authoritative?"repository-felix-authoritative":"repository-felix-warning"}><strong>{felix.authoritative?"Current authoritative record":"Caution: not the current authoritative record"}</strong><span>{felix.recordNumber||"Record number pending"} · v{felix.currentVersion} · {felix.lifecycle}</span></div>{felix.warnings.map((warning,index)=><p key={index} className="repository-felix-warning-line">{warning}</p>)}{felix.replacement&&<p><b>Current replacement:</b> {felix.replacement.record_number||felix.replacement.title}</p>}<h3>Related institutional work</h3>{felix.relationships.length===0?<p>No relationships recorded.</p>:felix.relationships.map((r,index)=><p key={index}>{r.relationship_type} · {r.entity_title||r.entity_type}{r.pinned_version_number?` · v${r.pinned_version_number}`:""}</p>)}</>}</div>}
    </>}
  </section></div>
}
