
-- es_settings: byt primärnyckel från organization_id till id, så vi kan ha en global rad (org NULL).
ALTER TABLE public.es_settings DROP CONSTRAINT IF EXISTS es_settings_pkey;
ALTER TABLE public.es_settings ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.es_settings ADD CONSTRAINT es_settings_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS es_settings_org_unique ON public.es_settings (organization_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS es_settings_global_unique ON public.es_settings ((organization_id IS NULL)) WHERE organization_id IS NULL;
ALTER TABLE public.es_settings ALTER COLUMN organization_id DROP NOT NULL;

-- Övriga kataloger
ALTER TABLE public.es_categories ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.es_products ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.es_suppliers ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.es_supplier_users ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.es_supplier_orders ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.es_warehouses ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.es_inventory_moves ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.es_freight_rules ALTER COLUMN organization_id DROP NOT NULL;

DO $$
DECLARE
  t text;
  global_tables text[] := ARRAY[
    'es_categories','es_products','es_product_variants','es_product_images',
    'es_product_documents','es_product_bundles','es_product_related','es_product_suppliers',
    'es_suppliers','es_supplier_users','es_supplier_orders',
    'es_warehouses','es_inventory_levels','es_inventory_moves',
    'es_freight_rules','es_settings'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY global_tables LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_read_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()))',
      t || '_superadmin_write', t
    );
  END LOOP;
END $$;
