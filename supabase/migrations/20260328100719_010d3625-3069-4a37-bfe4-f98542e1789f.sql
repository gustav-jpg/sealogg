
-- Enum for pending registration status
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected');

-- Table: organization_registration_codes
CREATE TABLE public.organization_registration_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT code_format CHECK (code ~ '^\d{4}$'),
  UNIQUE (code)
);

ALTER TABLE public.organization_registration_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage their codes"
  ON public.organization_registration_codes
  FOR ALL
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- Table: pending_registrations
CREATE TABLE public.pending_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status registration_status NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  assigned_role public.org_role,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pending registration"
  ON public.pending_registrations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pending registration"
  ON public.pending_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Org admins can read pending registrations for their org"
  ON public.pending_registrations
  FOR SELECT
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can update pending registrations for their org"
  ON public.pending_registrations
  FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- Table: pending_certificates
CREATE TABLE public.pending_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.pending_registrations(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  ai_suggested_type text,
  ai_suggested_expiry date,
  ai_confidence numeric,
  confirmed_type_id uuid REFERENCES public.certificate_types(id),
  confirmed_expiry date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pending certificates"
  ON public.pending_certificates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pending_registrations pr
      WHERE pr.id = registration_id AND pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pending_registrations pr
      WHERE pr.id = registration_id AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage pending certificates for their org"
  ON public.pending_certificates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pending_registrations pr
      WHERE pr.id = registration_id
        AND public.is_org_admin(auth.uid(), pr.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pending_registrations pr
      WHERE pr.id = registration_id
        AND public.is_org_admin(auth.uid(), pr.organization_id)
    )
  );

-- Storage bucket for registration certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('registration-certificates', 'registration-certificates', false);

-- Storage policies for registration-certificates bucket
CREATE POLICY "Authenticated users can upload registration certificates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'registration-certificates');

CREATE POLICY "Users can read own registration certificates"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'registration-certificates'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid() AND om.role = 'org_admin'
      )
    )
  );
