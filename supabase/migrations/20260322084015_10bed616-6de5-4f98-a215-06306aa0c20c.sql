
CREATE TABLE public.invitation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed - only accessed by service role in edge functions
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;
