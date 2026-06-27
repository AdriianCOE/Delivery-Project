# INV-001 validation

Disposition: reportable

Confidence: high

Source: a public order may name a product document controlled by another merchant.

Control: `productBelongsToStore` accepts a match against any store alias. The inventory helper then builds its expected-store set from both the order store and the candidate/product-supplied store identifier.

Sink: the Admin SDK transaction updates the selected product and creates an inventory movement under the order store.

Reachable path:

1. Firestore rules permit merchant B to create a product with canonical `storeId=B` and attacker-selected alias fields such as `storeKeys=[A]`.
2. A public order for store A names that product id.
3. The pre-read accepts the product because alias A matches.
4. The candidate carries canonical store B into the transaction.
5. The transaction treats both A and B as expected keys, accepts the product, decrements B's product, and records the movement under A.

Counterevidence: the product must be created by an authenticated merchant and its id supplied to the public order interface. This scopes exploitability but does not defeat cross-tenant order injection.

Proof: the focused harness reproduced acceptance (`tenantAliasAccepted: true`); the Firestore rule and Admin SDK write path were also traced statically.
