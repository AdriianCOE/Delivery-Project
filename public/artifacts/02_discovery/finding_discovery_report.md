# Finding Discovery

The focused inventory review produced four candidates:

1. `INV-001`: tenant alias confusion in transactional ownership validation.
2. `INV-002`: lossy negative quantity handling for backorders.
3. `INV-003`: restoration writes using historical rather than current stock format.
4. `INV-004`: price and product eligibility TOCTOU between pre-read and order transaction.

Public catalog leakage, client movement writes, transaction ordering and restoration idempotency were checked and suppressed with concrete controls in the coverage ledger. Restore tenant validation and hard-deleted-product cancellation remain documented residual/operational risks.
