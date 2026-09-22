# Judge preparation

This is an internal evidence map for reviewing the submission. It is not a claim about the judges' likely scores or a substitute for customer validation.

| Criterion | What to demonstrate | Evidence | Remaining weakness |
| --- | --- | --- | --- |
| Originality | Missing inputs propagate uncertainty into descendants. Evidence-backed correction changes live scope while earlier reports retain their original basis. | Save PAP-2409 drill, resolve CHL-1909-X, compare live trace with saved snapshot, domain tests. | Traceability and mock recalls are established categories. This focused workflow needs comparative user testing. |
| Impact | A maker can identify recorded recipients and see which batches still need investigation. | Live customer-delivery view, source references, saved pack. | No field study yet demonstrates time saved, improved decisions, or fewer mistakes. |
| Execution | The same workflow runs through a usable interface, validates writes, persists to an account, and exports a real report. | End-to-end tests, clean-browser demo, PDF, account isolation. | Hosted deployment, backup restoration, security review, and real production workflows need ongoing verification. |
| Product thinking | Begin with one maker segment and a legible response to a specific supplier message. | Demo story, small forms, spreadsheet templates, recovery flow, explicit uncertainty language. | Record-entry burden and repeated use remain unvalidated. |
| Technical depth | Graph traversal through intermediate material, stock allocation constraints, uncertainty propagation, revisioned writes, idempotent retries, and snapshot reports. | Shared domain implementation, API tests, offline/reconnect checks. | The SQLite/JSON architecture and workspace size limit target small operations. No distributed architecture or independent security audit is claimed. |
| Potential | A proposed hosted plan with a cost-sensitive path to paid pilots. | `docs/BUSINESS.md`, source exportability, no model inference fee for core traces. | No willingness-to-pay evidence, customers, or defensible distribution advantage yet. |

## Questions to answer directly

**Is this new?**

"Lot traceability and mock recalls already exist. Batchlight focuses on a complete uncertainty-and-repair workflow: a missing input stays visible through production, new evidence changes the live scope, and the original report keeps its earlier basis. We need pilots to learn whether makers value that enough to use and pay for it."

**Why use AI here?**

“AI helped build and test the product. The operational trace calculation is deterministic, so a maker can inspect recorded paths and get the same answer from the same records without model cost or variability.”

**Can the result say a product is safe?**

“No. A path means the records connect the batch to the selected source. Missing records remain unresolved. No recorded connection is not safety clearance. The producer must review the evidence and follow their incident process.”

**What about the 120 uncertain jars?**

“The incomplete spice entry prevents the records from ruling out a connection. They remain a separate investigation group. The demo also preserves 48 shipped units from that uncertain batch without mixing them into the 300 connected shipments.”

**Will people pay?**

“That has not been validated. We propose $29 a month for a hosted workspace, then test five observed rehearsals and offer a paid pilot. If makers only need an occasional drill, we will revisit the subscription model.”

**What happens offline?**

“A loaded workspace has a saved device copy. Signed-in changes queue locally. On reconnect, the server checks each command against current records and rejects conflicts. Until that succeeds, the local state is provisional.”

“A second tab is read-only to protect device storage. If an offline rehearsal meets newer server records, its original snapshot stays on the device for review and export. We do not silently recompute that earlier report.”

**Can I create an account on the public demo?**

“The GitHub Pages demo runs entirely in your browser and stores its sample records on your device. Actual registration, login, recovery, account isolation, and server synchronization are in the full application. Run it locally from the repository or deploy it with a persistent disk and the documented HTTPS configuration.”

**What remains before real operational use?**

“Supervised producer pilots, an independent security review, a tested hosted backup-restore process, and qualified review of the incident workflow. The release also has explicit scope limits, including no team roles, email verification, or automatic recall notifications.”

**Who built it?**

“I’m Shivam Gupta, the project creator and product owner. I built it with substantial AI assistance across research, design, implementation, testing, and writing. The source, tests, and dependency disclosure are available in the repository.”
