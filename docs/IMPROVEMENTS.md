# IMPROVEMENTS — AppBuilder.ai

> Diferența față de FEATURES: aici e ce **există deja** și trebuie făcut mai bun.
> Sortat după **impact la juriu / efort**. Cifra din dreapta = puncte de jurizare atacate.

## Prioritate 1 — câștig mare, efort mic

| ID | Îmbunătățire | Criteriu | Efort | Owner | Stare |
|---|---|---|---|---|---|
| I-01 | **Spargem agentul monolit în agenți cu roluri clare** (intake, potrivire, risc, financiar) + un orchestrator. Fiecare agent = fișier separat cu input/output tipizat | AGENT 25%, ARCH 15% | M | ⚠️ | 🔴 |
| I-02 | **Regulile scoase din prompt în cod/config** (`rules.yaml` sau `rules.ts`). LLM-ul extrage, regulile decid | AGENT, DOM, ARCH | S | Lip (propus) | 🔴 |
| I-03 | **Mesaje de excepție explicite**: nu „eroare”, ci „Cod client necunoscut: XYZ-12. Cel mai apropiat: XYZ-21 (scor 0.82). Propun: confirmare umană” | AGENT, FUNC | S | ⚠️ | 🔴 |
| I-04 | **Promptul și versiunea modelului în repo** (`/prompts`, `MODEL=` în `.env.example`) | ARCH | S | ⚠️ | 🔴 |
| I-05 | **Fluxurile n8n exportate în repo** (`/n8n/*.json`) | ARCH | S | ⚠️ | 🔴 |

## Prioritate 1b — găsite din cod (28 oct)

| ID | Îmbunătățire | Criteriu | Efort | Owner | Stare |
|---|---|---|---|---|---|
| I-06 | **O singură sursă de schemă**: alegeți `supabase/migrations/`, ștergeți duplicatele (`drizzle/…`, varianta din PR #1), regenerați `types.ts`. Schema HubSpot (proprietăți/pipeline) rămâne în `setup.ts`; scoateți ID-urile hardcodate din `order-rules.ts` într-un config | ARCH 15% | S | Daniel | 🔴 (BUGS B-07, B-19) |
| I-07 | **Secrete și config**: `.env.example` complet (toate numele din DOCUMENTATION §3), un singur nume pentru tokenul HubSpot, `.env` scos din git. Nu s-au găsit secrete reale în cod/istoric — verificați și n8n (`x-appbuilder-key`) | ARCH | S | ⚠️ | 🔴 (B-08) |
| I-08 | **Teste unde sunt banii și accesul**: `placeOrder` (cu HubSpot mock), `visibleCompanies` (admin / demo / domeniu / email neconfirmat), un test de paritate între regulile din TS și cele din n8n; CI cu `bun run test` + `lint` + `build` | ARCH, FUNC | M | ⚠️ | 🔴 (B-14) |
| I-09 | **Reguli ca date, partajate**: fișier unic de reguli (praguri, toleranțe, limite de aprobare) citit și de app, și de n8n (prin endpoint al app-ului), în loc de copii în Code node + TS | AGENT, ARCH, DOM | M | Lip | 🔴 (B-10) |
| I-10b | **Evidence runner**: script care trimite cele 12 mesaje din `live-messages.json` (și, la pivot, cele 12 documente de facturi) la webhook și scrie `evidence/results.md` cu așteptat vs obținut | FUNC 20% | M | ⚠️ | 🔴 (F-08) |
| I-11b | **Idempotență + rollback + rezervare stoc** în `placeOrder` | FUNC, DOM | S | ⚠️ | 🔴 (B-09) |
| I-12b | **Decizia de scenariu înainte de Lovable prompt 2**: dacă se alege AP/facturi, prompt 1 (rol `ap_reviewer`) merge doar după B-07; dacă nu, nu trimiteți prompturile (ar adăuga ~5 pagini și 6 server fn fără teste în afara testului de limite) | AGENT, ORIG | — | echipa | 🔴 (D2) |

## Prioritate 2 — câștig mare, efort mare

| ID | Îmbunătățire | Criteriu | Efort | Owner | Stare |
|---|---|---|---|---|---|
| I-10 | Mutarea scenariului de pe „comenzi pentru furnizor de mezeluri” pe un proces al băncii (vezi D2 în STATUS) | DOM, ORIG, BIZ | L | echipa | 🔴 |
| I-11 | Retry + fallback la erori de tool (API bancar picat, LLM timeout, JSON invalid) | AGENT („unexpected situations”) | M | ⚠️ | 🔴 |
| I-12 | Pagină de trace per caz (timeline cu pașii agentului) | FUNC, AGENT | M | ⚠️ | 🔴 |

## Prioritate 3 — landing page (impact mic la juriu)

> Landing-ul intră doar indirect la BIZ (10%). Nu mai investim aici după ce merge demo-ul.

| ID | Îmbunătățire | Stare |
|---|---|---|
| I-20 | „Try the demo” devine CTA primar în hero | 🟡 PR #1 |
| I-21 | „Open the app” → „Sign in”, doar în header | 🟡 PR #1 |
| I-22 | CTA pe fiecare card din „We sell the worker, not the tool” | 🟡 PR #1 |
| I-23 | Formular de contact în pagină (`#contact`) | 🟡 PR #1 |

## Deck

| ID | Îmbunătățire | Stare |
|---|---|---|
| I-30 | Slide-urile de problemă rescrise cu unghi bancar | 🔴 |
| I-31 | Slide „Arhitectura agenților” (diagrama orchestrator + agenți + tools) | 🔴 |
| I-32 | Slide cu rezultatul testelor: **X din N cazuri corecte**, câte excepții prinse | 🔴 |
| I-33 | Business case refăcut pe costul procesului din bancă (cifrele vechi €1,37/comandă și piața de €730M nu mai sunt relevante) | 🔴 |
| I-34 | Inconsecvențe numerice: „~40% din costul muncii” vs 23% la oferte; €560 vs €349/lună | 🔴 |
