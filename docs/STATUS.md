# STATUS — AppBuilder.ai @ NEXXT AI Hackathon (Raiffeisen)

> Actualizat: miercuri, 28 oct 2026 · Owner document: Lip
> Verificat cu codul de pe `main` @ `a6508fc` și cu `prompts/` (28 oct). Ce nu se vede în cod rămâne ⚠️.
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
| D2 | Scenariul bancar | Order-to-cash / Validare dosar credit / **Facturi furnizor, three-way match (AP)** / rămânem pe comenzi. Ultima variantă bancară e deja scrisă în `prompts/` (n8n + Lovable), dar **nimic din ea nu e construit** (0 fișiere de factură în repo) | echipa + 1 mentor Raiffeisen | azi |
| D3 | LLM-ul folosit în demo | `prompts/n8n/n8n-prompt.md` cere Claude `claude-sonnet-5-5`, credențial n8n „RTA Anthropic API". **Propunere: D3 = Claude**; ⚠️ de confirmat în n8n live ce model rulează fluxurile de comenzi. În repo nu există niciun apel LLM | Daniel | azi |

## Stare pe componente

| Componentă | Stare | Owner | Blocaj |
|---|---|---|---|
| Landing page (nexxt.appbuilder.ai) | 🟡 pe `main`: CTA demo, formular HubSpot și `Talk to us → #contact` există deja; `main` tratează lipsa tabelului `user_roles` (nimeni nu e admin). ⚠️ site-ul live poate rula alt build | Daniel | verifică ce build e live |
| PR #1 (branch `landing-cta-hubspot`) | 🟡 NEMERGE-UIT, a divergat de `main` (parte din conținut e refăcut pe `main` cu alte commit-uri). Aduce `supabase/migrations/…user_roles.sql`, care **nu trebuie merge-uit** (vezi BUGS B-07: schema rămâne în `drizzle/migrations/`). Merge doar dacă scoți acel fișier și `types.ts`/`drizzle` din diff | Daniel | decide: merge sau închide |
| Agentul de comenzi (order worker) | 🟡 rulează în n8n (6 workflow-uri citate în prompt), **nu e în repo**; app-ul îl cheamă prin 2 webhook-uri (`order-assistant`, `app-order-offer`). Regulile de comandă sunt în cod (`order-rules.ts`, testate) | Daniel | export JSON + prompt în repo |
| Invoice worker (n8n, scenariu bancar AP) | 🔴 doar prompt scris (`prompts/n8n/`); depinde de ID-uri HubSpot `<…>` necompletate | ⚠️ | D2 + setup HubSpot facturi |
| Invoice desk (Lovable: coadă, detaliu, submit) | 🔴 doar prompt scris (`prompts/lovable/`) | Lip (Lovable) | D2, prompt 1 (rol `ap_reviewer`) |
| Setup HubSpot facturi (pipeline, PO, furnizori, 12 documente sintetice) | 🔴 lipsesc `HUBSPOT.md`, `scripts/hubspot/data/invoices/`, `lovable-prompt-roles.md` (referite de prompturi, nu sunt în repo) | ⚠️ | — |
| Agenți separați + orchestrator | 🔴 neînceput | ⚠️ | D2 |
| Mock API bancar | 🔴 neînceput | ⚠️ | D2 |
| Date sintetice de test | 🔴 neînceput | Lip (propus) | D2 |
| Evidence pack (rulări X/N, log-uri) | 🔴 neînceput | ⚠️ | date de test |
| README / setup | 🔴 neînceput | ⚠️ | — |
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
| **HubSpot** | „sistemul băncii” în demo + formular contact | date demo CRM (portal 149650024); schema proprietăților e în `scripts/hubspot/setup.ts` | ⚠️ | token în `HUBSPOT_ACCESS_TOKEN` (app) și `HUBSPOT_API_KEY` (script) |
| **n8n** | lipici între sisteme + toți agenții/LLM-ul | fluxuri (`revtech-agency.app.n8n.cloud`) | ⚠️ | **niciun export în repo azi**; webhook-urile cer header `x-appbuilder-key` |
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
