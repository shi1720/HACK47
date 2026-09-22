# Batchlight engineering
This repository is independent of its parent directory. Do not change the parent project.
- Build for small food makers. No fake testimonials, fabricated customer validation, or unqualified food-safety/compliance guarantees.
- Use three recall states: recorded connection, needs investigation, no recorded connection. Never equate no recorded connection with safe.
- Demo data must always be labeled synthetic. All money/pricing projections are hypotheses.
- Validate writes on the server and protect tenant boundaries. Do not put credentials in the repo.
- Keep quantities finite, positive, precision-limited; prevent stock oversubscription, cycles, duplicate references, and incorrect temporal ordering.
- Test core traceability, uncertainty propagation, auth/isolation and end-to-end workflows.
- Parallel agents may work on clearly assigned disjoint files. Coordinate shared interfaces first.
