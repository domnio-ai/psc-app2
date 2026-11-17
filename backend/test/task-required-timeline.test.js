import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const backend = fs.readFileSync('backend/src/app.js', 'utf8');
const ui = fs.readFileSync('src/modules/tasks/TasksWorkspaceEntry.tsx', 'utf8');

test('new direct Task creation requires start and due dates at the backend', () => {
  assert.match(backend, /const assignmentTaskBaseSchema=z\.object\(\{/);
  assert.match(backend, /const assignmentTaskSchema=assignmentTaskBaseSchema\.superRefine\(governedDatePair\)/);
  assert.match(backend, /const assignmentTaskCreationSchema=assignmentTaskBaseSchema\.extend\(\{startDate:governedDate\.unwrap\(\),dueDate:governedDate\.unwrap\(\)\}\)\.superRefine\(governedDatePair\)/);
  assert.match(backend, /app\.post\('\/api\/assignments\/:id\/tasks',authenticate,validate\(assignmentTaskCreationSchema\)/);
});

test('Task Request approval requires both dates and keeps due date on or after start', () => {
  assert.match(backend, /if\(value\.decision==='Approved'\)\{[\s\S]*if\(!value\.startDate\)[\s\S]*if\(!value\.dueDate\)/);
  assert.match(backend, /Choose a task start date before approval/);
  assert.match(backend, /Choose a task due date before approval/);
  assert.match(backend, /Due date cannot be before the start date\./);
});

test('management direct-assignment form collects a required start and due date', () => {
  assert.match(ui, /const emptyDirectAssignment = \(\) => \(\{[\s\S]*startDate: today\(\),[\s\S]*dueDate: ""/);
  assert.match(ui, /startDate: directAssignDraft\.startDate,[\s\S]*dueDate: directAssignDraft\.dueDate/);
  assert.match(ui, /Start date<input type="date" required min=\{today\(\)\}/);
  assert.match(ui, /Due date<input type="date" required min=\{directAssignDraft\.startDate \|\| today\(\)\}/);
});

test('supervisor approval form requires a valid task start/due date pair', () => {
  assert.match(ui, /Choose a task start date and a due date on or after the start date\./);
  assert.match(ui, /required\s+min=\{today\(\)\}\s+value=\{approvalDraft\.startDate\}/);
  assert.match(ui, /required\s+min=\{approvalDraft\.startDate \|\| today\(\)\}\s+value=\{approvalDraft\.dueDate\}/);
});

test('updating an existing Task retains the backward-compatible schema for legacy records', () => {
  assert.match(backend, /app\.patch\('\/api\/assignments\/:id\/tasks\/:taskId',authenticate,validate\(assignmentTaskSchema\)/);
  assert.match(backend, /startDate:governedDate\.default\(null\),[\s\S]*dueDate:governedDate\.default\(null\)/);
  assert.match(backend, /const assignmentTaskSchema=assignmentTaskBaseSchema\.superRefine\(governedDatePair\)/);
});
