import app from './app.js'
import {config} from './config.js'
import {db} from './db.js'
import {startFelixIndexWorker} from './felix-index-worker.js'
import {startReportScheduler} from './reports/report-scheduler.js'
import {startNoticeExpiryWorker} from './notice-expiry-worker.js'
const server=app.listen(config.port,()=>console.log(`PSC App2 API listening on http://localhost:${config.port}`))
const stopFelixIndexWorker=startFelixIndexWorker()
const stopReportScheduler=startReportScheduler()
const stopNoticeExpiryWorker=startNoticeExpiryWorker()
async function shutdown(){stopFelixIndexWorker();stopReportScheduler();stopNoticeExpiryWorker();server.close(async()=>{await db.end();process.exit(0)})}
process.on('SIGINT',shutdown)
process.on('SIGTERM',shutdown)
