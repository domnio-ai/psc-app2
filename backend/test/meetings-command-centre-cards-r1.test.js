import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync('src/modules/meetings/MeetingsWorkspace.tsx', 'utf8');
const meetingsApi = readFileSync('src/modules/meetings/meetingsApi.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const css = readFileSync('src/modules/meetings/meetings-command-centre.css', 'utf8');

test('command centre exposes eight meaningful meeting metrics', () => {
  for (const label of ['Upcoming meetings','Awaiting my approval','Needs Preparation','Meeting notifications','My Meetings','Minutes Review','Open Actions','Completed meetings']) {
    assert.ok(workspace.includes(label), `missing command-centre card label: ${label}`);
  }
});

test('approval and notification card counts come from existing App2 APIs and handle unavailable data honestly', () => {
  assert.match(meetingsApi, /pendingScheduleApprovals:\s*\(token: string\)/);
  assert.match(meetingsApi, /meetingNotifications:\s*\(token: string\).*?"\/notifications"/s);
  assert.match(workspace, /pendingScheduleApprovalsCount === null \? "—"/);
  assert.match(workspace, /unreadMeetingNotifications === null \? "—"/);
  assert.match(workspace, /!item\.read_at && !item\.archived_at/);
});

test('cards link to the shared approval centre and notifications inbox', () => {
  assert.match(app, /onApprovals=\{\(\)\s*=>\s*navigateTo\("Reviews & Approvals"\)\}/);
  assert.match(app, /onNotifications=\{\(\)\s*=>\s*navigateTo\("Notifications"\)\}/);
  assert.match(workspace, /INVITATIONS & ATTENDANCE/);
  assert.match(workspace, /participantStats\.accepted/);
  assert.match(workspace, /selected\.schedule_approval_status/);
  assert.match(css, /APP2_MEETINGS_COMMAND_CARDS_R1/);
});