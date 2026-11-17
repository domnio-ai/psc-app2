import {useEffect,useMemo,useState} from "react";
import {api,type RepositoryGovernanceReconciliationRow} from "../../../api";

type Props={token:string;isManager:boolean;onChanged:()=>Promise<void>};

type Bucket="ALL"|"MISSING_REVIEWER"|"MISSING_RETENTION"|"MISSING_REVIEW_DATE"|"READY";

export default function RepositoryGovernanceReconciliation({token,isManager,onChanged}:Props){
  const[rows,setRows]=useState<RepositoryGovernanceReconciliationRow[]>([]);
  const[open,setOpen]=useState(false);
  const[bucket,setBucket]=useState<Bucket>("ALL");
  const[busy,setBusy]=useState<string>("");
  const[notice,setNotice]=useState("");

  const load=()=>api.repositoryGovernanceReconciliation(token).then(setRows).catch(error=>setNotice(error instanceof Error?error.message:"Governance reconciliation could not be loaded."));
  useEffect(()=>{void load()},[token]);

  const counts=useMemo(()=>({
    reviewer:rows.filter(r=>r.missingReviewer).length,
    retention:rows.filter(r=>r.missingRetention).length,
    reviewDate:rows.filter(r=>r.missingReviewDate).length,
    ready:rows.filter(r=>!r.missingReviewer&&!r.missingRetention&&!r.missingReviewDate).length,
  }),[rows]);

  const filtered=useMemo(()=>rows.filter(row=>{
    if(bucket==="MISSING_REVIEWER")return row.missingReviewer;
    if(bucket==="MISSING_RETENTION")return row.missingRetention;
    if(bucket==="MISSING_REVIEW_DATE")return row.missingReviewDate;
    if(bucket==="READY")return !row.missingReviewer&&!row.missingRetention&&!row.missingReviewDate;
    return true;
  }),[rows,bucket]);

  const deterministicPayload=(row:RepositoryGovernanceReconciliationRow)=>{
    const input:{
      reviewerId?:string|null;
      retentionScheduleId?:string|null;
      nextReviewAt?:string|null;
      reviewerSource?:"single-authoritative-approval"|null;
      retentionSource?:"exact-record-class"|null;
    }={};
    if(row.missingReviewer&&row.reviewerSuggestion){
      input.reviewerId=row.reviewerSuggestion.userId;
      input.reviewerSource="single-authoritative-approval";
    }
    if(row.missingRetention&&row.retentionSuggestion){
      input.retentionScheduleId=row.retentionSuggestion.scheduleId;
      input.retentionSource="exact-record-class";
    }
    if(row.missingReviewDate&&row.suggestedReviewDate){
      input.nextReviewAt=row.suggestedReviewDate;
      if(!input.retentionScheduleId&&row.retentionScheduleId)input.retentionScheduleId=row.retentionScheduleId;
    }
    return input;
  };

  const canApply=(row:RepositoryGovernanceReconciliationRow)=>{
    const payload=deterministicPayload(row);
    return Object.keys(payload).length>0;
  };

  const applyOne=async(row:RepositoryGovernanceReconciliationRow)=>{
    const input=deterministicPayload(row);
    if(!Object.keys(input).length)return;
    try{
      setBusy(row.id);
      await api.applyRepositoryGovernanceReconciliation(token,row.id,input);
      await load();
      await onChanged();
      setNotice(`Governance reconciled for ${row.recordNumber||row.title}.`);
    }catch(error){setNotice(error instanceof Error?error.message:"Governance reconciliation failed.")}
    finally{setBusy("")}
  };

  return <section className="repository-governance-reconciliation">
    <button type="button" className="repository-governance-reconciliation-trigger" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <div><small>GOVERNANCE RECONCILIATION</small><strong>Legacy published-record actions</strong><span>Use authoritative evidence only; unresolved records remain for manager review.</span></div>
      <div className="repository-governance-reconciliation-meta"><b>{counts.reviewer+counts.retention+counts.reviewDate}</b><small>open controls</small><i>{open?"▴":"▾"}</i></div>
    </button>

    {open&&<div className="repository-governance-reconciliation-body">
      {notice&&<div className="repository-governance-reconciliation-notice">{notice}</div>}
      <div className="repository-governance-reconciliation-buckets">
        <button className={bucket==="MISSING_REVIEWER"?"active":""} onClick={()=>setBucket("MISSING_REVIEWER")}><b>{counts.reviewer}</b><span>Missing reviewer</span></button>
        <button className={bucket==="MISSING_RETENTION"?"active":""} onClick={()=>setBucket("MISSING_RETENTION")}><b>{counts.retention}</b><span>Missing retention</span></button>
        <button className={bucket==="MISSING_REVIEW_DATE"?"active":""} onClick={()=>setBucket("MISSING_REVIEW_DATE")}><b>{counts.reviewDate}</b><span>Missing review date</span></button>
        <button className={bucket==="READY"?"active":""} onClick={()=>setBucket("READY")}><b>{counts.ready}</b><span>Ready</span></button>
      </div>

      <div className="repository-governance-reconciliation-list">
        {filtered.map(row=><article key={row.id}>
          <div>
            <strong>{row.recordNumber||"Record number pending"} · {row.title}</strong>
            <span>{row.recordClass||"Unclassified"}</span>
            <small>
              {row.missingReviewer?(row.reviewerSuggestion?`Reviewer evidence: ${row.reviewerSuggestion.userName}`:"Reviewer provenance requires manager review"):"Reviewer present"}
              {" · "}
              {row.missingRetention?(row.retentionSuggestion?`Suggested retention: ${row.retentionSuggestion.scheduleName}`:"Retention requires manager selection"):"Retention present"}
              {" · "}
              {row.missingReviewDate?(row.suggestedReviewDate?`Suggested review: ${row.suggestedReviewDate}`:"Review date requires schedule/manager decision"):"Review date present"}
            </small>
          </div>
          {isManager&&(row.missingReviewer||row.missingRetention||row.missingReviewDate)
            ?<button type="button" disabled={busy===row.id||!canApply(row)} onClick={()=>void applyOne(row)}>{busy===row.id?"Applying…":canApply(row)?"Apply safe reconciliation":"Manager review required"}</button>
            :null}
        </article>)}
      </div>
      <footer>Nothing is invented: reviewer provenance requires authoritative approval history; retention auto-suggestions require an exact one-to-one record-class match.</footer>
    </div>}
  </section>
}
