# INV-002 - Backorder debt is lost by non-negative normalization

Affected locations:

- Root control: `functions/shared/inventory.js:24-26`
- Decrement sink: `functions/shared/inventory.js:277-280`
- Restore sink: `functions/shared/inventory.js:369-377`

## Attack path

1. A trusted data path enables `allowBackorder`.
2. Public sales drive quantity below zero.
3. Each later transaction normalizes that negative debt to zero before arithmetic.
4. A subsequent cancellation can produce positive available stock while outstanding backorders still exist.

## Attack Path Facts

- Context: inventory integrity; usually affects the store that enabled backorders.
- In scope: yes as a production helper, but the current UI does not expose the enabling state.
- Exposure/vector: public orders reach arithmetic only after a protected configuration precondition.
- Cross-boundary behavior: no independent tenant boundary is crossed.
- Preconditions: trusted/admin/imported data enables a flag that the UI currently fixes to false.
- Attacker input control: public customers control order quantity after the precondition.
- Category: CWE-682 incorrect calculation.
- Mitigations: standard UI disables backorders; transactions remain atomic.
- Auth scope: public sales, protected configuration.
- Impact surface: data correctness.
- Counterevidence: protected-write precondition and primarily same-store business impact.
- Confidence: high for the bug, low as a standalone security issue.

Severity calibration: impact medium, likelihood low because of the protected uncommon precondition.

Final policy decision: ignore as a security finding; retain as a high-priority correctness risk in the engineering audit.
