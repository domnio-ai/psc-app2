import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import {AlignmentType,Document,HeadingLevel,PageOrientation,Packer,Paragraph,ShadingType,Table,TableCell,TableRow,TextRun,WidthType} from 'docx'

const NAVY='#0B2E59',BLUE='#315A8A',PSC_GOLD='#D6B85A',SLATE='#526071',BORDER='#D7DEE7',PALE='#EEF3F8',WHITE='#FFFFFF'

const MAX_EXPORT_ROWS=25000,MAX_EXPORT_COLUMNS=40,MAX_EXCEL_CELL_CHARS=32767
const exportError=(message,status=400)=>Object.assign(new Error(message),{status})
const assertExportModel=model=>{
  if(!model||typeof model!=='object'||Array.isArray(model))throw exportError('Invalid report export model.')
  if(!Array.isArray(model.columns)||!Array.isArray(model.rows)||!Array.isArray(model.kpis))throw exportError('Invalid report export model.')
  if(model.columns.length>MAX_EXPORT_COLUMNS)throw exportError(`Report export exceeds the ${MAX_EXPORT_COLUMNS}-column safety limit.`,413)
  if(model.rows.length>MAX_EXPORT_ROWS)throw exportError(`Report export exceeds the ${MAX_EXPORT_ROWS.toLocaleString('en-US')}-row safety limit. Narrow the reporting period or filters and try again.`,413)
  return model
}
const excelSafe=value=>{
  if(value===null||value===undefined)return ''
  const raw=String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
  return raw.length>MAX_EXCEL_CELL_CHARS?`${raw.slice(0,MAX_EXCEL_CELL_CHARS-1)}…`:raw
}
const text=value=>value===null||value===undefined||value===''?'—':String(value)
const columnLabel=value=>String(value).replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase())
const isDateColumn=column=>/(^|_)(date|at)$/.test(String(column))||['due_date','start_date','end_date','created_at','updated_at','generated_at'].includes(String(column))
const formatValue=(column,value)=>{if(value===null||value===undefined||value===''){const key=String(column);if(key==='parent_assignment')return 'Standalone work item';if(key==='owner_name'||key==='generated_by')return 'Not assigned';if(key==='due_date'||key==='start_date'||key==='end_date')return 'No date recorded';return 'Not recorded'}if(isDateColumn(column)){const date=value instanceof Date?value:new Date(value);if(!Number.isNaN(date.getTime()))return new Intl.DateTimeFormat('en-KE',{day:'2-digit',month:'short',year:'numeric',...(String(column).endsWith('_at')?{hour:'2-digit',minute:'2-digit',hour12:false}:{}),timeZone:'Africa/Nairobi'}).format(date)}if(typeof value==='boolean')return value?'Yes':'No';return String(value)}
const generatedAt=model=>new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}).format(new Date(model.generatedAt||Date.now()))
const metadata=model=>[['Reporting period',model.period?.from||model.period?.to?`${model.period.from||'Start'} to ${model.period.to||'Today'}`:'Current snapshot'],['Organisational scope',model.scope?.type?`${columnLabel(model.scope.type)}${model.scope.division?` · ${model.scope.division}`:''}`:'Permission-scoped REDESY data'],['Data basis',`${Number(model.recordCount??model.rows.length)} detailed record${Number(model.recordCount??model.rows.length)===1?'':'s'}`],['Generated at',generatedAt(model)]]
const pdfColumnWidths=(columns,total)=>{const weights=columns.map(column=>/title|description|parent|division/i.test(column)?2.1:/date|_at/i.test(column)?1.45:/status|priority|type/i.test(column)?1.15:1),sum=weights.reduce((a,b)=>a+b,0);return weights.map(weight=>total*weight/sum)}

async function pdf(model){
  const document=new PDFDocument({size:model.paperSize==='Letter'?'LETTER':'A4',layout:'landscape',margin:32,bufferPages:true,info:{Title:model.title,Author:'REDESY · Public Service Commission',Subject:'Controlled institutional report'}}),chunks=[]
  document.on('data',chunk=>chunks.push(chunk));const done=new Promise((resolve,reject)=>{document.on('end',()=>resolve(Buffer.concat(chunks)));document.on('error',reject)}),pageWidth=document.page.width-document.page.margins.left-document.page.margins.right
  const drawHeader=()=>{document.rect(0,0,document.page.width,76).fill(NAVY);document.rect(0,73,document.page.width,3).fill(PSC_GOLD);document.fillColor(WHITE).font('Helvetica-Bold').fontSize(9).text('PUBLIC SERVICE COMMISSION · REDESY CONTROLLED REPORT',32,18,{characterSpacing:.7});document.fontSize(18).text(model.title,32,36,{width:pageWidth-150,ellipsis:true});document.font('Helvetica').fontSize(8).fillColor('#DCE8F5').text('INSTITUTIONAL REPORTING',document.page.width-175,22,{width:140,align:'right'});document.y=91}
  const ensureSpace=height=>{if(document.y+height>document.page.height-48){document.addPage();drawHeader();return true}return false}
  drawHeader();metadata(model).forEach(([label,value],index)=>{const x=32+(index%2)*(pageWidth/2),y=92+Math.floor(index/2)*22;document.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY).text(`${label}:`,x,y,{width:100,lineBreak:false});document.font('Helvetica').fillColor(SLATE).text(value,x+103,y,{width:pageWidth/2-111,height:18,ellipsis:true})});document.x=32;document.y=141
  document.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Executive KPI Summary',32,document.y,{width:pageWidth,align:'left'});document.moveDown(.5);const kpiGap=7,kpiColumns=Math.min(4,Math.max(1,model.kpis.length)),kpiWidth=(pageWidth-kpiGap*(kpiColumns-1))/kpiColumns,kpiStart=document.y
  model.kpis.forEach((item,index)=>{const col=index%4,row=Math.floor(index/4),x=32+col*(kpiWidth+kpiGap),y=kpiStart+row*43;document.roundedRect(x,y,kpiWidth,36,4).fillAndStroke(PALE,BORDER);document.font('Helvetica').fontSize(7.5).fillColor(SLATE).text(item.label,x+8,y+6,{width:kpiWidth-16});document.font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text(text(item.value),x+8,y+18,{width:kpiWidth-16})});document.y=kpiStart+Math.ceil(model.kpis.length/4)*43+8
  if(!model.columns.length)document.font('Helvetica').fontSize(10).fillColor(SLATE).text('No detailed records matched the selected filters.',32,document.y,{width:pageWidth});else{document.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Underlying Records',32,document.y,{width:pageWidth,align:'left'});document.moveDown(.5);const widths=pdfColumnWidths(model.columns,pageWidth),headerHeight=27;const drawTableHeader=()=>{let x=32,y=document.y;model.columns.forEach((column,index)=>{document.rect(x,y,widths[index],headerHeight).fillAndStroke(BLUE,WHITE);document.font('Helvetica-Bold').fontSize(7).fillColor(WHITE).text(columnLabel(column),x+5,y+7,{width:widths[index]-10,height:16,ellipsis:true});x+=widths[index]});document.y=y+headerHeight};drawTableHeader();model.rows.forEach((row,rowIndex)=>{const values=model.columns.map(column=>formatValue(column,row[column]));document.font('Helvetica').fontSize(7);const height=Math.max(24,Math.min(52,Math.max(...values.map((value,index)=>document.heightOfString(value,{width:widths[index]-10,lineGap:1})))+10));if(ensureSpace(height+headerHeight))drawTableHeader();let x=32,y=document.y;model.columns.forEach((_column,index)=>{document.rect(x,y,widths[index],height).fillAndStroke(rowIndex%2?WHITE:'#F7F9FC',BORDER);document.fillColor('#1A2433').font('Helvetica').fontSize(7).text(values[index],x+5,y+6,{width:widths[index]-10,height:height-10,ellipsis:true,lineGap:1});x+=widths[index]});document.y=y+height})}
  const pages=document.bufferedPageRange();for(let index=0;index<pages.count;index++){document.switchToPage(index);const footerY=document.page.height-52;document.moveTo(32,footerY-7).lineTo(document.page.width-32,footerY-7).strokeColor(BORDER).stroke();document.font('Helvetica').fontSize(7.5).fillColor(SLATE).text(`REDESY · Data current as of ${generatedAt(model)}`,32,footerY,{width:420,lineBreak:false});document.text(`Page ${index+1} of ${pages.count}`,document.page.width-132,footerY,{width:100,align:'right',lineBreak:false})}document.end();return done
}


const compactColumns=model=>{
  const preferred=['title','name','division','lead_name','owner_name','status','priority','due_date','end_date','overdue_days','exception','contribution_type']
  const available=preferred.filter(column=>model.columns.includes(column))
  return (available.length?available:model.columns).slice(0,6)
}
const managementHighlights=model=>{
  const lines=[]
  for(const item of model.kpis||[]){
    const value=String(item.value??'—')
    if(item.status==='danger'||item.status==='warning')lines.push(`${item.label}: ${value}.`)
  }
  for(const section of model.sections||[]){
    if(section.message)lines.push(`${section.title}: ${section.message}`)
    for(const row of (section.rows||[]).slice(0,3)){
      const values=Object.entries(row).filter(([key,value])=>key!=='id'&&value!==null&&value!==undefined&&value!=='').slice(0,4).map(([key,value])=>`${columnLabel(key)} ${formatValue(key,value)}`)
      if(values.length)lines.push(`${section.title}: ${values.join(' · ')}.`)
    }
  }
  if(!lines.length)lines.push('No material exceptions were identified in the selected governed reporting scope.')
  return lines.slice(0,8)
}
async function briefPdf(model){
  const document=new PDFDocument({size:model.paperSize==='Letter'?'LETTER':'A4',layout:'portrait',margin:42,bufferPages:true,info:{Title:`${model.title} — Management Brief`,Author:'REDESY · Public Service Commission',Subject:'Summarised management report'}}),chunks=[]
  document.on('data',chunk=>chunks.push(chunk));const done=new Promise((resolve,reject)=>{document.on('end',()=>resolve(Buffer.concat(chunks)));document.on('error',reject)})
  const width=document.page.width-document.page.margins.left-document.page.margins.right
  const drawHeader=()=>{document.rect(0,0,document.page.width,82).fill(NAVY);document.rect(0,79,document.page.width,3).fill(PSC_GOLD);document.fillColor(WHITE).font('Helvetica-Bold').fontSize(9).text('PUBLIC SERVICE COMMISSION · REDESY',42,20,{characterSpacing:.7});document.fontSize(17).text('MANAGEMENT BRIEF',42,38,{width:width-120});document.font('Helvetica').fontSize(7.5).fillColor('#DCE8F5').text('PRINT-READY · GOVERNED REDESY DATA',document.page.width-215,23,{width:170,align:'right'});document.x=42;document.y=100}
  const ensure=height=>{if(document.y+height>document.page.height-65){document.addPage();drawHeader()}}
  drawHeader();document.x=42;document.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text(model.title,42,100,{width});document.x=42;document.moveDown(.35)
  metadata(model).forEach(([label,value])=>{document.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text(`${label}: `,{continued:true});document.font('Helvetica').fillColor(SLATE).text(value)});document.moveDown(.6)
  document.x=42;document.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Executive KPI Summary');document.x=42;document.moveDown(.35)
  const gap=8,cols=2,cardW=(width-gap)/cols,startY=document.y
  ;(model.kpis||[]).slice(0,8).forEach((item,index)=>{const col=index%cols,row=Math.floor(index/cols),x=42+col*(cardW+gap),y=startY+row*46;document.roundedRect(x,y,cardW,38,4).fillAndStroke(PALE,BORDER);document.font('Helvetica').fontSize(7.5).fillColor(SLATE).text(item.label,x+9,y+7,{width:cardW-18});document.font('Helvetica-Bold').fontSize(14).fillColor(NAVY).text(text(item.value),x+9,y+19,{width:cardW-18})});document.x=42;document.y=startY+Math.ceil(Math.min(8,(model.kpis||[]).length)/cols)*46+4
  ensure(120);document.x=42;document.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Management Attention');document.x=42;document.moveDown(.35)
  managementHighlights(model).forEach(line=>{document.x=42;document.font('Helvetica').fontSize(9).fillColor('#1A2433').text(`• ${line}`,{width,indent:8,lineGap:2});document.x=42;document.moveDown(.18)})
  const colsToUse=compactColumns(model),rows=(model.rows||[]).slice(0,12)
  if(colsToUse.length&&rows.length){ensure(150);document.x=42;document.moveDown(.5);document.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Priority Records / Evidence',{width});document.x=42;document.moveDown(.35);const widths=pdfColumnWidths(colsToUse,width),headerH=25;const head=()=>{let x=42,y=document.y;colsToUse.forEach((column,index)=>{document.rect(x,y,widths[index],headerH).fillAndStroke(BLUE,WHITE);document.font('Helvetica-Bold').fontSize(6.7).fillColor(WHITE).text(columnLabel(column),x+4,y+7,{width:widths[index]-8,height:14,ellipsis:true});x+=widths[index]});document.x=42;document.y=y+headerH};head();rows.forEach((row,rowIndex)=>{const values=colsToUse.map(c=>formatValue(c,row[c]));document.font('Helvetica').fontSize(6.8);const h=Math.max(23,Math.min(44,Math.max(...values.map((value,index)=>document.heightOfString(value,{width:widths[index]-8})))+9));if(document.y+h>document.page.height-65){document.addPage();drawHeader();head()}let x=42,y=document.y;colsToUse.forEach((_c,index)=>{document.rect(x,y,widths[index],h).fillAndStroke(rowIndex%2?WHITE:'#F7F9FC',BORDER);document.fillColor('#1A2433').text(values[index],x+4,y+5,{width:widths[index]-8,height:h-8,ellipsis:true});x+=widths[index]});document.x=42;document.y=y+h})}
  document.x=42;document.moveDown(.7);document.font('Helvetica').fontSize(8).fillColor(SLATE).text('This brief is a summarised view of the same permission-scoped dataset used by the REDESY Reports & Analytics workspace. Use the detailed PDF/DOCX/XLSX exports for the complete record listing.',42,document.y,{width})
  const pages=document.bufferedPageRange();for(let index=0;index<pages.count;index++){document.switchToPage(index);const footerY=document.page.height-64;document.moveTo(42,footerY-6).lineTo(document.page.width-42,footerY-6).strokeColor(BORDER).stroke();document.font('Helvetica').fontSize(7).fillColor(SLATE).text(`REDESY · Generated ${generatedAt(model)}`,42,footerY,{width:300,lineBreak:false});document.text(`Page ${index+1} of ${pages.count}`,document.page.width-120,footerY,{width:78,align:'right',lineBreak:false})}
  document.end();return done
}

const docxCell=(value,{header=false,width}={})=>new TableCell({width:width?{size:width,type:WidthType.PERCENTAGE}:undefined,shading:header?{fill:'315A8A',type:ShadingType.CLEAR}:undefined,margins:{top:90,bottom:90,left:100,right:100},children:[new Paragraph({children:[new TextRun({text:text(value),bold:header,color:header?'FFFFFF':'1A2433',size:header?18:17})]})]})
async function docx(model){
  const children=[new Paragraph({children:[new TextRun({text:'PUBLIC SERVICE COMMISSION',bold:true,color:'315A8A',size:20,characterSpacing:20})]}),new Paragraph({text:model.title,heading:HeadingLevel.TITLE}),new Paragraph({children:[new TextRun({text:'REDESY CONTROLLED INSTITUTIONAL REPORT',bold:true,color:'526071',size:18})]}),new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:metadata(model).map(([label,value])=>new TableRow({children:[docxCell(label,{header:true,width:24}),docxCell(value,{width:76})]}))}),new Paragraph({text:'Executive KPI Summary',heading:HeadingLevel.HEADING_1}),new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:model.kpis.map(item=>docxCell(item.label,{header:true}))}),new TableRow({children:model.kpis.map(item=>docxCell(item.value))})]}),new Paragraph({text:'Underlying Records',heading:HeadingLevel.HEADING_1})]
  if(model.columns.length)children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({tableHeader:true,children:model.columns.map(column=>docxCell(columnLabel(column),{header:true}))}),...model.rows.map((row,index)=>new TableRow({cantSplit:true,children:model.columns.map(column=>new TableCell({shading:index%2?undefined:{fill:'F3F6FA',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:85,right:85},children:[new Paragraph({children:[new TextRun({text:formatValue(column,row[column]),color:'1A2433',size:16})]})]}))}))]}));else children.push(new Paragraph('No detailed records matched the selected filters.'));children.push(new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`Data current as of ${generatedAt(model)} · REDESY controlled report`,color:'526071',size:16})]}))
  return Packer.toBuffer(new Document({styles:{default:{document:{run:{font:'Aptos',size:20,color:'1A2433'},paragraph:{spacing:{after:100}}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{font:'Aptos Display',size:36,bold:true,color:'17365D'},paragraph:{spacing:{before:120,after:180}}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',run:{font:'Aptos Display',size:25,bold:true,color:'17365D'},paragraph:{spacing:{before:260,after:100}}}]},sections:[{properties:{page:{size:{orientation:PageOrientation.LANDSCAPE},margin:{top:600,right:600,bottom:600,left:600}}},children}]}))
}

async function xlsx(model){
  const workbook=new ExcelJS.Workbook();workbook.creator='REDESY · Public Service Commission';workbook.created=new Date();workbook.properties.title=model.title;const sheet=workbook.addWorksheet('Report',{views:[{state:'frozen',ySplit:10}]}),span=Math.max(1,model.columns.length,model.kpis.length)
  sheet.addRow([excelSafe('PUBLIC SERVICE COMMISSION · REDESY CONTROLLED REPORT')]);sheet.mergeCells(1,1,1,span);sheet.getCell('A1').font={bold:true,size:11,color:{argb:'FFFFFFFF'}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17365D'}};sheet.addRow([excelSafe(model.title)]);sheet.mergeCells(2,1,2,span);sheet.getCell('A2').font={bold:true,size:18,color:{argb:'FF17365D'}}
  for(const [label,value] of metadata(model)){const row=sheet.addRow([excelSafe(label),excelSafe(value)]);row.getCell(1).font={bold:true,color:{argb:'FF315A8A'}}}sheet.addRow([]);const labels=sheet.addRow(model.kpis.map(item=>excelSafe(item.label))),values=sheet.addRow(model.kpis.map(item=>excelSafe(item.value)));labels.font={bold:true,color:{argb:'FFFFFFFF'}};labels.eachCell(cell=>cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF315A8A'}});values.font={bold:true,size:13,color:{argb:'FF17365D'}};sheet.addRow([])
  if(model.columns.length){const header=sheet.addRow(model.columns.map(column=>excelSafe(columnLabel(column))));header.font={bold:true,color:{argb:'FFFFFFFF'}};header.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF315A8A'}};cell.alignment={vertical:'middle',wrapText:true}});for(const [index,row] of model.rows.entries()){const added=sheet.addRow(model.columns.map(column=>excelSafe(formatValue(column,row[column]))));added.alignment={vertical:'top',wrapText:true};if(index%2===0)added.eachCell(cell=>cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F6FA'}})}}sheet.columns.forEach(column=>{column.width=Math.min(42,Math.max(13,...column.values.map(value=>text(value).length+2)))});sheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};sheet.headerFooter.oddFooter=`&LREDESY controlled report&CData current ${generatedAt(model)}&RPage &P of &N`;return Buffer.from(await workbook.xlsx.writeBuffer())
}
const numeric=value=>Number(value||0)
const countLabel=(value,singular,plural=`${singular}s`)=>`${numeric(value)} ${numeric(value)===1?singular:plural}`
const safeRows=value=>Array.isArray(value)?value:[]
const reportPeriod=model=>model.period?.from||model.period?.to?`${model.period.from||'Start'} to ${model.period.to||'Today'}`:'Current snapshot'

async function detailedPdf(model,intelligence={}){
  const paperSize=model.paperSize==='Letter'?'LETTER':'A4'
  const document=new PDFDocument({
    size:paperSize,layout:'portrait',margin:42,bufferPages:true,
    info:{Title:`${model.title} · Detailed Institutional Report`,Author:'REDESY · Public Service Commission',Subject:'Detailed controlled institutional management report'}
  }),chunks=[]
  document.on('data',chunk=>chunks.push(chunk))
  const done=new Promise((resolve,reject)=>{document.on('end',()=>resolve(Buffer.concat(chunks)));document.on('error',reject)})
  const bodyWidth=()=>document.page.width-document.page.margins.left-document.page.margins.right
  const bottom=()=>document.page.height-document.page.margins.bottom-30
  const newPage=(layout='portrait',section='')=>{
    document.addPage({size:paperSize,layout,margin:42})
    document.rect(0,0,document.page.width,54).fill(NAVY)
    document.rect(0,52,document.page.width,2).fill(PSC_GOLD)
    document.fillColor(WHITE).font('Helvetica-Bold').fontSize(8).text('PUBLIC SERVICE COMMISSION · REDESY',42,17,{characterSpacing:.6})
    document.font('Helvetica').fontSize(7.5).text(section||'DETAILED INSTITUTIONAL REPORT',document.page.width-260,18,{width:218,align:'right'})
    document.y=72
  }
  const ensure=(height,layout='portrait',section='')=>{
    if(document.y+height>bottom()){newPage(layout,section);return true}
    return false
  }
  const heading=(number,titleText,subtitle='')=>{
    document.font('Helvetica-Bold').fontSize(15)
    const titleHeight=document.heightOfString(`${number}. ${titleText}`,{width:bodyWidth()})
    document.font('Helvetica').fontSize(8.5)
    const subtitleHeight=subtitle?document.heightOfString(subtitle,{width:bodyWidth(),lineGap:2}):0
    ensure(titleHeight+subtitleHeight+28)
    document.font('Helvetica-Bold').fontSize(15).fillColor(NAVY).text(`${number}. ${titleText}`,42,document.y,{width:bodyWidth()})
    if(subtitle){document.moveDown(.25);document.font('Helvetica').fontSize(8.5).fillColor(SLATE).text(subtitle,42,document.y,{width:bodyWidth(),lineGap:2})}
    document.moveDown(.7)
  }
  let sectionNumber=0
  const numberedHeading=(titleText,subtitle='')=>heading(++sectionNumber,titleText,subtitle)
  const paragraph=(value,{bold=false}={})=>{
    if(!value)return
    document.font(bold?'Helvetica-Bold':'Helvetica').fontSize(9)
    const height=document.heightOfString(String(value),{width:bodyWidth(),lineGap:3})
    ensure(height+14)
    document.font(bold?'Helvetica-Bold':'Helvetica').fontSize(9).fillColor('#1A2433').text(String(value),42,document.y,{width:bodyWidth(),lineGap:3})
    document.moveDown(.55)
  }
  const bullet=(value)=>{
    if(!value)return
    document.font('Helvetica').fontSize(9)
    const height=document.heightOfString(String(value),{width:bodyWidth()-18,lineGap:2})
    ensure(height+12)
    document.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('•',46,document.y,{width:10,lineBreak:false})
    document.font('Helvetica').fillColor('#1A2433').text(String(value),60,document.y,{width:bodyWidth()-18,lineGap:2})
    document.moveDown(.35)
  }
  const metricCards=(items)=>{
    const itemsToDraw=safeRows(items),gap=8,cols=3,height=52
    for(let offset=0;offset<itemsToDraw.length;offset+=cols){
      ensure(height+gap)
      const width=(bodyWidth()-gap*(cols-1))/cols,start=document.y
      itemsToDraw.slice(offset,offset+cols).forEach((item,col)=>{
        const x=42+col*(width+gap)
        document.roundedRect(x,start,width,height,5).fillAndStroke(PALE,BORDER)
        document.font('Helvetica').fontSize(7.2).fillColor(SLATE).text(String(item.label),x+9,start+9,{width:width-18,height:16,ellipsis:true})
        document.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text(text(item.value),x+9,start+27,{width:width-18,height:20,ellipsis:true})
      })
      document.y=start+height+gap
    }
    document.y+=4
  }
  const horizontalBars=(titleText,rows,valueKey='value',maxRows=8)=>{
    const items=safeRows(rows).slice(0,maxRows)
    if(!items.length||items.every(row=>numeric(row[valueKey])===0))return
    ensure(70+items.length*25)
    document.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(titleText,42,document.y,{width:bodyWidth()});document.moveDown(.45)
    const max=Math.max(1,...items.map(row=>numeric(row[valueKey])))
    items.forEach(row=>{
      const labelText=String(row.label??row.title??row.team??'Item'),value=numeric(row[valueKey])
      const y=document.y
      document.font('Helvetica').fontSize(7.5).fillColor('#1A2433').text(labelText,42,y,{width:145,height:15,ellipsis:true})
      const bx=194,bw=Math.max(2,(bodyWidth()-190)*(value/max))
      document.roundedRect(bx,y+1,bw,10,2).fill(BLUE)
      document.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text(String(value),document.page.width-78,y,{width:36,align:'right'})
      document.y=y+21
    })
    document.moveDown(.3)
  }
  const lineChart=(titleText,rows,keys)=>{
    const items=safeRows(rows)
    if(items.length<1||keys.every(key=>items.every(row=>numeric(row[key.key])===0)))return
    ensure(190)
    document.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(titleText,42,document.y,{width:bodyWidth()});document.moveDown(.35)
    const x=58,y=document.y+8,w=bodyWidth()-32,h=110
    document.rect(x,y,w,h).strokeColor(BORDER).stroke()
    const values=keys.flatMap(key=>items.map(row=>numeric(row[key.key])))
    const max=Math.max(1,...values)
    keys.forEach((key,keyIndex)=>{
      let previous=null
      items.forEach((row,index)=>{
        const px=x+(items.length===1?w/2:(index*w/(items.length-1)))
        const py=y+h-(numeric(row[key.key])/max*h)
        if(previous){document.moveTo(previous[0],previous[1]).lineTo(px,py).lineWidth(keyIndex===0?2:1.3).strokeColor(keyIndex===0?BLUE:SLATE).stroke()}
        document.circle(px,py,2.2).fill(keyIndex===0?BLUE:SLATE)
        previous=[px,py]
      })
    })
    items.forEach((row,index)=>{
      if(index%Math.max(1,Math.ceil(items.length/5))!==0&&index!==items.length-1)return
      const px=x+(items.length===1?w/2:(index*w/(items.length-1)))
      document.font('Helvetica').fontSize(6.6).fillColor(SLATE).text(String(row.label||''),px-28,y+h+7,{width:56,align:'center',height:18,ellipsis:true})
    })
    let lx=x
    keys.forEach((key,index)=>{
      document.rect(lx,y+h+29,8,8).fill(index===0?BLUE:SLATE)
      document.font('Helvetica').fontSize(7).fillColor('#1A2433').text(key.label,lx+12,y+h+28,{width:105,lineBreak:false})
      lx+=118
    })
    document.y=y+h+47
  }
  const table=(titleText,columns,rows,{landscape=false,maxRows=100}={})=>{
    const data=safeRows(rows).slice(0,maxRows)
    if(!data.length)return
    if(landscape&&document.page.layout!=='landscape')newPage('landscape',titleText.toUpperCase())
    ensure(64,landscape?'landscape':'portrait',titleText.toUpperCase())
    document.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(titleText,42,document.y,{width:bodyWidth()});document.moveDown(.45)
    const widths=pdfColumnWidths(columns,bodyWidth()),headerHeight=24
    const drawHead=()=>{
      let xx=42,yy=document.y
      columns.forEach((column,index)=>{
        document.rect(xx,yy,widths[index],headerHeight).fillAndStroke(BLUE,WHITE)
        document.font('Helvetica-Bold').fontSize(6.6).fillColor(WHITE).text(columnLabel(column),xx+4,yy+6,{width:widths[index]-8,height:14,ellipsis:true})
        xx+=widths[index]
      })
      document.y=yy+headerHeight
    }
    drawHead()
    data.forEach((row,rowIndex)=>{
      const vals=columns.map(column=>formatValue(column,row[column]))
      document.font('Helvetica').fontSize(6.7)
      const rowHeight=Math.max(22,Math.min(45,Math.max(...vals.map((value,index)=>document.heightOfString(value,{width:widths[index]-8,lineGap:1})))+8))
      if(document.y+rowHeight>bottom()){newPage(landscape?'landscape':'portrait',titleText.toUpperCase());drawHead()}
      let xx=42,yy=document.y
      columns.forEach((_column,index)=>{
        document.rect(xx,yy,widths[index],rowHeight).fillAndStroke(rowIndex%2?WHITE:'#F7F9FC',BORDER)
        document.font('Helvetica').fontSize(6.7).fillColor('#1A2433').text(vals[index],xx+4,yy+5,{width:widths[index]-8,height:rowHeight-8,ellipsis:true,lineGap:1})
        xx+=widths[index]
      })
      document.y=yy+rowHeight
    })
    document.moveDown(.45)
  }

  const overview=intelligence.overview||{},research=intelligence.research||{},k=overview.kpis||{}
  const decision=overview.decisionSupport||{},warning=overview.earlyWarning||{},forecast=overview.forecast||{}
  const peopleRows=safeRows(intelligence.people),contributionRows=safeRows(intelligence.contributions),attentionRows=safeRows(intelligence.attention),publishedRows=safeRows(intelligence.published)
  const teamNames=[...new Set(peopleRows.map(row=>String(row.team||'').trim()).filter(Boolean))]
  const activePeople=peopleRows.filter(row=>numeric(row.total_assigned)+numeric(row.research_active)+numeric(row.awaiting_review)>0).length
  const zeroWorkPeople=peopleRows.filter(row=>numeric(row.total_assigned)+numeric(row.research_active)+numeric(row.awaiting_review)===0).length
  const managementConclusions=[]
  if(numeric(k.overdue)>0)managementConclusions.push(`${numeric(k.overdue)} overdue work item${numeric(k.overdue)===1?' requires':'s require'} accountable recovery action within the authorised scope.`)
  if(numeric(k.awaitingReview)>0||numeric(k.researchUnderReview)>0)managementConclusions.push(`Review capacity remains material: ${numeric(k.awaitingReview)} delivery item${numeric(k.awaitingReview)===1?' is':'s are'} awaiting review and ${numeric(k.researchUnderReview)} research item${numeric(k.researchUnderReview)===1?' is':'s are'} under review.`)
  if(numeric(k.dueSoon)>0)managementConclusions.push(`${numeric(k.dueSoon)} work item${numeric(k.dueSoon)===1?' falls':'s fall'} due within seven days and should be checked for evidence readiness and accountable ownership.`)
  if(numeric(k.activeResearch)>0)managementConclusions.push(`${numeric(k.activeResearch)} active research project${numeric(k.activeResearch)===1?' remains':'s remain'} in the portfolio; milestone, reviewer and publication readiness should continue to be monitored.`)
  if(!managementConclusions.length)managementConclusions.push('No material delivery, review or deadline exception is recorded for the selected governed reporting scope.')

  // Cover
  document.rect(0,0,document.page.width,document.page.height).fill('#F7F9FC')
  document.rect(0,0,document.page.width,185).fill(NAVY)
  document.rect(0,181,document.page.width,4).fill(PSC_GOLD)
  document.fillColor(WHITE).font('Helvetica-Bold').fontSize(10).text('PUBLIC SERVICE COMMISSION',42,48,{characterSpacing:1})
  document.fontSize(25).text('DETAILED INSTITUTIONAL\nMANAGEMENT REPORT',42,82,{width:430,lineGap:4})
  document.font('Helvetica').fontSize(11).fillColor('#DCE8F5').text(model.title,42,153,{width:430})
  document.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text('Institutional management report',42,238,{width:430})
  document.font('Helvetica').fontSize(10).fillColor(SLATE).text('A print-ready summary of work, research, review and delivery indicators available within the authorised REDESY reporting scope.',42,262,{width:430,lineGap:4})

  newPage('portrait','DOCUMENT CONTROL')
  document.x=42;document.font('Helvetica-Bold').fontSize(17).fillColor(NAVY).text('DOCUMENT CONTROL',42,82,{width:bodyWidth()})
  document.rect(42,108,bodyWidth(),2).fill(PSC_GOLD)
  document.font('Helvetica').fontSize(9).fillColor(SLATE).text('Controlled export details and authorised reporting basis',42,121,{width:bodyWidth()})
  const scopeType=String(intelligence.scope?.type||'').toUpperCase()
  const scopeLabel=scopeType==='ORGANISATION'?'Organisation-wide':scopeType==='TEAM_SUBTREE'?'Authorised team and subordinate teams':scopeType==='OWN_OR_CONTEXTUAL'?'Own and permitted contextual records':'Permission-scoped REDESY data'
  const controlEntries=[
    ['Report title',model.title],['Report key',model.reportKey||'Institutional report'],
    ['Prepared by',model.generatedBy||'Current authorised REDESY user'],['Document status',model.documentStatus||'Generated copy · No approval recorded'],
    ['Classification',model.classification||'INTERNAL'],['Reporting period',reportPeriod(model)],
    ['Authorised scope',`${scopeLabel}${intelligence.scope?.role?` · ${intelligence.scope.role}`:''}`],['Report profile','Comprehensive institutional report'],
    ['Paper size',model.paperSize||'A4'],['Generated',generatedAt(model)],
    ['Selected report records',numeric(model.recordCount??model.rows?.length).toLocaleString('en-KE')],
    ['Institutional data basis',`${countLabel(intelligence.basis?.assignments,'assignment')} · ${countLabel(intelligence.basis?.research,'research record')} · ${countLabel(intelligence.basis?.publishedReports,'published report')}`]
  ]
  const controlGap=10,controlWidth=(bodyWidth()-controlGap)/2,controlStartY=154,controlRowHeight=55
  controlEntries.forEach(([label,value],index)=>{
    const column=index%2,row=Math.floor(index/2),x=42+column*(controlWidth+controlGap),y=controlStartY+row*(controlRowHeight+7)
    document.roundedRect(x,y,controlWidth,controlRowHeight,4).fillAndStroke('#F8F6F0','#D9CCAA')
    document.font('Helvetica-Bold').fontSize(7).fillColor('#8B6914').text(label.toUpperCase(),x+10,y+8,{width:controlWidth-20,height:10,ellipsis:true})
    document.font('Helvetica').fontSize(9).fillColor('#1A2433').text(String(value||'Not recorded'),x+10,y+23,{width:controlWidth-20,height:25,lineGap:1,ellipsis:true})
  })
  const controlBottom=controlStartY+Math.ceil(controlEntries.length/2)*(controlRowHeight+7)+4
  document.font('Helvetica').fontSize(8).fillColor(SLATE).text('This control page records the scope and settings used to generate this copy. It does not constitute a review decision, approval or repository publication.',42,controlBottom,{width:bodyWidth(),lineGap:2})

  newPage('portrait','EXECUTIVE SUMMARY')
  numberedHeading('Executive Summary','A consolidated, evidence-based view of delivery, research, review, deadlines and management attention for the authorised reporting scope.')
  metricCards([
    {label:'Total work',value:numeric(k.totalWork)},{label:'Completed',value:numeric(k.completed)},{label:'Active',value:numeric(k.active)},
    {label:'Overdue',value:numeric(k.overdue)},{label:'Awaiting review',value:numeric(k.awaitingReview)},{label:'Due soon',value:numeric(k.dueSoon)},
    {label:'Completion rate',value:`${numeric(k.completionRate)}%`},{label:'Active research',value:numeric(k.activeResearch)},{label:'Research under review',value:numeric(k.researchUnderReview)}
  ])
  paragraph(overview.interpretation||'No executive interpretation is available for the selected period.')
  if(safeRows(decision.priorities).length){
    document.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Priority management interventions',42,document.y);document.moveDown(.35)
    safeRows(decision.priorities).forEach(item=>bullet(`${item.title}: ${item.evidence} Action: ${item.action}`))
  }

  numberedHeading('Visual Analytics','Charts are rendered from the same permission-scoped institutional intelligence used by the Reports & Analytics dashboard.')
  lineChart('Work completion trend',overview.completionTrend,[{key:'created',label:'Created'},{key:'completed',label:'Completed'},{key:'overdue',label:'Overdue'}])
  horizontalBars('Current work status',overview.status,'value',8)
  horizontalBars('Deadline exposure',overview.deadlineRisk,'value',8)
  horizontalBars('Research pipeline',research.pipeline,'value',10)
  lineChart('Research submission and approval trend',research.publicationTrend,[{key:'submitted',label:'Submitted'},{key:'approved',label:'Approved'}])
  lineChart('Review turnaround trend',research.reviewTurnaroundTrend,[{key:'average_days',label:'Average days'},{key:'reviewed',label:'Reviewed'}])

  newPage('portrait','DELIVERY & DEADLINES')
  numberedHeading('Delivery and Deadline Position')
  const completedCount=numeric(k.completed),activeCount=numeric(k.active),overdueCount=numeric(k.overdue),dueSoonCount=numeric(k.dueSoon)
  paragraph(`Current delivery comprises ${numeric(k.totalWork)} work item${numeric(k.totalWork)===1?'':'s'}, of which ${completedCount} ${completedCount===1?'is':'are'} completed, ${activeCount} ${activeCount===1?'remains':'remain'} active, ${overdueCount} ${overdueCount===1?'is':'are'} overdue and ${dueSoonCount} ${dueSoonCount===1?'is':'are'} due within seven days.`)
  horizontalBars('Assignment lifecycle',overview.lifecycle,'value',8)
  table('Management attention register',['type','title','status','due_date','responsible_team','reason'],intelligence.attention||[],{maxRows:50})

  numberedHeading('Research Portfolio')
  paragraph(research.interpretation)
  metricCards([
    {label:'Research total',value:numeric(research.portfolio?.total)},{label:'Active research',value:numeric(research.portfolio?.active)},
    {label:'Under review',value:numeric(research.portfolio?.under_review)},{label:'Approved/completed',value:numeric(research.portfolio?.approved)},
    {label:'Overdue research',value:numeric(research.portfolio?.overdue)},{label:'Average review days',value:numeric(research.review?.average_review_days)}
  ])
  horizontalBars('Research ageing',research.ageing,'value',8)
  horizontalBars('Research review outcomes',research.review?.outcomes,'value',8)

  newPage('portrait','REVIEWS & MANAGEMENT RISK')
  numberedHeading('Review and Approval Position')
  paragraph(`Submitted research report versions: ${numeric(research.review?.submitted)}. Approved: ${numeric(research.review?.approved)}. Changes requested: ${numeric(research.review?.changes_requested)}. Current average pending-review age: ${numeric(research.review?.pending_review_age)} days.`)
  lineChart('Reviewer turnaround over time',research.reviewTurnaroundTrend,[{key:'average_days',label:'Average days'},{key:'pending',label:'Pending'}])

  numberedHeading('Management Risk, Early Warning and Actions')
  if(safeRows(warning.signals).length)safeRows(warning.signals).forEach(item=>bullet(`${String(item.level||'').toUpperCase()} · ${item.title} · ${item.evidence} ${item.outlook||''} Action: ${item.action||''}`))
  else paragraph('No early-warning signals are recorded for the selected scope and period.')
  if(warning.methodology)paragraph(warning.methodology)
  if(safeRows(forecast.scenarios).length){
    document.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Deterministic management scenarios',42,document.y);document.moveDown(.35)
    safeRows(forecast.scenarios).forEach(item=>bullet(`${item.title}: overdue ${numeric(item.overdue)}, awaiting review ${numeric(item.awaitingReview)}, completion rate ${numeric(item.completionRate)}%. Assumption: ${item.assumption}`))
    paragraph(forecast.methodology)
  }

  if(intelligence.capabilities?.people){
    newPage('landscape','TEAM & CONTRIBUTIONS')
    numberedHeading('Team Workload and Contribution Evidence','This section describes attributable workload and contribution evidence. It is not a staff ranking or composite performance score.')
    if(peopleRows.length)table('Team workload evidence',['name','team','total_assigned','active_work','completed','overdue','research_active','awaiting_review','on_time_rate'],peopleRows,{landscape:true,maxRows:100})
    if(contributionRows.length)table('Contribution evidence',['name','team','work_type','work_title','contribution_role','status','progress','evidence_at','evidence'],contributionRows,{landscape:true,maxRows:500})
    if(!peopleRows.length&&!contributionRows.length)paragraph('No team workload or contribution records were found in the selected period and authorised scope.')
  }

  newPage('landscape','DETAILED SELECTED REPORT')
  numberedHeading('Detailed Selected Report',`${model.title} · ${numeric(model.recordCount??model.rows?.length)} governed records in the selected report dataset.`)
  if(safeRows(model.kpis).length)metricCards(model.kpis)
  table('Underlying governed records',model.columns||[],model.rows||[],{landscape:true,maxRows:MAX_EXPORT_ROWS})

  if(publishedRows.length){
    newPage('landscape','PUBLISHED REPORTS')
    numberedHeading('Published Reports and Institutional Record')
    table('Published reports',['title','report_type','generated_by','approved_by','approval_date','published_date','audience','status'],publishedRows,{landscape:true,maxRows:250})
  }

  newPage('portrait','MANAGEMENT CONCLUSIONS')
  numberedHeading('Management Conclusions and Action Register','A concise institutional interpretation of the governed evidence, followed by the accountable exception register requiring management follow-up.')
  if(intelligence.capabilities?.people)metricCards([
    {label:'Authorised team members',value:peopleRows.length},{label:'Members with recorded activity',value:activePeople},{label:'Members with zero recorded activity',value:zeroWorkPeople},
    {label:'Teams represented',value:teamNames.length},{label:'Contribution evidence records',value:contributionRows.length},{label:'Published report records',value:publishedRows.length}
  ])
  managementConclusions.forEach(item=>bullet(item))
  paragraph('These conclusions are descriptive management evidence only. They do not rank staff, create composite performance scores or widen any user’s authorised scope.')
  if(attentionRows.length)table('Management action register',['type','title','status','due_date','owner_name','responsible_team','reason'],attentionRows,{maxRows:100})
  if(!attentionRows.length)paragraph('No current exception item is recorded in the management attention register for the selected scope and period.')

  newPage('portrait','METHODOLOGY & GOVERNANCE')
  numberedHeading('Methodology, Scope and Governance')
  paragraph('All figures in this document are generated from REDESY’s existing reporting services and are filtered by the signed-in user’s backend-authorised scope. The PDF does not widen visibility and does not recalculate staff performance using hidden scores.')
  paragraph(`Reporting period: ${reportPeriod(model)}.`)
  paragraph(`Detailed selected-report ${countLabel(model.recordCount??model.rows?.length,'record')}.`)
  paragraph(`Institutional data basis: ${countLabel(intelligence.basis?.assignments,'assignment')}, ${countLabel(intelligence.basis?.research,'research record')} and ${countLabel(intelligence.basis?.publishedReports,'published report')}.`)
  paragraph('Research, deadline, review and contribution indicators are descriptive operational evidence. Early-warning and scenario sections use transparent deterministic rules and should be interpreted as management decision support rather than statistical forecasts.')
  paragraph('Contribution evidence recognises attributable participation in assignments, tasks, research and review work. It must not be used as a simplistic employee league table.')
  paragraph(`Data current as of ${generatedAt(model)}.`)

  const pages=document.bufferedPageRange()
  for(let index=0;index<pages.count;index++){
    document.switchToPage(index)
    // Keep footer text inside PDFKit's printable boundary. Writing below the
    // bottom margin causes PDFKit to append a new, footer-only page.
    const footerY=document.page.height-document.page.margins.bottom-14
    document.moveTo(42,footerY-7).lineTo(document.page.width-42,footerY-7).strokeColor(BORDER).stroke()
    document.font('Helvetica').fontSize(7).fillColor(SLATE).text(`REDESY · Detailed institutional management report · ${reportPeriod(model)}`,42,footerY,{width:document.page.width-180,lineBreak:false})
    document.text(`Page ${index+1} of ${pages.count}`,document.page.width-122,footerY,{width:80,align:'right',lineBreak:false})
  }
  document.end()
  return done
}

export async function renderReportPackPdf(model){
  if(!model||!Array.isArray(model.reports)||!model.reports.length)throw exportError('Choose at least one available report for the consolidated pack.')
  const paperSize=model.paperSize==='Letter'?'LETTER':'A4'
  for(const report of model.reports)assertExportModel({title:report.title,columns:report.columns||[],rows:report.rows||[],kpis:report.kpis||[]})
  const document=new PDFDocument({size:paperSize,layout:'landscape',margin:32,bufferPages:true,info:{Title:model.title,Author:'Public Service Commission',Subject:'Consolidated permission-scoped REDESY report pack'}}),chunks=[]
  document.on('data',chunk=>chunks.push(chunk))
  const done=new Promise((resolve,reject)=>{document.on('end',()=>resolve({buffer:Buffer.concat(chunks),type:'application/pdf',extension:'pdf'}));document.on('error',reject)})
  const width=()=>document.page.width-document.page.margins.left-document.page.margins.right
  const drawPageHeader=(label)=>{document.rect(0,0,document.page.width,62).fill(NAVY);document.rect(0,59,document.page.width,3).fill(PSC_GOLD);document.fillColor(WHITE).font('Helvetica-Bold').fontSize(8).text('PUBLIC SERVICE COMMISSION · REDESY',32,17,{characterSpacing:.6});document.font('Helvetica').fontSize(8).fillColor('#DCE8F5').text(label,document.page.width-300,18,{width:268,align:'right'});document.x=32;document.y=74}
  const startPage=(label)=>{document.addPage({size:paperSize,layout:'landscape',margin:32});drawPageHeader(label)}
  document.rect(0,0,document.page.width,document.page.height).fill('#F7F9FC')
  document.rect(0,0,document.page.width,164).fill(NAVY);document.rect(0,160,document.page.width,4).fill(PSC_GOLD)
  document.fillColor(WHITE).font('Helvetica-Bold').fontSize(10).text('PUBLIC SERVICE COMMISSION · REDESY',42,39,{characterSpacing:.8})
  document.fontSize(27).text('CONSOLIDATED REPORT PACK',42,71,{width:document.page.width-84})
  document.font('Helvetica').fontSize(16).fillColor('#DCE8F5').text(model.title,42,117,{width:document.page.width-84})
  document.font('Helvetica').fontSize(11).fillColor(NAVY).text('A single print-ready pack of selected reports, prepared from records available within the authorised REDESY reporting scope.',42,207,{width:width()-30,lineGap:4})
  startPage('DOCUMENT CONTROL')
  document.font('Helvetica-Bold').fontSize(17).fillColor(NAVY).text('DOCUMENT CONTROL',32,74,{width:width()})
  document.rect(32,101,width(),2).fill(PSC_GOLD)
  document.font('Helvetica').fontSize(9).fillColor(SLATE).text('Controlled details for this consolidated report copy',32,114,{width:width()})
  const controlRows=[['Pack title',model.title],['Report count',String(model.reports.length)],['Prepared by',model.generatedBy||'Current authorised REDESY user'],['Record count',numeric(model.recordCount).toLocaleString('en-KE')],['Classification','INTERNAL'],['Reporting period',model.period?.from||model.period?.to?`${model.period.from||'Start'} to ${model.period.to||'Today'}`:'Current snapshot'],['Authorised scope',model.scope?.type==='ORGANISATION'?'Organisation-wide':model.scope?.type==='TEAM'?'Authorised team':'Own and permitted contextual records'],['Paper size',model.paperSize||'A4'],['Status','Generated copy · No approval or sign-off recorded'],['Generated',generatedAt(model)]]
  controlRows.forEach(([label,value],index)=>{const column=index%2,row=Math.floor(index/2),x=32+column*(width()/2),y=151+row*58,cardWidth=(width()-10)/2;document.roundedRect(x,y,cardWidth,50,4).fillAndStroke('#F8F6F0','#D9CCAA');document.font('Helvetica-Bold').fontSize(7).fillColor('#8B6914').text(label.toUpperCase(),x+9,y+7,{width:cardWidth-18,height:10,ellipsis:true});document.font('Helvetica').fontSize(9).fillColor('#1A2433').text(String(value||'Not recorded'),x+9,y+22,{width:cardWidth-18,height:22,ellipsis:true})})
  startPage('PACK CONTENTS')
  document.font('Helvetica-Bold').fontSize(17).fillColor(NAVY).text('Reports in this pack',32,74,{width:width()})
  document.y=105
  model.reports.forEach((report,index)=>{
    if(document.y+27>document.page.height-document.page.margins.bottom-16)startPage('PACK CONTENTS · CONTINUED')
    const y=document.y
    document.roundedRect(32,y,width(),23,3).fillAndStroke(index%2?'#FFFFFF':'#F0F4F8',BORDER)
    document.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text(`${index+1}. ${report.title}`,42,y+7,{width:width()-115,height:12,ellipsis:true})
    document.font('Helvetica').fontSize(8).fillColor(SLATE).text(`${numeric(report.recordCount).toLocaleString('en-KE')} records`,document.page.width-132,y+7,{width:88,align:'right',lineBreak:false})
    document.y=y+28
  })
  model.reports.forEach((report,reportIndex)=>{
    const label=`REPORT ${reportIndex+1} OF ${model.reports.length}`
    startPage(label)
    document.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text(report.title,32,74,{width:width(),ellipsis:true})
    document.font('Helvetica').fontSize(8.5).fillColor(SLATE).text(`${numeric(report.recordCount).toLocaleString('en-KE')} governed records · ${model.period?.from||model.period?.to?`${model.period.from||'Start'} to ${model.period.to||'Today'}`:'Current snapshot'}`,32,101,{width:width()})
    document.y=123
    const kpis=(report.kpis||[]).slice(0,8),gap=7,columns=Math.max(1,Math.min(4,kpis.length)),cardWidth=(width()-gap*(columns-1))/columns,startY=document.y
    kpis.forEach((item,index)=>{const column=index%columns,row=Math.floor(index/columns),x=32+column*(cardWidth+gap),y=startY+row*39;document.roundedRect(x,y,cardWidth,33,4).fillAndStroke(PALE,BORDER);document.font('Helvetica').fontSize(7).fillColor(SLATE).text(item.label,x+7,y+5,{width:cardWidth-14,height:10,ellipsis:true});document.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(text(item.value),x+7,y+17,{width:cardWidth-14,height:13,ellipsis:true})})
    document.y=startY+Math.ceil(kpis.length/columns)*39+10
    const columnsToUse=(report.columns||[]).slice(0,MAX_EXPORT_COLUMNS),rows=report.rows||[]
    if(!columnsToUse.length||!rows.length){document.font('Helvetica').fontSize(10).fillColor(SLATE).text('No underlying records matched this report and reporting period.',32,document.y,{width:width()});return}
    const columnWidths=pdfColumnWidths(columnsToUse,width()),headerHeight=25
    const drawTableHeader=()=>{let x=32,y=document.y;columnsToUse.forEach((column,index)=>{document.rect(x,y,columnWidths[index],headerHeight).fillAndStroke(BLUE,WHITE);document.font('Helvetica-Bold').fontSize(6.7).fillColor(WHITE).text(columnLabel(column),x+4,y+6,{width:columnWidths[index]-8,height:13,ellipsis:true});x+=columnWidths[index]});document.x=32;document.y=y+headerHeight}
    drawTableHeader()
    rows.forEach((row,rowIndex)=>{
      const values=columnsToUse.map(column=>formatValue(column,row[column]))
      document.font('Helvetica').fontSize(6.8)
      const rowHeight=Math.max(22,Math.min(46,Math.max(...values.map((value,index)=>document.heightOfString(value,{width:columnWidths[index]-8,lineGap:1})))+8))
      if(document.y+rowHeight>document.page.height-document.page.margins.bottom-14){startPage(`${label} · CONTINUED`);document.font('Helvetica-Bold').fontSize(14).fillColor(NAVY).text(report.title,32,74,{width:width(),ellipsis:true});document.y=99;drawTableHeader()}
      let x=32,y=document.y
      columnsToUse.forEach((_column,index)=>{document.rect(x,y,columnWidths[index],rowHeight).fillAndStroke(rowIndex%2?WHITE:'#F7F9FC',BORDER);document.font('Helvetica').fontSize(6.8).fillColor('#1A2433').text(values[index],x+4,y+5,{width:columnWidths[index]-8,height:rowHeight-8,ellipsis:true,lineGap:1});x+=columnWidths[index]})
      document.x=32;document.y=y+rowHeight
    })
  })
  const pages=document.bufferedPageRange()
  for(let index=0;index<pages.count;index++){document.switchToPage(index);const footerY=document.page.height-document.page.margins.bottom-14;document.moveTo(32,footerY-7).lineTo(document.page.width-32,footerY-7).strokeColor(BORDER).stroke();document.font('Helvetica').fontSize(7).fillColor(SLATE).text(`${model.title} · ${reportPeriod({period:model.period})}`,32,footerY,{width:document.page.width-190,lineBreak:false});document.text(`Page ${index+1} of ${pages.count}`,document.page.width-126,footerY,{width:94,align:'right',lineBreak:false})}
  document.end()
  return done
}

export async function renderReportExport(format,model){assertExportModel(model);if(format==='pdf'&&model.profile==='brief')return{buffer:await briefPdf(model),type:'application/pdf',extension:'pdf'};if(format==='pdf'&&model.profile==='institutional-detailed')return{buffer:await detailedPdf(model,model.intelligence||{}),type:'application/pdf',extension:'pdf'};if(format==='pdf')return{buffer:await pdf(model),type:'application/pdf',extension:'pdf'};if(format==='docx')return{buffer:await docx(model),type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',extension:'docx'};if(format==='xlsx')return{buffer:await xlsx(model),type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',extension:'xlsx'};throw exportError('Unsupported report export format.')}
