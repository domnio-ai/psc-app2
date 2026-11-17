import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, '..');
const projectRoot = path.resolve(backendRoot, '..');
const appSource = await readFile(path.join(backendRoot, 'src', 'app.js'), 'utf8');
const workspaceSource = await readFile(path.join(projectRoot, 'src', 'modules', 'research', 'components', 'ResearchReportWorkspace.tsx'), 'utf8');
const routeStart = appSource.indexOf("'/api/research/:id/report/:sectionId'");
const routeEnd = appSource.indexOf("app.get('/api/research/:id/report/versions'", routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, 'Research report section route boundaries must exist');
const routeSource = appSource.slice(routeStart, routeEnd);

test('Research section JSON requests use the large-report parser', () => {
  assert.ok(appSource.includes("const isResearchReportSectionBody=/^\\/api\\/research\\/[^/]+\\/report\\/[^/]+$/.test(req.path)"));
  assert.ok(appSource.includes('isTaskReportBody||isResearchReportSectionBody'));
  assert.ok(appSource.includes("const taskReportJsonBodyParser=express.json({limit:'32mb'})"));
});

test('Research section content supports large rich-text sections without truncation', () => {
  assert.match(routeSource, /content\s*:\s*z\.string\(\)\.max\(5000000\)\.optional\(\)/);
  assert.doesNotMatch(routeSource, /content\s*:\s*z\.string\(\)\.max\(100000\)\.optional\(\)/);
});

test('Research editor makes serialized HTML size visible separately from readable text', () => {
  assert.ok(workspaceSource.includes('text characters'));
  assert.ok(workspaceSource.includes('editor HTML characters'));
  assert.ok(workspaceSource.includes('props.value.length.toLocaleString()'));
});
