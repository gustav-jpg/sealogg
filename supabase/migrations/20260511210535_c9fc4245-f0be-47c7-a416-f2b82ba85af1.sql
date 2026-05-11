UPDATE public.checklist_executions
SET started_at = started_at - interval '52 days',
    completed_at = completed_at - interval '52 days',
    created_at = created_at - interval '52 days'
WHERE id IN (
  'b80c232f-c8e5-4fbd-aaca-7206a314792e',
  'd616b7a9-9772-437a-98f7-61b17e77462c',
  'b7383c49-404c-414e-b7ee-93745a19bd99'
);