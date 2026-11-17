import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildPulse} from "../src/pulse-model.js";

const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");
const service=fs.readFileSync("backend/src/pulse-service.js","utf8");
const row=(module,id,status,dueDate,extra={})=>({id,title:`${module}-${id}`,status,dueDate,module,type:module,destination:module,...extra});

test("Needs My Attention excludes terminal and approved items even when legacy needsAction is true",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([
    row("Reports & Analytics","approved","Approved","2026-09-10",{owned:true,needsAction:true}),
    row("Tasks","done","Completed","2026-09-10",{owned:true,needsAction:true}),
    row("Document Repository","published","Published","2026-09-10",{owned:true,needsAction:true}),
  ],[],[],now);
  assert.equal(pulse.attention.length,0);
});

test("Newly Assigned is personal and clears when work starts",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([
    row("Tasks","mine-new","Assigned","2026-09-30",{owned:true}),
    row("Tasks","team-new","Assigned","2026-09-30",{owned:false}),
    row("Tasks","mine-started","In Progress","2026-09-30",{owned:true}),
    row("Research Repository","mine-plan","Planning","2026-09-30",{owned:true}),
  ],[],[],now);
  assert.deepEqual(new Set(pulse.attention.map(r=>r.id)),new Set(["mine-new","mine-plan"]));
  for(const item of pulse.attention) assert.ok(item.buckets.includes("Newly Assigned"));
});

test("personal overdue due-soon returned and assigned reviews are categorized",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([
    row("Tasks","late","In Progress","2026-09-12",{owned:true}),
    row("Assignments","soon","Active","2026-09-18",{owned:true}),
    row("Tasks","returned","Changes Requested","2026-09-30",{owned:true}),
    row("Reviews & Approvals","review","Under Review","2026-09-30",{myReview:true,reviewKind:"Task Report"}),
  ],[],[],now);
  const byId=Object.fromEntries(pulse.attention.map(r=>[r.id,r]));
  assert.ok(byId.late.buckets.includes("Overdue"));
  assert.ok(byId.soon.buckets.includes("Due Soon"));
  assert.ok(byId.returned.buckets.includes("Returned to Me"));
  assert.ok(byId.review.buckets.includes("My Reviews"));
});

test("manager team items do not enter personal attention unless the manager owns or reviews them",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([
    row("Tasks","team-overdue","In Progress","2026-09-12",{owned:false}),
    row("Tasks","my-overdue","In Progress","2026-09-12",{owned:true}),
    row("Reviews & Approvals","my-review","Under Review","2026-09-30",{owned:false,myReview:true}),
  ],[],[],now);
  assert.deepEqual(new Set(pulse.attention.map(r=>r.id)),new Set(["my-overdue","my-review"]));
});

test("attention category definitions feed the direct selection chooser",()=>{
  assert.match(dashboard,/'Needs My Attention':\['All','Newly Assigned','Overdue','Due Soon','Returned to Me','My Reviews'\]/);
  assert.match(dashboard,/const attentionMatches=/);
  assert.match(dashboard,/openModuleActionPicker/);
  assert.match(dashboard,/items:recordItems/);
  assert.doesNotMatch(dashboard,/openRows|setBucket|dashboard-drilldown-records/);
});

test("pulse service marks personal ownership for assignment research report and repository records",()=>{
  assert.match(service,/assignment_members ownm[\s\S]*ownm\.user_id=\$3\) owned/);
  assert.match(service,/research_collaborators ownc[\s\S]*ownc\.user_id=\$3\)\) owned/);
  assert.match(service,/d\.created_by=\$3 owned/);
  assert.match(service,/k\.created_by=\$3 owned/);
});
