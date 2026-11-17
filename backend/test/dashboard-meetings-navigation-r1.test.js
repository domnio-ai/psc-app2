/* APP2_DASHBOARD_MEETINGS_NAVIGATION_R1 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

test("dashboard landing includes Meetings and omits only the Needs My Attention landing card", () => {
  const start = dashboard.indexOf('className="pulse-card-first-grid module-kpi-strip dashboard-task-command-kpis"');
  assert.notEqual(start, -1, "canonical dashboard card grid must exist");
  const end = dashboard.indexOf("</section>", start);
  assert.notEqual(end, -1, "dashboard card grid must close");
  const landing = dashboard.slice(start, end);
  const listStart = dashboard.indexOf("{[", start);
  const listEnd = dashboard.indexOf("].filter(value=>canSee(value)).map(m=>{", listStart);
  assert.notEqual(listStart, -1, "dashboard card array must exist");
  assert.notEqual(listEnd, -1, "dashboard card list must end before card rendering");
  const cardList = dashboard.slice(listStart, listEnd);

  assert.match(cardList, /'Meetings'/, "Meetings must be offered as a landing card");
  assert.doesNotMatch(cardList, /'Needs My Attention'/, "Needs My Attention must not occupy a landing card");
  assert.match(landing, /m==='Meetings'\?'Open':/, "Meetings must not show a fabricated numeric zero");
  assert.match(landing, /m==='Meetings'\?'Schedule meetings, agendas, minutes and decisions'/);
  assert.match(landing, /onClick=\{\(\)=>m==='Meetings'\?onNavigate\('Meetings'\):/, "Meetings must open its exact workspace directly");
});

test("the existing attention/review model and Meetings workspace mount remain available", () => {
  assert.match(dashboard, /const filters:Record<string,string\[\]>=\{'Needs My Attention'/);
  assert.match(dashboard, /const modules=\[[\s\S]*?'Meetings'/);
  assert.match(dashboard, /'Needs My Attention':\{eyebrow:'Immediate action'/);
  assert.match(dashboard, /openFullWorkspace=\(value:string\)=>onNavigate\(value==='Needs My Attention'\?'Reviews & Approvals':value\)/);
  assert.match(app, /const MeetingsWorkspace = lazy\(\(\) => import\("\.\/modules\/meetings\/MeetingsWorkspace"\)\);/);
  assert.match(app, /MeetingsWorkspace/);
  assert.match(app, /setActive\("Meetings"\)/);
});
