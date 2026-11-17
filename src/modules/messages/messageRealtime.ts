const API_URL=import.meta.env.VITE_API_URL||"http://127.0.0.1:8000/api";
export type MessageRealtimeEvent={type:"ready"|"message"|"sent"|"delivered"|"presence"|"typing"|"read"|"reaction";data:Record<string,unknown>};
let aborter:AbortController|null=null;let activeToken="";let reconnectTimer:number|undefined;let stopped=true;
const dispatch=(type:MessageRealtimeEvent["type"],data:Record<string,unknown>)=>window.dispatchEvent(new CustomEvent<MessageRealtimeEvent>("app2-message-realtime",{detail:{type,data}}));
const parseEventBlock=(block:string)=>{
  let type="";const data:string[]=[];
  for(const line of block.split("\n")){if(line.startsWith("event:"))type=line.slice(6).trim();if(line.startsWith("data:"))data.push(line.slice(5).trim())}
  if(!type||!data.length)return;try{dispatch(type as MessageRealtimeEvent["type"],JSON.parse(data.join("\n")))}catch{}
};
const connect=async(token:string)=>{
  if(stopped||token!==activeToken)return;aborter?.abort();aborter=new AbortController();
  try{
    const response=await fetch(`${API_URL}/messages/realtime`,{headers:{Authorization:`Bearer ${token}`,Accept:"text/event-stream"},signal:aborter.signal,cache:"no-store"});
    if(!response.ok||!response.body)throw new Error(`Realtime stream unavailable (${response.status})`);
    const reader=response.body.getReader();const decoder=new TextDecoder();let buffer="";
    while(!stopped&&token===activeToken){
      const {done,value}=await reader.read();if(done)break;
      buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,"\n");
      let boundary=buffer.indexOf("\n\n");
      while(boundary>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);if(block&&!block.startsWith(":"))parseEventBlock(block);boundary=buffer.indexOf("\n\n")}
    }
  }catch(error){if((error as Error)?.name==="AbortError")return}
  if(!stopped&&token===activeToken){window.clearTimeout(reconnectTimer);reconnectTimer=window.setTimeout(()=>void connect(token),2500)}
};
export const startMessageRealtime=(token:string)=>{if(activeToken===token&&!stopped)return;stopMessageRealtime();activeToken=token;stopped=false;void connect(token)};
export const stopMessageRealtime=()=>{stopped=true;aborter?.abort();aborter=null;window.clearTimeout(reconnectTimer);reconnectTimer=undefined;activeToken=""};
