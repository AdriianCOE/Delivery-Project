# INV-004 - Product price and eligibility are stale across order transaction

Affected locations:

- Pre-read/entrypoint: `functions/publicOrder.js:815-920`
- Transaction/order sink: `functions/publicOrder.js:1620-1933`
- Partial transactional control: `functions/shared/inventory.js:255-280`

## Attack path

1. A customer submits an order while a merchant raises a price or disables/deletes the product.
2. Item price and orderability are fixed from the pre-transaction read.
3. The transaction rereads the product only for tenant association and inventory.
4. The order commits using stale price/eligibility despite the newer product state.

## Attack Path Facts

- Context: customer-to-merchant commercial integrity boundary.
- In scope: yes; public ordering is a production workflow.
- Exposure/vector: remote public callable.
- Cross-boundary behavior: plausible economic impact between customer and merchant.
- Preconditions: request must overlap a product update; plausible but timing-dependent.
- Attacker input control: customer controls order timing and repeated attempts, not the merchant update.
- Category: CWE-367 TOCTOU.
- Mitigations: current stock is validated transactionally; totals derive server-side rather than trusting client prices.
- Auth scope: public.
- Impact surface/reach: individual orders and merchant revenue.
- Counterevidence: timing window, limited per-order impact, and no emulator concurrency reproduction.
- Blindspots: payment-provider handling may add compensating checks outside this focused scope.
- Confidence: medium.

Severity calibration: impact medium, likelihood medium, final severity low (P3).

Final policy decision: report.
