import { useState } from 'react'
import felixAvatar from './assets/felix-avatar.png'

type FelixAssistantProps = { online: boolean; onOpen: () => void }

export default function FelixAssistant({ online, onOpen }: FelixAssistantProps) {
  const [expanded, setExpanded] = useState(true)

  if (!expanded) return <button className="felix-launcher" onClick={() => setExpanded(true)} aria-label="Open Felix AI assistant" title="Open Felix, your AI research assistant"><img src={felixAvatar} alt="" /><span className={online ? 'online' : ''} aria-hidden="true" /></button>

  return <aside className="felix-bar" aria-label="Felix AI research assistant">
    <button className="felix-collapse" onClick={() => setExpanded(false)} aria-label="Minimize Felix" title="Minimize Felix">×</button>
    <div className="felix-portrait" aria-hidden="true"><img src={felixAvatar} alt="" /></div>
    <div className="felix-copy">
      <div className="felix-name-row"><strong>Felix</strong><span className={online ? 'online' : ''}>{online ? 'Online' : 'Offline'}</span></div>
      <small>AI Research Assistant</small>
      <button onClick={onOpen} title="Open Felix's research chat">Ask Felix <span aria-hidden="true">→</span></button>
    </div>
  </aside>
}
