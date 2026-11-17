import {useCallback,useEffect,useRef,useState,type ClipboardEvent} from 'react'
import {GlobalWorkerOptions,getDocument,type PDFDocumentProxy} from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {api,type DocumentItem} from './api'
import FelixCharacter from './components/felix/FelixCharacter'
import FelixStatus from './components/felix/FelixStatus'
import {useFelixVisualState} from './components/felix/animations/FelixAnimationController'
import './document-reader.css'
import repositoryReaderDocumentCss from './modules/repository/repository-reader-document.css?inline'

GlobalWorkerOptions.workerSrc=pdfWorker
const API_URL=import.meta.env.VITE_API_URL||'http://127.0.0.1:8000/api'
type ReaderPayload={format:'docx'|'text'|'markdown'|'html';html:string;text:string;warnings?:string[];metadata:{versionId:string;version:number;isCurrent:boolean;canDownload:boolean;uploadedAt?:string;uploadedBy?:string;reportReference?:string|null;reportTitle?:string|null;assignmentTitle?:string|null;preparedBy?:string|null;reviewer?:string|null;reportVersion?:number|null;reportStatus?:string|null;reportClassification?:string|null}}
type FelixAssessment={overall_assessment:string;classification:{document_type:string;confidence:string};framework:{name:string;source:string};strengths:Array<{title:string;explanation:string}>;findings:Array<{kind:string;title:string;explanation:string}>;questions:string[];recommendations:Array<{priority:string;title:string;recommended_action:string}>;citations:Array<{title:string;page?:number;section?:string;chunk_id:string}>;limitations:string}

function PdfPageCanvas({pdf,pageNumber,stageWidth,fit,zoom,register}:{pdf:PDFDocumentProxy;pageNumber:number;stageWidth:number;fit:boolean;zoom:number;register:(page:number,node:HTMLDivElement|null)=>void}){
  const wrapperRef=useRef<HTMLDivElement>(null),canvasRef=useRef<HTMLCanvasElement>(null)
  const [near,setNear]=useState(pageNumber<=2),[ratio,setRatio]=useState(1.414)
  useEffect(()=>{register(pageNumber,wrapperRef.current);return()=>register(pageNumber,null)},[pageNumber,register])
  useEffect(()=>{let cancelled=false;pdf.getPage(pageNumber).then(item=>{if(cancelled)return;const base=item.getViewport({scale:1});setRatio(base.height/base.width)}).catch(()=>{});return()=>{cancelled=true}},[pdf,pageNumber])
  useEffect(()=>{const node=wrapperRef.current;if(!node)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))setNear(true)},{root:null,rootMargin:'1200px 0px',threshold:0});observer.observe(node);return()=>observer.disconnect()},[])
  useEffect(()=>{if(!near||!canvasRef.current)return;let cancelled=false,renderTask:any;pdf.getPage(pageNumber).then(async pdfPage=>{if(cancelled||!canvasRef.current)return;const base=pdfPage.getViewport({scale:1});const available=Math.max(320,stageWidth-56);const scale=fit?available/base.width:zoom;const viewport=pdfPage.getViewport({scale});const canvas=canvasRef.current,context=canvas.getContext('2d');if(!context)return;const pixelRatio=window.devicePixelRatio||1;canvas.width=Math.floor(viewport.width*pixelRatio);canvas.height=Math.floor(viewport.height*pixelRatio);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;renderTask=pdfPage.render({canvas,canvasContext:context,viewport,transform:pixelRatio===1?undefined:[pixelRatio,0,0,pixelRatio,0,0]});await renderTask.promise}).catch(()=>{});return()=>{cancelled=true;try{renderTask?.cancel?.()}catch{}}},[pdf,pageNumber,stageWidth,fit,zoom,near])
  const cssWidth=Math.max(320,fit?stageWidth-56:Math.min(stageWidth-32,900*zoom))
  return <div className="reader-pdf-page" data-page={pageNumber} ref={wrapperRef} style={{minHeight:Math.max(420,cssWidth*ratio)}}><canvas ref={canvasRef}/><span>Page {pageNumber}</span></div>
}

export default function DocumentReader({token,document,versionId,onClose}:{token:string;document:DocumentItem;versionId?:string;onClose:()=>void}){
  const {state:felixState,beginOperation:beginFelix,completeOperation:completeFelix,failOperation:failFelix}=useFelixVisualState()
  const [payload,setPayload]=useState<ReaderPayload|null>(null),[pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[fit,setFit]=useState(true)
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[matches,setMatches]=useState<number[]>([]),[matchIndex,setMatchIndex]=useState(0),[infoOpen,setInfoOpen]=useState(true),[felixOpen,setFelixOpen]=useState(false),[question,setQuestion]=useState(''),[answer,setAnswer]=useState(''),[asking,setAsking]=useState(false),[assessment,setAssessment]=useState<FelixAssessment|null>(null),[assessing,setAssessing]=useState(false),[assessmentError,setAssessmentError]=useState('')
  const [reportPdfBusy,setReportPdfBusy]=useState(false),[reportPdfError,setReportPdfError]=useState('')
  const [copyNotice,setCopyNotice]=useState(''),[stageWidth,setStageWidth]=useState(960)
  const readerRef=useRef<HTMLElement>(null),pageNodesRef=useRef(new Map<number,HTMLDivElement>())
  const readerHtmlFrameRef=useRef<HTMLIFrameElement>(null)
  const readerFrameResizeObserverRef=useRef<ResizeObserver|null>(null)
  const readerUrl=`${API_URL}/documents/${document.id}${versionId?`/versions/${versionId}`:''}/reader`
  const classification=document.classification||'INTERNAL',historical=versionId?payload?!payload.metadata.isCurrent:true:false
  useEffect(()=>{let cancelled=false;setLoading(true);setError('');setPayload(null);setPdf(null);fetch(readerUrl,{headers:{Authorization:`Bearer ${token}`}}).then(async response=>{if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||'Document could not be opened.');if((response.headers.get('content-type')||'').includes('application/pdf')){const bytes=await response.arrayBuffer();const loaded=await getDocument({data:bytes}).promise;if(!cancelled){setPdf(loaded);const remembered=Number(localStorage.getItem(`app2-reader-${document.id}-${versionId||'current'}`)||1);setPage(Math.min(Math.max(1,remembered),loaded.numPages))}}else{const data=await response.json();if(!cancelled)setPayload(data)}}).catch(value=>!cancelled&&setError(value instanceof Error?value.message:'Document could not be opened.')).finally(()=>!cancelled&&setLoading(false));return()=>{cancelled=true}},[readerUrl,token,document.id,versionId])
  useEffect(()=>{const node=readerRef.current;if(!node)return;const sync=()=>setStageWidth(Math.max(360,node.clientWidth));sync();const observer=new ResizeObserver(sync);observer.observe(node);return()=>observer.disconnect()},[pdf,payload])
  useEffect(()=>()=>readerFrameResizeObserverRef.current?.disconnect(),[])
  useEffect(()=>{if(!pdf)return;localStorage.setItem(`app2-reader-${document.id}-${versionId||'current'}`,String(page))},[pdf,page,document.id,versionId])
  useEffect(()=>{let cancelled=false;if(!search.trim()){setMatches([]);setMatchIndex(0);return}if(pdf){Promise.all(Array.from({length:pdf.numPages},(_,index)=>pdf.getPage(index+1).then(item=>item.getTextContent()).then(content=>({page:index+1,text:content.items.map(value=>'str'in value?value.str:'').join(' ')})))).then(pages=>{if(cancelled)return;const needle=search.toLowerCase();const found=pages.flatMap(item=>Array.from({length:item.text.toLowerCase().split(needle).length-1},()=>item.page));setMatches(found);setMatchIndex(0);if(found[0])setPage(found[0])})}else if(payload){const count=payload.text.toLowerCase().split(search.toLowerCase()).length-1;setMatches(Array.from({length:count},()=>1));setMatchIndex(0)}return()=>{cancelled=true}},[search,pdf,payload])
  const currentVersion=payload?.metadata.version||document.latest_version||document.current_version||1
  const assignmentReportOrigin=document.document_type==='Assignment Report Draft'?document.origin_links?.find(link=>link.type==='report'):undefined
  const downloadAssignmentReportPdf=async()=>{
    if(!assignmentReportOrigin||reportPdfBusy)return
    setReportPdfBusy(true);setReportPdfError('')
    try{await api.exportGeneratedDocument(token,assignmentReportOrigin.id,document.title,'pdf')}
    catch(value){setReportPdfError(value instanceof Error?value.message:'The assignment report PDF could not be downloaded.')}
    finally{setReportPdfBusy(false)}
  }
  const registerPdfPage=useCallback((pageNumber:number,node:HTMLDivElement|null)=>{if(node)pageNodesRef.current.set(pageNumber,node);else pageNodesRef.current.delete(pageNumber)},[])
  const goToPage=(pageNumber:number)=>{if(!pdf)return;const target=Math.min(Math.max(1,pageNumber),pdf.numPages);setPage(target);window.requestAnimationFrame(()=>pageNodesRef.current.get(target)?.scrollIntoView({block:'start',behavior:'smooth'}))}
  const syncActivePdfPage=()=>{if(!pdf||!readerRef.current)return;const stageTop=readerRef.current.getBoundingClientRect().top+18;let best=page,bestDistance=Number.POSITIVE_INFINITY;for(const [number,node] of pageNodesRef.current){const distance=Math.abs(node.getBoundingClientRect().top-stageTop);if(distance<bestDistance){bestDistance=distance;best=number}}if(best!==page)setPage(best)}
  const nextMatch=(direction:number)=>{if(!matches.length)return;const next=(matchIndex+direction+matches.length)%matches.length;setMatchIndex(next);if(pdf)goToPage(matches[next])}
  const askFelix=async()=>{if(!question.trim())return;setAsking(true);setAnswer('');beginFelix('document_summary');try{const result=await api.askDocumentFelix(token,document.id,question.trim());setAnswer(result.answer);completeFelix(/insufficient|cannot assess/i.test(result.answer)?'insufficient_evidence':'presenting')}catch(value){failFelix();setAnswer(value instanceof Error?value.message:'Felix could not answer.')}finally{setAsking(false)}}
  const auditFelix=async()=>{setFelixOpen(true);setInfoOpen(false);setAssessing(true);setAssessmentError('');setAssessment(null);beginFelix('document_audit');try{const value=await api.assessDocumentFelix(token,document.id) as FelixAssessment;setAssessment(value);completeFelix(value.overall_assessment==='READY'||value.overall_assessment==='READY WITH MINOR ISSUES'?'success':value.overall_assessment==='UNABLE TO ASSESS'?'insufficient_evidence':'found_issue')}catch(value){failFelix();setAssessmentError(value instanceof Error?value.message:'Felix could not assess this document.')}finally{setAssessing(false)}}
    /* APP2_REPOSITORY_READER_PRO_LAYOUT_V11
     Keep report HTML structured, add a controlled PSC cover to assignment reports,
     and render wide workflow tables in a readable, horizontally scrollable layout. */
  const prepareRepositoryReaderHtml = (input: string): string => {
    let html = String(input ?? "").trim();
    if (!html) {
      return '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
    }

    const isTaskReport = /task[\s_-]*report/i.test(
      `${document.document_type || ""} ${document.title || ""} ${document.category || ""}`,
    );
    const isAssignmentReport = /assignment[\s_-]*(?:(?:final[\s_-]*)?report|draft)/i.test(
      `${document.document_type || ""} ${document.title || ""}`,
    );
    const isResearchReport = /research[\s_-]*(?:(?:final[\s_-]*)?report|draft)/i.test(
      `${document.document_type || ""} ${document.title || ""}`,
    );
    const isControlledReport = isTaskReport || isAssignmentReport || isResearchReport;
    const isMeetingMinutes = /meeting\s+minutes/i.test(
      `${document.document_type || ""} ${document.title || ""}`,
    );

    // The frame needs a complete document so the report stylesheet has a real head.
    if (!/<html\b/i.test(html)) {
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
    }
    if (!isControlledReport && !isMeetingMinutes) return html;

    // Parse only for safe structural cleanup. Scripts remain disabled by the iframe sandbox.
    const parsed = new DOMParser().parseFromString(html, "text/html");
    if (isMeetingMinutes && !parsed.querySelector(".app2-repository-meeting-minutes")) {
      const page = parsed.createElement("main");
      page.className = "app2-repository-meeting-minutes";
      while (parsed.body.firstChild) page.append(parsed.body.firstChild);
      parsed.body.append(page);
    }
    if (isAssignmentReport && !parsed.querySelector(".app2-repository-document-control")) {
      const article = parsed.querySelector("body > article.page") || parsed.createElement("article");
      article.classList.add("app2-repository-assignment-report");
      article.classList.add("page");
      if (!article.parentElement) {
        while (parsed.body.firstChild) article.append(parsed.body.firstChild);
        parsed.body.append(article);
      }

      const cover = parsed.createElement("section");
      cover.className = "app2-repository-report-cover";
      cover.setAttribute("aria-label", "PSC assignment report document control");
      const masthead = parsed.createElement("div");
      masthead.className = "app2-psc-report-brand";
      const logo = parsed.createElement("img");
      logo.src = "/psc-logo.png";
      logo.alt = "Public Service Commission logo";
      logo.width = 72;
      logo.height = 72;
      const identity = parsed.createElement("div");
      const commission = parsed.createElement("strong");
      commission.textContent = "PUBLIC SERVICE COMMISSION";
      const directorate = parsed.createElement("span");
      directorate.textContent = document.directorate || "RESEARCH DEPARTMENT";
      identity.append(commission, directorate);
      masthead.append(logo, identity);

      const kicker = parsed.createElement("p");
      kicker.className = "app2-repository-report-kicker";
      kicker.textContent = "CONTROLLED ASSIGNMENT REPORT";
      const title = parsed.createElement("h1");
      title.textContent = payload?.metadata.reportTitle || document.title.replace(/\s*-\s*Draft$/i, "") || "Assignment Report";

      const control = parsed.createElement("section");
      control.className = "app2-repository-document-control";
      const controlHeader = parsed.createElement("div");
      controlHeader.className = "app2-repository-document-control-heading";
      const controlHeading = parsed.createElement("strong");
      controlHeading.textContent = "DOCUMENT CONTROL";
      const status = parsed.createElement("span");
      status.textContent = `${payload?.metadata.reportStatus || document.status || "Draft"} · Version ${payload?.metadata.reportVersion || payload?.metadata.version || document.current_version || 1}`;
      controlHeader.append(controlHeading, status);
      const table = parsed.createElement("table");
      const tbody = parsed.createElement("tbody");
      const updatedAt = payload?.metadata.uploadedAt || document.updated_at || document.created_at;
      const controlRows: Array<[string, string]> = [
        ["Report reference", payload?.metadata.reportReference || "Not recorded"],
        ["Assignment", payload?.metadata.assignmentTitle || document.subject || "Not specified"],
        ["Prepared by", payload?.metadata.preparedBy || document.author || payload?.metadata.uploadedBy || document.created_by_name || "Not recorded"],
        ["Reviewer", payload?.metadata.reviewer || document.reviewer_name || "Not assigned"],
        ["Version", String(payload?.metadata.reportVersion || payload?.metadata.version || document.current_version || 1)],
        ["Status", payload?.metadata.reportStatus || document.status || "Draft"],
        ["Classification", payload?.metadata.reportClassification || document.classification || "INTERNAL"],
        ["Last updated", updatedAt ? new Date(updatedAt).toLocaleString() : "Not recorded"],
      ];
      for (let index = 0; index < controlRows.length; index += 2) {
        const row = parsed.createElement("tr");
        for (const [label, value] of controlRows.slice(index, index + 2)) {
          const cell = parsed.createElement("td");
          const key = parsed.createElement("strong");
          key.textContent = label;
          const detail = parsed.createElement("span");
          detail.textContent = value;
          cell.append(key, detail);
          row.append(cell);
        }
        tbody.append(row);
      }
      table.append(tbody);
      control.append(controlHeader, table);
      cover.append(masthead, kicker, title, control);
      article.insertBefore(cover, article.firstChild);

      const reportContent = parsed.createElement("div");
      reportContent.className = "app2-repository-report-content";
      const contentNodes = Array.from(article.childNodes).filter((node) => node !== cover);
      contentNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && /^\s*Saved\s*:/i.test(node.textContent || "")) return;
        if (node.nodeType === Node.ELEMENT_NODE && /^\s*Saved\s*:/i.test(node.textContent || "")) return;
        reportContent.append(node);
      });
      article.append(reportContent);
    }
    const normalizeText = (value: string) => String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
    const normalizedText = (element: Element) => normalizeText(element.textContent || "");

    const brand = parsed.querySelector(".app2-psc-report-brand");
    const reportHeading = parsed.querySelector(".app2-task-report-title, h1");
    if (brand && reportHeading) {
      const canonicalTitle = normalizedText(reportHeading);
      if (canonicalTitle) {
        // Remove duplicated title-only blocks before the masthead (including wrappers
        // that V9's paragraph-only check did not catch), but never the report's real H1.
        const candidates = Array.from(parsed.body.querySelectorAll("p, div, span, h1, h2"))
          .filter((element) => {
            if (element === reportHeading || !canonicalTitle) return false;
            if (normalizedText(element) !== canonicalTitle) return false;
            return Boolean(element.compareDocumentPosition(brand) & Node.DOCUMENT_POSITION_FOLLOWING);
          });
        const outerDuplicates = candidates.filter((element) =>
          !candidates.some((other) => other !== element && other.contains(element)),
        );
        outerDuplicates.forEach((element) => element.remove());

        // Also handle a bare duplicate text node immediately before the brand.
        const walker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_TEXT);
        const duplicateTextNodes: Text[] = [];
        let textNode: Node | null;
        while ((textNode = walker.nextNode())) {
          if (
            normalizeText(textNode.textContent || "") === canonicalTitle &&
            Boolean(textNode.compareDocumentPosition(brand) & Node.DOCUMENT_POSITION_FOLLOWING)
          ) {
            duplicateTextNodes.push(textNode as Text);
          }
        }
        duplicateTextNodes.forEach((node) => node.parentNode?.removeChild(node));
      }
    }

    // Strip the legacy banner only where the proper PSC masthead is present.
    if (brand) {
      const banners = Array.from(parsed.body.querySelectorAll("div, header, p, section, span"))
        .filter((element) => /public service commission\s*(?:-|â€“|â€”|Â·|\s)+\s*official document/i.test(element.textContent || ""));
      const outerBanners = banners.filter((element) =>
        !banners.some((other) => other !== element && other.contains(element)),
      );
      outerBanners.forEach((element) => element.remove());
    }

    // Workflow matrices are often intentionally wide (six or more columns).
    // Give them a real scroll viewport instead of letting the report page clip
    // their right-hand columns in the secure repository reader.
    parsed.querySelectorAll<HTMLElement>(".app2-repository-report-content table").forEach((table) => {
      const columnCount=Math.max(0,...Array.from(table.querySelectorAll("tr"),row=>row.querySelectorAll(":scope > th, :scope > td").length))
      if(columnCount<6||!table.parentNode)return
      const scrollRegion=parsed.createElement("div")
      scrollRegion.className="app2-reader-wide-table"
      scrollRegion.setAttribute("role","region")
      scrollRegion.setAttribute("aria-label",`Wide report table with ${columnCount} columns; scroll horizontally to read all columns`)
      scrollRegion.tabIndex=0
      const hint=parsed.createElement("p")
      hint.className="app2-reader-table-hint"
      hint.textContent="Wide workflow table · scroll horizontally to read every column"
      table.parentNode.insertBefore(scrollRegion,table)
      scrollRegion.append(hint,table)
      table.classList.add("app2-reader-wide-table-content")
      table.style.minWidth=`${Math.max(1120,columnCount*145)}px`
    })

    const css = repositoryReaderDocumentCss;
    const prior = parsed.getElementById("app2-task-report-reader-pro-v10");
    prior?.remove();
    const style = parsed.createElement("style");
    style.id = "app2-task-report-reader-pro-v10";
    style.textContent = css;
    parsed.head.appendChild(style);

    return `<!doctype html>${parsed.documentElement.outerHTML}`;
  };

  const attachRepositoryFrameCopyPolicy = () => {
    const frameDocument = readerHtmlFrameRef.current?.contentDocument;
    if (!frameDocument || frameDocument.documentElement.dataset.app2CopyPolicy === "installed") return;
    // Repository HTML is already server-sanitized. Normalize supported WebP
    // assets at the reader boundary too, for historical imports predating the
    // editor's PNG/JPEG normalization.
    frameDocument.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (!/^data:image\/webp;base64,/i.test(image.src)) return;
      const canvas = frameDocument.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (context && canvas.width && canvas.height) {
        context.drawImage(image, 0, 0);
        image.src = canvas.toDataURL("image/png");
      }
    });
    frameDocument.documentElement.dataset.app2CopyPolicy = "installed";
    const frame = readerHtmlFrameRef.current;
    const resizeFrame = () => {
      if (!frame || !frameDocument.documentElement) return;
      const height = Math.max(520, Math.ceil(Math.max(
        frameDocument.documentElement.scrollHeight,
        frameDocument.body?.scrollHeight || 0,
      )));
      frame.style.height = `${Math.min(height, 150000)}px`;
    };
    readerFrameResizeObserverRef.current?.disconnect();
    if (frameDocument.body && typeof ResizeObserver !== "undefined") {
      readerFrameResizeObserverRef.current = new ResizeObserver(resizeFrame);
      readerFrameResizeObserverRef.current.observe(frameDocument.body);
      readerFrameResizeObserverRef.current.observe(frameDocument.documentElement);
    }
    requestAnimationFrame(() => requestAnimationFrame(resizeFrame));
    frameDocument.fonts?.ready.then(resizeFrame).catch(() => {});
    frameDocument.addEventListener("copy", (event) => {
      event.preventDefault();
      const selectedChars = frameDocument.getSelection()?.toString().length || 0;
      void api.logDocumentCopy(token, document.id, {
        versionId: payload?.metadata.versionId,
        charCount: selectedChars,
        mode: "BLOCKED_NATIVE",
      }).catch(() => {});
      setCopyNotice("External clipboard copy is disabled for repository documents. Use Copy within REDESY; every copy attempt is audited.");
    }, true);
  };
  const copyWithinApp2=async()=>{let text='';if(pdf){try{const content=await (await pdf.getPage(page)).getTextContent();text=content.items.map(value=>'str' in value?value.str:'').join(' ').trim()}catch{}}else{text=(readerHtmlFrameRef.current?.contentWindow?.getSelection()?.toString()||window.getSelection()?.toString()||payload?.text||'').trim()}text=text.slice(0,6000);if(!text){setCopyNotice('Select text first, or open a readable page.');return}sessionStorage.setItem('app2-internal-clipboard',text);await api.logDocumentCopy(token,document.id,{versionId:payload?.metadata.versionId,page:pdf?page:undefined,charCount:text.length,mode:'INTERNAL_COPY'}).catch(()=>{});setCopyNotice(`${text.length.toLocaleString()} characters copied inside REDESY only.`);window.setTimeout(()=>setCopyNotice(''),3500)}
  const blockNativeCopy=(event:ClipboardEvent)=>{event.preventDefault();const count=window.getSelection()?.toString().length||0;void api.logDocumentCopy(token,document.id,{versionId:payload?.metadata.versionId,page:pdf?page:undefined,charCount:count,mode:'BLOCKED_NATIVE'});setCopyNotice('External clipboard copy is disabled. Use Copy within REDESY.')}
  const contextualQuestions=/policy/i.test(`${document.category} ${document.document_type}`)?['What are the mandatory requirements?','Who is responsible?','What implementation gaps exist?']:/minute/i.test(`${document.category} ${document.document_type}`)?['What decisions were made?','What actions remain outstanding?','Who owns them?']:['Summarize this document','What are the strongest findings?','What are its limitations?','Are the conclusions justified?']
  return <div className="document-reader-shell" role="dialog" aria-modal="true" aria-label={`Read ${document.title}`} onCopy={blockNativeCopy}>
    <header><button onClick={onClose}>← Repository</button><div><small>{document.category} · Version {currentVersion} · {document.status}</small><h1>{document.title}</h1></div><div className="reader-head-actions">{assignmentReportOrigin&&<button className="reader-download-pdf" type="button" disabled={reportPdfBusy} onClick={()=>void downloadAssignmentReportPdf()}>{reportPdfBusy?"Preparing PDF…":"Download PDF"}</button>}<button onClick={()=>setInfoOpen(value=>!value)}>Information</button><button onClick={copyWithinApp2}>Copy within REDESY</button><button onClick={()=>{setFelixOpen(true);setInfoOpen(false)}}>Ask Felix</button><button onClick={auditFelix}>Audit</button><button onClick={()=>{setFelixOpen(true);setInfoOpen(false);setQuestion('Find related approved REDESY research and explain the relationship.')}}>Related research</button><button aria-label="Close reader" onClick={onClose}>×</button></div></header>
    {historical&&<div className="reader-history-banner">You are viewing a historical document version.</div>}
    {['CONFIDENTIAL','RESTRICTED'].includes(classification)&&<div className={`reader-classification ${classification.toLowerCase()}`}>{classification} — Authorized REDESY Users Only</div>}
    <div className="reader-copy-policy">External clipboard copy is disabled for repository documents. Use <b>Copy within REDESY</b>; every copy attempt is audited.</div>
    {copyNotice&&<div className="reader-copy-notice" role="status">{copyNotice}</div>}
    {reportPdfError&&<div className="reader-download-error" role="alert">PDF download failed: {reportPdfError}</div>}
    <nav className="reader-toolbar"><label><span>Search document</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search document..."/></label><span>{matches.length?`${matchIndex+1} of ${matches.length}`:'0 matches'}</span><button disabled={!matches.length} onClick={()=>nextMatch(-1)}>Previous match</button><button disabled={!matches.length} onClick={()=>nextMatch(1)}>Next match</button>{pdf&&<><i/><button disabled={page<=1} onClick={()=>goToPage(page-1)}>Previous page</button><strong>Page {page} of {pdf.numPages} · Continuous</strong><button disabled={page>=pdf.numPages} onClick={()=>goToPage(page+1)}>Next page</button><i/><button onClick={()=>{setFit(false);setZoom(value=>Math.max(.5,value-.15))}}>−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>{setFit(false);setZoom(value=>Math.min(2.5,value+.15))}}>+</button><button className={fit?'active':''} onClick={()=>setFit(true)}>Fit width</button></>}<button onClick={()=>readerRef.current?.requestFullscreen?.()}>Full screen</button></nav>
    <main><section className={`reader-stage ${payload?.format||'pdf'}`} ref={readerRef} onScroll={syncActivePdfPage}>{loading&&<div className="reader-state">Opening secure document…</div>}{error&&<div className="reader-state error"><strong>Document unavailable</strong><span>{error}</span><button onClick={onClose}>Back to Repository</button></div>}{pdf&&<div className="reader-pdf-continuous">{Array.from({length:pdf.numPages},(_,index)=><PdfPageCanvas key={index+1} pdf={pdf} pageNumber={index+1} stageWidth={stageWidth} fit={fit} zoom={zoom} register={registerPdfPage}/>)}</div>} {payload&&<iframe ref={readerHtmlFrameRef} className="reader-html-frame" title={document.title || "Repository document"} srcDoc={prepareRepositoryReaderHtml(payload.html)} sandbox="allow-same-origin" onLoad={attachRepositoryFrameCopyPolicy} style={{ display: "block", width: "100%", maxWidth: "100%", height: "1000px", minHeight: "520px", border: 0, background: "#eef1f4", overflow: "hidden" }} />}</section>
    {felixOpen&&<div className="reader-felix-presence"><FelixCharacter state={felixState} size="sm"/><FelixStatus state={felixState}/></div>}
    {infoOpen&&<aside className="reader-info">
      <div className="reader-info-head">
        <div>
          <small>CONTROLLED RECORD</small>
          <h2>Document information</h2>
        </div>
        <span className={`reader-info-status ${document.status.toLowerCase().replace(/\s+/g,'-')}`}>
          {document.status}
        </span>
      </div>

      <section className="reader-info-section">
        <h3>Document control</h3>
        <dl>
          <dt>Classification</dt><dd><b>{classification}</b></dd>
          <dt>Version</dt><dd>{currentVersion}{historical?' · Historical':' · Current'}</dd>
          <dt>Category</dt><dd>{document.category}</dd>
          <dt>Document type</dt><dd>{document.document_type||'Document'}</dd>
          <dt>Source</dt><dd>{document.source_type||'REDESY Repository'}</dd>
          <dt>Directorate</dt><dd>{document.directorate||'Not specified'}</dd>
        </dl>
      </section>

      <section className="reader-info-section">
        <h3>Accountability</h3>
        <dl>
          <dt>Author</dt><dd>{document.author||'Not specified'}</dd>
          <dt>Uploaded by</dt><dd>{document.created_by_name||'Not recorded'}</dd>
          <dt>Assigned reviewer</dt><dd>{document.reviewer_name||'Not assigned'}</dd>
          <dt>Reviewed by</dt><dd>{document.reviewed_by_name||'Not recorded'}</dd>
          <dt>Approved by</dt><dd>{document.approved_by_name||'Not approved'}</dd>
          <dt>Reviewed</dt><dd>{document.reviewed_at?new Date(document.reviewed_at).toLocaleString():'Not recorded'}</dd>
        </dl>
      </section>

      {!!document.origin_links?.length&&(
        <section className="reader-info-section">
          <h3>Related REDESY work</h3>
          <div className="reader-info-links">
            {document.origin_links.map(link=>(
              <span key={`${link.type}-${link.id}`}>
                <b>{link.type}</b>
                {link.title||link.id}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="reader-info-section">
        <h3>Description</h3>
        <p>{document.description||'No description recorded.'}</p>
        <div className="reader-info-tags">
          {document.tags?.length
            ? document.tags.map(tag=><span key={tag}>{tag}</span>)
            : <small>No tags</small>}
        </div>
      </section>

      {payload?.metadata.canDownload&&
        <button
          className="reader-info-download"
          onClick={()=>api.downloadKnowledgeVersion(
            token,
            payload.metadata.versionId,
            document.original_name
          )}
        >
          Download this version
        </button>
      }
    </aside>}
    {felixOpen&&<aside className="reader-felix"><div className="reader-felix-title"><div><small>Approved evidence only</small><h2>Felix</h2></div><button aria-label="Close Felix" onClick={()=>setFelixOpen(false)}>×</button></div><div className="reader-felix-prompts">{contextualQuestions.map(item=><button key={item} onClick={()=>setQuestion(item)}>{item}</button>)}</div><textarea value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Ask about this document…"/><button disabled={asking||!question.trim()} onClick={askFelix}>{asking?'Reading…':'Ask Felix'}</button>{answer&&<div className="reader-felix-answer">{answer}</div>}{assessing&&<div className="reader-felix-state">Running a structured evidence audit…</div>}{assessmentError&&<div className="reader-felix-state error">{assessmentError}</div>}{assessment&&<section className="reader-assessment"><header><div><small>Felix Assessment</small><h3>{assessment.overall_assessment.replaceAll('_',' ')}</h3></div><span>{assessment.classification.confidence}</span></header><p><b>{assessment.classification.document_type.replaceAll('_',' ')}</b> · {assessment.framework.name}</p>{assessment.strengths.length>0&&<div><h4>Strong</h4>{assessment.strengths.map(item=><article key={item.title}><b>{item.title}</b><p>{item.explanation}</p></article>)}</div>}<div><h4>Needs attention</h4>{assessment.findings.filter(item=>item.kind==='GAP').map(item=><article key={item.title}><b>{item.title}</b><p>{item.explanation}</p></article>)}</div><div><h4>Questions Felix would ask</h4><ul>{assessment.questions.map(item=><li key={item}>{item}</li>)}</ul></div><div><h4>Suggested actions</h4>{assessment.recommendations.map(item=><article key={item.title}><small>{item.priority}</small><b>{item.title}</b><p>{item.recommended_action}</p></article>)}</div><details><summary>Sources and limitations</summary><p>{assessment.framework.source}</p><ul>{assessment.citations.slice(0,8).map(item=><li key={item.chunk_id}>{item.title}{item.page?` · page ${item.page}`:''}{item.section?` · ${item.section}`:''}</li>)}</ul><p>{assessment.limitations}</p></details></section>}</aside>}</main>
  </div>
}
