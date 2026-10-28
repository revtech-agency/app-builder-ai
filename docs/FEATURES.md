# FEATURES — AppBuilder.ai

> Fiecare feature are: ID, prioritate, criteriul de jurizare pe care îl atacă, owner, stare.
> **Prioritate = cât cântărește la juriu**, nu cât de frumos e. P0 = fără el pierdem, P1 = ne ridică nota, P2 = după hackathon.

Criterii juriu (cod scurt): **ORIG** 15% · **DOM** 15% · **AGENT** 25% · **FUNC** 20% · **ARCH** 15% · **BIZ** 10%

## P0 — scenariul de bază care trebuie să ruleze live

| ID | Feature | Criteriu | Owner | Stare |
|---|---|---|---|---|
| F-01 | **Agent de intake**: citește input (email / formular), extrage date structurate | AGENT, FUNC | ⚠️ | 🟡 comenzi: în n8n, nu în repo. Facturi: doar prompt (`prompts/n8n/`) |
| F-02 | **Agent de potrivire**: mapează coduri/denumiri client la catalog, convertește cantități | AGENT, DOM | ⚠️ | 🟡 conversia în pachete e în cod (`order-rules.ts`); potrivirea pe cod client e în n8n, neverificabilă. Facturi: three-way match doar în prompt |
| F-03 | **Agent de risc**: reguli fixe în cod (expunere, restanțe, dubluri, limite) — LLM-ul NU decide pe bani | AGENT, DOM | Lip (propus) | 🟡 comenzi: restanță + stoc + pachete în `order-rules.ts` (cod, testat). Facturi: regulile sunt într-un *Code node* n8n (în afara repo-ului) și pragurile (5.000/25.000, ±2%) ar fi duplicate în `invoice-rules.ts` planificat |
| F-04 | **Orchestrator**: decide pașii, rutează spre excepție, reîncearcă la erori de tool | AGENT | ⚠️ | 🔴 |
| F-05 | **Coada de excepții** pentru om: motiv clar, ce a văzut agentul, ce propune | AGENT, FUNC | ⚠️ | 🟡 clientul vede `exception_reason` pe pagina Orders; ecran de operator/coadă NU există (doar în prompt Lovable pentru facturi) |
| F-06 | **Mock API bancar** (sold, tranzacții, plăți primite) în format apropiat de PSD2 | AGENT (tool use), DOM | ⚠️ | 🔴 |
| F-07 | **Trace per caz**: fiecare decizie salvată cu pas, tool apelat, input, output, regula aplicată | FUNC, ARCH | ⚠️ | 🟡 notă de audit în HubSpot doar în datele seed (`setup.ts`); `placeOrder` nu scrie notă. Facturi: notă de audit cerută în prompt |
| F-08 | **Set de date sintetice** + script care rulează tot setul și scoate X/N corecte | FUNC, DOM | Lip (propus) | 🟡 comenzi: 12 cazuri cu rezultat așteptat în `scripts/hubspot/data/`, fără runner. Facturi: cele 12 documente din prompt NU există |
| F-09 | **Demo „Try the demo”** funcțional din landing | FUNC | Daniel | 🟡 pe `main` (magic-link, cont non-admin, vede doar compania demo). Netestat live |

## P1 — ridică nota

| ID | Feature | Criteriu | Owner | Stare |
|---|---|---|---|---|
| F-10 | Învățare din corecturi: când omul corectează o potrivire, se salvează ca regulă / alias | ORIG, AGENT | ⚠️ | 🟡 doar model de date: `client_code_as_written` pe line items = harta de coduri. Nicio logică în repo |
| F-11 | Agent financiar: factură → reconciliere plată → propunere finanțare (dacă D2 = order-to-cash) | ORIG, DOM, BIZ | ⚠️ | 🔴 |
| F-12 | Ecran pentru angajatul băncii (ofițer / operator) cu coada de excepții și trace-ul | FUNC, BIZ | ⚠️ | 🔴 |
| F-13 | Juriul poate trimite singur un input în demo (email / formular) | FUNC | ⚠️ | 🔴 — risc mare, doar dacă e stabil |
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
