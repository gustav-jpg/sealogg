
-- ==========================================================
-- Reference data
-- ==========================================================
CREATE TABLE public.es_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.es_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX idx_es_categories_org ON public.es_categories(organization_id);

CREATE TABLE public.es_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address jsonb,
  lead_time_days integer NOT NULL DEFAULT 5,
  min_order_value numeric(12,2) NOT NULL DEFAULT 0,
  handling_fee numeric(12,2) NOT NULL DEFAULT 0,
  freight_markup_pct numeric(5,2) NOT NULL DEFAULT 0,
  dropship_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_suppliers_org ON public.es_suppliers(organization_id);

CREATE TABLE public.es_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address jsonb,
  is_external boolean NOT NULL DEFAULT false,
  supplier_id uuid REFERENCES public.es_suppliers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_warehouses_org ON public.es_warehouses(organization_id);

-- ==========================================================
-- Products
-- ==========================================================
CREATE TABLE public.es_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.es_categories(id) ON DELETE SET NULL,
  primary_supplier_id uuid REFERENCES public.es_suppliers(id) ON DELETE SET NULL,
  brand text,
  weight_g integer,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  freight_class text,
  price_excl_vat numeric(12,2) NOT NULL DEFAULT 0,
  recommended_price numeric(12,2),
  purchase_price numeric(12,2),
  vat_rate numeric(5,2) NOT NULL DEFAULT 25,
  lead_time_days integer,
  is_active boolean NOT NULL DEFAULT true,
  dropship boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  attributes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku)
);
CREATE INDEX idx_es_products_org ON public.es_products(organization_id);
CREATE INDEX idx_es_products_category ON public.es_products(category_id);
CREATE INDEX idx_es_products_supplier ON public.es_products(primary_supplier_id);
CREATE INDEX idx_es_products_active ON public.es_products(organization_id, is_active);

CREATE TABLE public.es_product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_product_images_product ON public.es_product_images(product_id);

CREATE TABLE public.es_product_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  kind text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_product_documents_product ON public.es_product_documents(product_id);

CREATE TABLE public.es_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  price_excl_vat numeric(12,2),
  purchase_price numeric(12,2),
  attributes jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, sku)
);
CREATE INDEX idx_es_product_variants_product ON public.es_product_variants(product_id);

CREATE TABLE public.es_product_bundles (
  parent_product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  child_product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 1,
  PRIMARY KEY (parent_product_id, child_product_id)
);

CREATE TABLE public.es_product_related (
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, related_product_id)
);

CREATE TABLE public.es_product_suppliers (
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.es_suppliers(id) ON DELETE CASCADE,
  supplier_sku text,
  supplier_lead_time_days integer,
  supplier_price numeric(12,2),
  PRIMARY KEY (product_id, supplier_id)
);

CREATE TABLE public.es_favorites (
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ==========================================================
-- Inventory
-- ==========================================================
CREATE TABLE public.es_inventory_levels (
  warehouse_id uuid NOT NULL REFERENCES public.es_warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.es_product_variants(id) ON DELETE CASCADE,
  on_hand integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  warning_level integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, product_id, variant_id)
);

CREATE TABLE public.es_inventory_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.es_warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.es_product_variants(id) ON DELETE SET NULL,
  qty integer NOT NULL,
  reason text NOT NULL,
  ref_table text,
  ref_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_inv_moves_org ON public.es_inventory_moves(organization_id);
CREATE INDEX idx_es_inv_moves_product ON public.es_inventory_moves(product_id);

-- ==========================================================
-- Freight
-- ==========================================================
CREATE TABLE public.es_freight_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.es_suppliers(id) ON DELETE CASCADE,
  country text NOT NULL DEFAULT 'SE',
  postal_prefix text,
  rule_type text NOT NULL CHECK (rule_type IN ('fixed','weight','volume','free_over','manual')),
  params jsonb NOT NULL DEFAULT '{}',
  price_excl_vat numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_freight_rules_org ON public.es_freight_rules(organization_id);

-- ==========================================================
-- Cart
-- ==========================================================
CREATE TABLE public.es_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vessel_id uuid REFERENCES public.vessels(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_carts_user ON public.es_carts(user_id);
CREATE INDEX idx_es_carts_org ON public.es_carts(organization_id);

CREATE TABLE public.es_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.es_carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.es_product_variants(id) ON DELETE SET NULL,
  qty integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_cart_items_cart ON public.es_cart_items(cart_id);

-- ==========================================================
-- Orders
-- ==========================================================
CREATE TABLE public.es_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  order_number text NOT NULL,
  vessel_id uuid REFERENCES public.vessels(id) ON DELETE SET NULL,
  ordered_by uuid,
  status text NOT NULL DEFAULT 'mottagen'
    CHECK (status IN ('mottagen','bekraftad','packas','skickad','delvis_skickad','levererad','restnoterad','avslutad','avbruten')),
  currency text NOT NULL DEFAULT 'SEK',
  sub_total numeric(12,2) NOT NULL DEFAULT 0,
  freight_total numeric(12,2) NOT NULL DEFAULT 0,
  handling_total numeric(12,2) NOT NULL DEFAULT 0,
  vat_total numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  delivery_address jsonb,
  billing_address jsonb,
  internal_note text,
  customer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, order_number)
);
CREATE INDEX idx_es_orders_org ON public.es_orders(organization_id);
CREATE INDEX idx_es_orders_vessel ON public.es_orders(vessel_id);
CREATE INDEX idx_es_orders_status ON public.es_orders(organization_id, status);

CREATE TABLE public.es_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.es_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.es_products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.es_product_variants(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.es_suppliers(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.es_warehouses(id) ON DELETE SET NULL,
  qty integer NOT NULL,
  unit_price_excl_vat numeric(12,2) NOT NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 25,
  line_total_excl_vat numeric(12,2) NOT NULL,
  product_name_snapshot text NOT NULL,
  sku_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_order_items_order ON public.es_order_items(order_id);

CREATE TABLE public.es_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.es_orders(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.es_suppliers(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.es_warehouses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','packed','shipped','delivered','cancelled')),
  carrier text,
  tracking_no text,
  freight_excl_vat numeric(12,2) NOT NULL DEFAULT 0,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_shipments_order ON public.es_shipments(order_id);

CREATE TABLE public.es_shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.es_shipments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.es_order_items(id) ON DELETE CASCADE,
  qty integer NOT NULL
);
CREATE INDEX idx_es_shipment_items_shipment ON public.es_shipment_items(shipment_id);

CREATE TABLE public.es_supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.es_suppliers(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.es_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','confirmed','shipped','closed','cancelled')),
  external_ref text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_supplier_orders_org ON public.es_supplier_orders(organization_id);

CREATE TABLE public.es_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.es_orders(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','received','refunded','rejected')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_es_returns_order ON public.es_returns(order_id);

CREATE TABLE public.es_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.es_returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.es_order_items(id) ON DELETE CASCADE,
  qty integer NOT NULL
);

-- ==========================================================
-- Invoices
-- ==========================================================
CREATE TABLE public.es_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.es_orders(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  due_at date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','paid','cancelled','overdue')),
  pdf_url text,
  total_excl_vat numeric(12,2) NOT NULL DEFAULT 0,
  vat_total numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);
CREATE INDEX idx_es_invoices_org ON public.es_invoices(organization_id);

-- ==========================================================
-- Settings
-- ==========================================================
CREATE TABLE public.es_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_warehouse_id uuid REFERENCES public.es_warehouses(id) ON DELETE SET NULL,
  payment_terms_days integer NOT NULL DEFAULT 30,
  invoice_prefix text NOT NULL DEFAULT 'F',
  order_prefix text NOT NULL DEFAULT 'O',
  free_shipping_threshold numeric(12,2),
  currency text NOT NULL DEFAULT 'SEK',
  language text NOT NULL DEFAULT 'sv',
  contact_email text,
  default_vat_rate numeric(5,2) NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.es_supplier_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.es_suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, user_id)
);
CREATE INDEX idx_es_supplier_users_user ON public.es_supplier_users(user_id);

-- ==========================================================
-- Triggers
-- ==========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'es_categories','es_suppliers','es_warehouses','es_products','es_product_variants',
    'es_freight_rules','es_carts','es_orders','es_shipments','es_supplier_orders',
    'es_returns','es_invoices','es_settings'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t, t);
  END LOOP;
END$$;

CREATE TRIGGER trg_es_orders_audit AFTER INSERT OR UPDATE OR DELETE ON public.es_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();
CREATE TRIGGER trg_es_invoices_audit AFTER INSERT OR UPDATE OR DELETE ON public.es_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();
CREATE TRIGGER trg_es_inventory_moves_audit AFTER INSERT OR UPDATE OR DELETE ON public.es_inventory_moves
  FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();
CREATE TRIGGER trg_es_supplier_orders_audit AFTER INSERT OR UPDATE OR DELETE ON public.es_supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

-- ==========================================================
-- Order/invoice number generators
-- ==========================================================
CREATE OR REPLACE FUNCTION public.es_generate_order_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_prefix text; v_candidate text; v_attempts int := 0;
BEGIN
  IF NEW.order_number IS NOT NULL AND length(NEW.order_number) > 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(order_prefix,'O') INTO v_prefix FROM public.es_settings WHERE organization_id = NEW.organization_id;
  v_prefix := COALESCE(v_prefix,'O');
  LOOP
    v_candidate := v_prefix || '-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*9000+1000))::int::text,4,'0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.es_orders WHERE organization_id = NEW.organization_id AND order_number = v_candidate);
    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN RAISE EXCEPTION 'Could not generate unique order number'; END IF;
  END LOOP;
  NEW.order_number := v_candidate;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_es_orders_number BEFORE INSERT ON public.es_orders
  FOR EACH ROW EXECUTE FUNCTION public.es_generate_order_number();

CREATE OR REPLACE FUNCTION public.es_generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_prefix text; v_year text := to_char(COALESCE(NEW.issued_at, CURRENT_DATE),'YYYY'); v_next int;
BEGIN
  IF NEW.invoice_number IS NOT NULL AND length(NEW.invoice_number) > 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(invoice_prefix,'F') INTO v_prefix FROM public.es_settings WHERE organization_id = NEW.organization_id;
  v_prefix := COALESCE(v_prefix,'F');
  SELECT COALESCE(MAX( (regexp_replace(invoice_number, '^.*-', ''))::int ),0) + 1 INTO v_next
  FROM public.es_invoices WHERE organization_id = NEW.organization_id AND invoice_number LIKE v_prefix || '-' || v_year || '-%';
  NEW.invoice_number := v_prefix || '-' || v_year || '-' || lpad(v_next::text,5,'0');
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_es_invoices_number BEFORE INSERT ON public.es_invoices
  FOR EACH ROW EXECUTE FUNCTION public.es_generate_invoice_number();

CREATE OR REPLACE FUNCTION public.es_is_supplier_user(_user_id uuid, _supplier_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.es_supplier_users WHERE user_id = _user_id AND supplier_id = _supplier_id)
$$;

-- ==========================================================
-- Enable RLS
-- ==========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'es_categories','es_suppliers','es_warehouses','es_products','es_product_images',
    'es_product_documents','es_product_variants','es_product_bundles','es_product_related',
    'es_product_suppliers','es_favorites','es_inventory_levels','es_inventory_moves',
    'es_freight_rules','es_carts','es_cart_items','es_orders','es_order_items',
    'es_shipments','es_shipment_items','es_supplier_orders','es_returns','es_return_items',
    'es_invoices','es_settings','es_supplier_users'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END$$;

-- ==========================================================
-- Policies
-- ==========================================================
CREATE POLICY "es_categories read" ON public.es_categories FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) AND public.org_has_module(organization_id,'eshop'));
CREATE POLICY "es_categories write" ON public.es_categories FOR ALL USING (public.is_org_admin(auth.uid(), organization_id) AND public.org_has_module(organization_id,'eshop')) WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND public.org_has_module(organization_id,'eshop'));

CREATE POLICY "es_suppliers read" ON public.es_suppliers FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) AND public.org_has_module(organization_id,'eshop'));
CREATE POLICY "es_suppliers write" ON public.es_suppliers FOR ALL USING (public.is_org_admin(auth.uid(), organization_id) AND public.org_has_module(organization_id,'eshop')) WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND public.org_has_module(organization_id,'eshop'));

CREATE POLICY "es_warehouses read" ON public.es_warehouses FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) AND public.org_has_module(organization_id,'eshop'));
CREATE POLICY "es_warehouses write" ON public.es_warehouses FOR ALL USING (public.is_org_admin(auth.uid(), organization_id) AND public.org_has_module(organization_id,'eshop')) WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND public.org_has_module(organization_id,'eshop'));

CREATE POLICY "es_products read" ON public.es_products FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) AND public.org_has_module(organization_id,'eshop'));
CREATE POLICY "es_products write" ON public.es_products FOR ALL USING (public.is_org_admin(auth.uid(), organization_id) AND public.org_has_module(organization_id,'eshop')) WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND public.org_has_module(organization_id,'eshop'));

CREATE POLICY "es_product_images read" ON public.es_product_images FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND p.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_product_images write" ON public.es_product_images FOR ALL USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id)));

CREATE POLICY "es_product_documents read" ON public.es_product_documents FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND p.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_product_documents write" ON public.es_product_documents FOR ALL USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id)));

CREATE POLICY "es_product_variants read" ON public.es_product_variants FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND p.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_product_variants write" ON public.es_product_variants FOR ALL USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id)));

CREATE POLICY "es_product_bundles read" ON public.es_product_bundles FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = parent_product_id AND p.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_product_bundles write" ON public.es_product_bundles FOR ALL USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = parent_product_id AND public.is_org_admin(auth.uid(), p.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = parent_product_id AND public.is_org_admin(auth.uid(), p.organization_id)));

CREATE POLICY "es_product_related read" ON public.es_product_related FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND p.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_product_related write" ON public.es_product_related FOR ALL USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id)));

CREATE POLICY "es_product_suppliers read" ON public.es_product_suppliers FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND p.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_product_suppliers write" ON public.es_product_suppliers FOR ALL USING (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_products p WHERE p.id = product_id AND public.is_org_admin(auth.uid(), p.organization_id)));

CREATE POLICY "es_favorites self" ON public.es_favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "es_inventory_levels read" ON public.es_inventory_levels FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_warehouses w WHERE w.id = warehouse_id AND w.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_inventory_levels write" ON public.es_inventory_levels FOR ALL USING (EXISTS (SELECT 1 FROM public.es_warehouses w WHERE w.id = warehouse_id AND public.is_org_admin(auth.uid(), w.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_warehouses w WHERE w.id = warehouse_id AND public.is_org_admin(auth.uid(), w.organization_id)));

CREATE POLICY "es_inventory_moves read" ON public.es_inventory_moves FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "es_inventory_moves write" ON public.es_inventory_moves FOR ALL USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "es_freight_rules read" ON public.es_freight_rules FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "es_freight_rules write" ON public.es_freight_rules FOR ALL USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "es_carts self" ON public.es_carts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "es_cart_items self" ON public.es_cart_items FOR ALL USING (EXISTS (SELECT 1 FROM public.es_carts c WHERE c.id = cart_id AND c.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.es_carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));

CREATE POLICY "es_orders read" ON public.es_orders FOR SELECT USING (
  organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.es_supplier_orders so
    JOIN public.es_supplier_users su ON su.supplier_id = so.supplier_id
    WHERE so.order_id = es_orders.id AND su.user_id = auth.uid()
  )
);
CREATE POLICY "es_orders insert" ON public.es_orders FOR INSERT WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) AND public.org_has_module(organization_id,'eshop'));
CREATE POLICY "es_orders update" ON public.es_orders FOR UPDATE USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "es_orders delete" ON public.es_orders FOR DELETE USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "es_order_items read" ON public.es_order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND (o.organization_id IN (SELECT public.get_user_org_ids(auth.uid())) OR EXISTS (SELECT 1 FROM public.es_supplier_orders so JOIN public.es_supplier_users su ON su.supplier_id = so.supplier_id WHERE so.order_id = o.id AND su.user_id = auth.uid()))));
CREATE POLICY "es_order_items write" ON public.es_order_items FOR ALL USING (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND public.is_org_admin(auth.uid(), o.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND public.is_org_admin(auth.uid(), o.organization_id)));

CREATE POLICY "es_shipments read" ON public.es_shipments FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND (o.organization_id IN (SELECT public.get_user_org_ids(auth.uid())) OR (supplier_id IS NOT NULL AND public.es_is_supplier_user(auth.uid(), supplier_id)))));
CREATE POLICY "es_shipments write" ON public.es_shipments FOR ALL USING (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND public.is_org_admin(auth.uid(), o.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND public.is_org_admin(auth.uid(), o.organization_id)));

CREATE POLICY "es_shipment_items read" ON public.es_shipment_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_shipments s JOIN public.es_orders o ON o.id = s.order_id WHERE s.id = shipment_id AND o.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_shipment_items write" ON public.es_shipment_items FOR ALL USING (EXISTS (SELECT 1 FROM public.es_shipments s JOIN public.es_orders o ON o.id = s.order_id WHERE s.id = shipment_id AND public.is_org_admin(auth.uid(), o.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_shipments s JOIN public.es_orders o ON o.id = s.order_id WHERE s.id = shipment_id AND public.is_org_admin(auth.uid(), o.organization_id)));

CREATE POLICY "es_supplier_orders read" ON public.es_supplier_orders FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) OR public.es_is_supplier_user(auth.uid(), supplier_id));
CREATE POLICY "es_supplier_orders write" ON public.es_supplier_orders FOR ALL USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "es_returns read" ON public.es_returns FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND o.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_returns write" ON public.es_returns FOR ALL USING (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND public.is_org_admin(auth.uid(), o.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_orders o WHERE o.id = order_id AND public.is_org_admin(auth.uid(), o.organization_id)));

CREATE POLICY "es_return_items read" ON public.es_return_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.es_returns r JOIN public.es_orders o ON o.id = r.order_id WHERE r.id = return_id AND o.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))));
CREATE POLICY "es_return_items write" ON public.es_return_items FOR ALL USING (EXISTS (SELECT 1 FROM public.es_returns r JOIN public.es_orders o ON o.id = r.order_id WHERE r.id = return_id AND public.is_org_admin(auth.uid(), o.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.es_returns r JOIN public.es_orders o ON o.id = r.order_id WHERE r.id = return_id AND public.is_org_admin(auth.uid(), o.organization_id)));

CREATE POLICY "es_invoices read" ON public.es_invoices FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "es_invoices write" ON public.es_invoices FOR ALL USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "es_settings read" ON public.es_settings FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "es_settings write" ON public.es_settings FOR ALL USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "es_supplier_users read" ON public.es_supplier_users FOR SELECT USING (auth.uid() = user_id OR public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "es_supplier_users write" ON public.es_supplier_users FOR ALL USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- ==========================================================
-- Storage buckets
-- ==========================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('eshop-products','eshop-products', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('eshop-orders','eshop-orders', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "eshop-products public read" ON storage.objects FOR SELECT USING (bucket_id = 'eshop-products');
CREATE POLICY "eshop-products auth insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'eshop-products' AND auth.uid() IS NOT NULL);
CREATE POLICY "eshop-products auth update" ON storage.objects FOR UPDATE USING (bucket_id = 'eshop-products' AND auth.uid() IS NOT NULL);
CREATE POLICY "eshop-products auth delete" ON storage.objects FOR DELETE USING (bucket_id = 'eshop-products' AND auth.uid() IS NOT NULL);

CREATE POLICY "eshop-orders auth read" ON storage.objects FOR SELECT USING (bucket_id = 'eshop-orders' AND auth.uid() IS NOT NULL);
CREATE POLICY "eshop-orders auth insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'eshop-orders' AND auth.uid() IS NOT NULL);
CREATE POLICY "eshop-orders auth update" ON storage.objects FOR UPDATE USING (bucket_id = 'eshop-orders' AND auth.uid() IS NOT NULL);
CREATE POLICY "eshop-orders auth delete" ON storage.objects FOR DELETE USING (bucket_id = 'eshop-orders' AND auth.uid() IS NOT NULL);
