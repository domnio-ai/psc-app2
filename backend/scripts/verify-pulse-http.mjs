import assert from 'node:assert/strict';import app from '../src/app.js';import {query,db} from '../src/db.js';import {createToken} from '../src/auth.js';
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
try{
 assert.equal((await fetch(base+'/pulse')).status,401);checks++;
 const users=(await query('SELECT DISTINCT ON(role) id,email,role,token_version FROM users WHERE active=TRUE ORDER BY role,id')).rows;
 for(const u of users){const headers={Authorization:`Bearer ${createToken(u)}`};
 for(const route of ['/pulse','/calendar']){const r=await fetch(base+route,{headers});assert.equal(r.status,200,await r.clone().text());const data=await r.json();assert.ok(route==='/calendar'?Array.isArray(data):data.generatedAt);checks++}
 }
 console.log(`PASS: ${checks} HTTP authentication and endpoint checks across ${users.length} roles.`);
}catch(e){console.error(e);process.exitCode=1}finally{await new Promise(r=>server.close(r));await db.end()}
