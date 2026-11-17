import type { MouseEvent, ReactNode } from 'react'

type AppShellProps = {
  children: ReactNode
  compact?: boolean
  collapsed?: boolean
}

export default function AppShell({children,compact=false,collapsed=false}:AppShellProps){
  const keepPopupOpen = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const isBackdrop = [...target.classList].some((name) =>
      name.includes('backdrop'),
    );
    if (isBackdrop) event.stopPropagation();
  };

  return <div
    className={`dashboard-shell app-shell${compact?' compact-layout':''}${collapsed?' sidebar-collapsed':''}`}
    onClickCapture={keepPopupOpen}
    onMouseDownCapture={keepPopupOpen}
  >
    {children}
  </div>
}
