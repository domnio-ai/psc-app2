import crypto from 'node:crypto'
import {Document,HeadingLevel,Packer,Paragraph,TextRun} from 'docx'

const decodeEntities=value=>String(value||'')
  .replaceAll('&nbsp;',' ')
  .replaceAll('&amp;','&')
  .replaceAll('&lt;','<')
  .replaceAll('&gt;','>')
  .replaceAll('&quot;','"')
  .replaceAll('&#39;',"'")

const plainText=value=>decodeEntities(String(value||'')
  .replace(/<br\s*\/?\s*>/gi,'\n')
  .replace(/<\/(p|div|li|h[1-6])>/gi,'\n')
  .replace(/<li[^>]*>/gi,'• ')
  .replace(/<[^>]+>/g,''))
  .replace(/\r\n/g,'\n')
  .replace(/\n{3,}/g,'\n\n')
  .trim()

const safeFileStem=value=>String(value||'research-report')
  .replace(/[^a-z0-9]+/gi,'-')
  .replace(/^-+|-+$/g,'')
  .slice(0,90)||'research-report'

export async function buildResearchDraftArtifact({project,sections,team,actorName,storeDocument,savedAt:sourceSavedAt}){
  const title=`${project.title} — Research Report Draft`
  const savedAt=new Intl.DateTimeFormat('en-KE',{
    dateStyle:'medium',
    timeStyle:'short',
    timeZone:'Africa/Nairobi'
  }).format(new Date(sourceSavedAt||Date.now()))
  const teamLines=team.length
    ?team.map(member=>`${member.name} — ${member.role}`)
    :['No research team recorded.']
  const children=[
    new Paragraph({text:title,heading:HeadingLevel.TITLE}),
    new Paragraph({children:[new TextRun({text:'Research project: ',bold:true}),new TextRun(project.title)]}),
    new Paragraph({children:[new TextRun({text:'Saved by: ',bold:true}),new TextRun(actorName||'REDESY user')]}),
    new Paragraph({children:[new TextRun({text:'Saved at: ',bold:true}),new TextRun(savedAt)]}),
    new Paragraph({text:'DRAFT — NOT YET APPROVED',heading:HeadingLevel.HEADING_1}),
    new Paragraph({text:'Research Team and Roles',heading:HeadingLevel.HEADING_1}),
    ...teamLines.map(line=>new Paragraph({text:line,bullet:{level:0}}))
  ]
  for(const section of sections){
    children.push(new Paragraph({text:section.title,heading:HeadingLevel.HEADING_1}))
    const content=plainText(section.content)
    const paragraphs=content?content.split('\n'):['No draft content recorded.']
    for(const paragraph of paragraphs)children.push(new Paragraph({text:paragraph||' '}))
  }
  const buffer=await Packer.toBuffer(new Document({sections:[{children}]}))
  const stored=await storeDocument(buffer,'.docx')
  return {
    buffer,
    stored,
    sha256:crypto.createHash('sha256').update(buffer).digest('hex'),
    title,
    originalName:`${safeFileStem(project.title)}-research-report-draft.docx`,
    mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
}

export async function saveResearchDraftRepositoryVersion({client,project,actor,artifact,teamUserIds,audit}){
  const existing=(await client.query(`SELECT k.*,v.sha256_hash
    FROM knowledge_items k
    JOIN repository_entity_links rel
      ON rel.knowledge_id=k.id
     AND rel.entity_type='research'
     AND rel.entity_id=$1
    LEFT JOIN knowledge_versions v
      ON v.knowledge_id=k.id
     AND v.is_current=TRUE
    WHERE k.document_type='Research Report Draft'
      AND COALESCE(k.is_archived,FALSE)=FALSE
    ORDER BY k.created_at
    LIMIT 1
    FOR UPDATE OF k`,[project.id])).rows[0]||null

  if(existing?.sha256_hash===artifact.sha256){
    await client.query('UPDATE knowledge_items SET updated_at=NOW() WHERE id=$1',[existing.id])
    return {documentId:existing.id,version:Number(existing.current_version||1),versionCreated:false}
  }

  const category=(await client.query("SELECT id FROM document_categories WHERE name='Research Reports' LIMIT 1")).rows[0]||null
  const ownerId=project.lead_id||actor.id
  const item=existing||(await client.query(`INSERT INTO knowledge_items(
    title,description,category,category_id,tags,author,document_date,status,created_by,current_version,
    source_type,source_url,directorate,document_type,subject,classification,felix_enabled,is_archived
  )VALUES($1,$2,'Research Reports',$3,$4,$5,CURRENT_DATE,'Draft',$6,0,
    'Research','',$7,'Research Report Draft',$8,'INTERNAL',FALSE,FALSE)RETURNING *`,[
    artifact.title,
    `Working draft for research project “${project.title}”. Repository versions are created by explicit Save Draft actions.`,
    category?.id||null,
    ['research','report','draft'],
    actor.name||null,
    ownerId,
    project.directorate||null,
    project.title
  ])).rows[0]

  const versionNumber=Number(item.current_version||0)+1
  await client.query('UPDATE knowledge_versions SET is_current=FALSE WHERE knowledge_id=$1',[item.id])
  const version=(await client.query(`INSERT INTO knowledge_versions(
    knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,
    sha256_hash,is_current,notes
  )VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10)RETURNING *`,[
    item.id,
    versionNumber,
    actor.id,
    artifact.originalName,
    artifact.stored.storedName,
    artifact.stored.storagePath,
    artifact.mimeType,
    artifact.buffer.length,
    artifact.sha256,
    `Research Workspace draft saved by ${actor.name||'a REDESY user'}`
  ])).rows[0]
  await client.query(`UPDATE knowledge_items SET
    title=$1,description=$2,status='Draft',current_version=$3,approved_by=NULL,approved_at=NULL,
    reviewed_by=NULL,reviewed_at=NULL,rejection_reason=NULL,is_archived=FALSE,updated_at=NOW()
    WHERE id=$4`,[
    artifact.title,
    `Working draft for research project “${project.title}”. Repository versions are created by explicit Save Draft actions.`,
    versionNumber,
    item.id
  ])
  await client.query("INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,'research',$2,$3)ON CONFLICT DO NOTHING",[item.id,project.id,actor.id])

  const permittedUserIds=[...new Set([ownerId,actor.id,...teamUserIds].filter(Boolean))]
  for(const userId of permittedUserIds){
    for(const permission of ['READ','WRITE']){
      await client.query(`INSERT INTO document_permissions(knowledge_id,user_id,permission,granted_by)
        VALUES($1,$2,$3,$4)ON CONFLICT DO NOTHING`,[item.id,userId,permission,actor.id])
    }
  }
  await audit(client,actor.id,'RESEARCH_DRAFT_SAVED_TO_REPOSITORY','knowledge',item.id,{
    projectId:project.id,
    version:versionNumber,
    sha256:artifact.sha256
  })
  return {documentId:item.id,versionId:version.id,version:versionNumber,versionCreated:true}
}
