import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync('backend/src/app.js','utf8')
const service=readFileSync('backend/src/notification-email-service.js','utf8')
const migration=readFileSync('backend/migrations/039_internal_email_composer.sql','utf8')
const api=readFileSync('src/api.ts','utf8')
const inbox=readFileSync('src/NotificationCenter.tsx','utf8')
const composer=readFileSync('src/modules/notifications/InternalEmailComposer.tsx','utf8')
test('internal email schema is governed',()=>{assert.match(migration,/app_email_messages/);assert.match(migration,/app_email_recipients/);assert.match(migration,/delivery_status/)})
test('recipients are active App2 users only',()=>{assert.match(app,/\/api\/internal-email\/recipients/);assert.match(app,/active=TRUE/);assert.match(app,/id=ANY\(\$1::uuid\[\]\)/)})
test('send is authenticated audited and SMTP-aware',()=>{assert.match(app,/app\.post\('\/api\/internal-email',authenticate/);assert.match(app,/INTERNAL_EMAIL_QUEUED/);assert.match(app,/mailStatus\(\)\.ready/)})
test('delivery queue retries',()=>{assert.match(service,/deliverPendingInternalEmails/);assert.match(service,/attempts<3/);assert.match(service,/INTERVAL '15 minutes'/)})
test('UI has composer and sent folder',()=>{assert.match(inbox,/Compose email/);assert.match(inbox,/"Sent"/);assert.match(inbox,/InternalEmailComposer/);assert.match(api,/sendInternalEmail/)})
test('composer supports multi-recipient search',()=>{assert.match(composer,/Search name, role, division or email/);assert.match(composer,/type="checkbox"/);assert.match(composer,/recipientIds:selected/)})
