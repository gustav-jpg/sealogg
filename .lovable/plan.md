# e-Skeppshandel – modul i Sealogg

En komplett B2B-handelsmodul för marina produkter, integrerad i Sealogg. All försäljning på faktura. Multi-tenant, org-scopad, RLS via `is_org_admin`. Bygger isolerat under modulflaggan `eshop` (ny `app_module`-värde) och route-prefix `/portal/eshop/*` så att inget i nuvarande system påverkas.

Modulen är stor och byggs i 7 faser med checkpoint mellan varje. Inga befintliga tabeller eller komponenter rörs.

## Säkerhet och isolation (gäller alla faser)

- Alla nya tabeller prefixas `es_` (e-shop) — krockar aldrig med `bk_*` (bookings) eller övriga tabeller.
- RLS på varje tabell. Kund-/orderdata: `is_org_admin(auth.uid(), organization_id)` + `get_user_org_ids()`. Produkt-/leverantörsdata: läsbart för medlem i org, skrivbart för org_admin.
- Modulen syns i sidomenyn endast när `org_has_module(org, 'eshop')` är aktiv.
- Audit-logg via befintlig `audit_generic_changes`-trigger på order-, faktura-, lager- och prisrelaterade tabeller.
- Filer (produktbilder, manualer, följesedlar) i två storage-buckets: `eshop-products` (publik, read-only) och `eshop-orders` (privat, RLS).

## Arkitektur

- Frontend: React 18 + Vite + Tailwind + shadcn (samma stack som resten av Sealogg).
- Backend: Lovable Cloud (Postgres + RLS + Edge Functions). Inga externa tjänster initialt.
- Edge Functions för: ordergenerering, fakturaunderlag (PDF), lagerreservation, fraktberäkning, leverantörs-PO, e-postnotiser via befintlig Resend-integration.
- Realtid via Supabase Realtime på `es_orders` och `es_inventory_levels`.
- Offlineanpassat: kataloglistor cachas via React Query med långa stale-times; kundvagn ligger i localStorage tills order skickas.

## Datamodell (fas 1)

```
es_categories          (id, org, parent_id, name, slug, sort_order, is_active)
es_suppliers           (id, org, name, contact, email, phone, lead_time_days,
                        min_order_value, handling_fee, freight_markup_pct,
                        dropship_default, is_active)
es_warehouses          (id, org, name, address, is_external, supplier_id?)
es_products            (id, org, sku, name, description, category_id,
                        primary_supplier_id?, brand, weight_g, length_mm,
                        width_mm, height_mm, freight_class,
                        price_excl_vat, recommended_price, purchase_price,
                        vat_rate, lead_time_days, is_active, dropship,
                        tags[], attributes jsonb)
es_product_images      (id, product_id, url, alt, sort_order)
es_product_documents   (id, product_id, url, label, kind)
es_product_variants    (id, product_id, sku, name, price_excl_vat,
                        purchase_price, attributes jsonb)
es_product_bundles     (id, parent_product_id, child_product_id, qty)
es_product_related     (product_id, related_product_id)
es_product_suppliers   (product_id, supplier_id, supplier_sku,
                        supplier_lead_time_days, supplier_price)
es_inventory_levels    (warehouse_id, product_id, on_hand, reserved,
                        reorder_level, warning_level)
es_inventory_moves     (id, warehouse_id, product_id, qty, reason,
                        ref_table, ref_id, created_by, created_at)
es_freight_rules       (id, org, supplier_id?, country, postal_prefix?,
                        rule_type['fixed','weight','volume','free_over'],
                        params jsonb, price_excl_vat)
es_carts               (id, org, vessel_id?, user_id, notes, updated_at)
es_cart_items          (id, cart_id, product_id, variant_id?, qty)
es_orders              (id, org, order_number, vessel_id?, ordered_by,
                        status, currency, sub_total, freight_total,
                        handling_total, vat_total, grand_total,
                        delivery_address jsonb, billing_address jsonb,
                        internal_note, customer_note, created_at)
es_order_items         (id, order_id, product_id, variant_id?,
                        supplier_id?, qty, unit_price_excl_vat,
                        vat_rate, line_total_excl_vat)
es_shipments           (id, order_id, supplier_id?, warehouse_id?,
                        status['pending','packed','shipped','delivered'],
                        carrier, tracking_no, freight_excl_vat, shipped_at)
es_shipment_items      (id, shipment_id, order_item_id, qty)
es_supplier_orders     (id, org, supplier_id, order_id, status,
                        external_ref, sent_at)
es_invoices            (id, org, order_id, invoice_number, issued_at,
                        due_at, status['draft','sent','paid','cancelled'],
                        pdf_url)
es_favorites           (user_id, product_id)
es_returns             (id, order_id, reason, status, created_by, created_at)
es_return_items        (id, return_id, order_item_id, qty)
es_settings            (org, default_warehouse_id, payment_terms_days,
                        invoice_prefix, free_shipping_threshold,
                        currency, language)
```

Kund-/organisationsdata hämtas direkt från befintliga `organizations`, `vessels`, `profiles`, `organization_members`. Inget dupliceras.

## Faser

**Fas 1 – Schema, RLS, modulaktivering, sidomeny**
- Migration: alla `es_*`-tabeller, indexer, RLS, trigger för `update_updated_at_column`, audit-triggers, ordernummerfunktion `es_generate_order_number(org)`.
- Lägg till `'eshop'` i `app_module`-enum.
- Storage-buckets `eshop-products` (public) och `eshop-orders` (private) med policies.
- Sidomeny: ny grupp "e-Skeppshandel" som visas när modulen är aktiv. Tomma route-stubs under `/portal/eshop/*`.

**Fas 2 – Produktkatalog (admin)**
- Sidor: Kategorier, Leverantörer, Lager/Warehouses, Produkter (lista + detalj), Varianter, Paket, Fraktklasser.
- Bilduppladdning, dokument (PDF), tags, attribut.
- Bulk-import via CSV (klientsida).
- Sökning, filtrering, inline-redigering.

**Fas 3 – Lagerhantering**
- Lagernivåer per warehouse, manuella justeringar, inventering, historik (`es_inventory_moves`).
- Reservationslogik: edge function `eshop-reserve-stock` som flyttar `on_hand → reserved` när order skapas.
- Varningar för låg nivå på dashboard.

**Fas 4 – Kundflöde (butik)**
- Publik (inom inloggad portal) butik på `/portal/eshop` för organisationsmedlemmar.
- Produktlista med kategori-/tag-filter, sök, favoriter.
- Produktdetalj med bilder, beskrivning, varianter, paket, relaterade.
- Kundvagn i localStorage, ändra antal, spara utkast (`es_carts`), interna kommentarer, val av leverans-/fakturaadress (default från org), val av fartyg.
- Tydlig "Betalas via faktura"-markering. Visa preliminär frakt och leveranstid (per leverantör).

**Fas 5 – Order, fraktberäkning, delleveranser, leverantörsorder**
- Edge function `eshop-create-order`:
  - validerar lager, beräknar pris/moms,
  - splittar automatiskt till delleveranser per leverantör/lager,
  - räknar frakt per delleverans via `es_freight_rules` (vikt, volym, fast, fri över belopp, postnr, land, dropship-påslag),
  - reserverar lager,
  - skapar `es_orders`, `es_order_items`, `es_shipments`, `es_shipment_items`, `es_supplier_orders`,
  - skickar bekräftelse via Resend.
- Edge function `eshop-send-supplier-order` skickar e-post till leverantör med PO-PDF.

**Fas 6 – Orderhantering & faktura (admin)**
- Adminpanel: alla ordrar, filter på status/fartyg/org, statusbyten, spårningsnummer per shipment, exportera Excel/PDF, följesedel-utskrift.
- Returer/reklamationer (`es_returns`).
- Fakturaunderlag: edge function `eshop-generate-invoice` som producerar PDF (jspdf) och sparar i `eshop-orders`-bucket. `es_invoices` med status sent/paid/cancelled.
- Återförsäljarvy: ordrar grupperade per leverantör.

**Fas 7 – Dashboard, statistik, roller, finputs**
- Dashboard: KPI-kort (omsättning, antal ordrar, restorder, lågt lager), försäljning per månad/org/fartyg, mest sålda produkter, aktiva leveranser, leverantörsstatistik. Recharts.
- Realtid via Supabase Realtime på `es_orders`/`es_inventory_levels`.
- Roller: superadmin (befintlig), admin (`org_admin`), leverantör (ny `es_supplier_user`-tabell som länkar `user_id ↔ supplier_id`, ser bara sina ordrar), fartygsanvändare (org-medlem, kan beställa).
- Demo-seed-script för en organisation: 8 kategorier, 5 leverantörer, ~40 produkter, lager, exempelordrar.

## Förberett för framtid (ej implementerat nu)

- Fortnox/Visma-export (struktur i `es_invoices` redo).
- DHL/PostNord-integrationer (carrier-fält i `es_shipments`).
- Multi-currency/multi-language (kolumner finns på `es_settings`/`es_orders`).
- EDI/RFID/QR – kan läggas till utan schemaändringar.

## Vad jag behöver innan fas 1

1. **Bekräftelse på modulnamnet** `eshop` (route `/portal/eshop`, sidomeny "e-Skeppshandel"). OK?
2. **E-post avsändare** för orderbekräftelser och leverantörs-PO – använder vi `bokning@sealogg.se` eller vill du ha t.ex. `order@sealogg.se`? (Domänen sealogg.se är redan verifierad i Resend.)
3. **Aktivering** – ska jag aktivera modulen för någon specifik org direkt efter fas 1 (t.ex. Skärgårdsrederiet eller SeaLife) för test, eller hålla inaktiv tills allt är klart?
4. **Fakturanummer-serie** – ska varje org ha egen löpande serie (t.ex. prefix från `es_settings.invoice_prefix` + löpnummer per år)? Default: ja.

Säg "kör" så börjar jag direkt med fas 1 (databas + modulaktivering + sidomenykrok, helt isolerat och rullbart).
