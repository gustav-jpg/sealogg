
-- Attach the existing notify_fault_comment_mentions function to fault_comments
CREATE TRIGGER on_fault_comment_insert_notify
  AFTER INSERT ON public.fault_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_fault_comment_mentions();

-- Also ensure the fault_assigned trigger exists on fault_cases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'fault_cases'
      AND trigger_name = 'on_fault_assigned_notify'
  ) THEN
    CREATE TRIGGER on_fault_assigned_notify
      AFTER UPDATE ON public.fault_cases
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_fault_assigned();
  END IF;
END $$;
