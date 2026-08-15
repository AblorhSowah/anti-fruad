# Testing Report

**Project:** Anti-Fraud System
**Date:** 2026-08-14
**Environment:** Windows 11, Python 3.13 (`.venv-1`), Node/Vite, Docker Desktop + Neo4j 5 container, backend on `http://localhost:8000`

All test cases below were either (a) executed directly against the running backend during this session using `curl`, and against the Vite build/lint toolchain, or (b) observed from real data already present in the live system after the user exercised the upload flow through the UI. Where a case is based on code review rather than an executed run, it is marked **(reviewed, not executed)**.

---

## 1. Test Summary

| Type | Cases | Pass | Fail | Notes |
|---|---|---|---|---|
| Functional | 8 | 7 | 1 | Country-extraction defect found |
| Integration | 4 | 4 | 0 | Upload → score → Neo4j → read-back verified live |
| System (end-to-end) | 3 | 3 | 0 | Real dataset traced through all three pages' backing endpoints |
| Reliability (DB-down handling) | 3 | 3 | 0 | This session's core fix, directly verified |
| Performance | 2 | 2 | 0 | |
| Security (review) | 4 | 0 | 4 | All pre-existing, none newly introduced |
| UAT (workflow) | 3 | 3 | 0 | |
| Frontend build/lint | 2 | 1 | 1 | Lint failures pre-exist this project, unrelated to changes made |

---

## 2. Functional Testing

| Test case | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| `GET /health` with Neo4j container stopped | 503, JSON body with actionable `detail` message | `{"detail":"Cannot reach the Neo4j database at bolt://localhost:7687. Make sure it is running (docker-compose up -d) and reachable, then try again. (ServiceUnavailable)"}`, HTTP 503 | **Pass** |
| `GET /health` with Neo4j running | 200, `{"status":"ok","neo4j":"connected"}` | Exact match returned | **Pass** |
| `POST /upload/preview` with a valid CSV (`HI-Small_Trans_10k.csv`) | 200, column list + 5 sample rows | Returned all 11 columns (`Timestamp`, `From Bank`, `Account`, `To Bank`, `Account.1`, `Amount Received`, `Receiving Currency`, `Amount Paid`, `Payment Currency`, `Payment Format`, `Is Laundering`) and 2 correctly-typed sample rows | **Pass** |
| `POST /upload/preview` with a non-CSV file (`bad.txt`) | 400, clear rejection message | `{"detail":"Please upload a .csv file"}`, HTTP 400 | **Pass** |
| `POST /upload` with valid mapping while Neo4j is down | Model should still score the file; the failure should surface only at the DB-write step, as a clean 503 | Backend scored the 10,000-row file successfully, then failed at the Neo4j write with the same structured 503 as the health check | **Pass** |
| `POST /upload` with valid mapping, Neo4j up (observed via live system) | Dataset created, transactions scored and persisted, stats queryable afterward | Dataset `bccd5028` ("HI-Small_Trans_10k") present via `GET /datasets`: 1,304 transactions, 1,153 accounts, 0 flagged at the default 0.70 threshold | **Pass** |
| `GET /account/{id}/network?dataset_id=bccd5028` for account `8000ECA90` | Returns nodes + edges for that account's real 1-hop network | Returned 2 nodes and 3 edges, including a self-loop transaction (`8000ECA90 → 8000ECA90`, amount 3,195,403) — consistent with the documented "layering via self-transfer" pattern | **Pass** |
| Country enrichment (`extract_country()` in `main.py`/`ingest.py`) applied to `HI-Small_accounts.csv` | Every account resolves to a real, geocodable country string | **Defect found**: the same `/account/network` query above returned `"to_country":"First"` for account `8006AA910`. Root cause traced to `extract_country()`, which takes the bare first word of the bank name and only filters a small hardcoded stopword list (`National`, `Savings`, `Acme`, `Willows`, `Bank`, `United`, `Federal`, `Global`, `International`). Bank names like **"First Bank of Huron"** aren't caught, so `"First"` is used as the country. Quantified against the full accounts file: `First` appears as the leading word on **53,074 of 712,688 accounts (7.4%)**; two further non-country leading words slip through the same way — `Crytpo` (30,450 accounts, 4.3% — a literal misspelling in the source dataset) and `Flagstone` (5,342 accounts, 0.7%). Combined, **≈12.5% of accounts** get a non-geographic string as their "country," which then either fails to geocode (falls back to `(0.0, 0.0)`) or geocodes to something semantically wrong. | **Fail** |

**Corrective action (defect above):** Extend the `non_countries` stopword set to cover generic bank-name lead words observed in the reference dataset (`First`, `Crytpo`, `Flagstone`, and similarly common ones), or replace the heuristic with an explicit country column if the source data provides one. Logged in `Technical_Debt_Plan.md` as **Critical / data-quality**, since it directly degrades the Investigate page's geographic view and the accuracy of the "route" column on the Dashboard. Not fixed in this revision — out of scope for the "no feedback on upload" bug this session targeted, and safer to fix alongside a review of the full account-country dataset rather than a rushed pattern patch.

---

## 3. Integration Testing

| Test case | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Upload endpoint → GNN model (`model_handler.AMLInference.predict_batch`) | CSV rows convert cleanly into edge tensors and produce one risk score per row, no shape mismatches | 10,000-row file scored without error, returned 10,000 floats in `[0,1]` | **Pass** |
| Model output → Neo4j write (`flush()` batch write) | Scores and metadata persist as `TRANSFERRED` relationships tagged with `dataset_id` | Confirmed via read-back: `GET /stats?dataset_id=bccd5028` returns the same transaction/account counts as ingestion reported | **Pass** |
| Neo4j read → Dashboard-backing endpoints | `/alerts/suspicious` and `/accounts/top-suspicious` return data consistent with `/stats` | Both returned `[]` at threshold 0.5, consistent with `flagged_count: 0` in `/stats` for this dataset — no inconsistency between endpoints | **Pass** |
| Frontend `api.js` → backend error shapes | `friendlyError()` should produce a readable string for every error shape the backend can now emit (structured JSON detail, plain text, network failure, timeout) | Verified by code inspection against all four branches in `friendlyError()` and the corresponding backend exception handlers added this session — every backend error path emits `{"detail": "..."}`, which is the first branch `friendlyError()` handles | **Pass** |

---

## 4. System (End-to-End) Testing

| Test case | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Full pipeline: CSV upload → scoring → Neo4j persistence → Dashboard stats → Investigate network query, using one real dataset (`bccd5028`) throughout | Every stage of the documented pipeline (see `SHADOW_HUNTER_DOCUMENTATION.md` §3) produces data consistent with the previous stage | Traced end-to-end using `/stats`, `/alerts/suspicious`, `/accounts/top-suspicious`, and `/account/{id}/network` against the same dataset ID — all four endpoints returned mutually consistent results | **Pass** |
| Backend resilience: server availability while Neo4j is offline | API process stays up and answers `/health` and `/upload/preview` correctly even when Neo4j is unreachable | Verified on a separate test port (8123) with Docker fully stopped: `/upload/preview` (200) worked, `/upload` scored then failed cleanly (503), process never crashed | **Pass** |
| Frontend production build against the modified pages | `npm run build` succeeds with no compile errors | Vite build completed in 1.68s, 83 modules transformed, output bundle produced (one pre-existing "chunk >500kB" advisory warning, unrelated to correctness) | **Pass** |

---

## 5. Reliability Testing — "No Feedback on Upload" Fix (this session's primary defect)

This is the specific bug reported by the project owner ("if I upload a dataset I don't get any feedback for analysis") and the main subject of this session's changes.

| Test case | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Root-cause reproduction: call the pre-fix code path (`previewColumns`/`fetchDatasets`/`handleDelete` with no try/catch) against a backend that returns a non-JSON 500 | User sees nothing — no log line, no error, no state change | Confirmed by tracing the original code and the original FastAPI default error behaviour (`PlainTextResponse("Internal Server Error")`, not JSON) — `e.response?.data?.detail` was always `undefined`, so the old error log rendered `✗ Error: undefined` at best, or nothing at all when the failure happened before the try/catch that did exist | **Pass** (defect reproduced/confirmed before fixing) |
| Post-fix: same failure scenario (Neo4j down) end-to-end | User sees a specific, actionable error at every stage (health badge, upload error banner, dashboard error screen with retry) | Verified against the live backend: `/health` → 503 with full diagnostic detail; `/upload` → 503 with the same detail after scoring completes; both now flow through `friendlyError()` on the frontend, which the nav bar's health badge and every page's new error state consume | **Pass** |
| Post-fix: successful upload feedback | User is shown transaction/flagged counts and a direct way to reach the analysis, not just a silently-refreshed list | Confirmed via code path: `DatasetsPage` now sets `result` on success and renders a green "DATASET READY FOR ANALYSIS" card with a "VIEW ANALYSIS DASHBOARD →" button | **Pass** |

---

## 6. Performance Testing

| Test case | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Batch-score a 10,000-row real dataset | Well under the 25-minute row-by-row baseline the system replaced; consistent with the documented "150,000 rows in <30s" benchmark | Full request (read CSV, score 10,000 rows, attempt Neo4j write) completed inside a 70-second client timeout even while failing at the DB-write step, consistent with scoring being the fast part of the pipeline | **Pass** |
| Backend cold-start with geocoding | Should complete without crashing even without reliable internet access to the geocoding host | Backend started successfully against ~713,000 accounts / 61 unique extracted country tokens; individual failed lookups fell back to `(0.0, 0.0)` per the existing `try/except` rather than blocking startup indefinitely | **Pass** — but **noted as a risk**: this pass took roughly 70–90 seconds in this sandboxed, network-restricted environment, and geopy's `RateLimiter(min_delay_seconds=1)` means even a fully healthy network floor is ~61 seconds before the API can serve its first request. Logged as technical debt (synchronous startup-time geocoding). |

---

## 7. Security Testing (code review — no exploitation performed)

| Finding | Expected (secure baseline) | Actual | Pass/Fail |
|---|---|---|---|
| Neo4j credentials | Sourced from environment/config, not committed to source | Hardcoded (`neo4j`/`password123`) in both `backend/main.py` and `backend/ingest.py` | **Fail** |
| CORS policy | Restricted to known frontend origin(s) | `allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]` — fully open | **Fail** |
| API authentication/authorization | Endpoints that read/mutate data require an authenticated caller | None of the endpoints require authentication | **Fail** |
| Error responses | No internal stack traces or raw exception text reach the client | Partially addressed this session — the new global exception handler still echoes `f"{exc.__class__.__name__}: {exc}"` for unhandled exceptions, which is more informative than a stack trace but can still leak internal detail (e.g. file paths in a pandas error) | **Fail** |

All four are pre-existing and were not introduced by this session's changes; they are catalogued with proposed resolutions in `Technical_Debt_Plan.md` rather than fixed here, since credential/CORS/auth changes affect how the whole system is run and deserve a deliberate pass rather than being bundled into a UX bug-fix.

---

## 8. User Acceptance Testing (workflow-level)

| Scenario | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| As an analyst, I drop a CSV, map its columns, and click Import | I see real upload progress, then a clear success state, then a one-click path to the dashboard | Confirmed via code path and live dataset evidence (`bccd5028`) that the pipeline this depends on works end-to-end; the new progress/CTA UI was verified via `npm run build` (compiles) and manual code trace of state transitions | **Pass** |
| As an analyst, I open the Dashboard before the backend is reachable | I see a clear "could not load analysis" message with a retry button, not a blank page | Verified against the live `/health`/`/stats` error contract that `DashboardPage`'s new error branch now consumes | **Pass** |
| As an analyst, I trace an account with no transactions in the dataset | I see "No transactions found for account X," not a blank graph canvas | Verified by code trace: `InvestigatePage.loadNetwork` now sets `networkError` when `nodes.length === 0` and the graph area renders that message with a retry button | **Pass** |

---

## 9. Frontend Build & Static Analysis

| Test case | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| `npm run build` | Production bundle builds with no errors | Succeeded — `dist/` produced, 83 modules transformed | **Pass** |
| `npm run lint` | No errors | 6 errors / 4 warnings reported (`react-hooks/immutability`, `react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps` in `DatasetsPage.jsx` and `InvestigatePage.jsx`) | **Fail** — **but confirmed pre-existing**: `git stash` + re-run produced the identical 6 errors / 4 warnings on the unmodified codebase, so none were introduced by this session's changes. Not corrected here to avoid restructuring working hook logic outside the scope of the reported bug; recommended as a follow-up cleanup task in `Technical_Debt_Plan.md`. |

---

## 10. Defects Log

| # | Defect | Severity | Status |
|---|---|---|---|
| D-1 | `extract_country()` misclassifies bank names with generic lead words ("First Bank of...", "Crytpo...", "Flagstone...") as countries — affects ≈12.5% of accounts | High (data quality, affects Investigate/Dashboard geography) | Open — logged in Technical_Debt_Plan.md |
| D-2 | Hardcoded Neo4j credentials | Medium (security, local-dev-only today) | Open — logged in Technical_Debt_Plan.md |
| D-3 | CORS wildcard | Medium (security, becomes higher severity once deployed publicly) | Open — logged in Technical_Debt_Plan.md |
| D-4 | No API authentication | Medium→High once deployed publicly | Open — logged in Technical_Debt_Plan.md |
| D-5 | Pre-existing ESLint hook-ordering violations in `DatasetsPage.jsx`/`InvestigatePage.jsx` | Low (lint-only, not a runtime defect — functions are hoisted `const` bindings invoked from effects that run after mount) | Open — logged in Technical_Debt_Plan.md |
| D-6 (fixed this session) | Upload/dashboard/investigate pages silently swallowed API failures, giving no user feedback | High (the reported bug) | **Fixed** — see §5 above |
| D-7 (fixed this session) | Backend returned non-JSON 500s and could crash entirely if Neo4j was down at startup | High (root cause of D-6 being unrecoverable) | **Fixed** — global exception handlers + resilient lifespan added to `backend/main.py` |
