import type { ReactNode } from 'react'

type AppShellProps = {
  children: ReactNode
  compact?: boolean
  collapsed?: boolean
}

export default function AppShell({children,compact=false,collapsed=false}:AppShellProps){
  return <div className={`dashboard-shell app-shell${compact?' compact-layout':''}${collapsed?' sidebar-collapsed':''}`}>
    {children}
  </div>
}
