# PROJECT_CONTEXT.md — Contexto Técnico Completo do PratoBy

Última atualização: 2026-05-31

Este documento é o mapa técnico interno do PratoBy. Ele deve ser lido por humanos e por IA antes de qualquer alteração relevante no projeto.

---

## 1. Resumo executivo

PratoBy é um SaaS white-label de cardápio digital e delivery para restaurantes, lanchonetes, pizzarias e negócios de comida. A plataforma permite que o lojista crie uma loja online própria, receba pedidos em tempo real, opere cozinha e retirada, e pague assinatura fixa sem comissão por venda.

O sistema está em fase de fechamento de MVP. Já existem:

- Loja pública por slug/ID.
- Catálogo público materializado em `publicStores`.
- Carrinho e criação de pedido via backend.
- Dashboard do lojista.
- Gestão de pedidos.
- KDS / Tela de Cozinha.
- Painel de Retirada estilo fast-food.
- Billing com Asaas.
- E-mails com Brevo.
- Notificações internas e FCM/Web Push para alertas críticos do lojista.
- Regras Firestore robustas.

Principais riscos ainda conhecidos:

- Confirmar deploy/backfill/indexes antes do piloto.
- App Check frontend opcional via `VITE_FIREBASE_APPCHECK_ENABLED=true` + `VITE_FIREBASE_APPCHECK_SITE_KEY`; ainda deve ser testado em monitor mode antes de enforcement.
- CustomerDisplay lê `orders` completos em client autenticado; futuro ideal é `publicDisplays` sem PII.
- Regra de `entregue` marcando pagamento como `paid` precisa ser entendida/documentada.
- Bundle grande; usar lazy loading no pós-MVP.

Decisões operacionais atuais:

- Backend é autoridade para preço, cupom, entrega, pedido, status, plano e billing.
- Frontend pode validar para UX, mas não pode ser a fonte final de decisão sensível.
- `publicStores/{storeId}` é a projeção pública canônica; slug é rota/alias, não ID de catálogo.
- Billing/Asaas deve ser tratado como área sensível e alterado em passos pequenos.
- Webhooks e envios de e-mail precisam ser idempotentes.
- Falhas em Brevo/notificações não devem derrubar cadastro, pedido ou billing.
- WhatsApp Cloud API, SSR/Next.js e permissões avançadas ficam fora do MVP salvo aprovação explícita. FCM/Web Push já faz parte do MVP para notificações críticas do lojista, sem PII no payload.

---

## 2. Stack e infraestrutura

### Frontend

- React.
- Vite.
- React Router DOM.
- Tailwind CSS.
- Framer Motion / motion.
- React Icons.
- Alguns componentes TSX na landing.
- Sentry frontend.
- Cloudinary para upload de imagens via assinatura gerada por Cloud Function.

### Backend/Firebase

- Firebase Auth.
- Firestore.
- Realtime Database.
- Cloud Functions v2.
- Firebase Hosting.
- Firestore Rules.
- RTDB Rules.
- Storage Rules.

### Integrações

- Asaas: billing/assinatura/checkout/webhook.
- Brevo: e-mails transacionais.
- WhatsApp Cloud API: planejado, não usado no MVP.
- FCM/Web Push: usado no MVP para alertas críticos do lojista; payload sem PII (`type`, `orderId`, `storeId`, `url`). Fluxos de cliente continuam futuros.

### Regiões de Functions

- Principal: `southamerica-east1`.
- Presença RTDB/Eventarc: `us-central1`.

---

## 3. Diretórios e arquivos por área

### Configuração raiz

```txt
.firebaserc
.gitattributes
.gitignore
database.rules.json
eslint.config.js
firebase.json
firestore.indexes.json
firestore.rules
index.html
package.json
postcss.config.js
storage.rules
tailwind.config.js
vite.config.js
```

### Docs existentes

```txt
docs/app-check-rollout.md
docs/deploy-runbook.md
docs/firebase-anonymous-cleanup.md
docs/legal-version-rollout.md
docs/pratoby-audit-2026-v3.md
docs/whatsapp-cloud-api-todo.md
```

### Functions

```txt
functions/asaas.js                       # Billing/Asaas, checkout, webhook helpers
functions/brevo.js                       # E-mails transacionais Brevo
functions/index.js                       # Exports, callables, triggers gerais
functions/merchantOrder.js               # updateMerchantOrder e fluxo de pedido merchant
functions/publicOrder.js                 # createPublicOrder e validação pública de pedido
functions/scripts/backfillPublicCatalog.js
functions/shared/phone.js
functions/package.json
```

### Frontend base

```txt
src/App.jsx
src/main.jsx
src/index.css
src/routes/AppRoutes.jsx
src/services/firebase.js
src/services/cloudinary.js
src/services/sentry.js
```

### Auth e contexto

```txt
src/contexts/AuthContext.jsx
src/hooks/useAuth.js
src/components/auth/ProtectedRoute.jsx
src/pages/auth/LoginPage.jsx
src/pages/auth/SignupPage.jsx
src/pages/auth/OnboardingPage.jsx
src/pages/auth/AuthActionPage.jsx
```

### Dashboard e layouts

```txt
src/components/layouts/DashboardLayout.jsx
src/components/layouts/DashboardPageHeader.jsx
src/components/layouts/DashboardFooter.jsx
src/components/layouts/AdminLayout.jsx
src/components/layouts/StoreFooter.jsx
src/components/merchant/GlobalOrderAlert.jsx
src/components/merchant/ProfilePanel.jsx
src/components/notifications/DashboardNotificationBell.jsx
src/components/notifications/DashboardTrialRibbon.jsx
```

### Páginas merchant

```txt
src/pages/merchant/MerchantDashboard.jsx
src/pages/merchant/OrdersPage.jsx
src/pages/merchant/KitchenDisplayPage.jsx
src/pages/merchant/CustomerDisplayPage.jsx
src/pages/merchant/BillingPage.jsx
src/pages/merchant/SubscriptionManagementPage.jsx
src/pages/merchant/Settings.jsx
src/pages/merchant/Statistics.jsx
src/pages/merchant/Reviews.jsx
src/pages/merchant/ProfilePage.jsx
src/pages/merchant/ComingSoon.jsx
src/pages/merchant/MenuManagementPage.jsx
src/pages/merchant/menu/MenuManagementPage.jsx
```

### Menu/cardápio merchant

```txt
src/pages/merchant/menu/components/CategoryEditorDrawer.jsx
src/pages/merchant/menu/components/CouponEditorDrawer.jsx
src/pages/merchant/menu/components/DeliveryAreaEditorDrawer.jsx
src/pages/merchant/menu/components/MenuCategoriesTab.jsx
src/pages/merchant/menu/components/MenuCouponsTab.jsx
src/pages/merchant/menu/components/MenuDeliveryAreasTab.jsx
src/pages/merchant/menu/components/MenuEmptyState.jsx
src/pages/merchant/menu/components/MenuProductsTab.jsx
src/pages/merchant/menu/components/MenuStatsCards.jsx
src/pages/merchant/menu/components/ProductEditorDrawer.jsx
src/pages/merchant/menu/hooks/useMenuManagementData.js
src/pages/merchant/menu/utils/couponPayloads.js
src/pages/merchant/menu/utils/deliveryPayloads.js
src/pages/merchant/menu/utils/menuFormatters.js
src/pages/merchant/menu/utils/menuPayloads.js
```

### Storefront público

```txt
src/pages/store/StoreFrontPage.jsx
src/pages/store/StoreHeader.jsx
src/pages/store/CartDrawer.jsx
src/pages/store/ProductCard.jsx
src/pages/store/ProductOptionsModal.jsx
src/pages/store/CustomerDrawer.jsx
src/pages/store/OrderTrackingPage.jsx
src/pages/store/MerchantDrawer.jsx
```

### Admin

```txt
src/pages/admin/AdminDashboard.jsx
src/pages/admin/AdminSubscriptionsPage.jsx
src/pages/admin/CreateStorePage.jsx
```

### Marketing e landing

```txt
src/pages/MarketingLayout.jsx
src/pages/landing/LandingPage.tsx
src/pages/landing/components/*
src/pages/AboutPage.jsx
src/pages/ContactPage.jsx
src/pages/PlansPage.jsx
src/pages/PrivacyPage.jsx
src/pages/TermsPage.jsx
src/pages/RestaurantExamplesPage.jsx
src/pages/NotFoundPage.jsx
```

### Utils

```txt
src/utils/billingStatus.js               # status e helpers de billing
src/utils/brazilianDocuments.js          # CPF/CNPJ, máscara, validação de dígito
src/utils/browserNotifications.js        # Notification API local
src/utils/merchantDisplayBranding.js     # branding KDS/CustomerDisplay
src/utils/notificationFormatters.js
src/utils/notificationStorage.js
src/utils/orderItems.js
src/utils/orderNumber.js
src/utils/orderSummary.js
src/utils/orderValidation.js
src/utils/phone.js
src/utils/pix.js
src/utils/planCatalog.js
src/utils/productStatus.js
src/utils/scroll.js
src/utils/ScrollToTop.jsx
src/utils/storeIdentity.js
```

---

## 4. Modelo de dados conceitual

### `stores/{storeId}`

Documento privado/operacional da loja. Pode conter owner, billing, Asaas, settings, dados administrativos e campos que não devem ser públicos.

Não deve ser lido publicamente como fonte de storefront.

Campos sensíveis protegidos pelas rules:

- owner/admin/team/role.
- billing/Asaas/subscription.
- aliases de permissão.
- bloqueios de billing.
- checkout URLs e IDs de provedor.

### `publicStores/{storeId}`

Documento público materializado com allowlist. É a fonte correta para storefront.

Subcoleções:

```txt
publicStores/{storeId}/products/{productId}
publicStores/{storeId}/categories/{categoryId}
```

Regras:

- `publicStores/{storeId}` é canônico.
- Slug resolve para `storeId`.
- Não duplicar `publicStores/{slug}`.
- Produtos/categorias carregam pelo ID canônico.

### `orders/{orderId}`

Pedido completo. Pode conter dados privados do cliente, endereço, telefone, itens, pagamento, trackingToken etc.

Regras:

- Cliente não escreve direto.
- `createPublicOrder` cria.
- `updateMerchantOrder` altera status sensível.
- CustomerDisplay não deve renderizar PII.
- Futuro ideal: projetar dados mínimos em `publicDisplays`.

### `coupons`

Cupons não devem ser listáveis publicamente. Preview via callable e validação final no backend.

### `reviews`

Reviews são ligadas a pedido/tracking/telefone. Lojista só pode responder/moderar, não alterar rating/comentário original.

### `notificationLogs`

Controle idempotente para Brevo/notificações.

Client não deve escrever.

### `billingLocks` e `billingRecovery`

Coleções de controle para fluxos sensíveis de billing.

Uso esperado:

- adquirir lock local antes de chamar provedor externo;
- evitar criação duplicada de assinatura/checkout;
- registrar estado de recuperação se a chamada ao provedor teve sucesso mas a persistência local final falhou;
- manter dados de recuperação suficientes para auditoria/suporte sem expor segredo.

Não usar esses documentos como fonte pública de status. O status exibido ao lojista deve vir do estado consolidado e confirmado pelo backend/webhook.

---

## 5. Cloud Functions principais

### `createPublicOrder`

Arquivo:

```txt
functions/publicOrder.js
```

Função:

- Cria pedido público.
- Recalcula itens, opções, adicionais, preço, cupom, entrega e total.
- Valida loja aberta/billing/área de entrega.
- Bloqueia tentativa de criar pedido inválido.

Nunca confiar no total enviado pelo frontend.

### `updateMerchantOrder`

Arquivo:

```txt
functions/merchantOrder.js
```

Função:

- Muda status de pedido de forma auditada.
- Usado por OrdersPage, KDS e outros fluxos merchant.
- Não usar `updateDoc` direto em `orders`.

Fluxo KDS desejado:

```txt
confirmado → preparando → pronto
```

Delivery deve seguir para `em_rota` pela OrdersPage, não pela KDS.

### `updateStoreSettings`

Arquivo:

```txt
functions/index.js
```

Função:

- Atualiza settings sensíveis da loja.
- Deve ser usado para abrir/fechar loja e settings merchant.
- Não usar `updateDoc` direto em `stores.isOpen` pelo frontend merchant.

### Asaas

Arquivo:

```txt
functions/asaas.js
```

Funções/conceitos:

- `startAsaasSubscription`.
- `createPaymentMethodUpdateCheckout`.
- `asaasWebhook`.
- Checkout, assinatura, sync, webhook.

Regras:

- CPF/CNPJ com dígito real.
- Webhook idempotente.
- Fluxos de criação/checkout devem ser lock-first quando houver risco de chamada duplicada ao provedor.
- Se o provedor confirmar algo e a gravação local falhar, persistir recuperação explícita.
- Tokens por Secret Manager.
- Mensagens honestas sobre atualizar pagamento/regularizar cobrança.

### Brevo

Arquivo:

```txt
functions/brevo.js
```

Regras:

- Templates por ID/tag.
- API key somente no backend.
- Idempotência por `notificationLogs`.
- Falha não quebra fluxo principal.

### Public catalog

Arquivo:

```txt
functions/index.js
functions/scripts/backfillPublicCatalog.js
```

Funções/conceitos:

- `getPublicStoreProfile`.
- `getPublicCatalog`.
- Materialização de perfil, produto e categoria.
- Backfill.

---

## 6. Billing, planos e valores

Planos atuais:

```txt
Essencial      R$ 59,99   5999 centavos
Profissional   R$ 89,99   8999 centavos
Premium        R$ 159,99  15999 centavos
```

Usar **Profissional**, não “Plus”, em UI/comercial.

Regra financeira:

- Valores em centavos inteiros.
- Evitar floats.
- Backend é fonte da verdade.
- Callables validam plano/valor/status.

CPF/CNPJ:

- `src/utils/brazilianDocuments.js` no frontend.
- Validação backend em `functions/asaas.js`.
- CPF/CNPJ inválido não deve chamar Asaas.

---

## 7. CEP, bairro e entrega

Arquivos principais:

```txt
src/pages/store/CartDrawer.jsx
functions/publicOrder.js
```

Regras:

- Normalizar bairro: lower, trim, sem acento, espaços normalizados.
- CEP validado com bairro retornado deve bater com bairro/alias atendido.
- CEP fora da área não pode ser burlado selecionando outro bairro manualmente.
- ViaCEP falhou ou não retornou bairro: pode permitir seleção manual na lista do lojista.
- Backend continua validando de verdade.

Fluxo correto:

```txt
CEP retorna bairro atendido/alias → aceita
CEP retorna bairro fora da área → bloqueia
CEP sem bairro ou ViaCEP falha → seleção manual permitida
```

---

## 8. Cupons

Arquivos:

```txt
src/hooks/useCoupons.js
src/pages/store/CartDrawer.jsx
functions/publicOrder.js
```

Regras:

- Preview de cupom no frontend é UX.
- `createPublicOrder` valida de novo.
- Cupom com pedido mínimo deve ser revalidado quando carrinho muda.
- Se subtotal elegível cair abaixo do mínimo, remover/invalidar desconto.
- Mensagem deve dizer quanto falta.

---

## Pedidos Agendados e Sob Encomenda

Estado atual:

- Backend valida agendamento em `createPublicOrder`.
- `publicStores` materializa `publicScheduling` e `product.scheduling`.
- `Settings` configura agendamento da loja.
- `ProductEditorDrawer` configura encomenda por produto.
- Checkout público permite Pedir agora / Agendar.
- Tracking mostra pedido agendado.

Pendências:

- Corrigir `normalizeSlotInterval` em `functions/shared`.
- Corrigir `normalizeProductScheduling(null)` na loja pública.
- Adaptar `OrdersPage`/SLA/card expandido.
- Adaptar KDS para mostrar agendado só na hora de preparo.
- Ajustar notificações/alertas/impressão de comanda.
- Criar dashboard de agenda do dia em patch separado.

---

## 9. KDS e Painel de Retirada

### KitchenDisplayPage

Função:

- Tela da cozinha.
- Uso interno.
- Mostra detalhes necessários para preparo.

Deve mostrar:

- número do pedido;
- tipo;
- tempo;
- itens;
- adicionais/opções;
- observações de preparo;
- ação de status.

Não precisa mostrar:

- telefone;
- endereço completo;
- pagamento;
- dados sensíveis que não ajudam a cozinha.

Fluxo:

```txt
confirmado → preparando → pronto
```

Pedido pronto:

- retirada/local/mesa: ação **Finalizar pedido** pode marcar `entregue`.
- delivery: não finalizar na KDS; despachar na OrdersPage.

### CustomerDisplayPage

Função:

- Tela pública de retirada.
- Estilo fast-food.
- Mostra `Em preparo` e `Prontos para retirada`.

Privacidade obrigatória:

Não renderizar:

```txt
nome
telefone
endereço
itens
valor
pagamento
observações
```

Mostrar apenas:

```txt
número/senha
status/coluna
```

---

## 10. Auth e presença

Auth:

- Admin.
- Developer/dev.
- Merchant/lojista.
- Cliente público/anônimo.

Anonymous Auth:

- Usado para presença pública.
- Não deve ser tratado como lojista/admin.

Presence:

- `presence/{storeId}/{sessionId}` exige auth.
- `sessionId == auth.uid`.
- Cliente lê `presenceCounts/{storeId}/activeCount`, não session nodes.
- `aggregateStorePresence` agrega.

---

## 11. App Check

Estado:

- Backend possui flags/opções de App Check.
- Frontend inicializa App Check somente quando `VITE_FIREBASE_APPCHECK_ENABLED=true` e `VITE_FIREBASE_APPCHECK_SITE_KEY` estao configurados.

Regra:

```txt
Não ativar ENFORCE_APP_CHECK=true sem:
1. `VITE_FIREBASE_APPCHECK_ENABLED=true` e `VITE_FIREBASE_APPCHECK_SITE_KEY` configurados no frontend.
2. monitor mode.
3. teste de loja pública, cupom, pedido, tracking, billing e merchant.
```

---

## 12. Compatibilidade de TV/KDS

Recomendação operacional:

- Usar Chrome atualizado, TV Box Android, tablet, notebook, mini PC ou Chromecast.
- Evitar navegador nativo de Smart TV antiga.
- Animações devem ser leves.
- Áudio pode exigir interação inicial por política de autoplay.

---

## 13. Pendências e roadmap

### Antes do piloto

- Confirmar deploy de hosting/functions/indexes.
- Rodar backfill do public catalog.
- Teste E2E real ponta a ponta.
- Testar Billing CPF/CNPJ com Asaas.
- Testar KDS/CustomerDisplay em tela real.
- Testar loja pública por slug e por ID canônico.
- Testar fluxo de cupom com subtotal acima e abaixo do mínimo.
- Testar pedido delivery e retirada até tracking/review.

### P1

- App Check monitor/enforcement.
- PublicDisplays sem PII.
- Firestore Rules unit tests.
- Playwright E2E.
- Lazy loading de rotas.
- Sync Asaas periódico.

### P2

- FCM para cliente e expansões de notificação.
- Storefront SSR/SEO.
- TypeScript gradual.
- Cardápio por dia/horário.
- Permissões/equipe.
- Relatórios/exportações.

---

## 14. Comandos úteis

Validação:

```bash
node --check functions/index.js
node --check functions/publicOrder.js
node --check functions/merchantOrder.js
node --check functions/asaas.js
node --check functions/brevo.js
node --check functions/scripts/backfillPublicCatalog.js
npm run lint
npm run build
git diff --check
```

Patch sem dist/cache/log:

```bash
git diff -- . ":(exclude)dist" ":(exclude)node_modules" ":(exclude)firebase-debug.log" > changes.patch
```

Deploy controlado:

```bash
firebase deploy --only hosting
firebase deploy --only firestore:indexes
firebase deploy --only functions:updateMerchantOrder
firebase deploy --only functions:updateStoreSettings
firebase deploy --only functions:createPublicOrder,functions:confirmCustomerDelivery,functions:markCustomerPixProofSent,functions:requestCustomerOrderCancellation,functions:submitPublicOrderReview
firebase deploy --only functions:startAsaasSubscription,functions:createPaymentMethodUpdateCheckout
```

Backfill:

```bash
cd functions
npm run backfill:public-catalog -- --dry-run --storeId=STORE_ID
npm run backfill:public-catalog -- --write --storeId=STORE_ID
```

---

## 15. Matriz rápida de impacto

Use esta matriz antes de alterar arquivos:

```txt
Storefront/CartDrawer        -> testar publicStores, cupom, CEP/bairro, createPublicOrder e tracking.
OrdersPage/KDS               -> testar updateMerchantOrder, fluxo de status e CustomerDisplay.
Settings                     -> testar updateStoreSettings e abertura/fechamento da loja pública.
Billing/Subscription         -> testar CPF/CNPJ, checkout Asaas, webhook e mensagens de UX.
Functions/publicOrder        -> testar totais, cupons, entrega, loja fechada e billing bloqueado.
Functions/merchantOrder      -> testar transições válidas, auditoria e bloqueios.
Functions/index              -> revisar exports, triggers, settings e integrações colaterais.
firestore.rules              -> exigir revisão cuidadosa e, idealmente, testes no Emulator.
```

Ao tocar em uma linha sensível, documente no fechamento da tarefa: arquivos alterados, impacto de segurança, validações rodadas, deploy necessário e testes manuais recomendados.
