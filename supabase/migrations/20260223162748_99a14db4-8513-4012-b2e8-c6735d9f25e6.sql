
-- 1. Extend organization_settings
ALTER TABLE public.organization_settings 
  ADD COLUMN IF NOT EXISTS documents_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storage_quota_mb integer NOT NULL DEFAULT 500;

-- 2. Document folders (recursive)
CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_folder_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_folders_org ON public.document_folders(organization_id);
CREATE INDEX idx_doc_folders_parent ON public.document_folders(parent_folder_id);
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

-- 3. Folder access table (before function that references it)
CREATE TABLE public.document_folder_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(folder_id, profile_id)
);
CREATE INDEX idx_doc_folder_access_folder ON public.document_folder_access(folder_id);
CREATE INDEX idx_doc_folder_access_profile ON public.document_folder_access(profile_id);
ALTER TABLE public.document_folder_access ENABLE ROW LEVEL SECURITY;

-- 4. Recursive access check function
CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE folder_chain AS (
    SELECT id, parent_folder_id, organization_id
    FROM document_folders
    WHERE id = _folder_id
    UNION ALL
    SELECT df.id, df.parent_folder_id, df.organization_id
    FROM document_folders df
    JOIN folder_chain fc ON df.id = fc.parent_folder_id
  )
  SELECT EXISTS (
    SELECT 1 FROM folder_chain fc
    JOIN document_folder_access dfa ON dfa.folder_id = fc.id
    WHERE dfa.profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = _user_id)
  )
  OR EXISTS (
    SELECT 1 FROM folder_chain fc
    JOIN organization_members om ON om.organization_id = fc.organization_id
    WHERE om.user_id = _user_id AND om.role = 'org_admin'::org_role
  )
  OR EXISTS (
    SELECT 1 FROM superadmins WHERE user_id = _user_id
  );
$$;

-- 5. Folder policies
CREATE POLICY "Org admins can manage document folders"
  ON public.document_folders FOR ALL
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));

CREATE POLICY "Users can view accessible folders"
  ON public.document_folders FOR SELECT
  USING (has_folder_access(auth.uid(), id));

-- 6. Document files
CREATE TABLE public.document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_files_folder ON public.document_files(folder_id);
CREATE INDEX idx_doc_files_org ON public.document_files(organization_id);
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage document files"
  ON public.document_files FOR ALL
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));

CREATE POLICY "Users can view files in accessible folders"
  ON public.document_files FOR SELECT
  USING (has_folder_access(auth.uid(), folder_id));

-- 7. Folder access policies
CREATE POLICY "Org admins can manage folder access"
  ON public.document_folder_access FOR ALL
  USING (folder_id IN (SELECT df.id FROM document_folders df WHERE is_org_admin(auth.uid(), df.organization_id) OR is_superadmin(auth.uid())))
  WITH CHECK (folder_id IN (SELECT df.id FROM document_folders df WHERE is_org_admin(auth.uid(), df.organization_id) OR is_superadmin(auth.uid())));

CREATE POLICY "Users can see own folder access"
  ON public.document_folder_access FOR SELECT
  USING (profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()));

-- 8. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('org-documents', 'org-documents', false);

CREATE POLICY "Upload org documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'org-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Delete org documents" ON storage.objects FOR DELETE
  USING (bucket_id = 'org-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Read org documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'org-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Update org documents" ON storage.objects FOR UPDATE
  USING (bucket_id = 'org-documents' AND auth.uid() IS NOT NULL);

-- 9. Triggers
CREATE TRIGGER update_document_files_updated_at
  BEFORE UPDATE ON public.document_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
