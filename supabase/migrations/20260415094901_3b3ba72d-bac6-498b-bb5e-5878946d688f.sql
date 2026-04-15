
-- Add end_date and requires_confirmation to intranet_messages
ALTER TABLE public.intranet_messages
  ADD COLUMN end_date date,
  ADD COLUMN requires_confirmation boolean NOT NULL DEFAULT false;

-- Drop the old unique constraint that limits one message per org+date
ALTER TABLE public.intranet_messages
  DROP CONSTRAINT IF EXISTS intranet_messages_organization_id_message_date_key;

-- Create confirmations table
CREATE TABLE public.intranet_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.intranet_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

ALTER TABLE public.intranet_confirmations ENABLE ROW LEVEL SECURITY;

-- Org members can view confirmations for messages in their org
CREATE POLICY "Org members can view confirmations"
  ON public.intranet_confirmations
  FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT im.id FROM public.intranet_messages im
      WHERE im.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

-- Authenticated users can insert their own confirmation
CREATE POLICY "Users can confirm messages"
  ON public.intranet_confirmations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND message_id IN (
      SELECT im.id FROM public.intranet_messages im
      WHERE im.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

-- Users can delete their own confirmation (un-confirm)
CREATE POLICY "Users can delete own confirmation"
  ON public.intranet_confirmations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
