import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildPulse} from "../src/pulse-model.js";

const app=fs.readFileSync("src/App.tsx","utf8");
const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");

const rec=(module,id,status,dueDate)=>({id,title:`${module}-${id}`,status,dueDate,module,type:module,destination:module});
const note=(id,read_at=null)=>({id,title:`N${id}`,body:"x",entity_type:"assignment",entity_id:`a${id}`,read_at,archived_at:null,created_at:"2026-09-13T08:00:00Z"});

test("every ordinary module count reconciles to its exact row bucket population",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([
    rec("Assignments","a1","Active","2026-09-18"),
    rec("Assignments","a2","Completed","2026-09-12"),
    rec("Tasks","t1","In Progress","2026-09-18"),
    rec("Tasks","t2","Changes Requested","2026-09-12"),
    rec("Research Repository","r1","Planning","2026-09-18"),
    rec("Research Repository","r2","Active","2026-09-12"),
    rec("Reports & Analytics","p1","Draft","2026-09-30"),
    rec("Document Repository","d1","Published",null),
    rec("Notice Board","n1","Important",null),
    rec("Team & Users","u1","Researcher",null),
  ],[],[],now);

  for(const [name,module] of Object.entries(pulse.modules)){
    for(const [bucket,count] of Object.entries(module.counts)){
      if(name==="Notifications") continue;
      const actual=module.rows.filter(r=>r.buckets.includes(bucket)).length;
      assert.equal(count,actual,`${name}:${bucket}`);
    }
  }
});

test("Notifications primary population is total records while unread remains a separate signal",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const pulse=buildPulse([],[
    note("1"),
    note("2","2026-09-13T08:30:00Z"),
  ],[],now);
  assert.equal(pulse.modules.Notifications.counts.All,2);
  assert.equal(pulse.modules.Notifications.counts.Unread,1);
  assert.equal(pulse.unread.length,1);
  assert.match(app,/label === "Notifications"[\s\S]*pulse\.data\?\.unread\.length/);
  assert.match(app,/pulse\.data\?\.modules\[label\]\?\.counts\?\.All/);
  assert.match(app,/const navigationCount =[\s\S]*modules\[label\]\?\.counts\?\.All/);
  assert.match(dashboard,/m==='Notifications'\?\`\$\{data\.unread\.length\} unread update/);
});

test("Calendar has an All card and All opens the same population as the landing card",()=>{
  assert.match(dashboard,/Calendar:\['All','Today','Next 7 days','Past Due'\]/);
  assert.match(dashboard,/\{All:data\.calendar\.length,\.\.\.data\.calendarCounts\}/);
  assert.match(dashboard,/label==='All'\|\|\(label==='Today'/);
  assert.match(dashboard,/m==='Calendar'\?data\.calendar\.length/);
});

test("Needs My Attention remains one governed deduplicated personal-action population",()=>{
  const now=new Date("2026-09-13T09:00:00+03:00");
  const rows=[
    {...rec("Tasks","t1","Changes Requested","2026-09-12"),destination:"Tasks",owned:true,reviewKind:"Task Report"},
    {...rec("Reviews & Approvals","t1","Under Review","2026-09-12"),destination:"Tasks",myReview:true,reviewKind:"Task Report"},
  ];
  const pulse=buildPulse(rows,[],[],now);
  assert.equal(pulse.attention.length,1);
  assert.ok(pulse.attention[0].buckets.includes("Returned to Me"));
  assert.ok(pulse.attention[0].buckets.includes("My Reviews"));
  assert.match(app,/label === "Needs My Attention"[\s\S]*pulse\.data\?\.attention\.length/);
});

test("dashboard child-card drilldowns remain row-backed and select records directly",()=>{
  assert.match(dashboard,/const matchingRows=label==='All'\?sourceRows/);
  assert.match(dashboard,/visibleCounts\?Object\.entries\(visibleCounts\)\.map/);
  assert.match(dashboard,/const openCard = \(\) =>/);
  assert.match(dashboard,/items:recordItems/);
  assert.match(dashboard,/onOpenTaskDashboardShortcut/);
  assert.doesNotMatch(dashboard,/setBucket|openRows|dashboard-drilldown-records/);
});
