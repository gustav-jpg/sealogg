
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_fault_comment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_fault_assigned boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_fault_comment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_fault_assigned boolean NOT NULL DEFAULT true;
