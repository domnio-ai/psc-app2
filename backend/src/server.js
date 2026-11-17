import app from './app.js'
import {config} from './config.js'
import {db,transaction} from './db.js'
import {startFelixIndexWorker} from './felix-index-worker.js'
import {startReportScheduler} from './reports/report-scheduler.js'
import {startNoticeExpiryWorker} from './notice-expiry-worker.js'
import {reconcileResearchLifecycleState} from './research-status.js'
const researchLifecycleReconciliationEnabled=process.env.RESEARCH_LIFECYCLE_RECONCILIATION_ENABLED!=='false'
if(researchLifecycleReconciliationEnabled)await transaction(async client=>reconcileResearchLifecycleState(client))
else console.log('REDESY research lifecycle startup reconciliation disabled by configuration')
const server=app.listen(config.port,()=>console.log(`PSC REDESY API listening on http://localhost:${config.port}`))
const stopFelixIndexWorker=process.env.FELIX_INDEX_WORKER_ENABLED==='false'?()=>{}:startFelixIndexWorker()
const stopReportScheduler=process.env.REPORT_SCHEDULER_ENABLED==='false'?()=>{}:startReportScheduler()
const noticeExpiryWorkerEnabled=process.env.NOTICE_EXPIRY_WORKER_ENABLED!=='false'
const stopNoticeExpiryWorker=noticeExpiryWorkerEnabled?startNoticeExpiryWorker():()=>{}
if(!noticeExpiryWorkerEnabled)console.log('REDESY notice expiry worker disabled by configuration')
async function shutdown(){stopFelixIndexWorker();stopReportScheduler();stopNoticeExpiryWorker();server.close(async()=>{await db.end();process.exit(0)})}
process.on('SIGINT',shutdown)
process.on('SIGTERM',shutdown)
