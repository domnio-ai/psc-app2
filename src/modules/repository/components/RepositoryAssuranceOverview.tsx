import {useEffect,useMemo,useState} from "react";
import {api,type RepositoryAssuranceOverview as Overview} from "../../../api";

export type RepositoryAssuranceFilter="ALL"|"READY"|"READY WITH MINOR ISSUES"|"NEEDS REVISION"|"SIGNIFICANT GAPS";
type Props={token:string;selected:RepositoryAssuranceFilter;onSelect:(filter:RepositoryAssuranceFilter,ids:string[])=>void};

export default function RepositoryAssuranceOverview({token,selected,onSelect}:Props){
  const[data,setData]=useState<Overview|null>(null);
  const[open,setOpen]=useState(false);
  const[error,setError]=useState("");
  useEffect(()=>{api.repositoryAssuranceOverview(token).then(v=>{setData(v);setError("")}).catch(e=>setError(e instanceof Error?e.message:"Assurance overview unavailable."))},[token]);

  const buckets=useMemo(()=>[
    ["READY","Ready","Governance controls satisfied"],
    ["READY WITH MINOR ISSUES","Minor issues","Usable; follow-up advisable"],
    ["NEEDS REVISION","Needs revision","One or more governance gaps"],
    ["SIGNIFICANT GAPS","Significant gaps","Multiple controls require action"],
  ] as const,[]);

  const choose=(key:RepositoryAssuranceFilter)=>{
    if(!data)return;
    const next=selected===key?"ALL":key;
    onSelect(next,next==="ALL"?[]:data.items.filter(item=>item.overall===next).map(item=>item.id));
  };

  return <section className="repository-assurance-overview">
    <button type="button" className="repository-assurance-overview-trigger" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <div><small>RECORD ASSURANCE</small><strong>Repository assurance overview</strong><span>Quality and governance status in your authorised scope.</span></div>
      <div className="repository-assurance-overview-meta"><b>{data?.total??"—"}</b><small>records</small><i>{open?"▴":"▾"}</i></div>
    </button>
    {open&&<div className="repository-assurance-overview-body">
      {error?<div className="repository-assurance-overview-error">{error}</div>:!data?<div className="repository-assurance-overview-loading">Checking Repository assurance…</div>:<>
        <div className="repository-assurance-overview-cards">
          {buckets.map(([key,label,hint])=><button key={key} type="button" className={selected===key?"active":""} onClick={()=>choose(key)}>
            <b>{data.counts[key]}</b><span>{label}</span><small>{hint}</small>
          </button>)}
        </div>
        <footer><span>This evaluates record controls, not employee performance.</span>{selected!=="ALL"&&<button type="button" onClick={()=>choose(selected)}>Clear assurance filter</button>}</footer>
      </>}
    </div>}
  </section>
}
