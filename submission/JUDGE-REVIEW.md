# Internal adversarial review

**Review date: 22 September 2026.** This is an internal AI-assisted critique of the current code, synthetic fixture, interface capture, tests, business brief, and submission copy. It is not feedback from HACK47 judges, customer validation, or an independent security audit. Scores are provisional on a five-point scale; they should not appear as achievements in the submission.

## Rubric assessment

| Criterion | Provisional score | What earns credit | What limits the score |
| --- | ---: | --- | --- |
| Originality | 2.5 / 5 | The uncertainty-to-repair-to-preserved-report sequence is a clear, inspectable product choice. | Lot traceability, nested production, mock recalls, reports, and even a paprika/sauce scenario already appear in direct competitors. Equivalent correction features have not been ruled out. This is a focused improvement in an existing category, not category invention. |
| Impact | 3 / 5 | A suspect supplier lot and incomplete paperwork create an understandable task. The tool separates unknown recipients from recipients supported by records. | No real producer has completed a recorded evaluation. Reduced false exclusions, time saved, or better outcomes have not been measured. Correct software cannot repair untruthful or absent physical records on its own. |
| Execution | 3.5 / 5 | Working graph, source inspection, input repair, preserved snapshots, real PDF exports, account API, atomic validation, and browser workflows provide substantial evidence. Local integration checks exercise restart and backup restoration. | The public artifact is a browser demo, while account and sync capabilities need separate full-app proof. Export parity and long-content rendering were issues found during review. Production hosting, Docker runtime, restoration on an actual public backend, and independent security review must not be implied by a successful local run. |
| Product thinking | 3.5 / 5 | Narrow buyer, source references, friendly spreadsheet import, restrained presentation, explicit unknowns, and no automatic customer messaging fit the task. | Recording every input remains a recurring behavior change. The correction flow handles incomplete inputs but cannot repair an already-complete record's wrong quantity. Subscription frequency, onboarding effort, and actual producer language remain untested. |
| Technical depth | 4 / 5 | Shared deterministic rules, integer quantity accounting, uncertainty propagation, chronology/cycle checks, tenant isolation, idempotent revisions, serialized device writes, and preserved offline-report conflicts are thoughtful choices. | Workspace JSON and full snapshots have explicit size limits. No conversion/yield model, cross-contact model, signed evidence, or general record-versioning system is implemented. A hash is not authenticity proof. |
| Potential | 2.5 / 5 | A low-inference-cost product, exportability, a defined pilot test, and support-sensitive economics create a plausible next experiment. | No paying demand, acquisition channel, retention, or moat is established. Competitors already sell related products and have free or affordable offers. The $29 price needs evidence rather than conviction. |

The credible entry is a polished, tested product with an unusually careful treatment of missing evidence. The weak entry would be “a new recall platform” followed by a standard graph and unsupported commercial claims. The opening and recording must show the evidence change, not stop at the graph.

## Three improvements to finish before recording

1. **Make the exported evidence as trustworthy as the interface.** Bring browser and server packs into semantic parity: synthetic marker, explicit quantity units, selected source, three states, and record-time caveat. Test a long title/reason/reference and multipage tables. A readable screen with a misleading or clipped pack fails the central promise. These issues were sent to the implementation owner; rerun the relevant checks after fixes.
2. **Show the complete uncertainty repair sequence as the main story.** Save the initial rehearsal, add the recovered PAP-2410 reference to CHL-1909-X, show the 120 units move out of investigation, then open the original report still containing them. Keep the original report and live trace visibly distinguishable. Use “See what your records prove, and what they don't” in the narrative so the distinct product choice appears before the general traceability category.
3. **Close the proof gap between public demo and full application.** Verify the published Pages URL in a clean browser, refresh its routes, download an actual PDF, and follow its account-setup link. Capture full-app account creation/persistence and a two-device stock conflict as separate technical evidence. Label the footage accurately. Do not let a judge discover that the apparent public login is unavailable without explanation.

The store safeguards found important during this review have since been implemented and reported browser-tested by the responsible agent: one writer per browser profile, read-only secondary tabs, preservation of pending records across session/network problems, and stopping a stale pending rehearsal instead of silently recalculating it. Keep those regression tests in the final verification run.

## Claims parity

| Claim | Assessment and required wording |
| --- | --- |
| “480 connected jars; 300 shipped; 180 on hand” | Matches the initial synthetic fixture. The 120 investigation units and their 48 shipped units are separate. Do not present the values as a real customer result. |
| “Repair updates the live scope and preserves the earlier report” | Implemented in the domain and API. Resolution to PAP-2410 leaves 480 connected, removes the investigation batch, and yields 360 finished units with no recorded connection. The earlier snapshot retains its original investigation batch. |
| “No recorded connection means safe” | False. No page, export, narration, color legend, or response should imply this. |
| “Missing records are detected automatically” | Too broad. The engine propagates uncertainty from explicitly incomplete records; it cannot verify the completeness or truth of original paperwork. |
| “Quantity conservation” | Use the narrower description “stock-allocation checks.” The implementation prevents recorded oversubscription in source units. It does not establish physical mass balance across conversions, losses, or yields. |
| “Held stock cannot enter production” | Not an implemented authorization guarantee. Hold status is stored information. Historical evidence about held stock may still be added, and the operator remains responsible for physical controls. |
| “Offline reports retain their original scope” | Supported with the new revision safeguard. A conflict pauses synchronization and requires export/reconciliation; there is no automatic saved-report merge. |
| “Immutable” or “tamper-proof” | Earlier snapshots are preserved by normal application commands. An administrator who rewrites the database is outside that guarantee. Fingerprints are not signatures or trusted timestamps. |
| “Public app has login and cloud backup” | False for GitHub Pages. Actual account features live in the full self-hosted application. Browser storage can be cleared or lost. |
| “Production ready” | Too broad as a certification. State the implemented controls and tested workflows, then identify deployment, restoration, qualified workflow review, and security review still needed for real operational use. |
| “$29/month business” | A proposed plan with illustrative economics. No checkout, managed hosting offer, paying customer, revenue, or willingness-to-pay result exists. |
| “Shivam built it” | Credit Shivam as project creator and product owner and disclose substantial AI assistance. Do not invent manual coding contributions. |

## Remaining product risks

The producer must keep source data current for the trace to be useful. A single unfamiliar import error or a complete-record typo that cannot be corrected may outweigh the value of a polished drill. Observe real record preparation before expanding features.

The conservative uncertainty model may include unrelated incomplete batches. That avoids an unsupported all-clear, but large investigation lists can reduce usefulness. Test this behavior with producers and qualified workflow reviewers before adding filtering that could create false exclusions.

The plan to run five observed rehearsals is the appropriate next commercial test. It is not a completed result, and no amount of internal judging can substitute for it. The immediate goal is a truthful, memorable demonstration with reproducible implementation evidence.
