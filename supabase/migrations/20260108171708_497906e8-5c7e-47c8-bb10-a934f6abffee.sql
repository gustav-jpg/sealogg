DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deviations_created_by_fkey' AND conrelid = 'public.deviations'::regclass
  ) THEN
    ALTER TABLE public.deviations
      ADD CONSTRAINT deviations_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fault_cases_created_by_fkey' AND conrelid = 'public.fault_cases'::regclass
  ) THEN
    ALTER TABLE public.fault_cases
      ADD CONSTRAINT fault_cases_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deviation_actions_created_by_fkey' AND conrelid = 'public.deviation_actions'::regclass
  ) THEN
    ALTER TABLE public.deviation_actions
      ADD CONSTRAINT deviation_actions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deviation_responses_responded_by_fkey' AND conrelid = 'public.deviation_responses'::regclass
  ) THEN
    ALTER TABLE public.deviation_responses
      ADD CONSTRAINT deviation_responses_responded_by_fkey
      FOREIGN KEY (responded_by) REFERENCES public.profiles (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fault_comments_user_id_fkey' AND conrelid = 'public.fault_comments'::regclass
  ) THEN
    ALTER TABLE public.fault_comments
      ADD CONSTRAINT fault_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deviation_attachments_uploaded_by_fkey' AND conrelid = 'public.deviation_attachments'::regclass
  ) THEN
    ALTER TABLE public.deviation_attachments
      ADD CONSTRAINT deviation_attachments_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES public.profiles (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fault_attachments_uploaded_by_fkey' AND conrelid = 'public.fault_attachments'::regclass
  ) THEN
    ALTER TABLE public.fault_attachments
      ADD CONSTRAINT fault_attachments_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES public.profiles (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'control_point_attachments_uploaded_by_fkey' AND conrelid = 'public.control_point_attachments'::regclass
  ) THEN
    ALTER TABLE public.control_point_attachments
      ADD CONSTRAINT control_point_attachments_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES public.profiles (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'control_point_records_performed_by_fkey' AND conrelid = 'public.control_point_records'::regclass
  ) THEN
    ALTER TABLE public.control_point_records
      ADD CONSTRAINT control_point_records_performed_by_fkey
      FOREIGN KEY (performed_by) REFERENCES public.profiles (user_id);
  END IF;
END $$;