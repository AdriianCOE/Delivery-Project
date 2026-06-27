# Inventory Security Coverage Ledger

| Row | Boundary/family | Files/control checked | Disposition | Evidence |
|---|---|---|---|---|
| INV-TENANT | Tenant/object isolation | `publicOrder.js:447-456,480-499,900-912`; `inventory.js:202-223,255-296`; `firestore.rules:703-709` | reportable INV-001 | Product-controlled alias is promoted into expected tenant keys. |
| INV-BACKORDER | Inventory arithmetic/integrity | `inventory.js:24-26,54-65,267-280,369-377` | reportable INV-002 | Negative quantities normalize to zero before later decrement/restore. |
| INV-RESTORE-FORMAT | Cancellation restoration integrity | `inventory.js:350-390` | reportable INV-003 | Stored historical format selects the current write shape. |
| INV-TOCTOU | Order eligibility/pricing integrity | `publicOrder.js:815-920,1620-1933`; `inventory.js:226-334` | reportable INV-004 | Transaction rereads stock/tenant only, not price or orderability. |
| INV-RESTORE-TENANT | Restore tenant isolation | `inventory.js:337-417`; `merchantOrder.js:640-729` | deferred | Restore lacks ownership check, but order inventory is Admin-SDK controlled; impact becomes reachable through INV-001 or trusted admin reassignment. |
| INV-CATALOG | Public data exposure | `index.js:675-688,985-986,1187-1218,3830-3965,5095-5143`; backfill equivalents | suppressed | `stock` excluded/deleted and public documents overwritten with `merge:false`; only `publicStock` emitted. |
| INV-ATOMICITY | Atomic writes/idempotency | `inventory.js:196-199,226-334,337-424`; `merchantOrder.js:640-729`; `publicOrder.js:1860-1940` | suppressed | Product reads precede writes; product/order/movements share transactions; restore flag is read and patched transactionally. |
| INV-ACL | Movement writes | `firestore.rules:672-674` | suppressed | Clients can read only managed stores; all client writes denied. |
| INV-DOS | Bounded transaction size | `publicOrder.js:196-200,798-812`; inventory aggregation | suppressed | 80 cart rows and 99 quantity cap keep transaction document count below Firestore limits. |
| INV-MISSING-PRODUCT | Cancellation availability | `inventory.js:350-366`; `merchantOrder.js:701-718` | operational risk | Hard-deleted products abort cancellation until data is repaired. |
