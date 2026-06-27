# INV-001 - Store-alias confusion permits cross-tenant order injection

Affected locations:

- Entrypoint/control: `functions/publicOrder.js:447-456`
- Candidate construction: `functions/publicOrder.js:900-912`
- Root control: `functions/shared/inventory.js:202-220`
- Sink: `functions/shared/inventory.js:282-318`
- Supporting rule: `firestore.rules:703-709`

## Attack path

1. An authenticated merchant for store B creates a B-owned product with an alias identifying victim store A.
2. A request to the public order callable for A supplies that product id.
3. Match-any alias validation accepts the B-owned document.
4. The candidate adds B to the expected identifiers used by the transactional check.
5. Admin SDK code commits an A order containing B's product, decrements B's record, and writes its movement under A.

## Attack Path Facts

- Assumptions: merchant B can write its own products under the current rule and can invoke or cause invocation of the public order interface.
- Context: cross-tenant integrity boundary; the order and audit record are attributed to A while the product is owned by B.
- In scope: yes; public ordering and tenant isolation are explicit inventory workflows.
- Exposure/vector: remote callable; public order entrypoint.
- Identity: Function uses Admin SDK and bypasses Firestore rules after application authorization.
- Cross-boundary behavior: verified statically and with the focused helper harness.
- Preconditions: attacker has a normal merchant account and knows/chooses a target store identifier; plausible.
- Attacker input control: yes, over B's product aliases and the public order product id.
- Category: CWE-863 / CWE-639 tenant authorization confusion.
- Mitigations: canonical `storeId` is immutable after product creation, but alias fields are not constrained and therefore do not defeat the path.
- Auth scope: merchant setup is authenticated; trigger is public.
- Impact surface/reach: runtime and tenant data, one target store per crafted order.
- Secrets: none.
- Counterevidence: the attacker does not overwrite A's product and needs a merchant account. This narrows impact but does not remove unauthorized A order/audit pollution.
- Blindspots: downstream operational and payment side effects were not exercised.
- Confidence: high.

Severity calibration: impact medium, likelihood high, final severity medium (P2).

Final policy decision: report.
