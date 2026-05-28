# PratoBy Deploy Runbook

## Validação Pré-Deploy

Sempre execute os lints e checagens de sintaxe antes de fazer o deploy.
```bash
npm run lint
npm run build
cd functions
node --check index.js
node --check asaas.js
node --check publicOrder.js
node --check scripts/backfillPublicCatalog.js
```

## Deploy de Rules e Índices

Faça o deploy das regras antes dos lotes de Functions. As regras do Realtime Database são necessárias para o presence público (`presence` e `presenceCounts`).

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only database
```

## Deploy em Lotes (Batches)

Para não esbarrar na cota de "CPU quotas for region southamerica-east1", realize o deploy em lotes específicos. Use `--only functions:<nome-da-function>,functions:<nome-da-function>`.

### Lote 1: Pedidos Públicos
```bash
firebase deploy --only functions:createPublicOrder,functions:validateOrderPricing,functions:auditOrderChanges
```

### Lote 2: Billing & Asaas
```bash
firebase deploy --only functions:startAsaasSubscription,functions:asaasWebhook,functions:syncAsaasSubscriptionStatus,functions:getSubscriptionManagementData,functions:changeSubscriptionPlan,functions:cancelSubscription,functions:requestSubscriptionDueDateChange,functions:createPaymentMethodUpdateCheckout,functions:adminUpdateSubscriptionRequestStatus
```

### Lote 3: Catálogo e Perfil Público
```bash
firebase deploy --only functions:getPublicCatalog,functions:getPublicStoreProfile,functions:validatePublicCoupon
```

### Lote 4: Configurações e Onboarding
```bash
firebase deploy --only functions:updateStoreSettings,functions:updateMyProfile,functions:adminCreateStore,functions:materializePublicStoreProfile,functions:materializePublicProduct,functions:materializePublicCategory,functions:precheckFirebasePhoneClaim,functions:confirmFirebasePhoneVerified,functions:startFreeTrial,functions:acceptLatestTerms,functions:updateBillingNotificationPreferences
```

### Lote 5: Presença e Auditorias
```bash
firebase deploy --only functions:aggregateStorePresence,functions:auditStoreChanges,functions:auditProductPriceChanges,functions:cleanupAnonymousUsers
```

> IMPORTANTE: Se criar um novo trigger de background, sempre lembre de exportar pelo `index.js`.
