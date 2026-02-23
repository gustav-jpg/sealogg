
-- 1) Drop existing RLS policies on document_folder_access
DROP POLICY IF EXISTS "Org admins can manage folder access" ON document_folder_access;
DROP POLICY IF EXISTS "Users can see own folder access" ON document_folder_access;

-- 2) Drop existing foreign key and column, add role column
ALTER TABLE document_folder_access DROP COLUMN IF EXISTS profile_id;
ALTER TABLE document_folder_access ADD COLUMN role app_role NOT NULL;

-- 3) Add unique constraint to prevent duplicate role-folder entries
ALTER TABLE document_folder_access ADD CONSTRAINT document_folder_access_folder_role_unique UNIQUE (folder_id, role);

-- 4) Recreate RLS policies
CREATE POLICY "Org admins can manage folder access"
ON document_folder_access
FOR ALL
USING (
  folder_id IN (
    SELECT df.id FROM document_folders df
    WHERE is_org_admin(auth.uid(), df.organization_id) OR is_superadmin(auth.uid())
  )
)
WITH CHECK (
  folder_id IN (
    SELECT df.id FROM document_folders df
    WHERE is_org_admin(auth.uid(), df.organization_id) OR is_superadmin(auth.uid())
  )
);

CREATE POLICY "Users can see folder access for their org"
ON document_folder_access
FOR SELECT
USING (
  folder_id IN (
    SELECT df.id FROM document_folders df
    WHERE df.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- 5) Update has_folder_access function to use role-based access
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
  SELECT
    -- Check if any of the user's roles match folder access in the chain
    EXISTS (
      SELECT 1 FROM folder_chain fc
      JOIN document_folder_access dfa ON dfa.folder_id = fc.id
      JOIN user_roles ur ON ur.role = dfa.role
      WHERE ur.user_id = _user_id
    )
    -- Org admins always have access
    OR EXISTS (
      SELECT 1 FROM folder_chain fc
      JOIN organization_members om ON om.organization_id = fc.organization_id
      WHERE om.user_id = _user_id AND om.role = 'org_admin'::org_role
    )
    -- Superadmins always have access
    OR EXISTS (
      SELECT 1 FROM superadmins WHERE user_id = _user_id
    );
$$;
