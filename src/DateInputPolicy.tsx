import {useEffect} from 'react'

const localToday=()=>{const now=new Date(),offset=now.getTimezoneOffset();return new Date(now.getTime()-offset*60000).toISOString().slice(0,10)}
const operationalPattern=/\b(start|starts|due|deadline|target completion|completion date|end date|ends|expiry|review date|event date)\b/i
const startPattern=/\b(start|starts)\b/i
const endPattern=/\b(due|deadline|target completion|completion date|end date|ends|expiry|review date)\b/i
const contextText=(input:HTMLInputElement)=>`${input.name} ${input.getAttribute('aria-label')||''} ${input.closest('label')?.textContent||''}`
const allowManualMeetingDate=(input:HTMLInputElement)=>Boolean(input.closest('.meeting-schedule-workspace,.meeting-approval-appointments'))

export default function DateInputPolicy(){
  useEffect(()=>{
    const configure=(input:HTMLInputElement)=>{
      if(!['date','datetime-local'].includes(input.type))return
      input.classList.add('app2-picker-only-date')
      input.inputMode=allowManualMeetingDate(input)?'text':'none'
      input.autocomplete='off'
      input.title=allowManualMeetingDate(input)?'Enter a date/time or use the calendar picker.':'Use the calendar button to choose this date.'
      const text=contextText(input),historical=input.dataset.datePolicy==='historical'||!operationalPattern.test(text)
      if(!historical){
        const today=input.type==='datetime-local'?`${localToday()}T00:00`:localToday()
        let minimum=today
        if(endPattern.test(text)){
          const area=input.closest('form,section,article,.modal,.modal-backdrop,.form-pair,.calendar-form-pair')||document
          const candidates=Array.from(area.querySelectorAll<HTMLInputElement>('input[type="date"],input[type="datetime-local"]'))
          const start=candidates.find(candidate=>candidate!==input&&startPattern.test(contextText(candidate)))
          if(start?.value&&start.value>minimum)minimum=start.value
        }
        input.min=minimum
      }
    }
    const scan=(root:ParentNode=document)=>root.querySelectorAll<HTMLInputElement>('input[type="date"],input[type="datetime-local"]').forEach(configure)
    const keydown=(event:KeyboardEvent)=>{const target=event.target;if(target instanceof HTMLInputElement&&['date','datetime-local'].includes(target.type)&&!allowManualMeetingDate(target)&&!['Tab','Escape'].includes(event.key))event.preventDefault()}
    const preventManual=(event:Event)=>{const target=event.target;if(target instanceof HTMLInputElement&&['date','datetime-local'].includes(target.type)&&!allowManualMeetingDate(target))event.preventDefault()}
    const refresh=(event:Event)=>{if(event.target instanceof HTMLInputElement&&['date','datetime-local'].includes(event.target.type)){configure(event.target);const form=event.target.closest('form,section,article');if(form)scan(form)}}
    const open=(event:MouseEvent)=>{const target=event.target;if(target instanceof HTMLInputElement&&['date','datetime-local'].includes(target.type))try{target.showPicker()}catch{/* Browser already opened its native picker. */}}
    scan()
    const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof HTMLElement){if(node.matches('input[type="date"],input[type="datetime-local"]'))configure(node as HTMLInputElement);scan(node)}})))
    observer.observe(document.body,{childList:true,subtree:true})
    document.addEventListener('keydown',keydown,true);document.addEventListener('paste',preventManual,true);document.addEventListener('drop',preventManual,true);document.addEventListener('change',refresh,true);document.addEventListener('click',open,true)
    return()=>{observer.disconnect();document.removeEventListener('keydown',keydown,true);document.removeEventListener('paste',preventManual,true);document.removeEventListener('drop',preventManual,true);document.removeEventListener('change',refresh,true);document.removeEventListener('click',open,true)}
  },[])
  return null
}
