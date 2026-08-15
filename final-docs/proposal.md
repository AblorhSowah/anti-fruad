**PROJECT PROPOSAL**

# Anti-Fraud System

*A Graph Neural Network Platform for Detecting Fraud and Money Laundering in Financial Transactions, with Reference to Ghana*

 AML Intelligence Platform | System name: Anti-Fraud System (formerly "Shadow-TX Hunter")


---

## 1. Executive Summary

Anti-Fraud System is a proposed Anti-Money Laundering (AML) and fraud detection platform that allows banks, fintechs, mobile money operators, and individual account holders to upload transaction records for automated risk scoring. Rather than relying on static, rule-based thresholds, which are easily evaded by sophisticated actors, the system applies a Graph Neural Network (GNN) that learns to recognise the structural patterns of laundering and fraud, such as fan-out smurfing, layering, structuring, and circular fund movement, directly from the relationships between accounts.

The proposal is anchored in a documented rise in fraud and money laundering cases connected to Ghana over the past two years, including large-scale romance scam and wire fraud networks prosecuted in the United States, illegal foreign exchange operations broken up by the Ghana Police Service and Bank of Ghana, and a major corruption and money laundering case brought by Ghana's Office of the Special Prosecutor against officials of the National Petroleum Authority. These cases, detailed in Section 3, illustrate both the scale of the problem and the specific transaction patterns the proposed system is designed to detect.

Section 4 onward presents the technical design, which builds on an existing working prototype, internally codenamed Shadow-TX Hunter, comprising a FastAPI backend, a PyTorch Geometric GNN scoring engine, a Neo4j graph database, and a React investigative dashboard with globe and network-graph visualisation.

---

## 2. Background and Problem Statement

Money laundering and transaction fraud remain difficult to detect because illicit actors deliberately structure their activity to stay beneath the thresholds and rule patterns that conventional compliance systems are built to catch. A transaction-by-transaction, rule-based screen, for example flagging any single transfer above a fixed amount, cannot see that ten smaller transfers from different accounts are converging on the same destination within a short window, or that funds are being passed through a chain of intermediary accounts before returning to their origin.

The central design problem this project addresses is: how can a detection system reason about the shape of financial relationships, not just the value of individual transactions, in a way that is usable by investigators who are not data scientists? The proposed answer is to represent transaction data as a graph, where accounts are nodes and transactions are edges, and to apply a Graph Neural Network that scores risk based on the topology of that graph.

---

## 3. Case Study: The Rising Incidence of Fraud and Money Laundering in Ghana

Ghana has, over the past two years, featured prominently in a series of high-profile fraud and money laundering prosecutions, both domestically and through joint operations with international law enforcement. These cases motivate the proposed system and provide realistic detection scenarios against which it can be evaluated.

### 3.1 Transnational Romance and Wire Fraud Networks

A pattern of romance-scam-linked money laundering involving Ghanaian nationals has drawn sustained attention from United States federal prosecutors. In March 2026, a Ghanaian national extradited to the United States pleaded guilty to conspiracy to commit wire fraud after a scheme that used business email compromise and romance scams to steal more than one hundred million dollars from American victims between 2016 and 2023, and he agreed to pay over ten million dollars in restitution.

In December 2025, a Ghanaian national known online as "Abu Trica" was arrested in Ghana on charges of running romance scams that took more than eight million dollars from elderly victims, reportedly using artificial intelligence tools to construct false identities. A related case in May 2026 saw two Ghanaian brothers and a United States-based woman indicted for a similar romance fraud and money laundering scheme that had operated since mid-2024, again targeting elderly Americans through dating platforms and social media.

A further defendant in a related network, a twenty-nine-year-old Ghanaian citizen, was sentenced to seventy-one months in prison and ordered to pay over three hundred and seventy thousand dollars in restitution after pleading guilty to conspiracy to commit wire fraud and money laundering. In June 2026, Moroccan authorities separately arrested a Ghanaian fugitive wanted by the United States on an Interpol Red Notice for an alleged fraud and money laundering operation that used a complex network of international bank transfers to conceal the origin of funds.

### 3.2 Domestic Corruption and Public-Sector Money Laundering

Ghana's Office of the Special Prosecutor has also pursued major domestic cases. In one active matter, the Office charged five individuals and three companies, including the former Chief Executive Officer of the National Petroleum Authority, with corruption and money laundering offences under the Anti-Money Laundering Act, 2020 (Act 1044). The case involves unlawful payments totalling more than two hundred and ninety-one million Ghana cedis and over three hundred and thirty-two thousand United States dollars, allegedly funnelled into land purchases, house construction, trucks for an oil distribution business, and fuel filling stations.

A separate 2025 case saw Ghana's Attorney-General move to prosecute twelve individuals over a fifty-six-million-dollar fraud involving former officials of the National Service Secretariat, following an investigative journalism exposé.

### 3.3 Illegal Foreign Exchange and Cash-Based Laundering

Alongside cross-border wire fraud, Ghana has seen a sustained crackdown on illegal foreign exchange trading, a common cash-based laundering channel. In December 2025, the Ghana Police Service's Criminal Investigation Department, working with the Bank of Ghana, arrested forty-one people in a single operation at Tudu, Kwame Nkrumah Circle, the Airport, and Osu, recovering over one million two hundred thousand Ghana cedis and quantities of foreign currency. This followed an earlier operation in November 2025 that led to twenty-eight arrests, and formed part of a nationwide crackdown that had, by that point, resulted in ninety arrests since August 2025.

### 3.4 Institutional Response

Ghana's Financial Intelligence Centre, established under the Anti-Money Laundering Act, is the national body responsible for receiving, analysing, and disseminating suspicious transaction reports from more than one hundred and fifty reporting institutions, including banks, fintechs, mobile money operators, and designated non-financial businesses. It participates in international information-sharing networks including GIABA, the Egmont Group, and ARIN-WA, and Ghana underwent its Third Round Mutual Evaluation in 2025 to assess the effectiveness of its AML and counter-terrorist-financing regime.

Taken together, these cases show that Ghana's exposure to financial crime spans three distinct channels: transnational cyber-enabled fraud that launders proceeds through international wire transfers, domestic public-sector corruption laundered through property and business investment, and cash-based laundering through informal foreign exchange trading. A single detection system cannot address all three through hardcoded rules, since each channel produces a different transaction topology. This is the specific gap the Anti-Fraud System is designed to close: a graph-based model that can be trained or fine-tuned to recognise the structural signature of each channel, rather than a fixed amount threshold that only catches the crudest cases.

---

## 4. Proposed System: Anti-Fraud System

The Anti-Fraud System ingests transaction data submitted by a bank, fintech, or individual account holder, scores every transaction with a trained Graph Neural Network, stores the results in a graph database, and presents findings through an investigative dashboard. The system is designed so that uploading a dataset, whether a bank's settlement file or an individual's statement export, is the only technical step required of the user; all graph construction, scoring, and visualisation happen automatically.

### 4.1 Design Objectives

- Allow both institutions (banks, payment processors) and individual users to upload transaction data for screening.
- Detect laundering and fraud typologies that are invisible to fixed-threshold rules, including fan-out smurfing, layering, structuring, and circular flows.
- Present results in a way that is usable by an investigator without a data science background, through visual risk scores, ranked account lists, and an interactive network graph.
- Score large transaction volumes fast enough to be usable in a near-real-time compliance workflow.
- Align with Ghana's Anti-Money Laundering Act, 2020 (Act 1044) reporting obligations, so that flagged transactions map naturally onto a Suspicious Transaction Report workflow.

### 4.2 System Architecture

The platform follows a four-layer architecture: a React frontend for upload, dashboard, and investigation; a FastAPI backend exposing scoring and query endpoints; a PyTorch/PyTorch Geometric GNN model for inference; and a Neo4j graph database for persistence and network traversal.

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Cytoscape.js for network visualisation |
| API layer | FastAPI (Python), exposing upload, alerts, account-network, and stats endpoints |
| ML model | PyTorch + PyTorch Geometric, Graph Isomorphic Network with Edge features (GINE) |
| Database | Neo4j 5 (graph database), enabling native traversal of account-to-account relationships |
| Geocoding | Geopy with OpenStreetMap Nominatim, for country-to-country route visualisation |

*Table 1. Proposed technology stack, carried forward from the existing prototype (codenamed Shadow-TX Hunter).*

### 4.3 Detection Typologies

The GNN is trained to recognise the graph structures below, each of which corresponds to patterns observed in the Ghana case study in Section 3.

| Typology | Graph Signature | Real-world analogue |
|---|---|---|
| Fan-out / smurfing | One account sends to many accounts in a short window | Splitting scam proceeds across mule accounts |
| Structuring | Repeated transfers between the same two accounts | Avoiding reporting thresholds on cash deposits |
| Round-tripping | Funds bounce back and forth between accounts | Layering illicit wire transfer proceeds |
| Cycle / cascade layering | Funds move in a circle through several accounts | Obscuring the origin of laundered public funds |

*Table 2. Detection typologies mapped to the case study patterns described in Section 3.*

### 4.4 User Workflow

- **Upload:** a bank, fintech, or individual uploads a CSV of transactions and maps sender, receiver, amount, timestamp, and transaction type columns.
- **Scoring:** the backend batch-scores every transaction through the GNN in a single vectorised forward pass, and writes results to the graph database.
- **Dashboard:** the user sees total accounts, total transactions, flagged transaction counts, and a ranked list of the most suspicious accounts.
- **Investigation:** clicking a flagged transaction or account opens an interactive network graph, colour-coded by risk, that traces the flow of funds outward from the account under review.
- **Reporting:** flagged transactions and their supporting graph evidence can be exported to support a Suspicious Transaction Report to the Financial Intelligence Centre.

---

## 5. Value Proposition

For institutions operating in or transacting with Ghana, the proposed system offers three concrete advantages over the fixed-threshold screening tools still common in the market.

### 5.1 Detects Patterns Rules Cannot See

As the romance fraud and structuring cases in Section 3 illustrate, illicit actors already structure transactions to fall under standard reporting thresholds. A graph-based model that scores the shape of a transaction network, rather than the size of any single transfer, is structurally harder to evade, because breaking a large transfer into many smaller ones changes the graph topology in a way the GNN is specifically trained to recognise.

### 5.2 Supports Both Institutional and Individual Users

Because the upload workflow accepts a standard transaction CSV with configurable column mapping, the same pipeline can serve a bank's settlement file, a fintech's mobile money ledger, or an individual's own bank statement, widening the system's applicability beyond large institutions to smaller reporting entities and self-screening use cases.

### 5.3 Investigator-Usable Output

The dashboard and network graph translate a machine learning risk score into a visual, explorable artefact: coloured nodes, weighted edges, and a geographic flow map. This matters because Ghana's Financial Intelligence Centre and its more than one hundred and fifty reporting institutions depend on human analysts to convert flagged activity into an actionable Suspicious Transaction Report, and a black-box score alone does not support that step.

---

## 6. Limitations and Considerations

- The current prototype is trained on IBM's synthetic AML dataset; before deployment against real Ghanaian transaction data, the model would need retraining or fine-tuning on labelled local data to reflect Ghana-specific typologies such as mobile money layering.
- Large uploads (over roughly fifty thousand rows) currently require a direct ingestion script rather than the web upload interface, and would need a production-grade asynchronous ingestion pipeline.
- Any deployment handling real customer financial data would need to satisfy Bank of Ghana and Financial Intelligence Centre data handling, KYC, and audit-trail requirements, which fall outside the current prototype's scope and would require dedicated compliance engineering.
- A GNN risk score is a decision-support signal, not a legal determination; every flagged transaction still requires human review before any filing or account action.

---

## 7. Conclusion

The prosecutions, arrests, and enforcement actions summarised in Section 3, spanning transnational romance fraud networks, public-sector corruption, and cash-based foreign exchange laundering, demonstrate that Ghana's exposure to financial crime is active, varied in typology, and growing in scale. The Anti-Fraud System is proposed as a response to that specific pattern of risk: a Graph Neural Network platform that lets both institutions and individuals upload transaction data, that detects laundering and fraud through the structure of financial relationships rather than fixed thresholds, and that presents its findings in a form investigators can act on. The existing prototype, described in Section 4 and demonstrated with the IBM AML benchmark dataset, provides a working foundation; the next phase of this project is to validate and, where necessary, retrain the model against Ghana-specific transaction data and reporting requirements.

---

*Sources: Ghanamma; Ghana News Agency; U.S. Department of Justice (Northern District of Ohio); Morocco World News; AllAfrica; Ghana Financial Intelligence Centre; Bank of Ghana / FIC AML-CFT Guidelines.*