import felixAvatar from './assets/felix-avatar.png'

type FelixAssistantProps = { online: boolean; onOpen: () => void }

export default function FelixAssistant({ online, onOpen }: FelixAssistantProps) {
  return <button className="felix-launcher" onClick={onOpen} aria-label="Open Felix AI assistant" title="Open Felix">
    <img src={felixAvatar} alt="" />
    <span className={online ? 'online' : ''} aria-hidden="true" />
  </button>
}
