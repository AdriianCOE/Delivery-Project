# Inventory validation summary

Rubric applied to every candidate:

1. A supported public or merchant interface reaches the code.
2. The source crosses a tenant, integrity, or transaction boundary.
3. The closest relevant control is missing, incomplete, or uses the wrong value.
4. The unsafe state transition or protected effect is reproducible or follows deterministically from the code.
5. Nearby rules, authorization checks, or transaction retry semantics do not defeat the path.

| Candidate | Root location | Method | Closest control | Disposition | Confidence |
|---|---|---|---|---|---|
| INV-001 | `functions/publicOrder.js:447-456` | Static source/control/sink trace plus focused fake-transaction harness | Match-any store aliases combined with candidate-provided store keys | reportable | high |
| INV-002 | `functions/shared/inventory.js:54-65` | Focused fake-transaction harness with two backorders and one cancellation | Negative quantity is clamped to zero on every normalization | reportable | high |
| INV-003 | `functions/shared/inventory.js:371-390` | Focused fake-transaction harness plus opposite-direction static trace | Restore chooses the write shape from historical `stockFormat` | reportable | high |
| INV-004 | `functions/publicOrder.js:815-920` | Static source/control/sink and transaction-boundary trace | Transaction validates stock only; price and orderability remain from the pre-read | reportable | medium |

Validation artifact: `artifacts/05_findings/validation_harness.js`.

Observed output:

```json
{
  "tenantAliasAccepted": true,
  "backorderAfterTwoSales": -3,
  "backorderAfterCancelFirstOrder": 2,
  "migratedObjectOverwrittenWithLegacyNumber": 12
}
```

No target-repository file was modified for validation.
