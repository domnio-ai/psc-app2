import {useEffect,useMemo,useState} from "react";
import {api,type RepositorySavedView} from "../../../api";

export type RepositoryAdvancedFilters={purpose:string;recordClass:string;owner:string;directorate:string;reviewer:string;protection:string;from:string;to:string};
type Props={token:string;filters:RepositoryAdvancedFilters;onChange:(filters:RepositoryAdvancedFilters)=>void;onClear:()=>void};

const entries=(filters:RepositoryAdvancedFilters)=>Object.entries(filters).filter(([,value])=>Boolean(value));
const labels:Record<keyof RepositoryAdvancedFilters,string>={purpose:"Purpose",recordClass:"Record class",owner:"Owner",directorate:"Directorate",reviewer:"Reviewer",protection:"Protection",from:"From",to:"To"};
const cleanProtection=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,(match)=>match.toUpperCase());

export default function RepositoryAdvancedSearch({token,filters,onChange,onClear}:Props){
  const[open,setOpen]=useState(false);
  const[views,setViews]=useState<RepositorySavedView[]>([]);
  const[name,setName]=useState("");
  const active=useMemo(()=>entries(filters),[filters]);
  const load=()=>api.repositorySavedViews(token).then(setViews).catch(()=>setViews([]));
  useEffect(()=>{void load()},[]);
  const save=async()=>{if(!name.trim())return;await api.saveRepositoryView(token,name.trim(),filters);setName("");await load()};
  const remove=async(id:string)=>{await api.deleteRepositoryView(token,id);await load()};
  const clearOne=(key:keyof RepositoryAdvancedFilters)=>onChange({...filters,[key]:""});
  const applyView=(view:RepositorySavedView)=>{
    const saved=(view.filters||{}) as Partial<RepositoryAdvancedFilters>;
    onChange({purpose:saved.purpose||"",recordClass:saved.recordClass||"",owner:saved.owner||"",directorate:saved.directorate||"",reviewer:saved.reviewer||"",protection:saved.protection||"",from:saved.from||"",to:saved.to||""});
    setOpen(true);
  };

  return <section className="repository-advanced-search">
    <div className="repository-advanced-search-bar">
      <button type="button" className="repository-advanced-search-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
        <span><b>Advanced search</b><small>Owner, reviewer, class, protection and activity date</small></span>
        <strong>{active.length?`${active.length} active`:"Refine"} {open?"▴":"▾"}</strong>
      </button>
      {active.length>0&&<button type="button" className="repository-clear-advanced" onClick={onClear}>Clear all</button>}
    </div>
    {active.length>0&&<div className="repository-active-filter-chips" aria-label="Active advanced filters">{active.map(([rawKey,value])=>{const key=rawKey as keyof RepositoryAdvancedFilters;const display=key==="protection"?cleanProtection(value):value;return <button type="button" key={key} onClick={()=>clearOne(key)} title={`Remove ${labels[key]} filter`}><b>{labels[key]}</b><span>{display}</span><em aria-hidden="true">×</em></button>})}</div>}
    {open&&<div className="repository-advanced-search-panel">
      <div className="repository-advanced-search-heading"><span><b>Find an exact record set</b><small>Filters combine together and stay within your authorised Repository scope.</small></span>{active.length>0&&<strong>{active.length} filter{active.length===1?"":"s"} applied</strong>}</div>
      <div className="repository-advanced-grid">
        <label>Purpose<input value={filters.purpose} onChange={e=>onChange({...filters,purpose:e.target.value})} placeholder="Evidence, Reference…"/></label>
        <label>Record class<input value={filters.recordClass} onChange={e=>onChange({...filters,recordClass:e.target.value})} placeholder="Class or category"/></label>
        <label>Owner<input value={filters.owner} onChange={e=>onChange({...filters,owner:e.target.value})} placeholder="Owner name"/></label>
        <label>Directorate<input value={filters.directorate} onChange={e=>onChange({...filters,directorate:e.target.value})} placeholder="Directorate"/></label>
        <label>Reviewer<input value={filters.reviewer} onChange={e=>onChange({...filters,reviewer:e.target.value})} placeholder="Reviewer name"/></label>
        <label>Protection<select value={filters.protection} onChange={e=>onChange({...filters,protection:e.target.value})}><option value="">Any protection</option>{["INHERITED","TEAM","NAMED_USERS","REVIEWER_ONLY","MANAGEMENT_ONLY"].map(v=><option key={v} value={v}>{cleanProtection(v)}</option>)}</select></label>
        <label>Updated from<input type="date" value={filters.from} onChange={e=>onChange({...filters,from:e.target.value})}/></label>
        <label>Updated to<input type="date" value={filters.to} onChange={e=>onChange({...filters,to:e.target.value})}/></label>
      </div>
      <div className="repository-saved-view-create"><span><b>Saved retrieval view</b><small>Save the current advanced filter set for repeat searches.</small></span><input value={name} onChange={e=>setName(e.target.value)} placeholder="View name"/><button type="button" disabled={!name.trim()} onClick={()=>void save()}>Save view</button></div>
      {views.length>0&&<div className="repository-saved-view-list" aria-label="Saved repository views">{views.map(view=><div key={view.id}><button type="button" onClick={()=>applyView(view)}>{view.name}</button><button type="button" aria-label={`Delete ${view.name}`} onClick={()=>void remove(view.id)}>×</button></div>)}</div>}
    </div>}
  </section>
}
