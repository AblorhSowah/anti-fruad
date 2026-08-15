# User Manual — Anti-Fraud System

*(internal codename: Shadow-TX Hunter)*

**Audience:** compliance analysts, fintech/bank operators, or individuals uploading their own transaction data for screening.

---

## 1. What This System Does

The Anti-Fraud System takes a transaction CSV, scores every transaction for money-laundering/fraud risk using a Graph Neural Network, and gives you three ways to review the results: a dashboard of flagged activity, a ranked list of the riskiest accounts, and an interactive network graph you can explore transaction-by-transaction.

Unlike a simple "flag anything over $10,000" rule, the model looks at the *shape* of the transaction network — fan-out to many accounts, money bouncing between two accounts, or funds moving in a circle — which is much harder for a bad actor to evade than a fixed threshold.

---

## 2. Getting Started

### 2.1 Prerequisites

- Python 3.10+
- Node.js 18+
- Docker Desktop (for the Neo4j graph database)

### 2.2 Start the database

```bash
docker compose up -d
```

Wait about a minute for Neo4j to finish starting (longer the first time, while the image downloads). You can check it directly at `http://localhost:7474` (login `neo4j` / `password123`).

### 2.3 Start the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload
```

The API is now at `http://localhost:8000`. The first startup takes roughly a minute while it geocodes the reference account data — this is normal.

**How you'll know it's ready:** open `http://localhost:8000/health` in a browser. You should see:

```json
{"status": "ok", "neo4j": "connected"}
```

If instead you see a `"detail"` message about Neo4j being unreachable, the database container isn't ready yet (or wasn't started) — the message tells you exactly what to check.

### 2.4 Pre-load a large reference dataset (optional)

For the full 150,000-row IBM demo dataset, use the direct ingestion script rather than the web upload (see §4.5 for why):

```bash
cd backend
python ingest.py
```

This loads the dataset under the ID `demo2025` and takes a few minutes.

### 2.5 Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Opens automatically at `http://localhost:5173/intro.html` — a short animated intro plays, then click **ENTER SYSTEM →** to reach the app.

---

## 3. Reading the Navigation Bar

At the top of every page:

- **◈ ANTIFRAUD** (top-left) — click to return to the intro page.
- **SYSTEM ONLINE / BACKEND OFFLINE** badge — a live indicator of whether the backend and database are reachable right now, refreshed every 15 seconds. If it ever says **BACKEND OFFLINE**, hover it to see exactly what's wrong (e.g. "Could not reach the backend" vs. "Neo4j unreachable") before you try to upload or investigate anything.
- **☀️ LIGHT / 🌙 DARK** — toggles the theme; your preference is remembered.
- **DATASETS / DASHBOARD / INVESTIGATE** — the three main pages, described below.

---

## 4. Datasets Page (`/app`)

This is where you upload and manage transaction data.

### 4.1 Upload a file

1. Click or drop a `.csv` file into the upload zone on the left.
2. The system reads the file's column headers and shows a **Column Mapping** panel. If the file can't be read (wrong file type, empty file, unparsable CSV), you'll see a clear red error banner explaining exactly why — this used to fail silently; it no longer does.
3. Give the dataset a name (defaults to the filename).
4. Map each required field to the matching column in your file:

| Field | What it means |
|---|---|
| Sender Account * | Source account of the transfer |
| Receiver Account * | Destination account |
| Amount * | Transaction value |
| Timestamp/Step * | When it happened, or its sequence order |
| Transaction Type | Payment method (optional) |

Fields marked `*` are required — you can't import without mapping them.

### 4.2 Import & watch progress

Click **📥 IMPORT DATASET**. You'll see, in order:

1. A short "initializing" phase.
2. **Real** upload progress (the percentage reflects actual bytes sent, not a canned animation).
3. A "Running GNN inference & writing to database..." phase with an animated progress bar while the server scores every transaction and writes it to the graph database — this step has no fine-grained progress of its own, so the bar shows a moving shimmer to make clear the system is still working, not stuck.
4. Either a **green success card** — "✅ DATASET READY FOR ANALYSIS," with the transaction and flagged counts, and a **VIEW ANALYSIS DASHBOARD →** button — or a **red error banner** telling you exactly what went wrong (bad column data, server unreachable, etc.).

The **System Log** panel on the right also records every step with a timestamp, useful if you need to check what happened after the fact.

### 4.3 Manage loaded datasets

The **Loaded Datasets** panel lists every dataset with its transaction and flagged count. **ANALYZE** takes you to the Dashboard for that dataset; **DEL** deletes it (you'll be asked to confirm) along with all its graph data.

### 4.4 Expected CSV format

At minimum your file needs sender, receiver, amount, and timestamp/step columns, with any header names (you map them in step 4.1). Optional: transaction type, payment/receiving currency.

### 4.5 A note on large files

The web upload works well for datasets under roughly 50,000 rows. For the full IBM 150,000-row reference dataset, use `python ingest.py` directly (§2.4) — very large HTTP uploads are more prone to timing out in a browser than a local script.

---

## 5. Dashboard Page (`/app/dashboard`)

Shows the threat picture for whichever dataset you selected.

- **While it loads:** a spinner with "ANALYZING DATASET …" — previously this stage showed nothing until data arrived (or nothing at all if it failed).
- **If it fails to load:** a clear "COULD NOT LOAD ANALYSIS" screen with the specific error and a **RETRY** button, instead of a page that just stays blank.
- **Stats cards:** total accounts, total transactions, flagged transactions — count up from zero when the page loads.
- **Top Suspicious Accounts:** accounts ranked by number of flagged *outgoing* transactions, with their max risk score and total suspicious amount. Click any row to jump straight into the Investigate view for that account — this is usually the fastest way to spot a smurfing hub.
- **Suspicious Transactions table:** every transaction at or above the current threshold, highest risk first, with sender, receiver, amount, type, and the country-to-country route. Click a row to open the Investigate page's geographic view for that specific transfer.
- **Threshold slider:** drag between 0.50 and 0.99 to widen or narrow what counts as "flagged." The table updates in place — moving the slider no longer flashes the whole page blank, it just shows a small "↻ updating…" indicator next to the slider while it refetches.

---

## 6. Investigate Page (`/app/investigate`)

The core investigation tool, with three states:

### 6.1 Idle globe

No account selected yet — a rotating globe with example city connections. Type an account ID into **NETWORK PROBE** and click **TRACE NETWORK**.

### 6.2 Alert globe (arrived from a Dashboard click)

Shows the specific flagged transfer geographically: a green pulsing dot at the origin country, a red pulsing dot at the destination, and an animated red arc between them. Click **◈ FOLLOW THE MONEY** to open the full network graph.

### 6.3 Network graph

The transaction network around the account, revealed node-by-node from the center outward.

- **Node colour** = that account's highest connected risk score: 🔴 red (>85%), 🟡 yellow (70–85%), 🟢 green (<70%).
- **Edge colour/thickness** = red and thicker for flagged/high-value transactions, grey and thin for normal ones; arrow direction shows the flow of money.
- **Click a node** to see its account ID, risk score, and status in the sidebar, with a **FOLLOW THE MONEY** button to re-center the graph on that account.
- **Click an edge** to see the sender, receiver, amount, and risk score of that specific transaction.
- **If the account has no transactions in this dataset, or the query fails**, you'll see a specific message (e.g. "No transactions found for account X…") with a **RETRY** button, instead of an empty graph area.

### 6.4 Reading the patterns

| What you see | What it means |
|---|---|
| One node with many outgoing red edges | Fan-out smurfing — splitting money to many accounts |
| Two nodes with multiple edges between them | Structuring — repeated transfers between the same accounts |
| Red edge in both directions | Round-tripping — money bouncing back and forth |
| Self-loop on a node | Layering — account sending to itself to obscure funds |
| Chain of red nodes | Cascade layering — money passing through multiple accounts |

---

## 7. Troubleshooting

| Problem | What to check |
|---|---|
| Nav bar says **BACKEND OFFLINE** | Hover the badge for the specific reason. If it mentions Neo4j, run `docker compose up -d` and wait ~30 seconds. If it says the backend itself is unreachable, make sure `uvicorn main:app --reload` is actually running. |
| Upload shows a red error banner | Read the message — it now states the actual problem (wrong file type, empty file, unparseable CSV, a mapped column with non-numeric data, or the backend/database being unreachable) rather than failing silently. |
| Dashboard shows "COULD NOT LOAD ANALYSIS" | Check the backend-status badge first; click RETRY once it says online. |
| Investigate says "No transactions found for account X" | Double check the account ID and that you're querying the right dataset (`dataset_id` in the URL) — the account may simply not appear in this particular dataset. |
| 0 flagged transactions on a dataset you expected findings in | Try lowering the threshold slider on the Dashboard; also note the model currently scores each transaction without knowledge of the sender/receiver's broader account history (see the Technical Debt Plan, item D-7) — some patterns are only visible once you open the Investigate network view manually. |
| Route column shows an unexpected "country" (e.g. "First") | Known data-quality issue in the bank-name-to-country mapping — see Technical Debt Plan item D-1. |
| Upload times out on a very large file | Use `python ingest.py` instead of the web upload for datasets over ~50,000 rows (§4.5, §2.4). |

---

## 8. Quick Reference — API Endpoints

For anyone integrating directly against the backend rather than the UI:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check backend + database connectivity |
| GET | `/datasets` | List datasets |
| DELETE | `/datasets/{id}` | Delete a dataset |
| POST | `/upload/preview` | Preview a CSV's columns before mapping |
| POST | `/upload` | Ingest and score a dataset |
| GET | `/alerts/suspicious` | Flagged transactions above a threshold |
| GET | `/accounts/top-suspicious` | Riskiest accounts by flagged outgoing count |
| GET | `/account/{id}/network` | 1-hop transaction network for an account |
| GET | `/stats` | Dataset-level statistics |
