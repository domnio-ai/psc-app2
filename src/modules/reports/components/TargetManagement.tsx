import {useEffect,useMemo,useState} from 'react'
import {api,type InstitutionalIntelligence} from '../../../api'

export const MANAGEMENT_TARGET_VIEW_NAME='__App2 Management Targets__'
const REPORT_KEY='executive-performance-overview'

type Targets={
  completionRate:number
  onTimeCompletionRate:number
  researchCompletionRate:number
  approvalRate:number
  reviewTurnaroundDays:number
  overdueTolerance:number
}

const defaults:Targets={
  completionRate:85,
  onTimeCompletionRate:90,
  researchCompletionRate:80,
  approvalRate:85,
  reviewTurnaroundDays:5,
  overdueTolerance:0,
}

function numberValue(value:unknown,fallback:number){
  const parsed=Number(value)
  return Number.isFinite(parsed)?parsed:fallback
}

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}

function statusFor(actual:number,target:number,lowerIsBetter=false){
  const variance=lowerIsBetter?target-actual:actual-target
  if(variance>=0)return {label:'On target',tone:'healthy'}
  const distance=Math.abs(variance)
  const threshold=lowerIsBetter?Math.max(1,target*0.25):5
  return {label:distance<=threshold?'Near target':'Off target',tone:distance<=threshold?'watch':'critical'}
}

function formatVariance(actual:number,target:number,unit:'%'|'days'|'items',lowerIsBetter=false){
  const raw=actual-target
  const favourable=lowerIsBetter?raw<=0:raw>=0
  const value=Math.abs(raw)
  if(unit==='%')return `${favourable?'▲':'▼'} ${value.toFixed(value%1===0?0:1)} pp ${favourable?'vs target':'below target'}`
  if(unit==='days')return `${favourable?'▲':'▼'} ${value.toFixed(value%1===0?0:1)} days ${favourable?'within target':'over target'}`
  return `${favourable?'▲':'▼'} ${value.toFixed(0)} item${value===1?'':'s'} ${favourable?'within tolerance':'over tolerance'}`
}

export default function TargetManagement({token,data,onOpen}:{token:string;data:InstitutionalIntelligence;onOpen:(title:string,rows:Record<string,unknown>[])=>void}){
  const [targets,setTargets]=useState<Targets>(defaults)
  const [editing,setEditing]=useState(false)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const [loaded,setLoaded]=useState(false)

  useEffect(()=>{
    let active=true
    api.reportViews(token,REPORT_KEY).then(views=>{
      if(!active)return
      const saved=views.find(view=>view.name===MANAGEMENT_TARGET_VIEW_NAME)
      if(saved){
        const f=saved.filters||{}
        setTargets({
          completionRate:numberValue(f.targetCompletionRate,defaults.completionRate),
          onTimeCompletionRate:numberValue(f.targetOnTimeCompletionRate,defaults.onTimeCompletionRate),
          researchCompletionRate:numberValue(f.targetResearchCompletionRate,defaults.researchCompletionRate),
          approvalRate:numberValue(f.targetApprovalRate,defaults.approvalRate),
          reviewTurnaroundDays:numberValue(f.targetReviewTurnaroundDays,defaults.reviewTurnaroundDays),
          overdueTolerance:numberValue(f.targetOverdueTolerance,defaults.overdueTolerance),
        })
      }
      setLoaded(true)
    }).catch(()=>setLoaded(true))
    return()=>{active=false}
  },[token])

  const metrics=useMemo(()=>{
    const k=data.overview.kpis
    const comparison=data.overview.comparison
    const reviewActual=Number(data.research.review.average_review_days||0)
    const records=data.overview.records
    return [
      {key:'completionRate',label:'Completion rate',actual:Number(k.completionRate||0),target:targets.completionRate,unit:'%' as const,lower:false,trend:Number(comparison?.deltas.completionRate||0),drill:records.filter(row=>String(row.status)!=='Completed')},
      {key:'onTimeCompletionRate',label:'On-time completion',actual:Number(k.onTimeCompletionRate||0),target:targets.onTimeCompletionRate,unit:'%' as const,lower:false,trend:null,drill:records.filter(row=>String(row.status)==='Completed')},
      {key:'researchCompletionRate',label:'Research completion',actual:Number(k.researchCompletionRate||0),target:targets.researchCompletionRate,unit:'%' as const,lower:false,trend:null,drill:data.attention.filter(row=>String(row.type)==='Research')},
      {key:'approvalRate',label:'Research approval',actual:Number(k.approvalRate||0),target:targets.approvalRate,unit:'%' as const,lower:false,trend:null,drill:data.attention.filter(row=>String(row.type)==='Research')},
      {key:'reviewTurnaroundDays',label:'Review turnaround',actual:reviewActual,target:targets.reviewTurnaroundDays,unit:'days' as const,lower:true,trend:null,drill:data.overview.records.filter(row=>String(row.status)==='Ready for Review')},
      {key:'overdueTolerance',label:'Overdue tolerance',actual:Number(k.overdue||0),target:targets.overdueTolerance,unit:'items' as const,lower:true,trend:Number(comparison?.deltas.overdue||0),drill:records.filter(row=>String(row.status)!=='Completed'&&row.due_date&&new Date(String(row.due_date))<new Date())},
    ]
  },[data,targets])

  const saveTargets=async()=>{
    setSaving(true);setMessage('')
    try{
      await api.saveReportView(token,REPORT_KEY,MANAGEMENT_TARGET_VIEW_NAME,{
        targetCompletionRate:clamp(targets.completionRate,0,100),
        targetOnTimeCompletionRate:clamp(targets.onTimeCompletionRate,0,100),
        targetResearchCompletionRate:clamp(targets.researchCompletionRate,0,100),
        targetApprovalRate:clamp(targets.approvalRate,0,100),
        targetReviewTurnaroundDays:clamp(targets.reviewTurnaroundDays,0,365),
        targetOverdueTolerance:clamp(targets.overdueTolerance,0,100000),
        purpose:'management-targets',
      },false)
      setEditing(false)
      setMessage('Management targets saved to your governed APP2 report profile.')
    }catch(value){setMessage(value instanceof Error?value.message:'Management targets could not be saved.')}
    finally{setSaving(false)}
  }

  if(!loaded)return <section className="target-management target-loading"><p>Loading management targets…</p></section>
  return <section className="target-management">
    <header className="target-management-header">
      <div><small>EXECUTIVE BENCHMARKING & TARGET MANAGEMENT</small><h3>Actual performance against declared management targets</h3><p>Targets are user-specific management controls stored through APP2’s governed saved-report mechanism. They are not staff scores.</p></div>
      <button type="button" onClick={()=>setEditing(value=>!value)}>{editing?'Cancel editing':'Edit targets'}</button>
    </header>
    {editing&&<div className="target-editor">
      <label>Completion rate %<input type="number" min="0" max="100" value={targets.completionRate} onChange={event=>setTargets({...targets,completionRate:Number(event.target.value)})}/></label>
      <label>On-time completion %<input type="number" min="0" max="100" value={targets.onTimeCompletionRate} onChange={event=>setTargets({...targets,onTimeCompletionRate:Number(event.target.value)})}/></label>
      <label>Research completion %<input type="number" min="0" max="100" value={targets.researchCompletionRate} onChange={event=>setTargets({...targets,researchCompletionRate:Number(event.target.value)})}/></label>
      <label>Research approval %<input type="number" min="0" max="100" value={targets.approvalRate} onChange={event=>setTargets({...targets,approvalRate:Number(event.target.value)})}/></label>
      <label>Review turnaround days<input type="number" min="0" max="365" step="0.5" value={targets.reviewTurnaroundDays} onChange={event=>setTargets({...targets,reviewTurnaroundDays:Number(event.target.value)})}/></label>
      <label>Overdue tolerance<input type="number" min="0" max="100000" value={targets.overdueTolerance} onChange={event=>setTargets({...targets,overdueTolerance:Number(event.target.value)})}/></label>
      <button type="button" disabled={saving} onClick={()=>void saveTargets()}>{saving?'Saving…':'Save management targets'}</button>
    </div>}
    {message&&<p className="target-message" role="status">{message}</p>}
    <div className="target-grid">
      {metrics.map(metric=>{
        const status=statusFor(metric.actual,metric.target,metric.lower)
        const maximum=metric.unit==='%'?100:Math.max(metric.actual,metric.target,1)*1.25
        const actualWidth=clamp(metric.actual/maximum*100,0,100)
        const targetLeft=clamp(metric.target/maximum*100,0,100)
        return <article key={metric.key} className={`target-card ${status.tone}`}>
          <div className="target-card-top"><div><span>{metric.label}</span><strong>{metric.actual}{metric.unit==='%'?'%':metric.unit==='days'?' days':''}</strong></div><b>{status.label}</b></div>
          <div className="target-track" aria-label={`${metric.label}: actual ${metric.actual}, target ${metric.target}`}><span className="target-actual" style={{width:`${actualWidth}%`}}/><i className="target-marker" style={{left:`${targetLeft}%`}}/></div>
          <div className="target-card-meta"><span>Target <b>{metric.target}{metric.unit==='%'?'%':metric.unit==='days'?' days':''}</b></span><span>{formatVariance(metric.actual,metric.target,metric.unit,metric.lower)}</span></div>
          {metric.trend!==null&&<small>Comparable-period movement: {metric.trend>0?'+':''}{metric.trend}{metric.key==='completionRate'?' pp':' item'+(Math.abs(metric.trend)===1?'':'s')}</small>}
          <button type="button" onClick={()=>onOpen(`${metric.label} · target evidence`,metric.drill)}>Open underlying evidence →</button>
        </article>
      })}
    </div>
    <footer><strong>Interpretation rule:</strong> variance shows distance from the declared target. “On target” is descriptive control status only; it does not rank or score employees.</footer>
  </section>
}
