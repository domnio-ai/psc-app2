const clients=new Map()
const presence=new Map()
const nowIso=()=>new Date().toISOString()
const userClients=userId=>clients.get(userId)||new Set()
const writeEvent=(res,event,data)=>{
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}
export const isMessageUserOnline=userId=>userClients(userId).size>0
export const messagePresenceSnapshot=userIds=>userIds.map(userId=>{
  const state=presence.get(userId)
  const online=isMessageUserOnline(userId)
  return {userId,status:online?(state?.status==='Away'?'Away':'Online'):'Offline',lastSeenAt:online?null:(state?.lastSeenAt||null)}
})
export const emitMessageEventToUser=(userId,event,data)=>{
  for(const res of userClients(userId)){try{writeEvent(res,event,data)}catch{}}
}
export const emitMessageEventToUsers=(userIds,event,data)=>{
  for(const userId of new Set(userIds))emitMessageEventToUser(userId,event,data)
}
export const setMessagePresence=(userId,status)=>{
  const safe=status==='Away'?'Away':'Online'
  presence.set(userId,{status:safe,lastSeenAt:nowIso()})
  return {userId,status:isMessageUserOnline(userId)?safe:'Offline',lastSeenAt:null}
}
export const registerMessageRealtimeClient=(userId,res)=>{
  const set=userClients(userId);set.add(res);clients.set(userId,set)
  presence.set(userId,{status:'Online',lastSeenAt:nowIso()})
  writeEvent(res,'ready',{userId,connectedAt:nowIso()})
  const heartbeat=setInterval(()=>{try{res.write(`: heartbeat ${Date.now()}\n\n`)}catch{}},20000)
  return ()=>{
    clearInterval(heartbeat)
    const active=clients.get(userId)
    if(active){
      active.delete(res)
      if(active.size===0){clients.delete(userId);presence.set(userId,{status:'Offline',lastSeenAt:nowIso()})}
    }
  }
}
