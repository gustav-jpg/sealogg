-- Add digest frequency column
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS digest_frequency TEXT NOT NULL DEFAULT 'daily' 
CHECK (digest_frequency IN ('daily', 'weekly'));

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;