import {useCallback,useEffect,useRef,useState} from 'react'
import type {FelixOperation,FelixVisualState} from './felixStates'

const START_STATE:Record<FelixOperation,FelixVisualState>={
  app2_operation:'thinking',knowledge_search:'searching',document_summary:'reading',
  document_audit:'reading',research_synthesis:'searching',general:'thinking',
}

export function useFelixVisualState(initial:FelixVisualState='idle'){
  const [state,setState]=useState<FelixVisualState>(initial)
  const timer=useRef<number|undefined>(undefined)
  const clear=useCallback(()=>{if(timer.current)window.clearTimeout(timer.current)},[])
  useEffect(()=>clear,[clear])
  const settle=useCallback((next:FelixVisualState,delay=2100)=>{clear();setState(next);timer.current=window.setTimeout(()=>setState('idle'),delay)},[clear])
  const beginOperation=useCallback((operation:FelixOperation)=>{clear();setState(START_STATE[operation]);if(operation==='document_audit')timer.current=window.setTimeout(()=>setState('auditing'),240);else if(operation==='document_summary')timer.current=window.setTimeout(()=>setState('reading'),180);else if(operation==='knowledge_search'||operation==='research_synthesis')timer.current=window.setTimeout(()=>setState('reading'),260)},[clear])
  const completeOperation=useCallback((outcome:'success'|'found_issue'|'suggesting'|'insufficient_evidence'|'presenting'='success')=>settle(outcome),[settle])
  const failOperation=useCallback(()=>settle('error',2800),[settle])
  return {state,setState,beginOperation,completeOperation,failOperation}
}
