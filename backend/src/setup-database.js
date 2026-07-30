import fs from 'node:fs/promises'
import bcrypt from 'bcryptjs'
import {db,transaction} from './db.js'
await db.query(await fs.readFile(new URL('./schema.sql',import.meta.url),'utf8'))
const hash=await bcrypt.hash('PSC@2026',12)
const users=[['Dominic Kibet','dominic.kibet@publicservice.go.ke','Research Officer','Digital Government'],['Mary Wanjiku','mary.wanjiku@publicservice.go.ke','Research Manager','Research & Policy'],['Grace Muturi','grace.muturi@publicservice.go.ke','Reviewer','Quality Assurance'],['System Administrator','admin@publicservice.go.ke','Administrator','ICT'],['John Kamau','john.kamau@publicservice.go.ke','Research Officer','HR Research'],['Faith Njeri','faith.njeri@publicservice.go.ke','Reviewer','Governance']]
await transaction(async client=>{
  for(const [name,email,role,division] of users)await client.query('INSERT INTO users(name,email,password_hash,role,division) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,division=EXCLUDED.division',[name,email,hash,role,division])
  const manager=(await client.query("SELECT id FROM users WHERE email='mary.wanjiku@publicservice.go.ke'")).rows[0]
  const seeds=[
    ['Policy Review on Performance Management','Review the evidence matrix and prepare recommendations.','HR Policy & Governance','In Progress','2026-08-02','dominic.kibet@publicservice.go.ke'],
    ['Public Service Digital Transformation','Research digital transformation practices across public institutions.','Digital Government','In Progress','2026-08-10','john.kamau@publicservice.go.ke'],
    ['Establishment Register Analysis','Analyse establishment register data and prepare the validation report.','Establishment Management','Ready for Review','2026-08-15','grace.muturi@publicservice.go.ke']
  ]
  for(const [title,description,division,status,dueDate,email] of seeds){
    let assignment=(await client.query('SELECT id FROM assignments WHERE title=$1',[title])).rows[0]
    if(!assignment)assignment=(await client.query('INSERT INTO assignments(title,description,division,status,due_date,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[title,description,division,status,dueDate,manager.id])).rows[0]
    const member=(await client.query('SELECT id FROM users WHERE email=$1',[email])).rows[0]
    await client.query('INSERT INTO assignment_members(assignment_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[assignment.id,member.id])
  }
  if(!(await client.query('SELECT 1 FROM alerts LIMIT 1')).rowCount)await client.query("INSERT INTO alerts(title,body,severity,created_by) VALUES('Quarterly research review','Quarterly research review meeting is scheduled for 6 August 2026.','Important',$1)",[manager.id])
})
console.log('PSC App2 database is ready.');await db.end()
