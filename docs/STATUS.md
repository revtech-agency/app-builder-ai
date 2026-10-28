# STATUS — AppBuilder.ai @ NEXXT AI Hackathon (Raiffeisen)

> Actualizat: joi, 29 oct 2026, 00:20 · Owner document: Lip
> Verificat cu codul de pe `main` @ `cce32e0`, cu portalul HubSpot 149650024 și cu site-ul live (29 oct). Ce nu se vede în cod rămâne ⚠️.
> Autori: `prompts/` (n8n + Lovable) = Daniel. Cele 5 documente = Lip, revizuite din cod cu Claude.
> Regulă: fiecare membru își actualizează rândul **la fiecare 2 ore** sau când se blochează. Nu se discută status pe Discord fără să fie trecut aici.

## Termene

| Ce | Când |
|---|---|
| Depunere cod + evidence | **joi, 29 oct, 10:30** |
| Prezentare live | ⚠️ DE CONFIRMAT |
| Code freeze intern (doar bugfix după) | joi, 29 oct, 08:00 |
| Video backup al demo-ului înregistrat | joi, 29 oct, 09:00 |

## Decizii deschise (blochează restul)

| # | Decizie | Opțiuni | Cine decide | Până când |
|---|---|---|---|---|
| D1 | Pe ce track suntem înscriși | Operational Efficiency / Provocare Deschisă | întrebare la organizatori | ACUM |
| D2 | Scenariul bancar | Order-to-cash / Validare dosar credit / **Facturi furnizor, three-way match (AP)** / rămânem pe comenzi. Varianta AP este **propunerea lui Daniel**: prompturile din `prompts/` (n8n + Lovable) sunt scrise de el, nu e o decizie de echipă. **Pe `main` (29 oct) varianta AP e construită și live:** invoice desk în app + invoice worker în n8n, 12/12 cazuri de test corecte (`evidence/invoice-worker-run-2026-10-29.md`). ⚠️ Decizia de echipă trebuie totuși confirmată | echipa + 1 mentor Raiffeisen | azi |
| D3 | LLM-ul folosit în demo | `prompts/n8n/n8n-prompt.md` cere Claude `claude-sonnet-5-5`, credențial n8n „RTA Anthropic API". **Propunere: D3 = Claude**; ⚠️ de confirmat în n8n live ce model rulează fluxurile de comenzi. Fluxurile de facturi exportate în `n8n/invoice-worker/` folosesc Claude `claude-sonnet-5-5` (Information Extractor la procesare, agentul din chatul reviewerului); aplicația nu cheamă LLM-ul direct | Daniel | azi |

## Stare pe componente

| Componentă | Stare | Owner | Blocaj |
|---|---|---|---|
| Landing page (nexxt.appbuilder.ai) | 🟢 CTA demo, formular HubSpot și `Talk to us → #contact`. Site-ul live rulează build-ul de pe `main` (verificat 29 oct: bundle-ul live conține ultimele texte din pagina de factură) | Daniel | — |
| PR #1 (branch `landing-cta-hubspot`) | 🟡 NEMERGE-UIT, a divergat de `main` (parte din conținut e refăcut pe `main` cu alte commit-uri). Aduce `supabase/migrations/…user_roles.sql`, care **nu trebuie merge-uit** (vezi BUGS B-07: schema rămâne în `drizzle/migrations/`). Merge doar dacă scoți acel fișier și `types.ts`/`drizzle` din diff | Daniel | decide: merge sau închide |
| Agentul de comenzi (order worker) | 🟡 rulează în n8n (6 workflow-uri citate în prompt), **nu e în repo**; app-ul îl cheamă prin 2 webhook-uri (`order-assistant`, `app-order-offer`). Regulile de comandă sunt în cod (`order-rules.ts`, testate) | Daniel | export JSON + prompt în repo |
| Invoice worker (n8n, scenariu bancar AP) | 🟢 live în n8n: `Kxhmr00uS4MBXTSO` procesează facturile (Gmail `demo+invoices@appbuilder.ai` sau webhook `invoice-intake` → deal în Procure-to-pay, linii, notă de audit), `HI8tvI2HG70NlgPo` e chatul reviewerului (doar citire), `rc72KPALhtJhwLZm` caută PO-ul. Export JSON în `n8n/invoice-worker/`. ⚠️ Exportul e mai vechi decât versiunea live `030f7e0f…`: regula split purchase numără în export facturile furnizorului, live doar pe cele de pe același PO | Daniel | re-export din n8n |
| Invoice desk (app: coadă, detaliu, submit) | 🟢 pe `main`: coada (`/app/invoices`), pagina facturii (three-way match, fiecare verificare trecută/picată, furnizor, activitate, chat „Ask the worker”), decizii (aprobare, trimis înapoi, duplicat, respins; comentariul pornește din verificările picate), `Submit document` (text sau PDF), furnizori, PO-uri, echipă, reguli de aprobare, Reset demo, ghid pas cu pas pentru contul demo | Daniel | — |
| Setup HubSpot facturi (pipeline, PO, furnizori, 12 documente sintetice) | 🟢 `scripts/hubspot/setup-invoices.ts` (rerulabil, `--dry-run`) + `scripts/hubspot/data/invoices/`: 6 furnizori, 10 PO-uri, 6 facturi istorice, 10 documente live cu stadiul așteptat. `scripts/hubspot/check-ids.ts` verifică ID-urile de stadii hardcodate. ⚠️ `HUBSPOT.md` și `lovable-prompt-roles.md` sunt în folderul de lucru al lui Daniel, nu în repo | Daniel | — |
| Agenți separați + orchestrator | 🟡 facturi: 3 fluxuri separate (procesare, chat cu 6 tool-uri, căutare PO ca sub-flux); LLM-ul doar extrage datele, regulile fixe din *Code node* `Apply Rules` decid. Nu există un orchestrator separat | ⚠️ | — |
| Mock API bancar | 🔴 neînceput | ⚠️ | D2 |
| Date sintetice de test | 🟢 facturi: 12 cazuri cu stadiu și flaguri așteptate în `n8n/invoice-worker/test-cases.json`. Comenzi: 12 cazuri în `scripts/hubspot/data/` | Lip (propus) | — |
| Evidence pack (rulări X/N, log-uri) | 🟢 facturi: `evidence/invoice-worker-run-2026-10-29.md`, 12/12 corecte pe 4 rulări la rând; `run-tests.mjs` arhivează facturile de test după fiecare rulare. Comenzi: fără runner | Daniel | — |
| README / setup | 🟡 `README.md` descrie aplicația, workerul de facturi și comenzile de dezvoltare/test (29 oct); variabilele de mediu sunt în `docs/DOCUMENTATION.md` | Daniel | — |
| Deck | 🟡 v1 există, nu răspunde brief-ului | ⚠️ | D2 |

Legendă: 🟢 gata · 🟡 în lucru / parțial · 🔴 neînceput sau blocat

## Echipa și roluri

| Membru | Rol | Ce deține |
|---|---|---|
| Daniel (revtech) | Tech lead | repo, Lovable, Supabase, deploy |
| Lip | Domeniu + reguli + date de test + documentație | ⚠️ DE CONFIRMAT |
| ⚠️ | Agenți și orchestrare | |
| ⚠️ | Integrări + UI | |
| ⚠️ | Deck + pitch | |

## Reguli de acces (propunere — de bătut în cuie azi)

Problema: avem 6+ unelte și nu e clar cine are acces unde, cine poate schimba ce și unde stă adevărul.

| Unealtă | Pentru ce | Sursa de adevăr pentru | Cine are acces | Cine poate scrie |
|---|---|---|---|---|
| **GitHub** | cod, migrări SQL, documentație | **tot codul și docs** | toată echipa (read) | toți, **doar prin PR** pe `main` |
| **Lovable** | generare UI | nimic — e editor | Daniel + 1 | doar pe branch, sincronizat în GitHub |
| **Supabase** | DB, auth | schema (prin migrări din repo) | Daniel + 1 backup | **`drizzle/migrations/` (decis 28 oct)**. Baza reală = `types.ts` de pe `main` = migrarea din `drizzle/`. Fișierul `supabase/migrations/…` din PR #1 nu se merge-uiește. Un singur tabel: `user_roles` |
| **HubSpot** | „sistemul băncii” în demo + formular contact | date demo CRM (portal 149650024); schema proprietăților e în `scripts/hubspot/setup.ts` | ⚠️ | token în `HUBSPOT_ACCESS_TOKEN` (app și scripturi; `HUBSPOT_API_KEY` doar ca nume vechi de rezervă) |
| **n8n** | lipici între sisteme + toți agenții/LLM-ul | fluxuri (`revtech-agency.app.n8n.cloud`) | ⚠️ | export în repo doar pentru fluxurile de facturi (`n8n/invoice-worker/`); fluxurile de comenzi nu sunt în repo. Webhook-urile cer header `x-appbuilder-key` |
| **Claude / Gemini** | asistență | nimic | toți | — |

Reguli de bază:
1. **Un singur loc de adevăr: repo-ul.** Ce nu e în GitHub nu există pentru juriu.
2. **Nicio schimbare direct în Supabase.** Singurul loc pentru schema DB este `drizzle/migrations/` (decis 28 oct, B-07). Îl scrie Lovable când îi dai un prompt de bază de date; fișierul SQL intră în repo prin PR. **Nu** se creează `supabase/migrations/`.
3. **Minim 2 oameni cu acces admin** la fiecare unealtă (Daniel + un backup). Dacă Daniel doarme la 3 dimineața, nu ne oprim.
4. **Secretele nu se pun în chat, Discord sau cod.** Doar în `.env` local și în setările de deploy. `.env.example` în repo, fără valori.
5. **Un branch per feature**, nume `feat/…`, `fix/…`. Merge după un review de la oricine altcineva.
6. **Promptul unui LLM care ajunge în produs se pune în repo** (`/prompts`), nu rămâne într-un chat.

## Log de schimbări

| Când | Cine | Ce |
|---|---|---|
| 28 oct | Lip | PR #1 deschis: fix `user_roles`, CTA-uri, formular HubSpot |
| 28 oct | Lip | Documente de lucru create (acesta + FEATURES, BUGS, IMPROVEMENTS, DOCUMENTATION) |
| 28 oct | Claude (revizie din cod) | Completat din cod pe branch `docs/project-docs` (nepublicat): stack, env, structură, reguli, bug-uri noi, corecturi |
| 29 oct | Daniel + Claude | Scenariul AP construit și testat: invoice desk, invoice worker în n8n, 12/12 cazuri (`evidence/`). STATUS, FEATURES și README aduse la zi cu codul |
