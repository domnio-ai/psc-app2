import {FELIX_STATUS_TEXT,type FelixVisualState} from './animations/felixStates'
export default function FelixStatus({state}: {state:FelixVisualState}) {return <span className="professor-felix-status" role="status" aria-live="polite">{FELIX_STATUS_TEXT[state]}</span>}
