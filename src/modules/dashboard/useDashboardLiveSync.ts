import {useEffect,useRef} from "react";

type Options={
  enabled:boolean;
  dashboardVisible:boolean;
  refresh:()=>void|Promise<void>;
  intervalMs?:number;
};

export function useDashboardLiveSync({
  enabled,
  dashboardVisible,
  refresh,
  intervalMs=10000,
}:Options){
  const refreshRef=useRef(refresh);
  const timerRef=useRef<number|null>(null);

  useEffect(()=>{refreshRef.current=refresh},[refresh]);

  useEffect(()=>{
    if(!enabled)return;

    const requestRefresh=(delay=120)=>{
      if(timerRef.current!==null)window.clearTimeout(timerRef.current);
      timerRef.current=window.setTimeout(()=>{
        timerRef.current=null;
        void refreshRef.current();
      },delay);
    };

    const onWorkflowChanged=()=>requestRefresh(120);
    const onFocus=()=>{if(dashboardVisible)requestRefresh(0)};
    const onVisibility=()=>{
      if(dashboardVisible&&document.visibilityState==="visible")requestRefresh(0);
    };
    const onStorage=(event:StorageEvent)=>{
      if(event.key==="app2:workflow-revision"&&event.newValue)requestRefresh(120);
    };

    window.addEventListener("app2:workflow-changed",onWorkflowChanged);
    window.addEventListener("focus",onFocus);
    window.addEventListener("storage",onStorage);
    document.addEventListener("visibilitychange",onVisibility);

    if(dashboardVisible)requestRefresh(0);

    const interval=window.setInterval(()=>{
      if(dashboardVisible&&document.visibilityState==="visible"){
        requestRefresh(0);
      }
    },Math.max(5000,intervalMs));

    return()=>{
      window.removeEventListener("app2:workflow-changed",onWorkflowChanged);
      window.removeEventListener("focus",onFocus);
      window.removeEventListener("storage",onStorage);
      document.removeEventListener("visibilitychange",onVisibility);
      window.clearInterval(interval);
      if(timerRef.current!==null)window.clearTimeout(timerRef.current);
      timerRef.current=null;
    };
  },[enabled,dashboardVisible,intervalMs]);
}
