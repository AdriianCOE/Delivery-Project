# INV-003 - Cancellation restores using stale stock representation

Affected location:

- Root control and sink: `functions/shared/inventory.js:350-390`

## Attack path

1. A merchant sale records the then-current legacy/object stock format.
2. The product is migrated to the other representation.
3. The order is canceled.
4. Restore writes according to historical movement format rather than current product format, destroying current configuration or aborting cancellation.

## Attack Path Facts

- Context: product and order integrity within the same managed store.
- In scope: yes; cancellation is a production workflow.
- Exposure/vector: merchant/admin workflow, not an independent remote attacker path.
- Cross-boundary behavior: none shown.
- Preconditions: format migration between sale and cancellation.
- Attacker input control: no meaningful lower-privileged attacker control established.
- Category: CWE-664 / CWE-682 state representation error.
- Mitigations: cancellation transaction aborts rather than silently succeeding on a failed write; idempotency flag prevents double restoration.
- Impact surface: runtime/data availability and configuration integrity.
- Counterevidence: same-owner/protected workflow and unusual timing.
- Confidence: high for the bug.

Severity calibration: self/protected workflow.

Final policy decision: ignore as a security finding; retain as a correctness and operability risk.
