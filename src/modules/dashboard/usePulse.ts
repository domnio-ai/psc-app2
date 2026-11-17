import {useCallback,useEffect,useRef,useState} from 'react';
import {type ApiNotification,api,loadPulse} from '../../api';
import type {PulseData} from './pulseTypes';
export function usePulse(token:string,onNotifications:(rows:ApiNotification[])=>void){
 const [data,setData]=useState<PulseData|null>(null),[error,setError]=useState('');
 const [arrival,setArrival]=useState(false);
 const dataToken=useRef(token);
 const refreshRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  setData(null);setError('');setArrival(false);
  if(!token)return;
  let disposed=false,running=false,again=false,timer:ReturnType<typeof setTimeout>|undefined,pulseTimer:ReturnType<typeof setTimeout>|undefined;
  let known:Set<string>|null=null;
  const controller=new AbortController();
  const refresh=async()=>{
   if(disposed||document.visibilityState==='hidden')return;
   if(running){again=true;return;}
   running=true;
   try{
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
    const notifications=await api.notifications(token,signal);
    if(disposed)return;
    onNotifications(notifications);
    const next=await loadPulse(token,signal);
    if(disposed)return;
    const ids=new Set(next.unread.map(n=>n.id));
    if(known&&next.unread.some(n=>!known!.has(n.id))){setArrival(true);clearTimeout(pulseTimer);pulseTimer=setTimeout(()=>setArrival(false),6000)}
    known=ids;dataToken.current=token;setData(next);setError('');
   }catch(e){if(!disposed)setError(e instanceof Error?e.message:'Refresh failed')}
   finally{running=false;if(again&&!disposed){again=false;void refresh()}}
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),150)};
  refreshRef.current=()=>void refresh();
  const interval=setInterval(()=>void refresh(),30000);
  window.addEventListener('app2:workflow-changed',schedule);
  document.addEventListener('visibilitychange',schedule);
  window.addEventListener('focus',schedule);
  void refresh();
  return()=>{disposed=true;controller.abort();clearInterval(interval);clearTimeout(timer);clearTimeout(pulseTimer);window.removeEventListener('app2:workflow-changed',schedule);document.removeEventListener('visibilitychange',schedule);window.removeEventListener('focus',schedule)};
 },[token,onNotifications]);
 return {data:dataToken.current===token?data:null,error,arrival,refresh:useCallback(()=>refreshRef.current(),[])};
}
