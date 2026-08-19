import { useEffect, type ReactNode } from 'react'

export type ThemeMode='Dark'|'Light'|'System'|'Gold Grey'|'Navy Blue'|'Navy Blue'
export type AccentColor='Gold'|'Blue'|'Green'

export default function ThemeProvider({mode,accent,children}:{mode:ThemeMode;accent:AccentColor;children:ReactNode}){
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: light)')
    const apply=()=>{
      const resolved=mode==='System'?(media.matches?'light':'dark'):mode.toLowerCase().replaceAll(' ','-')
      document.documentElement.dataset.theme=resolved
      document.documentElement.dataset.themePreference=mode.toLowerCase().replaceAll(' ','-')
      document.documentElement.dataset.accent=accent.toLowerCase()
    }
    apply()
    if(mode==='System')media.addEventListener('change',apply)
    return()=>media.removeEventListener('change',apply)
  },[mode,accent])
  return children
}
