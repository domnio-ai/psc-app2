import type { ReactNode } from 'react'

export type BreadcrumbItem={label:string;onClick?:()=>void}

type WorkspaceHeaderProps={
  eyebrow?:string
  title:string
  subtitle:string
  breadcrumbs:BreadcrumbItem[]
  icon?:ReactNode
  reference?:string
  status?:string
  onBack?:()=>void
  onDashboard?:()=>void
  onClose?:()=>void
  actions?:ReactNode
}

export function Breadcrumbs({items}:{items:BreadcrumbItem[]}){
  return <nav className="breadcrumbs" aria-label="Breadcrumb">
    <ol>{items.map((item,index)=><li key={`${item.label}-${index}`}>
      {item.onClick?<button type="button" onClick={item.onClick}>{item.label}</button>:<span aria-current={index===items.length-1?'page':undefined}>{item.label}</span>}
    </li>)}</ol>
  </nav>
}

export default function WorkspaceHeader({eyebrow,title,subtitle,breadcrumbs,icon,reference,status,onBack,onDashboard,onClose,actions}:WorkspaceHeaderProps){
  return <header className="workspace-header">
    <Breadcrumbs items={breadcrumbs}/>
    <div className="workspace-header-row">
      <div className="workspace-heading">
        {icon&&<span className="workspace-icon" aria-hidden="true">{icon}</span>}
        <div>{eyebrow&&<p>{eyebrow}</p>}<h1>{title}</h1><span>{subtitle}</span></div>
      </div>
      <div className="workspace-actions">
        {reference&&<span className="workspace-reference">{reference}</span>}
        {status&&<span className="status-badge">{status}</span>}
        {onBack&&<button type="button" className="secondary" onClick={onBack}>← Back</button>}
        {onDashboard&&<button type="button" className="secondary" onClick={onDashboard}>Dashboard</button>}
        {actions}
        {onClose&&<button type="button" className="workspace-close" onClick={onClose} aria-label={`Close ${title} workspace`}>Close</button>}
      </div>
    </div>
  </header>
}
