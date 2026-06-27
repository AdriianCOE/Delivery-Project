# INV-004 validation

Disposition: reportable

Confidence: medium

Source: product price, availability, visibility, deletion state, or option data read before the order transaction.

Control: the transaction rereads candidate products through the inventory helper, but only validates current tenant association and stock. It does not rebuild order items or revalidate current price and orderability.

Sink: the order document and total are committed from stale pre-read values.

Reachable path: a public order request overlaps a merchant update that increases price or disables/deletes a product. The transaction can still commit the earlier item and price while stock is validated from the later product state.

Counterevidence: exploitation requires a timing overlap and the payment flow may have later operational checks. No transactional or version control was found that defeats stale order creation.

Proof gap: this was not reproduced against a Firestore emulator with concurrent requests. The split read/transaction code path is direct, but real-world exploitability depends on timing.
