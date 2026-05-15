-- 1) Make variant_id nullable on es_inventory_levels and replace PK with conditional unique indexes
ALTER TABLE public.es_inventory_levels DROP CONSTRAINT IF EXISTS es_inventory_levels_pkey;
ALTER TABLE public.es_inventory_levels ALTER COLUMN variant_id DROP NOT NULL;

-- A surrogate id for ergonomics (optional row identity) – not required, skip to keep change minimal
CREATE UNIQUE INDEX IF NOT EXISTS uq_es_inv_levels_no_variant
  ON public.es_inventory_levels (warehouse_id, product_id)
  WHERE variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_es_inv_levels_with_variant
  ON public.es_inventory_levels (warehouse_id, product_id, variant_id)
  WHERE variant_id IS NOT NULL;

-- 2) Trigger to apply moves to levels automatically
CREATE OR REPLACE FUNCTION public.es_apply_inventory_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.variant_id IS NULL THEN
    INSERT INTO public.es_inventory_levels (warehouse_id, product_id, variant_id, on_hand, reserved, reorder_level, warning_level, updated_at)
    VALUES (NEW.warehouse_id, NEW.product_id, NULL, NEW.qty, 0, 0, 0, now())
    ON CONFLICT (warehouse_id, product_id) WHERE variant_id IS NULL
    DO UPDATE SET on_hand = public.es_inventory_levels.on_hand + EXCLUDED.on_hand,
                  updated_at = now();
  ELSE
    INSERT INTO public.es_inventory_levels (warehouse_id, product_id, variant_id, on_hand, reserved, reorder_level, warning_level, updated_at)
    VALUES (NEW.warehouse_id, NEW.product_id, NEW.variant_id, NEW.qty, 0, 0, 0, now())
    ON CONFLICT (warehouse_id, product_id, variant_id) WHERE variant_id IS NOT NULL
    DO UPDATE SET on_hand = public.es_inventory_levels.on_hand + EXCLUDED.on_hand,
                  updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_es_apply_inventory_move ON public.es_inventory_moves;
CREATE TRIGGER trg_es_apply_inventory_move
AFTER INSERT ON public.es_inventory_moves
FOR EACH ROW EXECUTE FUNCTION public.es_apply_inventory_move();