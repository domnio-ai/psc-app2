import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildPulse} from "../src/pulse-model.js";

const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");

const research=(id,status,dueDate)=>({id,title:id,status,dueDate,module:"Research Repository",type:"Research Project",destination:"Research Repository"});
const task=(id,status,dueDate)=>({id,title:id,status,dueDate,module:"Tasks",type:"Task",destination:"Tasks"});

test("Research Active is status-specific while Current is the umbrella open-work bucket",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([
    research("planning","Planning","2026-09-30"),
    research("active","Active","2026-09-30"),
    research("review","Under Review","2026-09-30"),
  ],[],[],now);
  const m=pulse.modules["Research Repository"];
  assert.equal(m.counts.Current,3);
  assert.equal(m.counts.Planning,1);
  assert.equal(m.counts.Active,1);
  assert.equal(m.counts["Under Review"],1);
});

test("Research Due Soon and Overdue drilldown buckets reconcile exactly",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([
    research("soon","Active","2026-09-18"),
    research("late","Planning","2026-09-12"),
    research("later","Active","2026-10-01"),
  ],[],[],now);
  const rows=pulse.modules["Research Repository"].rows;
  for(const bucket of ["Current","Active","Planning","Due Soon","Overdue"]){
    const actual=rows.filter(r=>r.buckets.includes(bucket)).length;
    assert.equal(pulse.modules["Research Repository"].counts[bucket]||0,actual,bucket);
  }
  assert.equal(pulse.modules["Research Repository"].counts["Due Soon"],1);
  assert.equal(pulse.modules["Research Repository"].counts.Overdue,1);
});

test("Non-research dashboard bucket semantics are preserved",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([task("t1","In Progress","2026-09-18")],[],[],now);
  const m=pulse.modules.Tasks;
  assert.equal(m.counts.Active,1);
  assert.equal(m.counts["Almost Due"],1);
  assert.equal(m.counts["In Progress"],1);
});

test("Main Dashboard exposes Research drilldown cards that match the governed research states",()=>{
  for(const label of ["Current","Planning","Active","Under Review","Changes Requested","Ready to Publish","Due Soon","Overdue"]){
    assert.ok(dashboard.includes(`'${label}'`),label);
  }
  assert.match(dashboard,/matchingRows\.map/);
  assert.doesNotMatch(dashboard,/matches card|setBucket/);
  assert.ok(dashboard.includes("authorised scope"));
});

test("Main Dashboard drilldown remains row-backed rather than recomputing card contents",()=>{
  assert.match(dashboard,/const matchingRows=label==='All'\?sourceRows/);
  assert.match(dashboard,/items:recordItems/);
  assert.doesNotMatch(dashboard,/openRows|setBucket/);
});
