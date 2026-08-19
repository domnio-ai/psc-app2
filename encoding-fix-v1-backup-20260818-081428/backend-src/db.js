import pg from 'pg'
import { config } from './config.js'
const {Pool}=pg
export const db=new Pool({connectionString:config.databaseUrl,ssl:config.databaseSsl?{rejectUnauthorized:true}:false,max:10,idleTimeoutMillis:30000})
export const query=(text,values=[])=>db.query(text,values)
export async function transaction(work){const client=await db.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}}
