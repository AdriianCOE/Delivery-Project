# PratoBy — Análise Técnica Completa
**Data:** 25 de maio de 2026  
**Escopo:** Segurança · Riscos · Estado do MVP · Melhorias  
**Arquivos lidos:** `firestore.rules`, `database.rules.json`, `firebase.json`, `functions/index.js`, `functions/asaas.js`, `functions/publicOrder.js`, `AuthContext.jsx`, `Settings.jsx`, `ProtectedRoute.jsx`, `usePresence.js`, `sentry.js`, `Statistics.jsx`, `AppRoutes.jsx`, `CartDrawer.jsx`, `OnboardingPage.jsx`, `Reviews.jsx` e todos os stubs.

---

## Resumo executivo

O PratoBy está em estágio de MVP funcional com arquitetura sólida no núcleo. O fluxo de pedidos públicos, a autenticação por telefone e a integração com Asaas estão bem implementados. A análise anterior identificou 2 riscos altos (RTDB sem auth e Review sem validação de customerPhone) — **ambos foram corrigidos nesta versão**. Surgem novos achados menores. Nenhum risco crítico ativo.

---

## 1. Segurança

### 1.1 Correções confirmadas desde a última análise

| # | O que foi corrigido | Onde |
|---|---|---|
| ✅ 1 | RTDB presence agora exige `auth != null && $sessionId == auth.uid` | `database.rules.json` |
| ✅ 2 | `validReviewCreate` valida `customerPhone` contra o pedido | `firestore.rules` |
| ✅ 3 | `requestPhoneVerification` / `confirmPhoneVerification` são stubs que lançam erro | `functions/index.js` |
| ✅ 4 | Webhook Asaas usa `timingSafeStringEqual` com `crypto.timingSafeEqual` | `functions/asaas.js` |
| ✅ 5 | CSP `script-src` usa hash SHA-256, **não** `unsafe-inline` | `firebase.json` |

### 1.2 Achados ativos por severidade

#### 🟡 MÉDIO — Exposição do Project ID antigo no CSP

**Arquivo:** `firebase.json` → header `Content-Security-Policy`  
**Detalhe:** O CSP contém referências ao ID do projeto Firebase anterior:  
```
frame-src ... https://borapedir-f529a.firebaseapp.com https://borapedir-f529a.web.app
```
Isso expõe o nome histórico do produto (BoraPedir) publicamente em todo header HTTP. Não é uma vulnerabilidade explorável, mas revela o histórico do projeto e o ID Firebase real para qualquer pessoa que leia os headers.  
**Correção:** Substituir pelas URLs do projeto PratoBy ou remover se não houver iframes de autenticação dessas origens.

---

#### 🟡 MÉDIO — `usePresence` cria usuários anônimos no Firebase Auth sem limpeza

**Arquivo:** `src/hooks/usePresence.js`  
**Detalhe:** Para visitantes não autenticados, o hook chama `signInAnonymously(auth)` a cada visita à StoreFrontPage. O Firebase Auth acumula esses usuários indefinidamente. Em escala (ex: 10.000 visitas/mês), o projeto terá dezenas de milhares de usuários anônimos fantasmas no Auth.  
**Impacto:** Não afeta segurança, mas polui o Firebase Auth, dificulta análises e pode ter custo em planos pagos.  
**Correção:** Ativar a limpeza automática de usuários anônimos no Firebase ou usar REST API diretamente para presence sem necessitar de Auth.

---

#### 🟡 MÉDIO — `isOpen` mutável diretamente pelo cliente em `Settings.jsx`

**Arquivo:** `src/pages/merchant/Settings.jsx` → `ALLOWED_KEYS`  
**Detalhe:** `isOpen` está no `ALLOWED_KEYS` e é gravado via `updateDoc` direto do cliente. A Firestore Rule permite (`protectedStoreFieldsUnchanged()` não bloqueia `isOpen`). Isso é intencional — o toggle abrir/fechar loja deve ser rápido. Mas significa que não há audit log server-side de quando a loja abriu ou fechou.  
**Risco:** Sem trace de quando o lojista abre/fecha a loja — impossível auditar em disputas.  
**Correção:** Adicionar o `isOpen` ao `auditOrderChanges` ou criar um trigger separado `auditStoreChanges`.

---

#### 🟠 BAIXO — `reserveCouponUsage` exportada como no-op

**Arquivo:** `functions/index.js`  
**Detalhe:** A função ainda está exportada e é ativada em cada pedido criado (`onDocumentCreated orders/{orderId}`), executando apenas um `logger.info` e retornando. Não causa dano, mas consome cold-start slots e execuções faturadas.  
**Correção:** Remover o export. A lógica real está em `createPublicOrder`.

---

#### 🟠 BAIXO — `Users.jsx` está vazio mas é roteado

**Arquivo:** `src/pages/merchant/Users.jsx`  
**Detalhe:** O arquivo existe com 0 linhas de conteúdo. O `AppRoutes.jsx` redireciona `/users` → `/dashboard/users`, que usa `<ComingSoon>` — então o usuário nunca chega no arquivo vazio. Mas o arquivo existe e pode causar confusão.  
**Correção:** Deletar ou substituir pela implementação real de CRM.

---

#### 🟠 BAIXO — `termsVersion` e `privacyVersion` hardcoded em Cloud Function

**Arquivo:** `functions/index.js` → `TERMS_VERSION = '2026-05-24'`  
**Arquivo:** `firestore.rules` → `data.termsVersion == '2026-05-24'`  
**Detalhe:** Se os termos forem atualizados, é necessário um deploy de Cloud Functions **e** de Firestore Rules para que novos cadastros sejam forçados a aceitar a versão nova. Não há mecanismo de migração para usuários existentes que aceitaram versões antigas.  
**Correção:** Centralizar em variável de ambiente ou Firestore config document para não exigir redeploy.

---

#### 🟢 BAIXO — `StoreHeader.jsx` continua órfão

**Arquivo:** `src/pages/store/StoreHeader.jsx`  
**Detalhe:** Arquivo de 1383 linhas não importado em nenhum ponto do projeto.  
**Correção:** Deletar com segurança.

---

### 1.3 O que está correto e bem implementado

```
✅ protectedStoreFieldsUnchanged() bloqueia 20 campos críticos em updates diretos
✅ validSignupUserCreate tem allowlist rígida — qualquer campo extra é rejeitado
✅ createPublicOrder: pricing server-side, coupon transacional, rate limit duplo (por telefone + IP em transação)
✅ precheckFirebasePhoneClaim transacional com rate limit (5/10min por uid+phoneHash)
✅ confirmFirebasePhoneVerified: transacional, atômico, com fallback de unlink
✅ Webhook Asaas: secret em Cloud Secret Manager, timingSafeEqual, payloadHash para deduplicação
✅ Audit trail de pedidos e produtos via triggers
✅ phoneVerifications, phoneClaims, storeSlugClaims, rateLimits, billingLocks — todos allow read,write: if false
✅ Storage totalmente bloqueado (Firebase Storage não é usado)
✅ CSP: script-src com SHA-256 (não unsafe-inline), frame-ancestors 'none', object-src 'none'
✅ Sentry com maskAllText e blockAllMedia no Replay — dados sensíveis não vazam
✅ startFreeTrial bloqueia se phoneVerified !== true
✅ orders.allow create: if false — pedidos só criados via Cloud Function
✅ auditLogs: allow create,update,delete: if false — imutável pelo cliente
```

---

## 2. Riscos de arquitetura

### 2.1 Performance — Statistics.jsx com 5 subscriptions paralelas de stores

**Arquivo:** `src/pages/merchant/Statistics.jsx`  
**Detalhe:** O componente abre 5 `onSnapshot` simultâneos para encontrar as lojas do merchant:
```js
subscribeStores(query(collection(db, 'stores'), where('ownerId', '==', uid)))
subscribeStores(query(collection(db, 'stores'), where('ownerUid', '==', uid)))
subscribeStores(query(collection(db, 'stores'), where('owner.uid', '==', uid)))
subscribeStores(query(collection(db, 'stores'), where('allowedUserIds', 'array-contains', uid)))
subscribeStores(query(collection(db, 'stores'), where('merchantUids', 'array-contains', uid)))
```
Para cada loja encontrada, abre mais 2 subscriptions de pedidos (`storeId in [...]` + `storeSlug in [...]`). Um único merchant com 1 loja gera **7 listeners ativos** simultâneos. Isso aumenta custo de leituras Firestore, latência de conexão e uso de memória no cliente.  
**Correção:** Usar `storeIds` do perfil do usuário (já armazenado no AuthContext) como fonte de verdade, eliminando as 5 queries de stores.

---

### 2.2 Conflito potencial de persistência Auth em `usePresence`

**Arquivo:** `src/hooks/usePresence.js`  
**Detalhe:** `getPresenceUser()` chama `setPersistence(auth, browserSessionPersistence)` antes de `signInAnonymously`. Se esse código executa **enquanto** um merchant está logado, o `setPersistence` muda a persistência da sessão do merchant de `localStorage` (padrão Firebase) para `sessionStorage`. Na próxima aba, o merchant estaria deslogado.  
**Proteção existente:** O `if (auth.currentUser) return auth.currentUser` faz early return — se o merchant já está logado, `setPersistence` nunca é chamado.  
**Risco real:** Se por algum motivo `auth.currentUser` retornar `null` temporariamente durante um reload, o hook pode chamar `setPersistence` e afetar a sessão do merchant.  
**Correção:** Mover `setPersistence` para após validar que não há usuário ativo, ou usar uma instância separada de `FirebaseApp` para a presença anônima.

---

### 2.3 `in` queries em Statistics com `storeKeys` de tamanho variável

**Arquivo:** `src/pages/merchant/Statistics.jsx`  
**Detalhe:** As queries usam `where('storeId', 'in', baseKeys)`. Se `baseKeys` tiver mais de 30 itens (limite atual do Firestore), a query falha silenciosamente ou lança erro. Para um merchant com muitas lojas ou muitos `storeKeys`, isso pode quebrar a página de estatísticas.  
**Correção:** Limitar `baseKeys.slice(0, 30)` com aviso ou dividir em múltiplas queries.

---

### 2.4 Dead code acumulando

| Arquivo | Status | Ação |
|---|---|---|
| `StoreHeader.jsx` | 1383 linhas, zero imports | Deletar |
| `Motoboy.jsx` | Vazio (0 linhas) | Deletar — rota usa `ComingSoon` |
| `OutScreen.jsx` | Vazio (0 linhas) | Deletar — rota usa `ComingSoon` |
| `QRCodes.jsx` | Vazio (0 linhas) | Deletar — rota usa `ComingSoon` |
| `Users.jsx` | Vazio (0 linhas) | Deletar — rota usa `ComingSoon` |
| `reserveCouponUsage` export | No-op, dispara em todo pedido | Remover export |

---

## 3. Estado do MVP por área

### 3.1 Núcleo do produto

| Área | Status | Observação |
|---|---|---|
| Fluxo de pedido público | ✅ Completo | Server-side pricing, PIX, coupon transacional |
| Firebase Phone Auth | ✅ Completo | linkWithCredential + unlink fallback + inline UX |
| Asaas billing | ✅ Completo | webhook, trial, billingLock, sandbox/prod |
| Firestore Rules | ✅ Sólido | 20 campos protegidos, allowlists rígidas |
| Audit trail | ✅ Completo | Pedidos + produtos por triggers |
| Rate limiting | ✅ Completo | Transacional por telefone + IP em pedidos, por uid em phone auth |
| Sentry | ✅ Configurado | maskAllText ativo, DSN via env var |
| SEO básico | ✅ Funcionando | react-helmet-async, og:image, favicon dinâmico |

### 3.2 Dashboard do lojista

| Área | Status | Observação |
|---|---|---|
| Pedidos em tempo real | ✅ Completo | onSnapshot, filtros, som de alerta |
| Cardápio (menu management) | ✅ Completo | Categorias, produtos, adicionais, opções |
| Cupons | ✅ Completo | Percentual e fixo, com validade |
| Áreas de entrega | ✅ Completo | Por bairro com taxa |
| Configurações da loja | ✅ Completo | Horários, PIX, tema, endereço |
| Avaliações (Reviews) | ✅ Completo | Listagem, filtro, resposta do lojista |
| Estatísticas | ⚠️ Parcial | Funcional, mas 5 subscriptions desnecessárias |
| Billing / Assinatura | ✅ Completo | Trial, checkout, past_due, renovação |
| Perfil | ✅ Completo | Foto, nome, dados básicos |
| Notificações | ⚠️ Parcial | Bell de pedidos existe, push não implementado |

### 3.3 Loja pública (storefront)

| Área | Status | Observação |
|---|---|---|
| StoreFrontPage | ⚠️ Em refinamento | Layout melhorado, banner corrigido |
| CartDrawer | ✅ Completo | Subtotal, desconto, taxa, validação WhatsApp |
| ProductOptionsModal | ✅ Completo | Opções obrigatórias/múltiplas, adicionais |
| Order Tracking | ✅ Completo | Por trackingToken, real-time |
| Presença (viewers) | ✅ Funcionando | Anônimo via signInAnonymously, RTDB seguro |
| Avaliação pós-pedido | ✅ Completo | Form inline, validação server-side |

### 3.4 O que falta para o produto estar 100% vendável

| Funcionalidade | Prioridade | Observação |
|---|---|---|
| Notificações WhatsApp | 🔴 Alta | TODO no código, fundamental para o lojista saber de pedidos novos |
| Push notifications | 🟡 Média | Alternativa/complemento ao WhatsApp |
| Financeiro (relatórios) | 🟡 Média | Página `ComingSoon` — lojistas precisam de extrato |
| Equipe / multi-user | 🟡 Média | Página `ComingSoon` — garçons e caixas |
| QR Codes para mesas | 🟢 Baixa | Página `ComingSoon` |
| OutScreen (cozinha) | 🟢 Baixa | Página `ComingSoon` |
| MotoBot | 🟢 Baixa | Página `ComingSoon` |

---

## 4. Melhorias recomendadas por prioridade

### 🔴 Imediato (segurança e limpeza)

```
1. Remover export reserveCouponUsage de functions/index.js
2. Deletar StoreHeader.jsx, Motoboy.jsx, OutScreen.jsx, QRCodes.jsx, Users.jsx
3. Corrigir frame-src no CSP — substituir borapedir-f529a pelas URLs pratoby corretas
4. Adicionar auditStoreChanges trigger para registrar mudanças de isOpen
```

### 🟡 Curto prazo (qualidade e performance)

```
5. Statistics.jsx — eliminar 5 subscriptions de stores, usar storeIds do AuthContext
6. usePresence.js — garantir setPersistence não afeta sessão de merchant autenticado
7. Externalizar termsVersion/privacyVersion para Firestore config ou env var
8. Implementar limpeza periódica de usuários anônimos do Firebase Auth (Cloud Scheduler)
```

### 🟢 Médio prazo (produto)

```
9.  WhatsApp Cloud API — notificações de novo pedido para o lojista (maior gap de produto)
10. Statistics.jsx — redesenhar queries com limit(30) e tratamento de erro
11. Financeiro — extrato de pedidos com exportação CSV
12. Equipe — multi-user por loja com roles (garçom, caixa, gerente)
```

### ⚙️ Técnico de longo prazo

```
13. Settings.jsx → migrar updateDoc para Cloud Function com audit log server-side
14. Firebase Auth anonymous — avaliar separar em instância de App dedicada para presença
15. Consolidar as 3 cópias de validateBrazilianMobilePhone em shared util/module
16. Adicionar limit(30) guard em todas as queries que usam baseKeys
```

---

## 5. Análise de custo Firestore (estimativa)

| Trigger/Query | Leituras por evento | Volume estimado |
|---|---|---|
| `validateOrderPricing` (trigger) | ~3 por item do pedido | Cada pedido |
| `auditOrderChanges` (trigger) | 1 write por mudança | Cada update de status |
| `auditProductPriceChanges` (trigger) | 1 write | Cada update de produto |
| `reserveCouponUsage` (no-op) | 0 leituras + 1 invocação | **Cada pedido — desnecessário** |
| Statistics.jsx (5 subscriptions) | 5 queries abertas permanentemente | Durante a sessão do merchant |
| usePresence (signInAnonymously) | 1 write no RTDB | Cada visita de novo cliente |

> **Ação de maior impacto no custo:** remover `reserveCouponUsage` e corrigir as 5 subscriptions de Statistics.

---

## 6. Conclusão

O PratoBy tem uma base técnica sólida para um SaaS de delivery no Brasil. Os pontos mais importantes resolvidos nesta versão são a segurança do RTDB e a validação de reviews. O próximo passo de maior impacto no produto é a implementação de notificações WhatsApp — sem ela, o lojista depende de abrir o dashboard manualmente para saber de novos pedidos, o que é um bloqueio real para conversão de clientes pagantes.

A arquitetura de segurança (Firestore Rules + Cloud Functions + rate limiting transacional) está num nível que permite crescer com confiança.

---

*Gerado por Claude Sonnet 4.6 · PratoBy Lead Review · 2026-05-25*
