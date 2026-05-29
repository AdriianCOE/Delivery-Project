# PratoBy — Análise Técnica Completa v3
**Data:** 29 de maio de 2026  
**Arquivos lidos:** `firestore.rules` · `database.rules.json` · `firebase.json` · `storage.rules` · `functions/index.js` · `functions/asaas.js` · `functions/merchantOrder.js` · `functions/publicOrder.js` · `AuthContext.jsx` · `Settings.jsx` · `ProtectedRoute.jsx` · `usePresence.js` · `sentry.js` · `Statistics.jsx` · `AppRoutes.jsx` · `CartDrawer.jsx`

---

## 1. Resumo executivo

O PratoBy evoluiu significativamente desde a análise anterior. Dois riscos altos foram corrigidos (RTDB presence e review sem customerPhone), e três melhorias arquiteturais importantes foram entregues: todas as mutações de pedidos do lojista agora passam pelo `merchantOrder.js`, as configurações da loja agora passam pelo `updateStoreSettings` com audit log, e a contagem de presença foi movida para um trigger RTDB em vez de leitura direta do cliente.

**Nenhum risco crítico ativo.** Os achados abaixo são médios e baixos.

---

## 2. O que foi corrigido desde a última análise

| # | Risco anterior | Status |
|---|---|---|
| 1 | RTDB presence sem autenticação | ✅ Corrigido — `auth != null && $sessionId == auth.uid` |
| 2 | Review sem validação de `customerPhone` | ✅ Corrigido — `validReviewCreate` valida o campo |
| 3 | `borapedir-f529a` exposto no CSP `frame-src` | ✅ Removido — CSP limpo |
| 4 | `adminCreateStore` com senha mínima de 6 chars | ✅ Corrigido — exige 8 chars, letras e números |
| 5 | Settings.jsx com `updateDoc` direto sem audit log | ✅ Corrigido — `updateStoreSettings` Cloud Function com `createAuditLog` |
| 6 | Mutações de pedidos do lojista via Firestore direto | ✅ Corrigido — `merchantOrder.js` com autorização e audit log |
| 7 | `usePresence` podia afetar sessão do merchant com `setPersistence` | ✅ Corrigido — guard explícito: `if (auth.currentUser) return auth.currentUser` |
| 8 | Contador de presença legível diretamente do RTDB | ✅ Corrigido — `aggregateStorePresence` agrega para `presenceCounts` |
| 9 | `requestPhoneVerification`/`confirmPhoneVerification` exportadas | ✅ Corrigido — são stubs que lançam `failed-precondition` |

---

## 3. Falhas de segurança e riscos ativos

### 3.1 🟡 MÉDIO — `aggregateStorePresence` usa `.set()` sem transação

**Arquivo:** `functions/index.js` → `exports.aggregateStorePresence`

```js
const activeCount = Object.values(presence).filter(session => session?.online === true).length
await admin.database().ref(`presenceCounts/${storeId}/activeCount`).set(activeCount)
```

**Problema:** Quando muitos visitantes se conectam ou desconectam simultaneamente (ex: loja vai viral no Instagram), múltiplos eventos `onValueWritten` disparam em paralelo. Cada um lê o snapshot de presença no momento em que executa e faz `.set()` com o valor calculado. Se dois eventos executam com dados diferentes, o último vence — mas pode sobrescrever uma contagem mais recente com uma mais antiga.

O contador se autocorrige na próxima mudança, mas durante um burst mostraria valores errados.

**Correção:**
```js
await admin.database()
  .ref(`presenceCounts/${storeId}/activeCount`)
  .transaction(() => activeCount)
```

---

### 3.2 🟡 MÉDIO — `ENFORCE_APP_CHECK` desabilitado por padrão

**Arquivo:** `functions/index.js`

```js
const ENFORCE_APP_CHECK = String(process.env.ENFORCE_APP_CHECK || '').toLowerCase() === 'true'

exports.createPublicOrder = onCall({ enforceAppCheck: ENFORCE_APP_CHECK, ... }, ...)
```

**Problema:** Se a variável de ambiente `ENFORCE_APP_CHECK` não estiver explicitamente configurada como `true` em produção, bots e scrapers podem chamar `createPublicOrder`, `getPublicCatalog` e `validatePublicCoupon` diretamente sem nenhuma validação de origem.

O rate limiting existente (por telefone + IP) protege contra abuso de pedidos, mas não contra scraping massivo de catálogos.

**Ação:** Configurar `ENFORCE_APP_CHECK=true` no ambiente de produção e ativar o Firebase App Check no console do Firebase com reCAPTCHA Enterprise ou Device Check.

---

### 3.3 🟡 MÉDIO — `findStoreForCallable` pode fazer até 16 leituras Firestore por chamada

**Arquivo:** `functions/index.js` → `findStoreForCallable`

A função tenta:
1. Direto: `publicStores.doc(key)` e `stores.doc(key)` para até 4 chaves → até 8 leituras
2. Por slug: `where('storeSlug', '==', key)` e `where('slug', '==', key)` para até 4 chaves → até 8 queries

Chamada em `getPublicStoreProfile`, `getPublicCatalog`, `validatePublicCoupon` e `createPublicOrder`. Com o rate limit de 120 chamadas/10min por IP, um único IP pode gerar até 1.920 leituras em 10 minutos.

**Ação:** Passar sempre o `storeId` exato na chamada do frontend (já disponível no contexto da loja) para que a função resolva com 1-2 leituras, nunca chegando nos fallbacks de slug query.

---

### 3.4 🟡 MÉDIO — Arquitetura dual-catálogo sem reconciliação

**Arquivos:** `functions/index.js` → triggers de sync de produtos/categorias + `loadPublicSubcollection`

O sistema mantém duas representações do catálogo:
- Coleções globais: `products` e `categories`
- Subcoleções: `publicStores/{storeId}/products` e `publicStores/{storeId}/categories`

Os triggers `syncPublicProducts` e `syncPublicCategories` mantêm as subcoleções em sync. Se um trigger falhar silenciosamente (timeout, erro de rede, cold start lento), a subcoleção ficará desatualizada. `loadPublicSubcollection` cai para o fallback global, então o cliente recebe dados corretos, mas a subcoleção fica divergente até o próximo update no produto.

Não há job de reconciliação periódica.

**Ação:** Adicionar um `onSchedule` semanal que detecta e corrige divergências entre coleções globais e subcoleções públicas.

---

### 3.5 🟠 BAIXO — `merchantOrder.js` sem rate limiting

**Arquivo:** `functions/merchantOrder.js` → `updateMerchantOrder`

Um merchant (ou sessão hijackada) pode chamar `updateMerchantOrder` em loop sem limitação. Cada chamada gera uma leitura + write no Firestore + escrita no auditLogs. Não cria risco financeiro (a validação de pricing já está no pedido), mas pode gerar custo e poluição de audit trail.

**Ação:** Adicionar rate limit simples de 60 chamadas/minuto por `uid` + `orderId`.

---

### 3.6 🟠 BAIXO — `_requestPhoneVerificationLegacyHandler` — 200 linhas de código vivo não exportado

**Arquivo:** `functions/index.js`

Duas funções privadas com prefixo `_` implementam o fluxo OTP completo (geração de código, hash HMAC, verificação timing-safe, claim de telefone). Não estão exportadas, portanto não são endpoints. Mas existem como código funcional no arquivo.

Se alguém adicionar `exports.requestPhoneVerification = _requestPhoneVerificationLegacyHandler` por engano, teria um endpoint OTP real ativo — sem envio de SMS em produção (há um TODO não implementado), mas que geraria `debugCode` no log se `FUNCTIONS_EMULATOR=true`.

**Ação:** Mover para arquivo separado `functions/_legacy/` ou deletar se não há plano de uso.

---

### 3.7 🟠 BAIXO — `termsVersion` hardcoded em dois lugares

**Arquivos:** `functions/index.js` e `firestore.rules`

```js
// index.js
const TERMS_VERSION = '2026-05-24'

// firestore.rules
&& data.termsVersion == '2026-05-24'
```

Atualizar os termos exige dois deploys simultâneos e coordenados (Functions + Firestore Rules). Se forem deployados em momentos diferentes, novos cadastros podem falhar com erro de validação ou aceitar termos desatualizados.

**Ação:** Ler `termsVersion` de um documento Firestore de configuração (`/config/terms`) tanto na rule quanto na function, ou usar uma variável de ambiente.

---

### 3.8 🟠 BAIXO — `validateBrazilianMobilePhone` duplicada em 3 arquivos

**Arquivos:** `functions/index.js`, `functions/publicOrder.js`, `src/pages/auth/OnboardingPage.jsx`

A mesma função com a mesma lógica existe em três lugares. Uma correção em um arquivo não propaga para os outros.

**Ação:** Extrair para `functions/shared/phone.js` (reusável entre as functions) e `src/utils/phone.js` (frontend).

---

### 3.9 🟠 BAIXO — Usuários anônimos do Firebase Auth acumulam sem limpeza

**Arquivo:** `src/hooks/usePresence.js`

```js
await setPersistence(auth, browserSessionPersistence)
const credential = await signInAnonymously(auth)
```

Cada visitante não autenticado cria um usuário anônimo no Firebase Auth. O Firebase Auth retém usuários anônimos indefinidamente a menos que sejam explicitamente deletados.

Com 10.000 visitas únicas/mês, o projeto acumula mais de 100.000 usuários anônimos em um ano, dificultando análise da base de usuários real e possivelmente gerando custo em planos pagos.

**Ação:** Adicionar um `onSchedule` mensal que delete usuários anônimos não convertidos criados há mais de 30 dias usando `admin.auth().listUsers()` com filtro por `providerData.length === 0`.

---

### 3.10 🟢 INFORMATIVO — `aggregateStorePresence` em `us-central1`, demais em `southamerica-east1`

**Arquivo:** `functions/index.js`

O trigger RTDB deve ser na mesma região do banco RTDB (que fica em `us-central1` por padrão). Isso é correto e intencional. Mas vale documentar: se o projeto migrar o RTDB para outra região, o trigger também precisa ser migrado.

---

## 4. O que está correto e bem implementado

```
✅ firestore.rules: protectedStoreFieldsUnchanged() bloqueia 45+ campos críticos
✅ firestore.rules: validSignupUserCreate com allowlist rígida — campos extras rejeitados
✅ firestore.rules: validReviewCreate valida storeId + trackingToken + customerPhone + status do pedido
✅ firestore.rules: publicOrderUpdateAllowed com diff.affectedKeys().hasOnly() preciso
✅ firestore.rules: orders.allow create: if false — pedidos só via Cloud Function
✅ firestore.rules: auditLogs.allow create,update,delete: if false — imutável pelo cliente
✅ functions/publicOrder.js: pricing server-side, coupon transacional, rate limit duplo (telefone + IP)
✅ functions/asaas.js: timingSafeStringEqual no webhook, secret em Cloud Secret Manager
✅ functions/asaas.js: billingLock transacional, deduplicação por payloadHash
✅ functions/asaas.js: getAsaasBaseUrl() exige ASAAS_BASE_URL explícito — sem fallback silencioso para sandbox
✅ functions/merchantOrder.js: assertMerchantCanManageOrder() server-side, shouldBlockMerchantOrderAction()
✅ functions/merchantOrder.js: bloqueia progressão retroativa de status, bloqueia pedido com pricing inválido
✅ functions/merchantOrder.js: cancellation exige motivo com ≥5 chars
✅ functions/index.js: updateStoreSettings com allowlist + denylist + hasForbiddenSettingsKeyDeep() recursivo
✅ functions/index.js: updateStoreSettings escreve audit log em createAuditLog()
✅ functions/index.js: startFreeTrial bloqueia se phoneVerified !== true
✅ functions/index.js: adminCreateStore com rollback de usuário Auth em caso de falha no Firestore
✅ functions/index.js: validateBrazilianMobilePhone com rejeição de padrões óbvios
✅ database.rules.json: auth != null && $sessionId == auth.uid
✅ database.rules.json: presenceCounts apenas leitura pelo cliente
✅ storage.rules: allow read, write: if false — Firebase Storage bloqueado totalmente
✅ firebase.json: script-src com SHA-256 hash (não unsafe-inline), frame-ancestors 'none'
✅ usePresence.js: guard contra setPersistence interferir na sessão do merchant
✅ sentry.js: maskAllText e blockAllMedia no Replay — dados sensíveis não vazam
✅ ProtectedRoute.jsx: redirect para /onboarding para merchants sem loja ou billing pendente
✅ AuthContext.jsx: onAuthStateChanged com skip explícito para usuários anônimos
```

---

## 5. Estado do MVP por área

### 5.1 Núcleo do produto

| Área | Status | Observação |
|---|---|---|
| Fluxo de pedido público | ✅ Completo e robusto | Server-side pricing, PIX, coupon transacional, rate limit duplo |
| Firebase Phone Auth | ✅ Completo | linkWithCredential, unlink fallback, fluxo inline |
| Asaas billing | ✅ Completo | Webhook, trial, billingLock, sandbox/prod, checkout |
| Mutações de pedido (merchant) | ✅ Completo | Via `merchantOrder.js` com autorização e audit log |
| Configurações da loja | ✅ Completo | Via `updateStoreSettings` com audit log server-side |
| Audit trail | ✅ Completo | Pedidos + produtos + configurações de loja |
| Presença em tempo real | ✅ Completo | RTDB auth, aggregation trigger, presenceCounts |
| Avaliações (Reviews) | ✅ Completo | Validação completa, resposta do lojista |
| Sentry | ✅ Configurado | maskAllText, DSN via env var |
| Billing / Assinatura | ✅ Completo | Trial, mudança de plano, cancelamento, vencimento |

### 5.2 Dashboard do lojista

| Área | Status | Observação |
|---|---|---|
| Pedidos em tempo real | ✅ Completo | onSnapshot, filtros, alertas |
| Menu management | ✅ Completo | Categorias, produtos, adicionais, opções |
| Cupons | ✅ Completo | Percentual e fixo, validade, limite de uso |
| Áreas de entrega | ✅ Completo | Por bairro com taxa |
| Gerenciamento de assinatura | ✅ Completo | Novo `SubscriptionManagementPage.jsx` |
| Estatísticas | ⚠️ Parcial | Funcional mas com 5 subscriptions desnecessárias |
| Notificações | ⚠️ Parcial | Bell de pedidos existe, push não implementado |
| Financeiro | 🔴 Stub | `ComingSoon` |
| Equipe / multi-user | 🔴 Stub | `ComingSoon` |

### 5.3 Loja pública (storefront)

| Área | Status | Observação |
|---|---|---|
| StoreFrontPage | ⚠️ Em refinamento | Layout melhorado, em iteração |
| CartDrawer + ProductOptionsModal | ✅ Completo | Subtotal, taxa, cupom, validação WhatsApp |
| Order Tracking | ✅ Completo | Por trackingToken, real-time |
| Avaliação pós-pedido | ✅ Completo | Form inline, validação server-side |
| Presença ("X vendo agora") | ✅ Completo | RTDB seguro, aggregation trigger |

### 5.4 Gap mais crítico para vendabilidade

| Funcionalidade | Prioridade | Impacto |
|---|---|---|
| **WhatsApp Cloud API** (notificação de novo pedido) | 🔴 Alta | Sem isso, lojista só sabe do pedido se estiver no dashboard |
| App Check em produção | 🔴 Alta | Bots podem scraping e rate limit abuse |
| Statistics — otimização de subscriptions | 🟡 Média | Custo Firestore + performance |
| Financeiro (extrato, relatórios) | 🟡 Média | Lojistas profissionais precisam de extrato |
| Equipe / multi-user | 🟡 Média | Garçons, caixas, gerentes |

---

## 6. Análise de custo Firestore

| Operação | Leituras | Escritas | Gatilho |
|---|---|---|---|
| `createPublicOrder` | 3–10 por pedido | 2–3 | Cada pedido novo |
| `validateOrderPricing` | ~3 por item do pedido | 1 | Trigger onDocumentCreated |
| `auditOrderChanges` | 0 | 1 | Trigger onDocumentUpdated |
| `aggregateStorePresence` | 0 | 1 RTDB | Cada connect/disconnect |
| `syncPublicProducts` | 0 | 1–2 | Cada update de produto |
| `syncPublicCategories` | 0 | 1–2 | Cada update de categoria |
| `updateStoreSettings` | 2 | 1 store + 1 audit | Cada save de configurações |
| `getPublicCatalog` | 1–16 | 0 | Cada abertura de cardápio |

> **Ação de maior impacto no custo:** Passar `storeId` exato no payload de `getPublicCatalog` / `getPublicStoreProfile` para eliminar os fallbacks de `findStoreForCallable`.

---

## 7. Melhorias prioritárias

### 🔴 Imediato (segurança e produto)

```
1. Ativar ENFORCE_APP_CHECK=true em produção + Firebase App Check no console
2. Implementar WhatsApp Cloud API para notificações de novo pedido ao lojista
3. Corrigir aggregateStorePresence — usar .transaction() no lugar de .set()
```

### 🟡 Curto prazo (qualidade e custo)

```
4. Passar storeId explícito em todas as chamadas de getPublicCatalog/getPublicStoreProfile
5. Statistics.jsx — eliminar 5 subscriptions paralelas de stores, usar storeIds do AuthContext
6. Adicionar onSchedule mensal para limpar usuários anônimos do Firebase Auth
7. Externalizar termsVersion/privacyVersion — remover hardcoding duplo
```

### 🟢 Médio prazo (produto e manutenção)

```
8.  Extrair validateBrazilianMobilePhone para módulo compartilhado
9.  Deletar ou mover _requestPhoneVerificationLegacyHandler para _legacy/
10. Adicionar job de reconciliação entre global collections e publicStores subcollections
11. Rate limit em updateMerchantOrder (60 calls/min por uid)
12. Financeiro — extrato de pedidos com exportação CSV
13. Equipe — multi-user por loja (garçom, caixa, gerente)
```

---

## 8. Novas funções adicionadas desde a última análise

| Função | Tipo | Descrição |
|---|---|---|
| `updateMerchantOrder` | Callable | Mutações de pedido do lojista com autorização server-side |
| `updateStoreSettings` | Callable | Configurações da loja com allowlist, denylist e audit log |
| `aggregateStorePresence` | RTDB Trigger | Agrega contagem de presença para presenceCounts |
| `acceptLatestTerms` | Callable | Re-aceite de termos com allowlist estrita |
| `updateBillingNotificationPreferences` | Callable | Preferências de notificação de billing |
| `adminUpdateSubscriptionRequestStatus` | Callable | Admin gerencia solicitações de assinatura |
| `createPaymentMethodUpdateCheckout` | Callable | Checkout para atualização de método de pagamento |
| `syncPublicProducts` / `syncPublicCategories` | Firestore Trigger | Mantém subcoleções públicas atualizadas |

---

## 9. Conclusão

O PratoBy está num estágio de qualidade técnica acima da média para um SaaS nessa fase. A migração de mutações diretas para Cloud Functions (`merchantOrder.js`, `updateStoreSettings`) eliminou as últimas lacunas de auditoria. As Firestore Rules com `diff.affectedKeys().hasOnly()` e allowlists explícitas são exemplares.

O próximo passo mais impactante para o **produto** é WhatsApp Cloud API — sem notificação de novo pedido, o lojista depende de abrir o dashboard manualmente, o que é um bloqueio real para conversão.

O próximo passo mais impactante para **segurança** é App Check — sem ele, qualquer automação pode chamar `createPublicOrder` e `getPublicCatalog` além do rate limit por phone/IP.

---

*Gerado por Claude Sonnet 4.6 · PratoBy Security & Architecture Review · 2026-05-29*
