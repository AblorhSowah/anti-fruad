# Software Requirements Specification (SRS)

**Project:** Anti-Fraud System (internal codename: Shadow-TX Hunter)
**Type:** Anti-Money Laundering (AML) and Fraud Detection Platform
**Version:** 1.0
**Date:** 2026-08-14

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the Anti-Fraud System, a platform that ingests financial transaction data, scores it for money-laundering/fraud risk using a Graph Neural Network (GNN), and presents the results through an investigative web dashboard. It is intended for the examiner assessing this project, and for any future developer maintaining or extending the system.

### 1.2 Scope

The system allows a user (bank compliance analyst, fintech operator, or individual) to:

1. Upload a transaction CSV and map its columns to the fields the system needs.
2. Have every transaction scored automatically by a pretrained GINE (Graph Isomorphic Network with Edge features) model.
3. View dataset-level statistics and a ranked list of the most suspicious accounts and transactions.
4. Visually investigate the transaction network around any account, including a geographic view of cross-border flows.

Out of scope for the current version: user authentication/authorization, multi-tenant data isolation, real-time streaming ingestion, model retraining/fine-tuning UI, and regulatory filing (Suspicious Transaction Report) submission.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| GNN / GINE | Graph Neural Network / Graph Isomorphic Network with Edge features — the ML model architecture used for scoring |
| Risk score | A value between 0.0 and 1.0 output by the model per transaction; higher = more suspicious |
| Flagged transaction | A transaction whose risk score is at or above the active threshold (default 0.70) |
| Dataset | One uploaded CSV, scored and stored as an isolated, ID-tagged subgraph in Neo4j |
| Node / Account | A bank account, represented as a graph node |
| Edge / Transaction | A transfer between two accounts, represented as a directed graph edge |

### 1.4 References

- IBM AML synthetic transaction dataset (`HI-Small_Trans.csv`, `HI-Small_accounts.csv`)
- `SHADOW_HUNTER_DOCUMENTATION.md` (existing system documentation)
- `final-docs/proposal.md` (project proposal and Ghana case study)

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a self-contained, four-layer web application: a React single-page frontend, a FastAPI backend/API layer, a PyTorch Geometric GNN inference module, and a Neo4j graph database. It is not integrated with any external banking core system in the current version; all data enters via CSV upload.

### 2.2 Product Functions (Summary)

- Dataset ingestion with configurable column mapping
- Batch GNN risk scoring of all transactions in a dataset
- Geo-enrichment of accounts (country + coordinates) via a static account→bank lookup table
- Persistent storage of accounts and transactions as a labelled graph, partitioned by `dataset_id`
- Dashboard: aggregate stats, top suspicious accounts, threshold-adjustable flagged-transaction table
- Investigation: account-network graph traversal (1-hop, up to 100 relationships) with risk-based colour coding, plus a geographic globe view for a single flagged transfer
- Dataset lifecycle management (list, delete)
- Live backend/database connectivity status indicator

### 2.3 User Classes

| User class | Description | Primary needs |
|---|---|---|
| Compliance analyst / investigator | Uploads datasets, reviews flagged accounts/transactions, traces networks | Fast, trustworthy signal + clear evidence trail |
| Individual account holder | Uploads their own statement for self-screening | Simple upload flow, plain-language results |
| System maintainer / developer | Operates and extends the platform | Clear errors, health visibility, low operational surprise |
| Examiner (for this coursework) | Assesses the finished system | Working demo, clear docs, reproducible setup |

### 2.4 Operating Environment

- Backend: Python 3.13, FastAPI, Uvicorn, PyTorch 2.11 (CPU), PyTorch Geometric 2.7
- Database: Neo4j 5, run via Docker (`docker-compose.yml`), bolt protocol on port 7687
- Frontend: Node.js/React 19 via Vite, served on port 5173 in development
- Target OS: cross-platform (developed and verified on Windows 11 in this session)

### 2.5 Design and Implementation Constraints

- The web upload path is capped at 150,000 rows per request (`pd.read_csv(..., nrows=150000)` in `backend/main.py`); the documented practical ceiling for the browser-driven UI flow is ~50,000 rows before HTTP timeouts become a risk. Larger loads use the standalone `backend/ingest.py` script instead.
- The GNN scores transactions in a *disconnected-graph batch* — each transaction is scored as an isolated 2-node subgraph, so node-level features (e.g. account degree) are not available at scoring time. This is a deliberate performance trade-off, documented in Technical_Debt_Plan.md.
- Country/coordinate enrichment depends on a synchronous, network-bound geocoding pass (Nominatim + geopy `RateLimiter`, minimum 1 request/second) executed once at backend startup over every *unique* country string. On the reference dataset (`HI-Small_accounts.csv`, ~713k accounts, 61 unique extracted country tokens) this delays first readiness by roughly a minute under normal network conditions, and much longer if the geocoding host is unreachable (each lookup falls back to `(0.0, 0.0)` after retrying).
- Neo4j connection parameters (`bolt://localhost:7687`, `neo4j`/`password123`) are hardcoded rather than sourced from environment/config.

### 2.6 Assumptions and Dependencies

- The uploaded CSV contains, at minimum, identifiable sender, receiver, amount, and timestamp/step columns (any header names — the user maps them).
- Neo4j is reachable at `bolt://localhost:7687` before dataset-touching endpoints are called; if it is not, the backend now degrades gracefully (see FR-16) rather than crashing.
- The pretrained model artifacts (`aml_model.pth`, `*_scaler.pkl`, `ohe_encoder.pkl`) are present under `backend/ml/` and match the architecture in `model_definition.py`.

---

## 3. Functional Requirements

### 3.1 Dataset Upload & Ingestion

| ID | Requirement |
|---|---|
| FR-1 | The system shall allow a user to select a `.csv` file for upload via a drag/click file picker. |
| FR-2 | The system shall preview the uploaded file's column headers and first 5 rows before ingestion (`POST /upload/preview`). |
| FR-3 | The system shall let the user map CSV columns to required fields (sender, receiver, amount, timestamp/step) and one optional field (transaction type). |
| FR-4 | The system shall reject ingestion and show a specific error if any required field is left unmapped. |
| FR-5 | The system shall reject non-CSV files, empty files, unparsable CSVs, and CSVs whose mapped amount column contains non-numeric data, each with a distinct, human-readable error message. |
| FR-6 | The system shall drop rows with missing values in any required mapped column before scoring, and shall reject the upload with a clear message if zero rows remain afterward. |
| FR-7 | The system shall assign each successfully ingested dataset a unique ID and store it as a `Dataset` node in Neo4j with name, upload timestamp, transaction count, and flagged count. |

### 3.2 Risk Scoring

| ID | Requirement |
|---|---|
| FR-8 | The system shall score every ingested transaction with the trained AML_GINE model in a single batched forward pass. |
| FR-9 | The system shall derive edge features per transaction: log-transformed amount, cyclic (sin/cos) hour-of-day, one-hot payment format, one-hot payment currency, and a pay/receive currency-mismatch flag. |
| FR-10 | The system shall enrich each transaction with sender/receiver country and coordinates, looked up from the static account→bank mapping, defaulting to `('United States', 0.0, 0.0)` for unmapped accounts. |
| FR-11 | The system shall persist each transaction as a `TRANSFERRED` relationship between two `Account` nodes, carrying amount, computed risk score, currency, format, and geo fields, scoped to its `dataset_id`. |
| FR-12 | The system shall compute and store, per dataset, the total transaction count and the count of transactions at or above the 0.70 default flag threshold. |

### 3.3 Dashboard & Alerts

| ID | Requirement |
|---|---|
| FR-13 | The system shall list all loaded datasets with name, ID, transaction count, and flagged count, and allow deletion of a dataset (and all its graph data) with user confirmation. |
| FR-14 | The system shall display, for a selected dataset: total accounts, total transactions, and flagged-transaction count. |
| FR-15 | The system shall display accounts ranked by number of flagged outgoing transactions, with max risk score and total suspicious amount per account. |
| FR-16 | The system shall list flagged transactions (sender, receiver, amount, type, country route, risk score) ordered by risk score descending, and shall let the user adjust the flag threshold (0.50–0.99) to widen or narrow the list live. |
| FR-17 | The system shall let the user navigate from any flagged transaction or top-suspicious account directly into the Investigate view for that account. |

### 3.4 Investigation

| ID | Requirement |
|---|---|
| FR-18 | The system shall let the user query the 1-hop transaction network (incoming and outgoing, up to 100 relationships) for any account ID within a chosen dataset. |
| FR-19 | The system shall render the network as an interactive node/edge graph, colouring nodes by their maximum connected risk score (green <70%, yellow 70–85%, red >85%) and colouring/weighting edges by risk and amount. |
| FR-20 | The system shall, when arriving from a flagged-transaction click, first show a geographic "globe" view of the specific cross-border transfer (origin/destination countries, animated flow arc) before the user opts into the full network graph via "Follow the Money." |
| FR-21 | The system shall show account/transaction details in a side panel when a node or edge is clicked. |
| FR-22 | The system shall report a clear "no transactions found" or error state (with retry) when a queried account has no network data or the query fails, rather than rendering an empty screen.

### 3.5 System Feedback & Reliability *(added in this revision)*

| ID | Requirement |
|---|---|
| FR-23 | The system shall display a live backend/database connectivity indicator in the navigation bar, polled at least every 15 seconds. |
| FR-24 | The system shall surface every failed API call to the user as a readable message (not a silent failure), whether the failure is a validation error, a database-connectivity error, a timeout, or a network error. |
| FR-25 | The system shall show real upload-transfer progress during ingestion (bytes sent), followed by a clearly labelled "scoring & writing to database" state while the server-side portion of the request is in flight. |
| FR-26 | On a successful upload, the system shall present a prominent, explicit call-to-action to view the resulting analysis, rather than relying on the user noticing an updated list. |
| FR-27 | The backend shall remain reachable and able to report its own health (`GET /health`) even when Neo4j is unreachable, returning a structured error rather than crashing the process. |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | The system shall score at least 10,000 transactions in a single batched forward pass in under 5 seconds on standard CPU hardware (no GPU required). *(Verified in this session — see Testing_Report.md.)* |
| NFR-2 | Performance | Dataset ingestion via the web upload path shall complete within the HTTP client timeout (configured at 10 minutes) for datasets up to 150,000 rows. |
| NFR-3 | Usability | Every user-facing error shall state, in plain language, what failed and — where actionable — what to do next (e.g. "Is the backend running?"). |
| NFR-4 | Usability | The interface shall provide visible feedback (progress, spinner, or explicit success/error state) for every operation that takes longer than ~1 second. |
| NFR-5 | Reliability | A Neo4j outage shall degrade the affected endpoints (503 with a diagnostic message) without crashing the API process or blocking unrelated endpoints. |
| NFR-6 | Reliability | The backend shall not fail to start solely because the database is temporarily unreachable at boot. |
| NFR-7 | Maintainability | Backend error responses shall be structured JSON (`{"detail": "..."}`) so the frontend can render them without provider-specific parsing. |
| NFR-8 | Portability | The system shall run on Windows, macOS, and Linux via the same Docker Compose + `pip`/`npm` toolchain, with no OS-specific code paths. |
| NFR-9 | Security *(baseline, not yet hardened — see Technical_Debt_Plan.md)* | The system shall not display raw database credentials or internal stack traces to the end user (structured error messages only). |
| NFR-10 | Data quality | Country enrichment shall resolve to a real, geocodable country for at least 90% of accounts in the reference dataset. *(Currently not met — see the "First Bank of X" defect in Testing_Report.md; tracked as technical debt.)* |

---

## 5. External Interface Requirements — API Summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Backend + Neo4j connectivity check |
| GET | `/datasets` | List datasets |
| DELETE | `/datasets/{dataset_id}` | Delete a dataset and its graph data |
| POST | `/upload/preview` | Return column headers + sample rows for a CSV |
| POST | `/upload` | Ingest, score, and persist a dataset |
| GET | `/alerts/suspicious` | Flagged transactions for a dataset, above a threshold |
| GET | `/accounts/top-suspicious` | Accounts ranked by flagged outgoing transaction count |
| GET | `/account/{account_id}/network` | 1-hop transaction network for an account |
| GET | `/stats` | Dataset-level statistics |

Full request/response shapes are implemented in `backend/main.py` and consumed via `frontend/src/api.js`.

---

## 6. Requirements Traceability Note

Requirements FR-1 through FR-22 describe the system as it existed prior to this revision (verified working against the running prototype). FR-23 through FR-27 and NFR-3 through NFR-7 were added and implemented in this revision specifically to close the "upload succeeds but the user gets no feedback" defect reported against the system — see Testing_Report.md §2 for verification evidence.
