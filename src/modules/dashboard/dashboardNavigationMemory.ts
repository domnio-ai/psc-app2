export type DashboardNavigationMemory = {
  pinnedWorkspaces: string[];
};

const PIN_KEY="app2:dashboard-navigation:pinned-workspaces:v1";

const safeParse=<T>(raw:string|null,fallback:T):T=>{
  if(!raw)return fallback;
  try{return JSON.parse(raw) as T}catch{return fallback}
};

export function readDashboardNavigationMemory():DashboardNavigationMemory{
  if(typeof window==="undefined")return {pinnedWorkspaces:[]};
  const pinnedWorkspaces=safeParse<string[]>(window.localStorage.getItem(PIN_KEY),[]);
  return {pinnedWorkspaces:Array.isArray(pinnedWorkspaces)?pinnedWorkspaces.slice(0,12):[]};
}

function writeWorkspacePins(memory:DashboardNavigationMemory){
  if(typeof window==="undefined")return;
  window.localStorage.setItem(PIN_KEY,JSON.stringify(memory.pinnedWorkspaces.slice(0,12)));
}

export function toggleDashboardWorkspacePin(memory:DashboardNavigationMemory,label:string){
  const exists=memory.pinnedWorkspaces.includes(label);
  const next={pinnedWorkspaces:exists?memory.pinnedWorkspaces.filter(v=>v!==label):[label,...memory.pinnedWorkspaces].slice(0,12)};
  writeWorkspacePins(next);
  return next;
}
