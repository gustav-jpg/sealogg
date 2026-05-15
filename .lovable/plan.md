## Mål

- **Katalog/lager/leverantörer/inställningar** är globala – endast superadmin (du) administrerar.
- **Order, fakturor, varukorg** är fortsatt per organisation (varje kund ser sina egna).
- **All administration sker i Backoffice** under en ny sektion "e-Skeppshandel".
- I portalen ser kunden bara butiken (`/portal/eshop`), varukorgen, "Tidigare beställningar" och de andra köpsidorna.

---

## 1. Databas (migration)

Sätt `organization_id` nullable och uppdatera RLS för dessa kataloger så att:
- **SELECT**: alla inloggade kan läsa (så butiken funkar för alla orgs).
- **INSERT/UPDATE/DELETE**: endast `is_superadmin(auth.uid())`.

Tabeller som blir globala:
- `es_categories`, `es_products`, `es_product_variants`, `es_product_images`, `es_product_documents`, `es_product_bundles`, `es_product_related`, `es_product_suppliers`
- `es_suppliers`, `es_supplier_users`, `es_supplier_orders`
- `es_warehouses`, `es_inventory_levels`, `es_inventory_moves`
- `es_freight_rules`, `es_settings`

Tabeller som lämnas per‑org (oförändrat):
- `es_orders`, `es_order_items`, `es_invoices`, `es_carts`, `es_cart_items`, `es_favorites`, `es_returns`, `es_return_items`, `es_shipments`, `es_shipment_items`

Befintlig data i Testrederiets katalog (om någon) lämnas men kommer fortfarande synas (org‑bunden); ny data skapas global (NULL i `organization_id`). Säg till om du vill att jag rensar testdatat istället.

## 2. Frontend – Backoffice (ny sektion)

I `BackofficeLayout` läggs en ny grupp "e-Skeppshandel" med:

- Produkter
- Kategorier
- Leverantörer
- Lager
- Lagersaldo
- Order (alla organisationer, med kundkolumn)
- Fakturor (alla organisationer)
- Inställningar (global eshop‑konfig)

Sidorna flyttas/återanvänds från `src/pages/eshop/admin/*` till `src/pages/backoffice/eshop/*`. Inserts slutar sätta `organization_id` (blir NULL = globalt). Listor filtrerar inte längre på `selectedOrgId`.

Routes:
- `/backoffice/eshop/products`, `/categories`, `/suppliers`, `/warehouses`, `/inventory`, `/orders`, `/invoices`, `/settings`

## 3. Frontend – Portalen (kundsidan)

- I `AppSidebar`: ta bort hela kollapsbara gruppen "e-Skeppshandel – inställningar". Endast själva butiks‑menyn `e-Skeppshandel` (länk till `/portal/eshop`) behålls för orgs som har modulen aktiv.
- `Shop.tsx`, `ProductDetail`, kategorier: ta bort `.eq('organization_id', selectedOrgId)` på katalogfrågor.
- Order/cart/checkout fortsätter använda `selectedOrgId` (kundens egna order).
- Tidigare admin‑routes under `/portal/eshop/admin/*` tas bort (eller redirectar till backoffice för superadmin).

## 4. Synlighet / modul

`organization_features.eshop` styr fortfarande om **butiken** visas för en org i portalen. Backoffice‑adminen kräver bara superadmin – ingen modul behöver vara aktiv för dig.

---

## Tekniska detaljer

- Befintlig migration har constraint `enforce_vessel_org` för fartyg – inget motsvarande för es‑tabeller, så det räcker att göra `organization_id` nullable.
- RLS‑policies ersätts (DROP + CREATE) för katalogtabellerna.
- `es_apply_inventory_move`‑triggern påverkas inte (den jobbar bara mot `es_inventory_levels` utan org).
- TypeScript types regenereras automatiskt efter migrationen.
