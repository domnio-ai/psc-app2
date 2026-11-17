import 'dotenv/config'
for (const name of ['DATABASE_URL','JWT_SECRET']) if (!process.env[name]) throw new Error(`${name} is required. Copy .env.example to .env and configure it.`)
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.')
const configuredFrontendOrigins=(process.env.FRONTEND_ORIGIN||'http://localhost:5173').split(',').map(value=>value.trim()).filter(Boolean)
const localFrontendOrigins=['http://localhost:5173','http://127.0.0.1:5173']
const uploadDir=process.env.UPLOAD_DIR||'uploads'
const environment=process.env.NODE_ENV||'development'
const port=Number(process.env.PORT||8000)
const maxUploadMb=Number(process.env.MAX_UPLOAD_MB||100)
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.')
if(!Number.isFinite(maxUploadMb)||maxUploadMb<1||maxUploadMb>500)throw new Error('MAX_UPLOAD_MB must be between 1 and 500.')
if(environment==='production'&&configuredFrontendOrigins.some(origin=>/^http:\/\/(?:localhost|127\.0\.0\.1)(?::|$)/i.test(origin)))throw new Error('FRONTEND_ORIGIN must not use localhost in production.')
export const config={port,environment,frontendOrigin:configuredFrontendOrigins[0],frontendOrigins:[...new Set([...configuredFrontendOrigins,...(environment==='production'?[]:localFrontendOrigins)])],exposeLoginDirectory:process.env.EXPOSE_LOGIN_DIRECTORY==='true'&&environment!=='production',aiResearchUrl:process.env.AI_RESEARCH_URL||'http://127.0.0.1:8100',felixIndexIntervalMs:Number(process.env.FELIX_INDEX_INTERVAL_MS||5000),felixIndexReconcileMs:Number(process.env.FELIX_INDEX_RECONCILE_MS||300000),felixIndexTimeoutMs:Number(process.env.FELIX_INDEX_TIMEOUT_MS||360000),databaseUrl:process.env.DATABASE_URL,databaseSsl:process.env.DATABASE_SSL==='true',jwtSecret:process.env.JWT_SECRET,jwtExpiresIn:process.env.JWT_EXPIRES_IN||'8h',uploadDir,documentStoragePath:process.env.DOCUMENT_STORAGE_PATH||uploadDir,maxUploadMb,smtp:{enabled:process.env.SMTP_ENABLED==='true',host:process.env.SMTP_HOST||'',port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',user:process.env.SMTP_USER||'',password:process.env.SMTP_PASSWORD||'',from:process.env.SMTP_FROM||''}}
