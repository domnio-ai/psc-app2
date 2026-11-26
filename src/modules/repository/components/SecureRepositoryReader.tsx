import {lazy,Suspense,useEffect,useMemo,useRef,useState} from "react";
import {api,type DocumentItem,type DocumentProtectionEffective} from "../../../api";

const DocumentReader=lazy(()=>import("../../../DocumentReader"));

type Props={
  token:string;
  document:DocumentItem;
  versionId?:string;
  onClose:()=>void;
};

const protectedAction=(target:HTMLElement|null)=>{
  if(!target)return "";
  const node=target.closest("button,a,[role='button']") as HTMLElement|null;
  if(!node)return "";
  return `${node.textContent||""} ${node.getAttribute("aria-label")||""} ${node.getAttribute("title")||""}`.toLowerCase();
};

export default function SecureRepositoryReader({token,document,versionId,onClose}:Props){
  const[caps,setCaps]=useState<DocumentProtectionEffective|null>(null);
  const[error,setError]=useState("");
  const[notice,setNotice]=useState("");
  const printLogged=useRef(false);
  const requestKey=`${token}:${document.id}`;

  useEffect(()=>{
    let active=true;
    setCaps(null);
    setError("");
    api.documentProtectionEffective(token,document.id)
      .then(value=>{if(active){setCaps(value);setError("")}})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:"Protected record access could not be verified.")});
    return()=>{active=false};
  },[requestKey]);

  useEffect(()=>{
    if(!caps)return;
    const beforePrint=()=>{
      if(!caps.canPrint){
        setNotice("Printing is disabled for this protected record.");
        return;
      }
      if(!printLogged.current){
        printLogged.current=true;
        void api.recordDocumentPrint(token,document.id).catch(()=>{});
        window.setTimeout(()=>{printLogged.current=false},1500);
      }
    };
    window.addEventListener("beforeprint",beforePrint);
    return()=>window.removeEventListener("beforeprint",beforePrint);
  },[caps,token,document.id]);

  const watermarks=useMemo(()=>Array.from({length:12},(_,index)=>index),[]);

  if(error)return <div className="repository-secure-reader-denied">
    <div><small>PROTECTED RECORD</small><h2>Access not authorised</h2><p>{error}</p><button type="button" onClick={onClose}>Close</button></div>
  </div>;

  if(!caps)return <div className="repository-secure-reader">
    <div className="repository-secure-reader-loading" role={error?"alert":"status"}>
      {error?<><strong>Reader could not be opened</strong><span>{error}</span><button type="button" onClick={onClose}>Close reader</button></>:<><span className="repository-reader-spinner" aria-hidden="true"/><strong>Opening protected reader…</strong><span>Checking access to this document.</span></>}
    </div>
  </div>;

  const blockAction=(event:React.SyntheticEvent)=>{
    const action=protectedAction(event.target as HTMLElement);
    const blocked=
      (!caps.canDownload&&(action.includes("download")||action.includes("save")))||
      (!caps.canCopy&&(action.includes("copy")||action.includes("clipboard")))||
      (!caps.canPrint&&action.includes("print"));
    if(blocked){
      event.preventDefault();
      event.stopPropagation();
      setNotice("That action is disabled by this record's protection policy.");
    }
  };

  const onKeyDown=(event:React.KeyboardEvent)=>{
    const modified=event.ctrlKey||event.metaKey;
    const key=event.key.toLowerCase();
    if(modified&&((key==="c"&&!caps.canCopy)||(key==="p"&&!caps.canPrint)||(key==="s"&&!caps.canDownload))){
      event.preventDefault();
      event.stopPropagation();
      setNotice(
        key==="c"?"Copying is disabled for this protected record.":
        key==="p"?"Printing is disabled for this protected record.":
        "Saving/downloading is disabled for this protected record."
      );
    }
  };

  return <div
    className={[
      "repository-secure-reader",
      !caps.canDownload?"block-download":"",
      !caps.canCopy?"block-copy":"",
      !caps.canPrint?"block-print":"",
    ].filter(Boolean).join(" ")}
    onClickCapture={blockAction}
    onKeyDownCapture={onKeyDown}
    onCopyCapture={event=>{if(!caps.canCopy){event.preventDefault();setNotice("Copying is disabled for this protected record.");}}}
    onCutCapture={event=>{if(!caps.canCopy){event.preventDefault();setNotice("Copying is disabled for this protected record.");}}}
    onContextMenuCapture={event=>{if(!caps.canCopy){event.preventDefault();}}}
  >
    <div className="repository-secure-reader-policy">
      <div><small>PROTECTED RECORD</small><strong>{caps.readerScope.replaceAll("_"," ")}</strong></div>
      <div className="repository-secure-reader-capabilities">
        <span>{caps.canDownload?"Download allowed":"Download blocked"}</span>
        <span>{caps.canCopy?"Copy allowed":"Copy blocked"}</span>
        <span>{caps.canPrint?"Print allowed":"Print blocked"}</span>
        {caps.watermark&&<span>Watermarked</span>}
      </div>
      {caps.restrictionReason&&<small>{caps.restrictionReason}</small>}
    </div>

    {notice&&<div className="repository-secure-reader-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>×</button></div>}

    <Suspense fallback={<div className="document-reader-loading">Opening secure reader…</div>}>
      <DocumentReader token={token} document={document} versionId={versionId} onClose={onClose}/>
    </Suspense>

    {caps.watermark&&caps.watermarkText&&<div className="repository-secure-reader-watermark" aria-hidden="true">
      {watermarks.map(index=><span key={index}>{caps.watermarkText}</span>)}
    </div>}

    <div className="repository-secure-reader-limit">
      Protection controls restrict APP2 actions and are audited. An authorised viewer can still photograph or manually transcribe information displayed on screen.
    </div>
  </div>;
}
