# Bokningsmodul för SeaLogg – plan

Stort system. Bygger i 7 faser så att inget i den live-driftade plattformen påverkas. Allt nytt lever bakom modulflaggan `bookings` (finns redan i `app_module`-enum) och under egna route-prefix `/portal/bookings/*` (admin) och `/boka/:slug` (publikt). Inga befintliga tabeller eller komponenter rörs.

## Säkerhets- och isolationsprinciper (gäller alla faser)

- Allt nytt prefixas `bk_` i databasen för att aldrig krocka med befintliga tabeller.
- RLS på varje tabell via `is_org_admin(auth.uid(), organization_id)` + `get_user_org_ids()` enligt projektets standard.
- Publika endpoints (kundflödet) går via Edge Functions med service-role-nyckel + slug-validering, aldrig direkt mot tabeller från anon.
- Stripe enbart via Edge Functions; nycklar i secrets, aldrig i klient.
- Modulen syns bara i sidomenyn när `org_has_module(org, 'bookings')` är aktiv – samma mönster som dagens övriga moduler.

## Datamodell (fas 1)

```
bk_piers              (id, org, name, lat, lng, info)
bk_lines              (id, org, name, code, color, is_active)
bk_routes             (id, org, line_id, name, direction)
bk_route_stops        (id, route_id, pier_id, stop_order,
                       boarding_allowed, alighting_allowed,
                       arrival_offset_min, departure_offset_min)
bk_ticket_types       (id, org, name, code, sort_order, is_active)
bk_fare_rules         (id, org, line_id?, route_id?, from_pier_id?,
                       to_pier_id?, ticket_type_id, weekday_mask?,
                       valid_from?, valid_to?, price_sek, return_discount_pct)
bk_schedules          (id, org, route_id, name, weekday_mask,
                       start_date, end_date, depart_time, vessel_id?, is_active)
bk_departures         (id, org, route_id, vessel_id?, departure_at,
                       capacity_override?, status['open','closed','cancelled'])
bk_departure_stop_times (id, departure_id, route_stop_id, arrive_at, depart_at)
bk_bookings           (id, org, booking_number, customer_name, email, phone,
                       total_sek, currency, status['pending','paid','cancelled','refunded'],
                       stripe_session_id, stripe_payment_intent_id, created_at)
bk_booking_legs       (id, booking_id, departure_id, from_route_stop_id,
                       to_route_stop_id, return_of_leg_id?)
bk_booking_passengers (id, leg_id, ticket_type_id, qty, unit_price_sek)
bk_tickets            (id, booking_id, leg_id, ticket_type_id,
                       qr_code, status['valid','used','void'])
bk_check_ins          (id, ticket_id, departure_id, route_stop_id,
                       checked_by, checked_at, method['scan','manual'])
bk_refunds            (id, booking_id, amount_sek, stripe_refund_id, reason, created_by)
bk_settings           (org, public_slug, brand_color, logo_url,
                       contact_email, currency, terms_url, is_public_active)
```

Kapacitet räknas per segment (route_stop[i] → route_stop[i+1]). En leg `from→to` belastar alla mellanliggande segment. Available = `vessel.capacity` (eller `capacity_override`) minus summan av alla aktiva passagerare som korsar segmentet.

## Faser

**Fas 1 – Schema + RLS + modulaktivering**

- Migration: alla `bk_*`-tabeller, indexer, RLS, `bk_settings.public_slug` unik.
- SQL-funktion `bk_segment_availability(departure_id, from_stop, to_stop)` som returnerar tillgängliga platser (SECURITY DEFINER, parametriserad).
- Funktion `bk_get_org_by_slug(slug)` (publik, läser bara `is_public_active=true`).
- Sidomeny: lägg till `bookings`-grupp som visas när modulen är aktiv för organisationen.

**Fas 2 – Admin: Bryggor, Linjer, Rutter, Biljettyper**

- Sidor under `/portal/bookings/admin/*`.
- Visuell rutt-byggare: dra-och-släpp ordna stopp, per-stopp toggle för Påstigning / Avstigning / Tekniskt stopp.
- Karta (Leaflet, redan i bundle om Kartvisaren använder det – annars `react-leaflet` + OpenStreetMap-tiles, gratis).
- Validering: rutt måste ha minst 2 stopp där minst ett tillåter påstigning och minst ett tillåter avstigning.

**Fas 3 – Admin: Tidtabeller, Avgångar, Fartygstilldelning, Priser**

- Schemagenerator som materialiserar `bk_departures` + `bk_departure_stop_times` X dagar framåt.
- Fartygstilldelning per avgång (återanvänder befintliga `vessels` i samma org, läsbart men inte muterande).
- Prisregelmatris (linje × delsträcka × biljettyp × dag).
- Möjlighet att stänga / inställa enskild avgång och justera kapacitet.

**Fas 4 – Publikt kundflöde + Stripe**

- Route `/boka/:slug` (publikt, ingen auth) – egen layout utan portal-chrome.
- Sökflöde: från, till, datum, enkel/TR, antal per biljettyp.
- Edge function `bk-search` returnerar bokningsbara avgångar med tillgänglighet per segment.
- Edge function `bk-create-checkout` skapar `bk_bookings` med status `pending`, lägger reservation (TTL 15 min) och skapar Stripe Checkout-session.
- Edge function `bk-stripe-webhook` (publik, signaturverifierad) bekräftar bokning, genererar `bk_tickets` med UUID-QR-kod, skickar e-post via Resend (befintlig integration).
- Bokning kan inte slutföras utan `payment_intent.succeeded`.

**Fas 5 – Kundbiljett + e-post**

- E-postmall med logga, rutt, tider och QR (som inline PNG via `qrcode`-lib i edge function).
- Publik biljettsida `/biljett/:qr` för visning på telefon (read-only).

**Fas 6 – Boarding/incheckning för besättning**

- `/portal/bookings/boarding` – dagens avgångar för org, val av avgång.
- QR-skanner (samma `html5-qrcode` som redan finns i projektet).
- Edge function `bk-check-in` validerar: rätt avgång, datum, segment täcker påstigningsbryggan, inte redan använd. Manuell incheckning som fallback.
- Tydliga felmeddelanden för: fel tur, redan incheckad, ogiltig, ogiltig brygga.

**Fas 7 – Dashboard, bokningshantering, återbetalning, demo-data**

- Dashboard: intäkter (dag/vecka/månad), beläggning per avgång, kommande avgångar.
- Bokningslista med filter, detaljvy, flytta avgång, avboka, återbetala via Stripe Refunds API.
- Demo-seed-script (kör manuellt från admin) med Stockholms skärgård: ~10 bryggor (Stavsnäs, Sandhamn, Möja, Runmarö, Nämdö, Grinda, Vaxholm m.fl.), 2 linjer, schema 7 dagar framåt, biljettyper Vuxen/Barn/Pensionär/Cykel/Hund.

## Vad jag behöver innan jag börjar

1. **Stripe** – jag rekommenderar `enable_stripe_payments` (inbyggt, ingen egen Stripe-konto behövs initialt). Bekräfta så aktiverar jag det innan fas 4. Om du vill använda eget Stripe-konto med egna nycklar säger du till.
2. **Karta** – OK med OpenStreetMap via `react-leaflet`? (gratis, ingen nyckel)
3. **E-post avsändare** – skickar via befintlig Resend-integration från `bokning@sealogg.se` (eller annan domän du redan har verifierad)?
4. **Aktivering** – modulen `bookings` aktiveras per organisation i Backoffice. Ska jag aktivera den för någon specifik org direkt efter fas 1, eller låter vi den ligga inaktiv tills allt är klart?

## Leveransordning

Jag bygger fas 1 direkt när du godkänner planen (databas + sidomenykrok, helt isolerat, kan rullas tillbaka). Sedan en fas i taget med checkpoint mellan varje, så att inget av det live-driftade systemet påverkas och vi kan testa stegvis.

Kör enligt planen med följande tillägg och krav:

- Kapacitetslogiken är den absolut viktigaste delen i hela systemet. Säkerställ att kapacitet räknas segmentbaserat mellan bryggor och att endast aktiva reservationer + betalda bokningar belastar segmenten.
- Reservation/Hold under Stripe Checkout ska reservera platser i 15 minuter och sedan automatiskt släppas om betalning inte genomförs.
- I ruttbyggaren måste varje brygga/stopp kunna konfigureras som:
  - Endast påstigning
  - Endast avstigning
  - Både på- och avstigning
  - Tekniskt stopp/passering (ingen på-/avstigning)

Detta måste styra:

- vilka resor som får bokas
- vilka kombinationer som visas i sökningen
- boarding/incheckning
- kapacitetsberäkningen

Lägg även till:

- audit-logg för ändringar av avgångar, priser, kapacitet, återbetalningar och manuell boarding
- signerade/unika QR-tokens för biljetter
- tydlig isolering från befintligt live-system enligt planen

Bekräftelser:

- Stripe: kör enable_stripe_payments initialt
- Karta: OpenStreetMap + react-leaflet är OK
- E-post: använd befintlig Resend-integration och [bokning@sealogg.se](mailto:bokning@sealogg.se)
- Aktivering: håll modulen inaktiv tills hela flödet är testat

Du kan börja med fas 1.