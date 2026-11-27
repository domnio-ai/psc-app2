import {useEffect,useMemo,useRef,useState} from 'react';
import './dashboardCommandPalette.css';

export type DashboardCommandRecord={
 key:string;
 title:string;
 module:string;
 status:string;
};

type Props={
 workspaces:string[];
 records:DashboardCommandRecord[];
 labelForWorkspace:(value:string)=>string;
 onInspectWorkspace:(value:string)=>void;
 onOpenWorkspace:(value:string)=>void;
 onOpenRecord:(key:string)=>void;
};

const normalise=(value:string)=>value.trim().toLocaleLowerCase();

export default function DashboardCommandPalette({
 workspaces,
 records,
 labelForWorkspace,
 onInspectWorkspace,
 onOpenWorkspace,
 onOpenRecord,
}:Props){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);
 const launcherRef=useRef<HTMLButtonElement>(null);

 const close=()=>{
  setOpen(false);
  window.setTimeout(()=>launcherRef.current?.focus(),0);
 };
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   const target=event.target as HTMLElement|null;
   const typing=target?.tagName==='INPUT'||target?.tagName==='TEXTAREA'||target?.isContentEditable;
   if((event.ctrlKey||event.metaKey)&&event.key.toLocaleLowerCase()==='k'){
    event.preventDefault();
    if(open)close();else setOpen(true);
    return;
   }
   if(event.key==='/'&&!typing){
    event.preventDefault();
    setOpen(true);
   }
   if(event.key==='Escape'&&open)close();
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[open]);

 useEffect(()=>{
  if(!open)return;
  setQuery('');
  const timer=window.setTimeout(()=>inputRef.current?.focus(),0);
  return()=>window.clearTimeout(timer);
 },[open]);

 const search=normalise(query);
 const matchingWorkspaces=useMemo(()=>workspaces.filter(value=>{
  if(!search)return true;
  return normalise(`${labelForWorkspace(value)} ${value}`).includes(search);
 }).slice(0,10),[workspaces,search,labelForWorkspace]);

 const matchingRecords=useMemo(()=>records.filter(record=>{
  if(!search)return false;
  return normalise(`${record.title} ${record.module} ${record.status}`).includes(search);
 }).slice(0,8),[records,search]);

 const inspect=(workspace:string)=>{close();onInspectWorkspace(workspace)};
 const openWorkspace=(workspace:string)=>{close();onOpenWorkspace(workspace)};
 const openRecord=(key:string)=>{close();onOpenRecord(key)};

 return <>
  <span className="pulse-command-launcher-wrap">
    <button ref={launcherRef} type="button" className="pulse-command-launcher" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-describedby="pulse-command-shortcuts" aria-keyshortcuts="Control+K Meta+K /">
      <span>Jump to…</span><kbd>Ctrl K</kbd>
    </button>
    <span id="pulse-command-shortcuts" className="pulse-command-tooltip" role="tooltip">
      <strong>Keyboard shortcuts</strong>
      <span><kbd>Ctrl K</kbd> open or close navigation</span>
      <span><kbd>/</kbd> open search</span>
      <span><kbd>Esc</kbd> close</span>
    </span>
  </span>
  {open&&<div className="pulse-command-backdrop" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)close()}}>
    <section className="pulse-command-palette" role="dialog" aria-modal="true" aria-label="APP2 universal navigation">
      <header>
        <div><strong>Jump anywhere in APP2</strong><span>Search authorised workspaces and visible work.</span></div>
        <button type="button" onClick={close} aria-label="Close command palette">×</button>
      </header>
      <label className="pulse-command-search">
        <span>Search</span>
        <input ref={inputRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Assignments, research, a report title…" autoComplete="off"/>
      </label>
      <div className="pulse-command-results">
        {!!matchingWorkspaces.length&&<section>
          <h3>Workspaces</h3>
          <div className="pulse-command-workspaces">
            {matchingWorkspaces.map(workspace=><article key={workspace}>
              <button type="button" className="pulse-command-primary" onClick={()=>inspect(workspace)}>
                <span>{labelForWorkspace(workspace)}</span><small>View dashboard</small>
              </button>
              <button type="button" className="pulse-command-secondary" onClick={()=>openWorkspace(workspace)} aria-label={`Open ${labelForWorkspace(workspace)} full workspace`}>Open workspace</button>
            </article>)}
          </div>
        </section>}
        {!!matchingRecords.length&&<section>
          <h3>Visible work</h3>
          <div className="pulse-command-records">
            {matchingRecords.map(record=><button type="button" key={record.key} onClick={()=>openRecord(record.key)}>
              <span>{record.module}</span><strong>{record.title}</strong><small>{record.status}</small>
            </button>)}
          </div>
        </section>}
        {!matchingWorkspaces.length&&!matchingRecords.length&&<div className="pulse-command-empty"><strong>No authorised match</strong><span>Try a workspace name, record title or status.</span></div>}
      </div>
      <footer><span><kbd>Ctrl K</kbd> open/close</span><span><kbd>/</kbd> search</span><span><kbd>Esc</kbd> close</span></footer>
    </section>
  </div>}
 </>;
}
