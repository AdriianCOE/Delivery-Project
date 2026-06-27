# Overview

PratoBy is a multi-tenant SaaS storefront and order-management platform for food merchants. React/Vite clients use Firebase Auth, Firestore, Realtime Database, Storage and Cloud Functions. Public customers browse materialized `publicStores`, submit orders through callable Functions and track them; authenticated merchants manage stores, products, orders and billing. External payment, email, image and notification providers cross additional trust boundaries.

# Threat Model, Trust Boundaries, and Assumptions

Important assets are tenant isolation, product/order integrity, inventory and pricing integrity, customer PII, merchant credentials, payment state, provider secrets, billing entitlements and audit history.

Trust boundaries:

- Anonymous browsers to public callable Functions and public Firestore documents.
- Authenticated merchant browsers to callable Functions and merchant-scoped documents.
- Cloud Functions/Admin SDK to private Firestore collections, bypassing Rules.
- Firestore source collections to materialized public catalog documents.
- PratoBy to payment, email, media and push providers through secrets and webhooks.
- Scheduled/background triggers to operational and billing state.

Customer order payloads, product IDs, quantities, coupon data, addresses, tracking tokens and public query parameters are attacker-controlled. Merchant settings and product edits are operator-controlled but remain untrusted across tenant boundaries. Deployment configuration, secrets and source code are developer-controlled. Firebase Rules are not a protection inside Admin SDK code; Functions must enforce authentication, authorization, tenant scope and invariants themselves.

Core invariants include: a caller may act only on authorized stores/orders; public documents contain no private operational fields; server prices and inventory win over client payloads; order, payment, scheduling and inventory state transitions are atomic or explicitly recoverable; webhooks are authenticated and idempotent; sensitive fields and secrets never enter public catalog or logs.

# Attack Surface, Mitigations, and Attacker Stories

Primary surfaces include public order/coupon/tracking Functions, merchant order/settings/catalog Functions, Firestore triggers and materializers, payment OAuth/webhooks, media signatures, push tokens, scheduled jobs and Firestore/Storage/RTDB Rules.

Existing controls include callable authentication checks, non-anonymous merchant checks, store-owner/admin checks, App Check rollout options, rate-limit documents, server-side price/product reads, Firestore transactions, webhook validation, private-by-default Rules and public catalog sanitization.

Realistic attacker stories include anonymous overselling or order abuse through races; cross-tenant product/order manipulation through inconsistent store identifiers; tracking-token enumeration; public-field leakage through merge/materialization mistakes; merchant privilege escalation through stale ownership checks; webhook replay or forged payment transitions; and denial of service through oversized or repeated requests.

Lower-relevance stories include local developer-only tooling compromise without a deployment path. Client-side validation is never considered a security control. Merchant-controlled descriptive text is lower risk unless rendered unsafely or propagated to provider APIs.

# Severity Calibration (Critical, High, Medium, Low)

- Critical: cross-tenant administrative compromise, provider-secret disclosure, arbitrary payment/billing state control, or broad customer PII exfiltration.
- High: unauthorized cross-store order/product mutation, exploitable payment/webhook bypass, reliable inventory/order corruption with material financial impact, or private catalog-field exposure at scale.
- Medium: bounded single-store integrity failures requiring races or merchant access, denial of service against order creation, idempotency failures with recoverable financial/operational impact, or limited metadata leakage.
- Low: defense-in-depth gaps without a reachable attacker path, noisy logs, minor enumeration, inefficient queries, and robustness issues whose impact is operational rather than security-sensitive.
