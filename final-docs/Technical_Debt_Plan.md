# Technical Debt Plan

**Project:** Anti-Fraud System
**Date:** 2026-08-14

Each item follows **Debt → Cause → Impact → Priority → Proposed Resolution**, and is classified as one of:

- 🟢 **Acceptable temporarily** — fine to ship with, revisit opportunistically
- 🟡 **Scheduled for future resolution** — should be fixed in the next development pass
- 🔴 **Critical and requiring immediate attention** — should not go into a real deployment as-is

---

## D-1. Country-extraction defect misclassifies ~12.5% of accounts

- **Debt:** `extract_country()` (duplicated in `backend/main.py` and `backend/ingest.py`) derives an account's "country" by taking the first whitespace-delimited word of its bank name and checking it against a small hardcoded stopword list (`National`, `Savings`, `Acme`, `Willows`, `Bank`, `United`, `Federal`, `Global`, `International`). Bank names that start with a different generic word slip through unfiltered.
- **Cause:** Design shortcut — a heuristic built for a specific slice of the IBM sample data, not validated against the full `HI-Small_accounts.csv`.
- **Impact:** Verified in this session (see `Testing_Report.md` §2): `First` (53,074 accounts), `Crytpo` (30,450 accounts, a dataset-native misspelling), and `Flagstone` (5,342 accounts) are all treated as "countries" — 88,866 of 712,688 accounts, ≈12.5%. These either geocode to nothing (`(0.0, 0.0)` fallback) or to something semantically wrong, directly degrading the Dashboard's route column and the Investigate page's globe view. It also duplicates logic between `main.py` and `ingest.py`, so any fix must be applied twice unless refactored (see D-6).
- **Priority:** 🔴 **Critical** — this is a correctness bug in a feature the whole Investigate page depends on, not a cosmetic issue.
- **Proposed resolution:** Replace the heuristic with a proper country column if one can be sourced or derived from the entity/bank ID data; failing that, expand and externalize the stopword list (config file, not a hardcoded set) and add a unit test asserting every unique first-word token in `HI-Small_accounts.csv` either resolves to a real country or is filtered. Do this once, in a shared module imported by both `main.py` and `ingest.py`.

---

## D-2. Hardcoded Neo4j credentials

- **Debt:** `URI, AUTH = "bolt://localhost:7687", ("neo4j", "password123")` is a literal in both `backend/main.py` and `backend/ingest.py`.
- **Cause:** 48-hour/prototype time constraint — fastest path to a working local demo.
- **Impact:** Low today (local-only, default Docker Compose password), but becomes a real credential-leak risk the moment the repository is shared or the system is deployed with these values unchanged.
- **Priority:** 🟡 **Scheduled for future resolution** — must be resolved *before* any deployment (see `Deployment_and_Source_Links.txt` and Project_Documentation.md §13), 🟢 acceptable for continued local development in the meantime.
- **Proposed resolution:** Move to environment variables (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`) read via `os.environ`, with the current literals only as local-dev fallback defaults. Rotate the demo password before any public deployment.

---

## D-3. Fully open CORS policy

- **Debt:** `app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])`.
- **Cause:** Design shortcut to avoid CORS friction during local frontend/backend development.
- **Impact:** Any website can call this API from a user's browser today. Low impact while the API also has no authentication and no sensitive multi-tenant data, but compounds badly with D-4 the moment either changes.
- **Priority:** 🟡 **Scheduled for future resolution**, 🔴 **Critical before public deployment**.
- **Proposed resolution:** Restrict `allow_origins` to the deployed frontend's actual origin(s) via configuration, once a deployment target is chosen.

---

## D-4. No API authentication or authorization

- **Debt:** Every endpoint in `backend/main.py` is unauthenticated and unauthorized — any caller can upload, delete, or read any dataset.
- **Cause:** Scoped out under the 48-hour constraint; the brief's requirement to "implement authentication/authorization where required" was deferred in favour of the core detection pipeline.
- **Impact:** Acceptable for a local single-user demo; unacceptable for any deployment handling real or even realistic-looking financial data, and blocks the "Test-user credentials / Admin credentials" requirement in the submission brief.
- **Priority:** 🔴 **Critical before deployment** (directly blocks a brief requirement), 🟢 acceptable for the current local-only demo.
- **Proposed resolution:** Add a minimal auth layer (e.g. FastAPI's `OAuth2PasswordBearer` + JWT, or a simple API-key header for a coursework-scale deployment) in front of mutating endpoints (`/upload`, `/datasets/{id}` DELETE) at minimum, before dataset-scoped read endpoints if multi-user isolation is required.

---

## D-5. Synchronous, network-blocking geocoding at startup

- **Debt:** `load_account_map()` runs once at import time and calls Nominatim (rate-limited to 1 request/second via geopy's `RateLimiter`) for every *unique* extracted country string before the app can serve any request.
- **Cause:** Design shortcut — geocode-once-and-cache was the simplest correct approach, but was never moved off the request/startup path.
- **Impact:** Verified in this session: ~70–90 seconds of startup delay in a network-restricted environment; even under ideal network conditions, 61 unique countries × 1 req/sec ≈ 61 seconds before `/health` responds. During this window every request appears as "backend offline" to the new connectivity badge (correct behaviour, but a poor first impression).
- **Priority:** 🟡 **Scheduled for future resolution**.
- **Proposed resolution:** Precompute and cache the country→coordinates table to a checked-in file (it rarely changes for a fixed reference dataset), loading it synchronously in milliseconds; only fall back to live geocoding for genuinely new/unseen bank-name tokens.

---

## D-6. Duplicated ingestion logic between `main.py` and `ingest.py`

- **Debt:** `extract_country()`, `geocode_country()`, `load_account_map()`, and `flush()` are copy-pasted between `backend/main.py` (the API's `/upload` path) and `backend/ingest.py` (the standalone bulk-load script).
- **Cause:** Code duplication — `ingest.py` was written as a fast-path bulk loader without factoring shared logic into a common module.
- **Impact:** Any fix (e.g. D-1) must be applied twice or it silently regresses in one path. No functional impact today beyond maintenance risk.
- **Priority:** 🟢 **Acceptable temporarily**.
- **Proposed resolution:** Extract the shared functions into `backend/ingestion_common.py` (or similar) and import from both entry points.

---

## D-7. Zeroed node features during batch inference

- **Debt:** `model_handler.AMLInference.predict_batch()` scores each transaction as an isolated 2-node subgraph with node features hardcoded to zero (`node_feats = np.zeros((2 * n, 2))`), because per-account degree/history isn't available at ingestion time in the current pipeline.
- **Cause:** Simplified architecture — a deliberate trade-off documented directly in the code comment ("no degree info during ingestion") to make single-pass batch scoring of 150,000 transactions in under 30 seconds possible.
- **Impact:** The model cannot use any structural signal beyond the single edge being scored, which likely explains the low/zero flagged-transaction counts observed on the real 10,000-row dataset ingested during this session (see `Testing_Report.md` §2). This directly limits the system's core value proposition (detecting *graph-structure* patterns like fan-out and cycles) at ingestion time — those patterns are only visible after the fact, when a human explicitly opens the Investigate network view.
- **Priority:** 🟡 **Scheduled for future resolution** — this is a real gap between the marketed capability ("detects laundering through graph structure") and what ingestion-time scoring can currently see.
- **Proposed resolution:** Compute a first pass of true node features (in/out degree, transaction count, total volume) over the full uploaded batch before scoring, since all transactions are available at once at ingestion time — this doesn't require real-time streaming and is compatible with the existing batch design.

---

## D-8. No automated test suite

- **Debt:** The project has no unit or integration test files (`pytest`, `vitest`, etc.); this session's verification was manual, ad hoc, and against a live process.
- **Cause:** Limited testing under the 48-hour constraint, and the coursework brief's testing requirement was satisfied via manual test documentation (`Testing_Report.md`) instead.
- **Impact:** Regressions (e.g. reintroducing D-1-style heuristics, or breaking the error-handling added this session) would not be caught automatically.
- **Priority:** 🟡 **Scheduled for future resolution**.
- **Proposed resolution:** At minimum, add `pytest` coverage for `extract_country()` edge cases (ties directly to D-1) and for the new backend exception handlers (assert `/health`, `/upload/preview`, `/upload` return structured JSON under a simulated Neo4j outage).

---

## D-9. ESLint hook-ordering / set-state-in-effect violations

- **Debt:** `DatasetsPage.jsx` and `InvestigatePage.jsx` declare `fetchDatasets`/`loadNetwork` as `const` functions referenced inside a `useEffect` that runs above their declaration; `DashboardPage.jsx` and `InvestigatePage.jsx` call `setState` synchronously as the first statement inside several effect bodies (e.g. resetting `loaded`/`txLoading` before a fetch). ESLint's `react-hooks/immutability` and `react-hooks/set-state-in-effect` rules flag both patterns.
- **Cause:** Incomplete refactoring for the hook-ordering cases (predates the current ESLint hook rule set). The set-state-in-effect cases are a deliberate, consistent convention used throughout this codebase (reset loading/error state at the top of a data-fetch effect) that a newer, stricter lint rule now flags — the transactions-table feature added to `InvestigatePage.jsx` follows the same existing convention as `DashboardPage.jsx`'s original fetch effect, so it inherits the same two extra findings rather than introducing a new pattern.
- **Impact:** No runtime defect in either case — hoisted `const` bindings resolve correctly before effects fire post-mount, and resetting loading/error flags synchronously at the top of an effect is a standard, safe React pattern. It does mean `npm run lint` fails cleanly (8 errors / 4 warnings as of this revision, up from 6/4 at the previous revision — the 2 new ones are both `set-state-in-effect` findings in the new `InvestigatePage.jsx` transactions-table effects, verified via `git stash` + re-lint against the true pristine baseline).
- **Priority:** 🟢 **Acceptable temporarily** — no functional impact, and fixing it well means a deliberate pass across all four files at once (see resolution) rather than a piecemeal patch each time a new effect is added.
- **Proposed resolution:** Reorder function declarations above the effects that reference them; for the set-state-in-effect findings, either accept them as a known, intentional pattern (simplest) or refactor to a shared `useAsyncFetch`-style hook that encapsulates the loading/error/data state transitions in one place, so new fetch effects stop adding to this count one at a time.

---

## D-10. Model trained only on IBM's synthetic dataset

- **Debt:** `aml_model.pth` was trained exclusively on IBM's synthetic AML benchmark, not on real or regionally-representative transaction data.
- **Cause:** Dependency/scope choice — the synthetic dataset is what was available and is purpose-built to contain known laundering typologies for demonstration.
- **Impact:** Already identified in `final-docs/proposal.md` §6: before any deployment against real Ghanaian (or any real-world) transaction data, the model needs retraining or fine-tuning on labelled local data to reflect region-specific typologies (e.g. mobile money layering).
- **Priority:** 🟡 **Scheduled for future resolution** — not blocking for a coursework demo, blocking for the proposal's stated real-world ambition.
- **Proposed resolution:** As stated in the proposal's conclusion: validate and, where necessary, retrain against Ghana-specific transaction data and FIC reporting requirements as the next project phase.

---

## D-11. Incomplete documentation *(partially resolved this session)*

- **Debt:** Prior to this session, the repository had no SRS, testing report, technical debt plan, deployment instructions, or effort estimation — only a system overview (`SHADOW_HUNTER_DOCUMENTATION.md`) and a proposal document.
- **Cause:** Incomplete documentation under the 48-hour constraint.
- **Impact:** Blocked the coursework submission requirements directly.
- **Priority:** 🟢 **Resolved** for the documents now present in `final-docs/` (this plan, `SRS.md`, `Testing_Report.md`, `User_Manual.md`, `Deployment_and_Source_Links.txt`, `Project_Documentation.md`). 🟡 Remaining: keep these in sync as the system changes — they describe the system as of 2026-08-14 and will drift if endpoints or the UI change without a documentation pass.
- **Proposed resolution:** Treat `final-docs/` as living documentation; update alongside any future functional change, not as a one-off exercise.

---

## Priority Summary

| Priority | Items |
|---|---|
| 🔴 Critical | D-1 (country extraction), D-4 (no auth, before deployment) |
| 🟡 Scheduled | D-2, D-3, D-5, D-7, D-8, D-10 |
| 🟢 Acceptable for now | D-6, D-9, D-11 |
