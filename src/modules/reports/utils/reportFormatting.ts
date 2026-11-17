export const periods:Record<string,()=>{from:string;to:string}>={
  Month:()=>{const d=new Date();return{from:new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10),to:d.toISOString().slice(0,10)}},
  Quarter:()=>{const d=new Date();return{from:new Date(d.getFullYear(),Math.floor(d.getMonth()/3)*3,1).toISOString().slice(0,10),to:d.toISOString().slice(0,10)}},
  Year:()=>{const d=new Date();return{from:`${d.getFullYear()}-01-01`,to:d.toISOString().slice(0,10)}}
}
export const title=(value:string)=>value.replaceAll('_',' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/\s+/g,' ').trim().replace(/^./,c=>c.toUpperCase())
export const attentionTeam=(item:Record<string,unknown>)=>String(item.responsible_team||item.division||item.team||'Unassigned team')
export const attentionTiming=(value:unknown)=>{if(!value)return 'No due date';const due=new Date(String(value));if(Number.isNaN(due.getTime()))return 'Due date unavailable';due.setHours(0,0,0,0);const today=new Date();today.setHours(0,0,0,0);const days=Math.round((due.getTime()-today.getTime())/86400000);if(days<0)return `${Math.abs(days)} day${Math.abs(days)===1?'':'s'} overdue`;if(days===0)return 'Due today';return `${days} day${days===1?'':'s'} remaining`}
export const detailValue=(field:string,value:unknown)=>{
  if(value===null||value===undefined||value==='')return '—'
  const key=field.toLowerCase(),date=new Date(String(value))
  if(Number.isNaN(date.getTime()))return String(value)
  if(key.endsWith('_date')||['due_date','start_date','end_date'].includes(key))return new Intl.DateTimeFormat('en-KE',{day:'2-digit',month:'short',year:'numeric',timeZone:'Africa/Nairobi'}).format(date)
  if(key.endsWith('_at')||key.endsWith('_time'))return new Intl.DateTimeFormat('en-KE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Africa/Nairobi'}).format(date)
  return String(value)
}
export const sliceClass=(index:number)=>`slice-${index%6}`
