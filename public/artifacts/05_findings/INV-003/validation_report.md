# INV-003 validation

Disposition: reportable

Confidence: high

Source: cancellation after the product stock representation is migrated between legacy numeric and object formats.

Control: restore selects the write shape from the order's historical movement `stockFormat`, not from the product reread inside the transaction.

Sink: `transaction.update` may replace the current stock object with a number, discarding current configuration; the reverse migration may attempt a nested update against a numeric field and abort cancellation.

Counterevidence: the issue requires a format migration between sale and cancellation. Normal cancellation without a representation change is safe and idempotent.

Proof: the harness migrated legacy numeric stock to an object before cancellation and observed the object overwritten with numeric `12`. The reverse direction follows deterministically from the nested-field Firestore update.
