import {config} from './config.js'

export function mailStatus(){
  const complete=Boolean(config.smtp.host&&config.smtp.port&&config.smtp.user&&config.smtp.password&&config.smtp.from)
  return {enabled:config.smtp.enabled,configured:complete,host:config.smtp.host||null,port:config.smtp.port,secure:config.smtp.secure,from:config.smtp.from,ready:config.smtp.enabled&&complete}
}

export async function sendMail({to,subject,text}){
  const status=mailStatus()
  if(!status.ready)throw new Error('Email delivery is not enabled or SMTP configuration is incomplete.')
  let nodemailer
  try{nodemailer=(await import('nodemailer')).default}catch{throw new Error('The nodemailer dependency is not installed. Run npm install nodemailer in the backend folder.')}
  const transport=nodemailer.createTransport({host:config.smtp.host,port:config.smtp.port,secure:config.smtp.secure,auth:{user:config.smtp.user,pass:config.smtp.password},requireTLS:!config.smtp.secure})
  await transport.verify()
  const info=await transport.sendMail({from:config.smtp.from,to,subject,text,html:`<div style="font-family:Arial,sans-serif;max-width:640px"><h2 style="color:#8a6a00">PSC App2</h2><p>${text.replace(/[&<>]/g,value=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[value]))}</p><hr><small>Public Service Commission Research Department</small></div>`})
  return {messageId:info.messageId,accepted:info.accepted}
}
