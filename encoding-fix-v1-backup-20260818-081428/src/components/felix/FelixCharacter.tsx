import {useId} from 'react'
import type {FelixVisualState} from './animations/felixStates'
import FelixStatus from './FelixStatus'

export interface FelixCharacterProps{state?:FelixVisualState;size?:'xs'|'sm'|'md'|'lg';interactive?:boolean;showStatus?:boolean;className?:string}

export default function FelixCharacter({state='idle',size='md',interactive=false,showStatus=false,className=''}:FelixCharacterProps){
  const id=useId().replaceAll(':','')
  return <span className={`professor-felix professor-felix-${size} professor-felix-${state} ${interactive?'is-interactive':''} ${className}`.trim()} data-felix-state={state}>
    <svg className="professor-felix-art" viewBox="0 0 120 140" role="img" aria-label={`Felix: ${state.replaceAll('_',' ')}`}>
      <defs>
        <linearGradient id={`${id}-aura`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e4bd52" stopOpacity=".8"/><stop offset="1" stopColor="#5b91aa" stopOpacity=".18"/></linearGradient>
        <linearGradient id={`${id}-jacket`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#26343d"/><stop offset="1" stopColor="#10191f"/></linearGradient>
        <linearGradient id={`${id}-skin`} x1=".2" y1="0" x2=".8" y2="1"><stop stopColor="#9b684b"/><stop offset="1" stopColor="#704431"/></linearGradient>
        <linearGradient id={`${id}-tablet`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#263f4e"/><stop offset="1" stopColor="#09151c"/></linearGradient>
      </defs>
      <circle className="felix-aura" cx="60" cy="66" r="49" fill="none" stroke={`url(#${id}-aura)`} strokeWidth="2" strokeDasharray="3 6" opacity=".65"/>
      <g className="felix-body">
        <path d="M12 139c3-28 18-43 48-45 30 2 45 17 48 45z" fill={`url(#${id}-jacket)`} stroke="#d9b64c" strokeWidth="1.8"/>
        <path d="M43 96l17 25 17-25-9-5H52z" fill="#f0eee8"/>
        <path d="M52 94l8 10 8-10 6 8-14 19-14-19z" fill="#bd9434"/>
        <path d="M26 123l17-18M94 123l-17-18" stroke="#4d626e" strokeWidth="2"/>
        <circle cx="60" cy="129" r="2" fill="#d9b64c"/>
      </g>
      <g className="felix-head">
        <ellipse cx="60" cy="57" rx="27" ry="33" fill={`url(#${id}-skin)`}/>
        <path d="M35 50c1-23 12-36 25-36 17 0 25 13 25 35-7-10-15-15-25-16-9 7-17 11-25 11z" fill="#d5d7d5"/>
        <path d="M38 40c7-13 17-18 30-17 7 1 12 4 16 9-8-15-30-19-42-6-4 4-6 9-7 14z" fill="#eef0ed" opacity=".75"/>
        <path d="M38 67c2 19 11 28 22 28s20-9 22-28c-5 9-13 13-22 13s-17-4-22-13z" fill="#d4d6d3" opacity=".95"/>
        <path d="M50 77c6 5 14 5 20 0" fill="none" stroke="#4b2c24" strokeLinecap="round" strokeWidth="2.2"/>
        <path d="M58 62l-2 9 6 1" fill="none" stroke="#5c382b" strokeLinecap="round" strokeWidth="1.6"/>
      </g>
      <g className="felix-eyes" fill="#15191b"><ellipse cx="49" cy="57" rx="2.2" ry="2.7"/><ellipse cx="71" cy="57" rx="2.2" ry="2.7"/></g>
      <g className="felix-glasses" fill="#18303b" fillOpacity=".2" stroke="#e0bd57" strokeWidth="2.2"><circle cx="48" cy="57" r="10"/><circle cx="72" cy="57" r="10"/><path d="M58 56h4M38 55l-6-2M82 55l6-2" fill="none"/></g>
      <g className="felix-tablet"><rect x="61" y="101" width="47" height="35" rx="5" fill={`url(#${id}-tablet)`} stroke="#d9b64c" strokeWidth="2"/><circle cx="84.5" cy="106" r="1.5" fill="#d9b64c"/><g className="felix-data-lines" stroke="#7ac3e8" strokeWidth="2" opacity=".85"><path d="M68 114h31"/><path d="M68 121h22"/><path d="M68 128h27"/></g><path className="felix-scan-line" d="M66 110h37" stroke="#b7ebff" strokeWidth="2" opacity="0"/></g>
      <g className="felix-indicator"><circle cx="101" cy="27" r="10" fill="#172129" stroke="currentColor" strokeWidth="2"/><path d="M96 27l4 4 6-8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4"/></g>
    </svg>{showStatus&&<FelixStatus state={state}/>}</span>
}
