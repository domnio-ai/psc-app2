import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('app shell does not mount legacy detail panels beneath dashboard cards', () => {
 const source=fs.readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8');
 const tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const forbidden=new Set(['management-area','primary-grid','panel dashboard-research-status','bottom-grid','deadline-summary-grid']);
 let cards=0;
 function visit(node){
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   for(const attr of node.attributes.properties){
    if(attr.name?.getText(tree)==='className'&&attr.initializer&&ts.isStringLiteral(attr.initializer))assert.ok(!forbidden.has(attr.initializer.text),`Legacy panel mounted: ${attr.initializer.text}`);
   }
   if(node.tagName.getText(tree)==='ProgressiveDashboard')cards++;
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);
 assert.equal(cards,1);
 assert.match(source,/<div\s+hidden=\{active !== "Dashboard"\}>[\s\S]*?<ProgressiveDashboard/);
 assert.match(source,/<AssignmentsControlCentreEntry/);
 assert.match(source,/<TasksWorkspaceEntry/);
 assert.ok(!source.includes('© 2026 Public Service Commission'));
});
