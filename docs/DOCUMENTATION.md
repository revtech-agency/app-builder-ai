# AppBuilder.ai — Documentație

> Acest fișier devine `README.md` în repo înainte de depunere (README-ul actual e un placeholder Lovable). Juriul îl citește ca să verifice **Architecture & reproducibility (15%)** și **Functional completeness & testability (20%)**.
> Completat din cod pe `main` @ `a6508fc` (28 oct). ⚠️ = nu se poate afla din repo, trebuie completat de cine deține componenta.

---

## 1. Ce face

AppBuilder.ai este un „order worker": preia comenzi ale clienților unui distribuitor (în datele demo: **membrane/învelișuri pentru mezeluri, vândute la metru**), le convertește în pachete întregi, aplică reguli de business și le scrie ca *deals* într-un pipeline HubSpot. Ce nu e clar trimite la om (stadiile „Waiting on client" / „Needs staff"). Clienții comandă din aplicație (chat + inventar + coș); comenzile din email/WhatsApp sunt procesate de un flux n8n.

**Scenariul pentru Raiffeisen:** ⚠️ DE CONFIRMAT după D2. `prompts/` (scrise de Daniel) descrie un pivot propus spre *procesarea facturilor furnizor (AP, three-way match PO → aviz → factură)* cu un „invoice desk" nou; **nimic din el nu e implementat încă** (nici cod, nici HubSpot, nici date). Atenție: tot ce există în cod azi este scenariul *comenzi de la IMM-uri*, nu un proces bancar (vezi IMPROVEMENTS I-10).

Fluxul real, așa cum e în cod:

```
Client (browser, login Supabase)
   │
   ├─ Chat "Order assistant" ──► server fn sendChat ──► n8n webhook /order-assistant  (LLM, în afara repo-ului)
   │                                   └─ întoarce {reply, delivery_date, cart[]}
   ├─ Inventar (listInventory ◄── HubSpot products) ──► adaugă în coș (sessionStorage)
   │
   ▼
Coș ──► server fn placeOrder
          1. requireCompany: userul are voie pe compania asta?
          2. re-citește produsele din HubSpot (prețul/stocul NU vin din browser)
          3. src/lib/order-rules.ts (COD, fără LLM): pachete întregi, min. pachete,
             stoc, dată livrare lipsă, plată restantă, listă negociată
          4. creează deal + line items în HubSpot, stadiul = cel mai prost stadiu al liniilor
          5. dacă stadiul e ready/waiting → n8n webhook /app-order-offer (email cu oferta)
             dacă e "staff" (ex. client restant) → fără email, rămâne la om

Admin: /app/dashboard (MRR, venit/lună, comenzi facturabile din HubSpot) · /app/admin (roluri)
Landing: / (demo, formular de contact → HubSpot Forms API)
```

Principiul „LLM propune, regulile decid" **este respectat în `placeOrder`** (reguli deterministe în TypeScript, testate). Ce face LLM-ul în n8n nu poate fi verificat din repo.

## 2. Arhitectură

| Strat | Tehnologie (din cod) | Rol |
|---|---|---|
| Framework | **TanStack Start** (React 19, TanStack Router file-based, server functions) pe **Vite 8**; build cu `@lovable.dev/vite-tanstack-config` + Nitro (țintă implicită Cloudflare) | SSR + RPC server |
| UI | Tailwind 4, shadcn/ui (Radix), lucide, sonner, recharts | landing, app, dashboard |
| Date client | `@tanstack/react-query`, `zod` pentru validarea inputului server fn | |
| Auth | **Supabase Auth** (email+parolă; demo prin magic-link token generat server-side cu service role) | login, demo |
| DB Supabase | un singur tabel: `public.user_roles` (+ enum `app_role`, funcția `has_role`) | doar roluri admin |
| „Sistemul băncii" / datele de business | **HubSpot** (portal 149650024): products, companies, contacts, deals (pipeline „Orders"), line items, notes | sursa de adevăr pentru catalog, clienți, comenzi |
| Orchestrare / agenți | **n8n cloud** (`revtech-agency.app.n8n.cloud`), 2 webhook-uri: `order-assistant`, `app-order-offer` | ⚠️ fluxurile NU sunt în repo |
| LLM | **Niciun apel LLM în repo.** Chatul și parsarea email/WhatsApp rulează în n8n. `prompts/n8n/n8n-prompt.md` specifică Claude `claude-sonnet-5-5` (credențial n8n „RTA Anthropic API"); ⚠️ de confirmat pe fluxurile live (D3) | |
| Mock bancar | nu există | |
| Teste | Vitest + jsdom + Testing Library: `order-rules`, `billing`, routing | |
| CI | nu există (`.github/` lipsește) | |

### Structura repo (reală)

```
src/
  routes/            fișier = rută (TanStack). /, /login, /customer-form,
                     /app (layout), /app/dashboard, /app/admin,
                     /app/$companyId/{orders,new-order,inventory}
  lib/
    order-rules.ts   regulile de comandă (pur, testat) + ID-uri pipeline/stadii HubSpot
    orders.ts        server fns: getMyCompanies, listOrders, listInventory, sendChat, placeOrder
    billing.ts       model de venit (abonament + taxă/comandă), pur, testat
    dashboard.ts     server fn getPlatformDashboard (admin)
    admin.ts         roluri, requireAdmin, getDemoSignIn
    hubspot.server.ts  clienți HTTP HubSpot + n8n (doar server)
    auth.tsx, cart.tsx, format.ts, error-*.ts
  integrations/supabase/   fișiere generate de Lovable (client, client.server, auth-middleware, types)
  components/        UI (ui/ = shadcn)
  test/              3 fișiere de test
scripts/hubspot/     setup.ts (bun) + data/{catalogue,demo-orders,live-messages}.json
drizzle/             migrations/0000_create_user_roles.sql (schema.ts e gol)
supabase/config.toml doar project_id
```

Nu există (față de „structura țintă" din ciornă): `/agents`, `/rules`, `/prompts`, `/n8n`, `/data/synthetic`, `/evidence`, `supabase/migrations/` (pe `main`).

### Contracte între componente

Nu există tipul `Case` din ciornă. Contractele reale:

- **App → n8n `order-assistant`** (`sendChat`): `{session_id, client_name, negotiated_skus[], message, cart[]}` → `{reply, delivery_date?, cart: ChatCartLine[]}`; header `x-appbuilder-key`.
- **App → n8n `app-order-offer`** (`placeOrder`): `{deal_id, token, to, client_name, order_ref, delivery_date, intro, line_item_ids[], lines[]}`.
- **Pipeline HubSpot „Orders"**: Received → Waiting on client → Needs staff → Ready to confirm → Confirmed; Duplicate, Rejected. Proprietăți custom în grupul `appbuilder_order_worker` (definite în `scripts/hubspot/setup.ts`): `delivery_date`, `order_channel` (email/whatsapp/pdf/app), `source_message_id`, `raw_order_text`, `exception_reason`, `min_field_confidence`; pe line items `client_code_as_written`, `rounding_note`, `field_confidence`; pe companii `payment_status`, `negotiated_skus`, `appbuilder_*`; pe produse `pack_type`, `units_per_pack`, `min_sale_packs`, `stock_packs`.

## 3. Instalare locală

⚠️ Nerulat pe o mașină curată (nu am instalat dependențele; `node_modules` lipsește local).

```bash
git clone https://github.com/revtech-agency/app-builder-ai
cd app-builder-ai
bun install                  # repo-ul are bun.lock; README-ul vechi zicea npm
cp .env.example .env.local   # completează (vezi mai jos)
bun run dev
bun run test
bun run build
```

`scripts/hubspot/setup.ts` cere **Bun** (folosește `Bun.sleep`, `import.meta.dir`).

### Variabile de mediu (doar nume)

| Variabilă | Unde se citește | Obligatorie | Note |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server (middleware, SSR) | da | |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | da | în ciornă scria `VITE_SUPABASE_ANON_KEY` — greșit |
| `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_PROJECT_ID` | doar în `.env` | nu | informativ |
| `SUPABASE_SERVICE_ROLE_KEY` | server (`client.server.ts`) | da (roluri, demo, listă useri) | **lipsește din `.env.example`** |
| `HUBSPOT_ACCESS_TOKEN` | server (`hubspot.server.ts`) | da (orice comandă/inventar/dashboard) | **lipsește din `.env.example`** |
| `N8N_APP_KEY` | server | da pentru chat și email ofertă | **lipsește din `.env.example`** |
| `DEMO_EMAIL` | server | nu (implicit `demo@appbuilder.ai`) | |
| `HUBSPOT_API_KEY` | doar `scripts/hubspot/setup.ts` | pentru seed | e singura din `.env.example`; alt nume decât `HUBSPOT_ACCESS_TOKEN` pentru același tip de token |
| `LOVABLE_DB_MIGRATION_URL` | `drizzle.config.ts` | nu | |
| `LOVABLE_CRON_SECRET`(`_PREVIOUS`) | `cron-auth.ts` | nu | niciun job programat nu o folosește |

Nu există `LLM_API_KEY`/`MODEL` în cod. `VITE_HUBSPOT_PORTAL_ID`/`VITE_HUBSPOT_FORM_GUID` din ciornă **nu există**: ID-urile formularului sunt constante în `src/components/contact-form.tsx` (publice).

### Baza de date și HubSpot

```bash
bun scripts/hubspot/setup.ts --dry-run        # doar citire
bun scripts/hubspot/setup.ts                   # proprietăți, pipeline, 180 produse, 4 clienți demo, 12 comenzi
bun scripts/hubspot/setup.ts --history-only    # 6 comenzi confirmate; restul în data/live-messages.json pentru demo live
```
Portalul trebuie să aibă moneda EUR. Scriptul e idempotent.

Supabase: **singura sursă a schemei este `drizzle/migrations/`** (acum `0000_create_user_roles.sql`: enum `app_role`, tabelul `user_roles` cu RLS, funcția `has_role`). Se modifică prin prompturi Lovable pentru baza de date, care adaugă o migrare nouă aici; `src/integrations/supabase/types.ts` se regenerează din baza reală și nu se editează de mână. `drizzle/schema.ts` e gol intenționat. `supabase db push` din ciornă nu se folosește: nu există `supabase/migrations/` pe `main` și nu trebuie creat (varianta din branch-ul `landing-cta-hubspot` e depășită, vezi BUGS B-07).

⚠️ ID-urile pipeline/stadii și compania demo (`458454559952`) sunt hardcodate pentru portalul 149650024; pe alt portal trebuie înlocuite (`order-rules.ts`, `orders.ts`).

## 4. Cum testezi

```bash
bun run test        # vitest: order-rules (10), billing (7), routing (8 rute)
```
⚠️ Neexecutat de mine (dependențe neinstalate). Nu există script `eval` și nici teste pentru `placeOrder`, `visibleCompanies`, n8n sau agenți. Setul „X din N" nu există încă.

### Scenariul de demo (din cod)

1. Deschide landing-ul ⚠️ (URL).
2. Click **Try the demo** → login ca `DEMO_EMAIL` (non-admin) → vede doar compania demo `458454559952`.
3. **New order** → scrie „MB52-T 3000 m, livrare joi" → n8n întoarce coșul → **Place order**.
4. Vezi în **Orders** dealul cu stadiul și `exception_reason`; în HubSpot apare deal + line items; dacă stadiul e ready/waiting pleacă emailul de ofertă.
5. Ca admin: **/app/dashboard** arată MRR și venit.

### Cazuri de test existente (date, nu automatizate)

`scripts/hubspot/data/demo-orders.json` / `live-messages.json` conțin 12 comenzi cu rezultatul așteptat (stadiu + excepție), ex.: cantitate care nu umple pachete (ORD-1008 → Waiting on client), cod client necunoscut F45 (ORD-1009 → Needs staff, cu cel mai apropiat produs), client restant (ORD-1010 → Needs staff). Lipsește rularea automată și compararea cu rezultatul real.

## 5. Reguli de business

Implementate în cod (`src/lib/order-rules.ts`, testate):

| ID | Condiție | Acțiune |
|---|---|---|
| R-01 | cantitate în metri nu se împarte exact la pachet | rotunjire în sus la pachete întregi + `rounding_note`; stadiu ≥ Waiting on client |
| R-02 | pachete < `min_sale_packs` | se ridică la minim; Waiting on client |
| R-03 | `stock_packs` < pachete cerute | notă „only N in stock"; Waiting on client |
| R-04 | fără dată de livrare | Waiting on client |
| R-05 | `payment_status = overdue` | Needs staff; fără email ofertă |
| R-06 | SKU în afara `negotiated_skus` (dacă lista nu e goală) | comandă respinsă cu eroare |
| R-07 | produs fără `units_per_pack` | eroare |
| R-08 | stadiul comenzii = cel mai prost stadiu dintre linii/condiții (ready < waiting < staff) | |

Doar în datele demo / n8n, **neverificabile în cod** (⚠️ confirmați că există în flux): potrivire pe harta de coduri a clientului, cel mai apropiat produs după familie+calibru+culoare, detecție duplicat pe `source_message_id`, alertă finance la client restant, încredere minimă pe câmp.

Facturare (`src/lib/billing.ts`): abonament lunar de la luna de start + taxă per comandă facturabilă (orice stadiu în afară de Duplicate/Rejected); demo: 99 EUR + 0,60 EUR/comandă.

## 6. Limitări cunoscute

- Agenții/LLM-ul din n8n nu sunt în repo → nereproductibil din GitHub.
- Stocul nu se scade la plasarea comenzii.
- Date 100% sintetice (clienți „(demo)", `example.com`, prețuri/stoc inventate).
- Scenariul e comenzi IMM, nu proces bancar.
- Detalii: BUGS.md.

## 7. Echipa

⚠️ nume · rol · contact (vezi STATUS.md).
