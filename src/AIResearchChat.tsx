import { useState } from 'react'
import type { AiResearchEngine, AiResearchJob } from './api'

type Message={role:'assistant'|'user';text:string}
type Props={engine:AiResearchEngine|null;jobs:AiResearchJob[];onAsk:(question:string)=>Promise<string>}

export default function AIResearchChat({engine,jobs,onAsk}:Props){
  const [question,setQuestion]=useState('')
  const [sending,setSending]=useState(false)
  const [messages,setMessages]=useState<Message[]>([{role:'assistant',text:'Hello, I am Felix, your PSC AI Research Assistant. You can greet me, ask a simple question, or request help with research and policy evidence.'}])
  const send=async()=>{const text=question.trim();if(!text||sending)return;setQuestion('');setMessages(current=>[...current,{role:'user',text}]);setSending(true);try{const answer=await onAsk(text);setMessages(current=>[...current,{role:'assistant',text:answer}])}catch(error){setMessages(current=>[...current,{role:'assistant',text:error instanceof Error?error.message:'I could not answer that just now. Please try again.'}])}finally{setSending(false)}}
  return <div className="ai-chat-layout"><section className="ai-chat"><header><div><strong>Chat with Felix</strong><small>Research assistant · Human review required</small></div><b className={engine?.ollamaConnected?'online':'offline'}>{engine?.ollamaConnected?'Local AI online':'Local AI offline'}</b></header><div className="ai-chat-messages">{messages.map((message,index)=><article className={message.role} key={index}><span>{message.role==='assistant'?'Felix':'You'}</span><p>{message.text}</p></article>)}{sending&&<article className="assistant"><span>Felix</span><p>Thinking…</p></article>}</div><div className="ai-chat-input"><textarea value={question} onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}}} placeholder="Ask Felix a question…"/><button onClick={send} disabled={!question.trim()||sending}>Send</button></div><small className="ai-chat-scope">Felix can answer general questions and support research, but cannot perform administrative actions or approve official records.</small></section><aside className="ai-chat-history"><h3>Research history</h3>{jobs.slice(0,8).map(job=><article key={job.id}><span>{job.status}</span><strong>{job.title}</strong><small>{job.question}</small></article>)}{!jobs.length&&<p>No research conversations yet.</p>}</aside></div>
}
