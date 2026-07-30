import 'dotenv/config'
for (const name of ['DATABASE_URL','JWT_SECRET']) if (!process.env[name]) throw new Error(`${name} is required. Copy .env.example to .env and configure it.`)
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.')
export const config={port:Number(process.env.PORT||8000),environment:process.env.NODE_ENV||'development',frontendOrigin:process.env.FRONTEND_ORIGIN||'http://localhost:5173',databaseUrl:process.env.DATABASE_URL,databaseSsl:process.env.DATABASE_SSL==='true',jwtSecret:process.env.JWT_SECRET,jwtExpiresIn:process.env.JWT_EXPIRES_IN||'8h'}
