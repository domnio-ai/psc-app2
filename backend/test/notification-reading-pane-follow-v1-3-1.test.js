import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const inbox=readFileSync("src/NotificationCenter.tsx","utf8");
const css=readFileSync("src/notifications.css","utf8");
const shell=readFileSync("src/app-shell.css","utf8");

test("reading pane automatically follows first visible notification",()=>{
  assert.match(inbox,/useEffect\(\(\) => \{/);
  assert.match(inbox,/!selected \|\| !visible\.some/);
  assert.match(inbox,/setSelected\(visible\[0\]\)/);
});

test("current selection survives while it remains in the visible result set",()=>{
  assert.match(inbox,/visible\.some\(\(item\) => item\.id === selected\.id\)/);
});

test("changing folder search or priority can move preview to the first valid result",()=>{
  assert.match(inbox,/\}, \[items, folder, priority, query\]\);/);
  assert.match(inbox,/\}, \[visible, selected, folder\]\);/);
});

test("selected message row exposes explicit selected state",()=>{
  assert.match(inbox,/data-selected=/);
  assert.match(inbox,/notification-row-\$\{item\.id\}/);
});

test("desktop reading pane stays visible beside the current message list",()=>{
  assert.match(css,/READING PANE FOLLOW/);
  assert.match(css,/position:sticky/);
  assert.match(css,/height:calc\(100vh - 220px\)/);
  assert.match(css,/align-self:start/);
  assert.match(css,/@media\(max-width:900px\)/);
});

test("opening a notification preserves the desktop folder rail and message list",()=>{
  assert.doesNotMatch(css,/\.notification-message-open \.notification-folder-rail[\s\S]*?display:none/);
  assert.doesNotMatch(css,/\.notification-message-open \.notification-message-column\s*\{\s*display:none/);
  assert.match(css,/\.notification-mailbox-grid\{[\s\S]*?grid-template-columns:170px minmax\(340px,\.9fr\) minmax\(330px,1\.1fr\)/);
});

test("selected notification preview flows across the full row on compact screens",()=>{
  assert.match(css,/\.notification-message-open \.notification-reading-pane\{[^}]*grid-column:1\/-1/);
});

test("main content uses its grid track instead of adding viewport width beside the sidebar",()=>{
  assert.match(shell,/\.app-shell>main\{min-width:0;width:auto/);
});
