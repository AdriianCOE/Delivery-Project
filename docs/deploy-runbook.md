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

## Gates Operacionais Antes do Piloto

Antes de vender para lojista real, confirme estes pontos fora do codigo:

- App Check no Firebase Console em modo monitor para o Web App e Hosting.
- Build do frontend com `VITE_FIREBASE_APPCHECK_ENABLED=true` e `VITE_FIREBASE_APPCHECK_SITE_KEY` validado em producao assistida.
- Somente depois dos testes publicos, ativar `ENFORCE_APP_CHECK=true` nas Functions publicas.
- `/config/legal` criado no Firestore antes de publicar Rules, Functions e Hosting que leem `termsVersion`/`privacyVersion`.
- Cloudinary assinado configurado: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e secret `CLOUDINARY_API_SECRET`.
- Frontend publicado sem `VITE_CLOUDINARY_ALLOW_UNSIGNED_FALLBACK=true`, salvo janela de migracao controlada.
- `cleanupAnonymousUsers` conferida em dry run antes de qualquer delecao real.
- Para limpeza real monitorada, configurar em producao `CLEANUP_ANONYMOUS_USERS_ENABLED=true` e `CLEANUP_ANONYMOUS_USERS_DRY_RUN=false` somente durante a janela operacional; depois voltar `CLEANUP_ANONYMOUS_USERS_DRY_RUN=true` se a limpeza nativa do Firebase nao estiver habilitada.
- Push FCM de novo pedido validado em runtime com token real em `stores/{storeId}/notificationTokens`, permission/subscription ativa no navegador do lojista e pedido criado via loja publica.

Fluxo minimo para validar App Check antes de enforcement:

1. Abrir uma loja publica por slug.
2. Carregar catalogo.
3. Validar cupom valido e invalido.
4. Criar pedido publico.
5. Abrir tracking do pedido.
6. Confirmar recebimento no tracking.
7. Enviar avaliacao no tracking.

Fluxo minimo para validar FCM merchant:

1. Entrar no dashboard da loja em navegador real.
2. Ativar notificacoes e confirmar token em `stores/{storeId}/notificationTokens/{tokenHash}`.
3. Criar pedido real pela loja publica.
4. Confirmar log de envio de `sendNewOrderPushToStore`.
5. Confirmar notificacao recebida no navegador do lojista.
6. Se houver falha, registrar navegador, service worker ativo, token hash, `storeId` e erro de push.

Fluxo minimo para validar agendamento:

1. Produto comum com pedido imediato.
2. Produto `scheduled_only` com 2 dias de antecedência.
3. Produto com intervalo de 10 min escolhendo 14:50.
4. Pix obrigatório para encomenda.
5. Conflito `asap_only` + `scheduled_only`.
6. Tracking de pedido agendado.
7. `OrdersPage` sem marcar agendado futuro como atrasado.
8. KDS mostrando agendado só quando entrar na janela de preparo.

Comando para configurar o secret Cloudinary antes do deploy da assinatura:

```bash
firebase functions:secrets:set CLOUDINARY_API_SECRET
```

## Deploy de Rules e Índices

Faça o deploy das regras antes dos lotes de Functions. As regras do Realtime Database são necessárias para o presence público (`presence` e `presenceCounts`).

Exceção: quando a mudança remover writes diretos do client em `orders`, publique primeiro as novas Functions de tracking e o Hosting correspondente; depois aplique `firestore:rules`. Isso evita quebrar clientes com bundle antigo durante a janela de deploy.

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only database
```

## Deploy em Lotes (Batches)

Para não esbarrar na cota de "CPU quotas for region southamerica-east1", realize o deploy em lotes específicos. Use `--only functions:<nome-da-function>,functions:<nome-da-function>`.

### Lote 1: Pedidos Públicos
```bash
firebase deploy --only functions:createPublicOrder,functions:confirmCustomerDelivery,functions:markCustomerPixProofSent,functions:requestCustomerOrderCancellation,functions:submitPublicOrderReview,functions:validateOrderPricing,functions:auditOrderChanges
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
firebase deploy --only functions:updateStoreSettings,functions:updateMyProfile,functions:createCloudinaryUploadSignature,functions:adminCreateStore,functions:materializePublicStoreProfile,functions:materializePublicProduct,functions:materializePublicCategory,functions:precheckFirebasePhoneClaim,functions:confirmFirebasePhoneVerified,functions:startFreeTrial,functions:acceptLatestTerms,functions:updateBillingNotificationPreferences
```

### Lote 5: Presença e Auditorias
```bash
firebase deploy --only functions:aggregateStorePresence,functions:auditStoreChanges,functions:auditProductPriceChanges,functions:cleanupAnonymousUsers
```

> IMPORTANTE: Se criar um novo trigger de background, sempre lembre de exportar pelo `index.js`.


Pendências ainda relevantes

Cloudinary deve usar assinatura via `createCloudinaryUploadSignature`; fallback unsigned so deve ser habilitado temporariamente com `VITE_CLOUDINARY_ALLOW_UNSIGNED_FALLBACK=true`.
App Check ainda precisa ser ativado/configurado no Firebase Console e no client para endurecer de verdade.
npm audit tinha vulnerabilidades moderadas em dependências; não atualizei pacotes nesta rodada.
presence no Realtime Database ainda pode ser poluído por usuários autenticados/anonymous, embora o impacto seja baixo.
