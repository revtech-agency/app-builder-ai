# FEATURES — AppBuilder.ai

> Fiecare feature are: ID, prioritate, criteriul de jurizare pe care îl atacă, owner, stare.
> **Prioritate = cât cântărește la juriu**, nu cât de frumos e. P0 = fără el pierdem, P1 = ne ridică nota, P2 = după hackathon.

Criterii juriu (cod scurt): **ORIG** 15% · **DOM** 15% · **AGENT** 25% · **FUNC** 20% · **ARCH** 15% · **BIZ** 10%

## P0 — scenariul de bază care trebuie să ruleze live

| ID | Feature | Criteriu | Owner | Stare |
|---|---|---|---|---|
| F-01 | **Agent de intake**: citește input (email / formular), extrage date structurate | AGENT, FUNC | ⚠️ | 🟢 facturi: fluxul `Process supplier invoices` (Gmail + webhook `invoice-intake`, PDF → text, Information Extractor cu Claude), export în `n8n/invoice-worker/`. 🟡 comenzi: în n8n, nu în repo |
| F-02 | **Agent de potrivire**: mapează coduri/denumiri client la catalog, convertește cantități | AGENT, DOM | ⚠️ | 🟢 facturi: three-way match PO ↔ cantitate recepționată (avize) ↔ factură, pe fiecare linie (`line_check`: matched / price_off / qty_off / not_on_po), în `Apply Rules`; afișat în app la „Three-way match”. 🟡 comenzi: conversia în pachete e în cod (`order-rules.ts`); potrivirea pe cod client e în n8n, neverificabilă |
| F-03 | **Agent de risc**: reguli fixe în cod (expunere, restanțe, dubluri, limite) — LLM-ul NU decide pe bani | AGENT, DOM | Lip (propus) | 🟢 facturi: reguli fixe în *Code node* `Apply Rules` (duplicat, IBAN diferit sau schimbat în ultimele 30 de zile, furnizor neaprobat sau necunoscut, split purchase, încredere < 0,8, preț ±2%, cantitate peste recepție, certificat fiscal); pragurile de aprobare (5.000/25.000) și verificările afișate reviewerului sunt și în `invoice-rules.ts` (testat). Duplicarea TS ↔ n8n rămâne (B-10). 🟡 comenzi: restanță + stoc + pachete în `order-rules.ts` (cod, testat) |
| F-04 | **Orchestrator**: decide pașii, rutează spre excepție, reîncearcă la erori de tool | AGENT | ⚠️ | 🔴 |
| F-05 | **Coada de excepții** pentru om: motiv clar, ce a văzut agentul, ce propune | AGENT, FUNC | ⚠️ | 🟢 facturi: coada `/app/invoices` + pagina facturii cu motivul (`exception_reason`), flagurile, fiecare verificare trecută/picată, three-way match și datele furnizorului; omul decide. Comenzi: clientul vede `exception_reason` pe pagina Orders |
| F-06 | **Mock API bancar** (sold, tranzacții, plăți primite) în format apropiat de PSD2 | AGENT (tool use), DOM | ⚠️ | 🔴 |
| F-07 | **Trace per caz**: fiecare decizie salvată cu pas, tool apelat, input, output, regula aplicată | FUNC, ARCH | ⚠️ | 🟡 facturi: workerul scrie pe fiecare factură o notă de audit cu fiecare verificare și rezultatul ei; fiecare decizie umană adaugă o notă (`decideInvoice`); ambele apar în app la „Activity”. Nu există încă un timeline pas cu pas (tool, input, output). Comenzi: notă doar în datele seed; `placeOrder` nu scrie notă |
| F-08 | **Set de date sintetice** + script care rulează tot setul și scoate X/N corecte | FUNC, DOM | Lip (propus) | 🟢 facturi: 12 cazuri în `n8n/invoice-worker/test-cases.json` + `run-tests.mjs` → 12/12 corecte (`evidence/invoice-worker-run-2026-10-29.md`). 🟡 comenzi: 12 cazuri cu rezultat așteptat în `scripts/hubspot/data/`, fără runner |
| F-09 | **Demo „Try the demo”** funcțional din landing | FUNC | Daniel | 🟡 două conturi demo fără parolă (magic-link): comenzi (`DEMO_EMAIL`, vede doar compania demo) și invoice desk (`DEMO_AP_EMAIL`, cu ghid pas cu pas și Reset demo). ⚠️ Contul invoice desk e comun: Reset demo făcut de un vizitator șterge facturile trimise de altul. De retestat live înainte de prezentare |

## P1 — ridică nota

| ID | Feature | Criteriu | Owner | Stare |
|---|---|---|---|---|
| F-10 | Învățare din corecturi: când omul corectează o potrivire, se salvează ca regulă / alias | ORIG, AGENT | ⚠️ | 🟡 doar model de date: `client_code_as_written` pe line items = harta de coduri. Nicio logică în repo |
| F-11 | Agent financiar: factură → reconciliere plată → propunere finanțare (dacă D2 = order-to-cash) | ORIG, DOM, BIZ | ⚠️ | 🔴 |
| F-12 | Ecran pentru angajatul băncii (ofițer / operator) cu coada de excepții și trace-ul | FUNC, BIZ | Daniel | 🟡 invoice desk-ul e ecranul angajatului AP: coadă, detaliu, decizii, chat „Ask the worker”. Trace-ul e nota de audit, nu un timeline |
| F-13 | Juriul poate trimite singur un input în demo (email / formular) | FUNC | Daniel | 🟡 `Submit document` (text sau PDF) în invoice desk și email la `demo+invoices@appbuilder.ai`. ⚠️ Scrie în portalul demo comun |
| F-14 | Formular „Talk to us” conectat la HubSpot | BIZ | Daniel | 🟢 pe `main` (`contact-form.tsx`, Forms API, ID-uri hardcodate) |
| F-15 | Dashboard admin: MRR, venit/lună, comenzi facturabile din HubSpot | BIZ | Daniel | 🟢 `/app/dashboard`, `billing.ts` testat (nu era în ciornă) |
| F-16 | Chat „Order assistant” + coș + inventar cu reguli de pachete | FUNC, DOM | Daniel | 🟢 `/app/$companyId/*` (nu era în ciornă); chatul depinde de n8n |

## P2 — după hackathon

| ID | Feature | Notă |
|---|---|---|
| F-20 | Workerii „quote” și „purchasing” | nu contează pentru Raiffeisen |
| F-21 | Pagina `/privacy` completă | linkul există în PR #1 |
| F-22 | Multi-tenant / mai mulți clienți IMM | |

## Cum adaugi un feature

1. Rând nou în tabelul potrivit, ID următor.
2. Scrii **ce criteriu de jurizare atacă**. Dacă nu atacă niciunul → P2 automat.
3. Branch `feat/F-XX-nume-scurt`, PR cu ID-ul în titlu.
