import assert from 'node:assert/strict';
import {query,db,transaction} from '../src/db.js';
import {pulseForUser,visibleNotifications,syncTaskDeadlineNotifications} from '../src/pulse-service.js';
import {calendarForUser} from '../src/calendar-service.js';
import {managedUserIds} from '../src/scope.js';
let checks=0;
try{
 const users=(await query('SELECT id,role FROM users WHERE active=TRUE')).rows;
 for(const u of users){
  const p=await pulseForUser(u),scope=await managedUserIds(u);
  for(const module of Object.values(p.modules))for(const [bucket,count] of Object.entries(module.counts)){assert.equal(count,module.rows.filter(r=>r.buckets.includes(bucket)).length);checks++}
  if(u.role==='Researcher'){
   const expected=(await query('SELECT id FROM assignment_tasks WHERE owner_id=$1 AND archived_at IS NULL',[u.id])).rows.map(r=>r.id).sort();
   assert.deepEqual(p.modules.Tasks.rows.map(r=>r.id).sort(),expected);checks++;
   const allowed=(await query('SELECT id FROM assignment_tasks WHERE archived_at IS NULL AND(owner_id=$1 OR reviewer_id=$1)',[u.id])).rows.map(r=>r.id);
   for(const r of await calendarForUser(u))if(r.type==='task'){assert.ok(allowed.includes(r.id));checks++}
  }else if(scope){
   const allowed=(await query("SELECT id FROM assignment_tasks WHERE archived_at IS NULL AND(owner_id=ANY($1::uuid[]) OR reviewer_id=$2 AND contribution_status='Ready for Integration')",[scope,u.id])).rows.map(r=>r.id);
   for(const t of p.modules.Tasks.rows){assert.ok(allowed.includes(t.id));checks++}
  }
 }
 // Notice visibility and deadline reconciliation are tested in a rolled-back transaction.
 const client=await db.connect();
 try{await client.query('BEGIN');const u=users.find(u=>u.role==='Researcher');
 const a=(await client.query("INSERT INTO alerts(title,body,created_by,status,audience_role,expires_at) VALUES('Pulse audience test','Fixture',$1,'Published','Director',NOW()+INTERVAL '1 day') RETURNING id",[u.id])).rows[0];
 await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'New Notice Board post','Fixture','notice',$2)",[u.id,a.id]);
 assert.ok(!(await visibleNotifications(u,client.query.bind(client))).some(n=>n.entity_id===a.id));checks++;
 await client.query('UPDATE alerts SET audience_role=$1 WHERE id=$2',[u.role,a.id]);
 assert.ok((await visibleNotifications(u,client.query.bind(client))).some(n=>n.entity_id===a.id));checks++;
 const task=(await client.query('SELECT id,owner_id FROM assignment_tasks WHERE owner_id IS NOT NULL AND archived_at IS NULL LIMIT 1')).rows[0];
 const recipient=task?.owner_id||u.id;
 if(task)await client.query("UPDATE assignment_tasks SET due_date=CURRENT_DATE-1,status='In Progress' WHERE id=$1",[task.id]);
 await syncTaskDeadlineNotifications(client,recipient);const before=(await client.query('SELECT count(*)::int n FROM notifications WHERE user_id=$1',[recipient])).rows[0].n;
 await syncTaskDeadlineNotifications(client,recipient);assert.equal((await client.query('SELECT count(*)::int n FROM notifications WHERE user_id=$1',[recipient])).rows[0].n,before);checks++;
 }finally{await client.query('ROLLBACK');client.release()}
 console.log(`PASS: ${checks} assertions across ${users.length} active users; counts, researcher ownership, manager scope, calendar, notice audiences and idempotency.`);
}catch(e){console.error(e);process.exitCode=1}finally{await db.end()}
