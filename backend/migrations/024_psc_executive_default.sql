BEGIN;
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_theme_mode_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_theme_mode_check
  CHECK(theme_mode IN('Dark','Light','System','Gold Grey','Navy Blue','PSC Slate','Low-Contrast Navy','Executive Gold','Sage Ivory'));
ALTER TABLE user_preferences ALTER COLUMN theme_mode SET DEFAULT 'Executive Gold';
COMMIT;
