# INV-002 validation

Disposition: reportable

Confidence: high

Source: an inventory object with `allowBackorder: true`.

Control: normalization uses `normalizeNonNegativeInteger`, converting every negative current quantity to zero.

Sink: decrement and restore transaction writes use the normalized value for arithmetic.

Reproduction:

1. Start at quantity 0 with backorders enabled.
2. Sell 2 units; quantity becomes -2.
3. Sell 3 more; normalization reads -2 as 0, so quantity becomes -3 instead of -5.
4. Cancel the first order; normalization reads -3 as 0, so quantity becomes +2 while the second backorder is still outstanding.

Counterevidence: the current merchant UI saves `allowBackorder: false`; the unsafe branch requires existing, imported, or administrative data with the explicitly supported flag enabled.

Proof: the focused harness returned `backorderAfterTwoSales: -3` and `backorderAfterCancelFirstOrder: 2`.
