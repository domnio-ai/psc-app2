import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {config} from '../config.js'
import {audit} from '../audit.js'
import {query,transaction} from '../db.js'
import {emitMessageEventToUser,emitMessageEventToUsers,isMessageUserOnline} from './realtime.js'

const ALLOWED_REACTIONS=new Set(['👍','❤️','✅','👏','😂'])
const BLOCKED_EXTENSIONS=new Set(['.exe','.msi','.bat','.cmd','.ps1','.vbs','.scr','.com','.dll','.js','.jar'])

const isMember=async(userId,conversationId)=>Boolean((await query(
  `SELECT 1 FROM message_conversation_members WHERE conversation_id=$1 AND user_id=$2`,
  [conversationId,userId]
)).rowCount)

const publishAttachmentMessage=async({conversationId,user,file})=>{
  const message=await transaction(async client=>{
    const row=(await client.query(`INSERT INTO app_messages(conversation_id,sender_id,body)
      VALUES($1,$2,$3) RETURNING *`,[conversationId,user.id,`Shared attachment: ${file.originalName}`])).rows[0]
    await client.query(`INSERT INTO message_attachments(message_id,conversation_id,uploader_id,original_name,stored_name,mime_type,size_bytes)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[row.id,conversationId,user.id,file.originalName,file.storedName,file.mimeType,file.sizeBytes])
    await client.query(`UPDATE message_conversations SET updated_at=NOW() WHERE id=$1`,[conversationId])
    await client.query(`UPDATE message_conversation_members SET last_read_at=NOW() WHERE conversation_id=$1 AND user_id=$2`,[conversationId,user.id])
    const recipients=(await client.query(`SELECT cm.user_id FROM message_conversation_members cm
      WHERE cm.conversation_id=$1 AND cm.user_id<>$2`,[conversationId,user.id])).rows
    const sender=(await client.query(`SELECT name FROM users WHERE id=$1`,[user.id])).rows[0]
    const conversation=(await client.query(`SELECT kind,title FROM message_conversations WHERE id=$1`,[conversationId])).rows[0]
    for(const recipient of recipients){
      await client.query(`INSERT INTO message_receipts(message_id,user_id,delivered_at)
        VALUES($1,$2,$3) ON CONFLICT(message_id,user_id) DO NOTHING`,
        [row.id,recipient.user_id,isMessageUserOnline(recipient.user_id)?new Date():null])
      await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id,priority,action,target_workspace,event_key,notification_category)
        VALUES($1,$2,$3,'message_conversation',$4,'Normal','Open messages','Messages',$5,'Information')
        ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [recipient.user_id,`New file from ${sender?.name||'APP2 user'}`,file.originalName,conversationId,`message:${row.id}:${recipient.user_id}`])
    }
    await audit(client,user.id,'MESSAGE_ATTACHMENT_SENT','message_conversation',conversationId,{messageId:row.id,name:file.originalName,sizeBytes:file.sizeBytes})
    return {...row,sender_name:sender?.name||'APP2 user',recipientIds:recipients.map(item=>item.user_id),conversation_kind:conversation?.kind||'Direct',conversation_title:conversation?.title||null}
  })
  emitMessageEventToUsers(message.recipientIds,'message',{
    id:message.id,conversationId,senderId:user.id,senderName:message.sender_name,
    body:message.body,createdAt:message.created_at,kind:message.conversation_kind,title:message.conversation_title,attachment:true
  })
  emitMessageEventToUser(user.id,'sent',{conversationId,messageId:message.id})
  return message
}

export const registerRichMessagingRoutes=(app,{authenticate})=>{
  app.post('/api/messages/messages/:messageId/reactions',authenticate,async(req,res,next)=>{try{
    const emoji=String(req.body?.emoji||'')
    if(!ALLOWED_REACTIONS.has(emoji))return res.status(400).json({error:'Unsupported reaction.'})
    const message=(await query(`SELECT id,conversation_id FROM app_messages WHERE id=$1`,[req.params.messageId])).rows[0]
    if(!message)return res.status(404).json({error:'Message not found.'})
    if(!await isMember(req.user.id,message.conversation_id))return res.status(403).json({error:'Conversation access denied.'})
    await transaction(async client=>{
      await client.query(`INSERT INTO message_reactions(message_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[message.id,req.user.id,emoji])
      await audit(client,req.user.id,'MESSAGE_REACTION_ADDED','message',message.id,{emoji})
    })
    const members=(await query(`SELECT user_id FROM message_conversation_members WHERE conversation_id=$1`,[message.conversation_id])).rows.map(row=>row.user_id)
    emitMessageEventToUsers(members,'reaction',{conversationId:message.conversation_id,messageId:message.id})
    res.json({ok:true})
  }catch(error){next(error)}})

  app.delete('/api/messages/messages/:messageId/reactions/:emoji',authenticate,async(req,res,next)=>{try{
    const emoji=decodeURIComponent(String(req.params.emoji||''))
    const message=(await query(`SELECT id,conversation_id FROM app_messages WHERE id=$1`,[req.params.messageId])).rows[0]
    if(!message)return res.status(404).json({error:'Message not found.'})
    if(!await isMember(req.user.id,message.conversation_id))return res.status(403).json({error:'Conversation access denied.'})
    await transaction(async client=>{
      await client.query(`DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3`,[message.id,req.user.id,emoji])
      await audit(client,req.user.id,'MESSAGE_REACTION_REMOVED','message',message.id,{emoji})
    })
    const members=(await query(`SELECT user_id FROM message_conversation_members WHERE conversation_id=$1`,[message.conversation_id])).rows.map(row=>row.user_id)
    emitMessageEventToUsers(members,'reaction',{conversationId:message.conversation_id,messageId:message.id})
    res.json({ok:true})
  }catch(error){next(error)}})

  app.post('/api/messages/conversations/:id/attachments',authenticate,async(req,res,next)=>{try{
    if(!await isMember(req.user.id,req.params.id))return res.status(403).json({error:'Conversation access denied.'})
    let submittedName=String(req.headers['x-file-name']||'attachment.bin')
    try{submittedName=decodeURIComponent(submittedName)}catch{}
    const originalName=path.basename(submittedName).slice(0,255)||'attachment.bin'
    const extension=path.extname(originalName).toLowerCase().slice(0,16)
    if(BLOCKED_EXTENSIONS.has(extension))return res.status(400).json({error:'This file type is blocked for security reasons.'})
    if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Choose a non-empty file to attach.'})
    const maxBytes=Math.max(1,Number(config.maxUploadMb||10))*1024*1024
    if(req.body.length>maxBytes)return res.status(413).json({error:`Attachment exceeds the ${config.maxUploadMb} MB upload limit.`})
    const relativeDir='messages'
    const storedFile=`${crypto.randomUUID()}${extension}`
    const storedName=path.join(relativeDir,storedFile)
    const uploadRoot=path.resolve(config.uploadDir)
    const targetDir=path.join(uploadRoot,relativeDir)
    await fs.mkdir(targetDir,{recursive:true})
    await fs.writeFile(path.join(targetDir,storedFile),req.body,{flag:'wx'})
    try{
      const message=await publishAttachmentMessage({conversationId:req.params.id,user:req.user,file:{originalName,storedName,mimeType:String(req.headers['x-file-type']||'application/octet-stream').slice(0,160),sizeBytes:req.body.length}})
      res.status(201).json({id:message.id,conversation_id:req.params.id,body:message.body,created_at:message.created_at})
    }catch(error){await fs.unlink(path.join(targetDir,storedFile)).catch(()=>{});throw error}
  }catch(error){next(error)}})

  app.get('/api/messages/attachments/:id/download',authenticate,async(req,res,next)=>{try{
    const attachment=(await query(`SELECT * FROM message_attachments WHERE id=$1`,[req.params.id])).rows[0]
    if(!attachment)return res.status(404).json({error:'Attachment not found.'})
    if(!await isMember(req.user.id,attachment.conversation_id))return res.status(403).json({error:'Conversation access denied.'})
    res.setHeader('Content-Type',attachment.mime_type||'application/octet-stream')
    res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`)
    res.sendFile(path.resolve(config.uploadDir,attachment.stored_name))
  }catch(error){next(error)}})
}
