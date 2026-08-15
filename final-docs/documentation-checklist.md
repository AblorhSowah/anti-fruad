# Documentation Checklist — Anti-Fraud System

*Derived from `system-docs/documentation.md` (the assignment brief). This file tracks every document, section, and piece of evidence the brief requires for final submission against what now exists in `final-docs/`.*

Legend: ✅ done · 🟡 drafted but needs a human decision/action to finish (e.g. actually deploying, filling in personal details) · ❌ not started

**Update (2026-08-14, second pass):** SRS, Testing Report, Technical Debt Plan, User Manual, Deployment template, and the consolidated Project Documentation have all been written. What's left is almost entirely things only the project owner can do: pick real names/IDs, actually deploy the app, and convert to PDF.

---

## 1. Final ZIP structure required (Part C)

- [x] `Project_Documentation.pdf` — ✅ content complete in `final-docs/Project_Documentation.md` (all 19 sections); 🟡 needs exporting to PDF before submission
- [x] `SRS.pdf` — ✅ complete in `final-docs/SRS.md`; 🟡 needs PDF export
- [x] `Testing_Report.pdf` — ✅ complete in `final-docs/Testing_Report.md`, including real evidence gathered against the live system; 🟡 needs PDF export
- [x] `Technical_Debt_Plan.pdf` — ✅ complete in `final-docs/Technical_Debt_Plan.md` (11 items, Debt→Cause→Impact→Priority→Resolution, prioritized); 🟡 needs PDF export
- [x] `User_Manual.pdf` — ✅ complete in `final-docs/User_Manual.md`, rebranded and rewritten around the current UI/behaviour; 🟡 needs PDF export
- [x] `Deployment_and_Source_Links.txt` — ✅ template + deployment guide written in `final-docs/Deployment_and_Source_Links.txt`; 🟡 **still needs**: real student name/ID, an actual deployment, the resulting live URL, and the source repository link filled in by the project owner
- [ ] `Supporting_Files/` — ❌ not started (screenshots of the running app, the `HI-Small_Trans_10k.csv` sample, etc.) — easy to assemble once a final walkthrough is done

> The brief allows combining everything into one comprehensive PDF as long as sections are clearly labelled — since each piece above is already a separate, clearly-headed file, either route (separate PDFs, or concatenate them in this order) works from here.

---

## 2. Consolidated `Project_Documentation` — required sections (brief §10)

All 19 present in `final-docs/Project_Documentation.md`:

- [x] 1. Project title
- [x] 2. Problem statement
- [x] 3. Aim and objectives
- [x] 4. Stakeholders
- [x] 5. Requirements analysis
- [x] 6. SRS — summarized here, full spec in `SRS.md`
- [x] 7. Software effort estimation — technique justified, task breakdown, 48h estimate
- [x] 8. System analysis — actors, use cases, data-flow diagram
- [x] 9. System design — architecture, sequence, ER/graph-schema, and component diagrams (Mermaid)
- [x] 10. Implementation — stack + what was actually built in this pass
- [x] 11. Testing — summarized here, full report in `Testing_Report.md`
- [x] 12. Technical debt — summarized here, full plan in `Technical_Debt_Plan.md`
- [x] 13. Deployment — status + what's needed, full detail in `Deployment_and_Source_Links.txt`
- [x] 14. User manual — summarized here, full manual in `User_Manual.md`
- [x] 15. Maintenance strategy — all 8 maintenance types covered
- [x] 16. Future evolution — 6 concrete next steps
- [x] 17. Limitations — carried forward from `proposal.md` §6 + 2 newly-identified ones
- [x] 18. Conclusion
- [x] 19. References

---

## 3. Requirements-phase deliverables (brief Part A) — ✅ done, in `SRS.md` §1–2 and `Project_Documentation.md` §5

- [x] Problem defined
- [x] Stakeholders/users identified
- [x] Requirements gathered and analysed
- [x] Functional requirements defined (27, `SRS.md` §3)
- [x] Non-functional requirements defined (10, `SRS.md` §4)
- [x] Requirements prioritised — informally, via the "does this change whether the reported bug is fixed / the system is safe to demo" test (`Project_Documentation.md` §5)
- [x] Software effort estimated (`Project_Documentation.md` §7)
- [x] Scope of the 48-hour build explicitly bounded (deferred items listed in §7.5 and cross-referenced to Technical Debt Plan)

---

## 4. Software effort estimation — ✅ done (`Project_Documentation.md` §7)

- [x] Technique selected and justified — expert/task-based estimation, justified against why FPA/COCOMO/UCP don't fit well
- [x] Estimated effort / person-hours — 48 hours, itemized by task
- [x] Estimated development duration — matches the brief's 48-hour window
- [x] Assumptions
- [x] Constraints
- [x] How the estimate influenced scope — explicit list of what got deferred and why

---

## 5. System design — diagram checklist — ✅ done (`Project_Documentation.md` §9)

- [x] System architecture diagram — Mermaid flowchart
- [ ] Use-case diagram — deliberately not produced; use-case list in §8.2 covers the same ground (justified in §9.5)
- [ ] Class diagram — deliberately not produced (justified in §9.5 — no meaningful class hierarchy in this codebase)
- [x] Sequence diagram — upload → score → persist flow, including the new error path
- [ ] Activity diagram — not produced (sequence + data-flow diagrams cover the same flow from two other angles)
- [x] ER / database diagram — Neo4j `Dataset`/`Account`/`TRANSFERRED` schema, rendered ER-style
- [x] Component diagram — frontend/backend/ML module boundaries
- [ ] UI wireframes — not produced as separate mockups; `User_Manual.md` describes each real page instead (justified in §9.5). **Still worth adding actual screenshots to `Supporting_Files/`.**
- [x] Data-flow diagram — `Project_Documentation.md` §8.3

---

## 6. Testing — ✅ done (`Testing_Report.md`)

- [x] Test case / Expected result / Actual result / Pass-fail / Defects / Corrective action — all recorded, per test
- [x] Functional testing — 8 cases (7 pass, 1 defect found: country-extraction affecting ~12.5% of accounts)
- [x] Integration testing — 4 cases
- [x] System testing — 3 cases, traced through one real ingested dataset end-to-end
- [x] User acceptance testing — 3 workflow-level scenarios
- [x] Security testing — 4 findings via code review (all pre-existing, logged as technical debt, none newly introduced)
- [x] Performance testing — 2 cases (batch-scoring speed, cold-start time)
- [ ] Unit testing — not applicable yet; no unit test suite exists (tracked as Technical Debt item D-8, since there's nothing to report results *of* until it's written)

---

## 7. Technical debt — ✅ done (`Technical_Debt_Plan.md`)

11 items (D-1 through D-11), each in Debt→Cause→Impact→Priority→Resolution format, classified 🔴/🟡/🟢. Includes every item originally flagged as a candidate here, plus three found during this pass's live testing (the quantified country-extraction defect, the zeroed-node-features scoring limitation, and the pre-existing lint violations).

---

## 8. Deployment — 🟡 template + guide done, actual deployment still required

- [x] `Deployment_and_Source_Links.txt` written, with every required field present
- [ ] Application actually deployed and accessible online — ❌ **requires the project owner's own hosting/Neo4j Aura accounts; not something that can be completed without those credentials**
- [ ] Live URL, admin URL (if any), and test credentials (if any) filled in with real values
- [x] Deployment blockers identified in advance (credentials in source, open CORS, no auth, `localhost`-only Neo4j) so the deploy pass doesn't hit them as surprises

---

## 9. Maintenance and future evolution — ✅ done (`Project_Documentation.md` §15–16)

- [x] Corrective / Adaptive / Perfective / Preventive maintenance
- [x] Security updates
- [x] Dependency updates
- [x] Performance improvements
- [x] Scalability plan
- [x] New feature roadmap
- [x] User feedback loop
- [x] Technology change considerations
- [x] Technical debt repayment plan — each `Technical_Debt_Plan.md` item has its own "Proposed resolution," and §16 sequences the highest-value ones

---

## 10. Final pre-submission checklist (verbatim from the brief)

- [x] Defined a realistic software problem
- [x] Identified stakeholders and users
- [x] Completed requirements analysis
- [x] Developed an SRS
- [x] Estimated software effort
- [x] Justified the estimation technique
- [x] Designed the system
- [x] Implemented a functional application
- [x] Tested the application
- [x] Documented test results
- [x] Identified technical debt
- [x] Proposed technical debt resolution strategies
- [ ] **Deployed the application** — ❌ still needed, see §8
- [ ] **Tested the live deployment** — ❌ blocked on the above
- [x] Prepared a user manual
- [x] Prepared a maintenance strategy
- [x] Prepared a future evolution plan
- [ ] **Provided the source-code repository** — 🟡 the repository exists locally; needs pushing to a host (GitHub, etc.) and its URL added to `Deployment_and_Source_Links.txt`
- [ ] **Verified all URLs and credentials** — ❌ blocked on deployment
- [ ] **Included name, student ID, and project title** — 🟡 project title is filled in; name/ID are placeholders pending the project owner's details
- [ ] **Submitted all required files through SAKAI** — ❌ final step, pending everything above

---

## 11. What's actually left (in order)

1. Fill in your name, student ID, and (once created) repository URL in `Deployment_and_Source_Links.txt`.
2. Push this repository to GitHub (or wherever) and add that link too.
3. Deploy the app (see the deployment guide inside `Deployment_and_Source_Links.txt` for the specific steps — frontend host, backend host, Neo4j Aura, environment variables for credentials/CORS).
4. Re-test the live deployment the same way `Testing_Report.md` tested the local one, and note any deployment-specific findings.
5. Grab a handful of screenshots of the running app for `Supporting_Files/`.
6. Export each `.md`/`.txt` file in `final-docs/` to PDF (or keep as one combined PDF with clear section headers) and package into `StudentID_ProjectName.zip`.
7. Submit through SAKAI.
