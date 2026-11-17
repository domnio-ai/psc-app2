import {transaction} from '../db.js'

const sql=`
CREATE TABLE IF NOT EXISTS meeting_conference_sessions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL DEFAULT 'jitsi',
  provider_base_url text NOT NULL,
  room_code varchar(180) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'Ready' CHECK(status IN('Ready','Live','Ended')),
  created_by uuid NOT NULL REFERENCES users(id),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meeting_conference_sessions_meeting ON meeting_conference_sessions(meeting_id,created_at DESC);
CREATE TABLE IF NOT EXISTS meeting_conference_presence(
  session_id uuid NOT NULL REFERENCES meeting_conference_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  left_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY(session_id,user_id)
);
`
try{await transaction(async client=>client.query(sql));console.log('MEETINGS V2 LIVE CONFERENCE MIGRATION APPLIED');process.exit(0)}catch(error){console.error(error);process.exit(1)}
