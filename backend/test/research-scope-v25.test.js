import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("research portfolio list has explicit personal, team and reviewer scopes", () => {
  assert.match(app, /String\(req\.query\.view\|\|'my'\)/);
  assert.match(app, /\['my','team','reviews'\]\.includes\(view\)/);
  assert.match(app, /const managed=await managedUserIds\(req\.user\)/);
  assert.match(app, /const teamIds=managed\.filter\(id=>id!==req\.user\.id\)/);
});

test("project-specific research routes have a universal access guard", () => {
  const guard = "app.use('/api/research/:id',authenticate,requireResearchProjectAccess)";
  assert.ok(app.includes(guard));
  assert.ok(app.indexOf(guard) < app.indexOf("app.patch('/api/research/:id/plan'"));
  assert.match(app, /await canAccessResearch\(req\.user,req\.params\.id\)/);
});


test("My Research and My Reviews are distinct populated scopes", () => {
  const myStart = app.indexOf("if(view==='my')");
  const reviewsStart = app.indexOf("}else if(view==='reviews'){", myStart);
  const teamStart = app.indexOf("}else{", reviewsStart);

  const myBlock = app.slice(myStart, reviewsStart);
  const reviewsBlock = app.slice(reviewsStart, teamStart);

  assert.match(myBlock, /p\.lead_id=\$1/);
  assert.match(myBlock, /FROM research_collaborators rc/);
  assert.match(myBlock, /COALESCE\(rc\.role,'Researcher'\)<>'Reviewer'/);
  assert.doesNotMatch(myBlock, /FROM research_reviewers rr/);

  assert.match(reviewsBlock, /FROM research_reviewers rr/);
  assert.match(reviewsBlock, /rr\.reviewer_id=\$1/);
  assert.match(reviewsBlock, /rr\.active=TRUE/);
});
