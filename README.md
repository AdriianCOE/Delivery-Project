# PratoBy — Cardápio Digital e Delivery sem Comissão

Última atualização: 2026-05-31

PratoBy é uma plataforma SaaS B2B para restaurantes, lanchonetes, pizzarias e lojas de comida criarem uma loja/cardápio digital próprio, receberem pedidos online pelo próprio link e gerenciarem operação, cozinha, retirada e assinatura sem pagar comissão por venda.

Frases de posicionamento usadas no projeto:

- **Seu cardápio. Seu link. Seus pedidos. Zero comissão.**
- **Seu delivery online, sem comissão por pedido.**
- **Crie sua loja, receba pedidos e venda pelo seu próprio link.**

Domínio principal: `pratoby.com`
Marca atual: `PratoBy`
Identidade visual principal: laranja PratoBy.

Documentos que devem ser lidos antes de alterar o projeto:

```txt
AGENTS.md            # regras obrigatórias para IA/agentes e mudanças sensíveis
PROJECT_CONTEXT.md   # mapa técnico, modelo de dados e decisões de arquitetura
docs/deploy-runbook.md
docs/app-check-rollout.md
docs/whatsapp-cloud-api-todo.md
```

Para mudanças em código, trate `AGENTS.md` como contrato operacional. O README explica o produto; `PROJECT_CONTEXT.md` explica a arquitetura; `AGENTS.md` define o que pode ou não ser alterado sem aprovação explícita.

---

## 1. Visão do produto

O PratoBy atende lojistas pequenos e médios que querem vender online sem depender de marketplaces com comissão. O lojista cria sua loja, cadastra cardápio, configura entrega/pagamento, compartilha o link e recebe pedidos em tempo real.

Fluxo resumido:

```txt
Cliente acessa loja pública
→ escolhe produtos
→ monta carrinho
→ aplica cupom, se houver
→ informa dados de entrega/retirada
→ cria pedido via Cloud Function
→ pedido aparece no dashboard do lojista
→ atendente confirma
→ cozinha acompanha no KDS
→ cliente acompanha tracking ou painel de retirada
```

Principais áreas do produto:

- Landing page comercial.
- Autenticação/cadastro/onboarding do lojista.
- Dashboard do lojista.
- Gerenciamento de cardápio, categorias, cupons e bairros/taxas.
- Loja pública por slug.
- Carrinho e checkout público.
- Tracking do pedido.
- Gestão de pedidos.
- KDS / Tela de Cozinha.
- Painel de Retirada estilo fast-food.
- Billing/assinatura com Asaas.
- E-mails transacionais com Brevo.
- Notificações internas do dashboard.

Estado atual do MVP:

- A criação de pedido público deve passar por `createPublicOrder`.
- Alteração de status de pedido merchant deve passar por `updateMerchantOrder`.
- Abertura/fechamento e settings sensíveis devem passar por `updateStoreSettings`.
- Storefront deve usar `publicStores/{storeId}` como catálogo público materializado.
- Billing/assinatura usa Asaas como fonte externa e webhook como confirmação.
- WhatsApp Cloud API, FCM/Web Push, SSR/Next.js e permissões complexas são pós-MVP.

---

## 2. Stack técnica

Frontend:

- React.
- Vite.
- React Router DOM.
- Tailwind CSS.
- Framer Motion / motion.
- React Icons.
- Alguns componentes TSX na landing.
- Design mobile-first, dark/light mode, visual premium.

Backend/Firebase:

- Firebase Auth.
- Firestore.
- Realtime Database para presença.
- Cloud Functions v2.
- Firebase Hosting.
- Firestore Rules.
- Realtime Database Rules.
- Storage Rules.

Integrações:

- Asaas para billing, assinatura, checkout e webhooks.
- Brevo para e-mails transacionais.
- Cloudinary para upload de imagens via unsigned upload.
- Sentry para observabilidade frontend.
- WhatsApp Cloud API ficou como plano futuro; MVP usa fallback com som, notificações, wa.me e painel.

Regiões:

- Cloud Functions principais: `southamerica-east1`.
- `aggregateStorePresence`: `us-central1`, por compatibilidade RTDB/Eventarc.

---

## 3. Cores e identidade visual

Cores principais recomendadas:

```txt
Laranja principal: #F97316
Laranja hover/destaque: #EA580C
Fundo suave logo: #FFF7ED
Alternativa premium: #FFFBF5
Texto escuro: #111827
```

Diretrizes visuais:

- Visual premium, leve e moderno.
- Mobile-first.
- Dark mode e light mode bem adaptados.
- Glassmorphism leve quando fizer sentido.
- Evitar telas poluídas.
- Evitar informação sensível em telas públicas.
- Animações suaves, sem prejudicar Smart TVs/TV boxes.

---

## 4. Estrutura de diretórios

Raiz e configuração:

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

Documentação existente:

```txt
docs/app-check-rollout.md
docs/deploy-runbook.md
docs/firebase-anonymous-cleanup.md
docs/legal-version-rollout.md
docs/pratoby-audit-2026-v3.md
docs/whatsapp-cloud-api-todo.md
```

Cloud Functions:

```txt
functions/.gitignore
functions/asaas.js
functions/brevo.js
functions/index.js
functions/merchantOrder.js
functions/package.json
functions/publicOrder.js
functions/scripts/backfillPublicCatalog.js
functions/shared/phone.js
```

Assets públicos:

```txt
public/android-chrome-512x512.png
public/bell.mp3
public/confirmation.mp3
public/favicon.ico
public/favicon.png
public/icons/*
public/notransparent.png
public/og/pratoby-cover.png
public/og/pratoby-logo.png
public/og/pratoby-mark.png
public/robots.txt
public/site.webmanifest
public/sitemap.xml
```

Frontend principal:

```txt
src/App.jsx
src/main.jsx
src/index.css
src/routes/AppRoutes.jsx
src/services/firebase.js
src/services/cloudinary.js
src/services/sentry.js
```

Contextos e hooks:

```txt
src/contexts/AuthContext.jsx
src/contexts/CartContext.jsx
src/contexts/DashboardThemeContext.jsx
src/hooks/useAuth.js
src/hooks/useCoupons.js
src/hooks/useDashboardNotifications.js
src/hooks/usePresence.js
```

Layouts e componentes compartilhados:

```txt
src/components/auth/ProtectedRoute.jsx
src/components/billing/SubscriptionStatusBadge.jsx
src/components/layouts/AdminLayout.jsx
src/components/layouts/DashboardFooter.jsx
src/components/layouts/DashboardLayout.jsx
src/components/layouts/DashboardPageHeader.jsx
src/components/layouts/StoreFooter.jsx
src/components/merchant/GlobalOrderAlert.jsx
src/components/merchant/ProfilePanel.jsx
src/components/notifications/DashboardNotificationBell.jsx
src/components/notifications/DashboardTrialRibbon.jsx
src/components/privacy/CookieConsent.jsx
src/components/seo/SEO.jsx
src/components/shared/Skeletons.jsx
src/components/ui/AnimatedSegmentedControl.jsx
```

Páginas públicas/marketing:

```txt
src/pages/AboutPage.jsx
src/pages/ContactPage.jsx
src/pages/MarketingLayout.jsx
src/pages/PlansPage.jsx
src/pages/PrivacyPage.jsx
src/pages/RestaurantExamplesPage.jsx
src/pages/TermsPage.jsx
src/pages/NotFoundPage.jsx
src/pages/landing/*
```

Autenticação:

```txt
src/pages/auth/AuthActionPage.jsx
src/pages/auth/LoginPage.jsx
src/pages/auth/OnboardingPage.jsx
src/pages/auth/SignupPage.jsx
```

Admin:

```txt
src/pages/admin/AdminDashboard.jsx
src/pages/admin/AdminSubscriptionsPage.jsx
src/pages/admin/CreateStorePage.jsx
```

Dashboard lojista:

```txt
src/pages/merchant/BillingPage.jsx
src/pages/merchant/ComingSoon.jsx
src/pages/merchant/CustomerDisplayPage.jsx
src/pages/merchant/KitchenDisplayPage.jsx
src/pages/merchant/MenuManagementPage.jsx
src/pages/merchant/MerchantDashboard.jsx
src/pages/merchant/OrdersPage.jsx
src/pages/merchant/ProfilePage.jsx
src/pages/merchant/Reviews.jsx
src/pages/merchant/Settings.jsx
src/pages/merchant/Statistics.jsx
src/pages/merchant/SubscriptionManagementPage.jsx
src/pages/merchant/menu/*
```

Loja pública:

```txt
src/pages/store/CartDrawer.jsx
src/pages/store/CustomerDrawer.jsx
src/pages/store/MerchantDrawer.jsx
src/pages/store/OrderTrackingPage.jsx
src/pages/store/ProductCard.jsx
src/pages/store/ProductOptionsModal.jsx
src/pages/store/StoreFrontPage.jsx
src/pages/store/StoreHeader.jsx
```

Utilitários:

```txt
src/utils/billingStatus.js
src/utils/brazilianDocuments.js
src/utils/browserNotifications.js
src/utils/merchantDisplayBranding.js
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

## 5. Principais fluxos

### 5.1 Cliente final

1. Acessa a loja pública por slug ou ID.
2. Vê produtos/categorias materializados em `publicStores`.
3. Escolhe produto, opções, adicionais e observações.
4. Adiciona ao carrinho.
5. Aplica cupom via `validatePublicCoupon`.
6. Informa retirada/entrega, CEP/bairro, telefone e nome.
7. Cria pedido via `createPublicOrder`.
8. Acompanha via tracking.
9. Avalia pedido quando entregue/finalizado.

Regras importantes:

- Cliente não cria pedido direto no Firestore.
- `createPublicOrder` é a fonte de verdade para preços, cupom, entrega e total.
- Frontend é só UX/preview.
- Backend sempre recalcula.

### 5.2 Lojista

1. Cria conta e loja.
2. Recebe e-mail de boas-vindas via Brevo quando conta merchant está minimamente pronta.
3. Configura billing/Asaas.
4. Configura loja, produtos, categorias, cupons e entrega.
5. Abre loja.
6. Recebe pedidos no dashboard.
7. Confirma, prepara, despacha e finaliza pedidos.
8. Usa KDS para cozinha e Painel de Retirada para clientes.

### 5.3 Pedido e status

Fluxo conceitual:

```txt
pendente/novo
→ confirmado
→ preparando
→ pronto
→ em_rota, se delivery
→ entregue/finalizado
→ cancelado, se cancelado
```

Regras:

- Alteração de status deve usar `updateMerchantOrder`.
- Não usar `updateDoc` direto em `orders`.
- KDS usa `updateMerchantOrder`.
- OrdersPage é a tela de gestão/atendimento.
- KitchenDisplayPage é a tela da cozinha.
- CustomerDisplayPage é a tela pública de retirada.

### 5.4 Cozinha / KDS

Arquivo principal:

```txt
src/pages/merchant/KitchenDisplayPage.jsx
```

Função:

- Tela interna da cozinha/produção.
- Deve mostrar `confirmado`, `preparando` e `pronto`.
- Não deve mostrar `pendente/novo` antes do atendente confirmar.
- Deve ordenar mais antigo primeiro.
- Deve alertar atrasos em `confirmado` e `preparando`.
- Pedidos prontos podem ter ação **Finalizar pedido** para retirada/local/mesa.
- Delivery pronto não deve ser finalizado pela KDS; deve ser despachado pela OrdersPage.

### 5.5 Painel de Retirada

Arquivo principal:

```txt
src/pages/merchant/CustomerDisplayPage.jsx
```

Função:

- Tela pública estilo fast-food.
- Mostra apenas pedidos não-delivery.
- Mostra colunas `Em preparo` e `Prontos para retirada`.
- Não exibe nome, telefone, endereço, itens, valor, pagamento ou observações.
- Mostra apenas número/senha/status.
- Pedidos prontos somem após TTL.
- Pedidos em preparo não devem sumir por TTL.

Futuro P1 recomendado:

```txt
publicDisplays/{storeId}/activeOrders/{orderId}
```

com payload mínimo sem PII.

---

## 6. Catálogo público e `publicStores`

Arquitetura correta:

```txt
publicStores/{storeId}
publicStores/{storeId}/products/{productId}
publicStores/{storeId}/categories/{categoryId}
```

Regras:

- `publicStores/{storeId}` é canônico.
- Não criar `publicStores/{slug}` como catálogo duplicado.
- Slug deve resolver para `storeId` canônico.
- StoreFront deve carregar produtos/categorias pelo ID canônico.
- Não copiar dados sensíveis para `publicStores`.

Campos públicos aceitáveis incluem nome, slug, branding público, produtos ativos, categorias visíveis, horários públicos e formas públicas de atendimento/pagamento.

Campos que não devem ir para `publicStores`:

```txt
ownerUid
ownerEmail
allowedUserIds
merchantUids
billing/Asaas/subscription
segredos
campos admin
campos internos sensíveis
```

Script de backfill:

```bash
cd functions
npm run backfill:public-catalog -- --dry-run
npm run backfill:public-catalog -- --write --storeId=STORE_ID
npm run backfill:public-catalog -- --write
```

Para a loja de teste citada nas conversas:

```bash
cd functions
npm run backfill:public-catalog -- --dry-run --storeId=2pdPYIKOofJjdRwvCKad
npm run backfill:public-catalog -- --write --storeId=2pdPYIKOofJjdRwvCKad
```

---

## 7. Billing / Asaas

Arquivos principais:

```txt
src/pages/merchant/BillingPage.jsx
src/pages/merchant/SubscriptionManagementPage.jsx
functions/asaas.js
```

Regras:

- CPF/CNPJ deve validar dígito verificador.
- Não chamar Asaas com CPF/CNPJ inválido.
- Enviar CPF/CNPJ limpo ao backend.
- Backend também valida para evitar chamada direta inválida.
- Webhooks devem ser idempotentes.
- Cancelamento, alteração de plano e alteração de vencimento podem ser solicitações manuais no MVP.
- Não prometer no frontend algo que o backend ainda não automatiza.

Fluxo automático:

- Criar checkout/assinatura.
- Receber webhook.
- Atualizar status local.
- Bloquear/desbloquear por billing.
- Enviar e-mail de trial iniciado quando Asaas confirma.

Fluxos sensíveis/manuais no MVP:

- Alteração real de plano.
- Cancelamento real no Asaas.
- Alteração real de vencimento.
- Atualização de pagamento quando não há checkout seguro.

---

## 8. E-mails / Brevo

Arquivos:

```txt
functions/brevo.js
functions/index.js
functions/asaas.js
```

Templates:

```txt
welcome_pratoby         → boas-vindas
trial_started           → trial iniciado
weekly_report           → relatório semanal
trial_ending_alert      → alerta de fim de trial
```

Regras:

- API key somente no backend/Secret Manager.
- Nunca expor Brevo no frontend.
- Usar `notificationLogs` para idempotência.
- Falha de e-mail não deve quebrar cadastro, pedido ou billing.
- Welcome não deve esperar trial iniciado.
- Trial iniciado deve continuar separado e ligado ao Asaas/CHECKOUT_PAID.
- Retry de `failed`/`sending` antigo deve ser controlado.

---

## 9. Notificações

Status atual:

- Som de novo pedido.
- Toast/modal persistente.
- Badges por área no dashboard.
- Sino de notificações.
- Notificação nativa Windows/Chrome/Edge quando dashboard está aberto.
- WhatsApp manual via `wa.me`.

Não implementado ainda:

- WhatsApp Cloud API.
- Firebase Cloud Messaging.
- Push real com navegador fechado.

Futuro recomendado:

- FCM para lojista.
- FCM para cliente no tracking.
- Materialização de public displays sem PII.

---

## 10. Segurança

Princípios:

- Backend é fonte de verdade para pedidos, preço, cupom, entrega, billing e status.
- Frontend não deve escrever diretamente em dados sensíveis.
- Rules devem bloquear writes diretos indevidos.
- Callables sensíveis devem validar auth, store ownership, schema e audit log.

Não fazer:

- `updateDoc` direto em `orders`.
- `updateDoc` direto em `stores.isOpen` pelo merchant.
- Create direto em `orders` pelo cliente.
- Listar cupons publicamente.
- Expor `notificationLogs` para client.
- Expor secrets no frontend.
- Copiar dados privados para `publicStores`.

Fazer:

- `updateMerchantOrder` para status de pedido.
- `updateStoreSettings` para configurações sensíveis da loja.
- `createPublicOrder` para pedido público.
- `validatePublicCoupon` para preview de cupom.
- `notificationLogs` para idempotência de notificações/e-mails.

---

## 11. Deploy e validação

Validações comuns:

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

Use validação proporcional ao tipo de alteração:

- Frontend: `npm run lint`, `npm run build`, `git diff --check`.
- Functions: `node --check` nos arquivos de Functions alterados e nos principais listados abaixo.
- Regras/indexes: validar diffs manualmente e preferir dry-run de Firebase antes de deploy real.
- Docs only: pelo menos revisar diff e rodar `git diff --check`.

Em Windows, se `npm` global estiver quebrado, usar bin local:

```bat
.\node_modules\.bin\eslint.cmd . --quiet
.\node_modules\.bin\vite.cmd build
```

Deploy recomendado por lotes:

```bash
firebase deploy --only hosting
firebase deploy --only firestore:indexes
firebase deploy --only functions:createPublicOrder,functions:confirmCustomerDelivery,functions:markCustomerPixProofSent,functions:requestCustomerOrderCancellation,functions:submitPublicOrderReview
firebase deploy --only functions:updateMerchantOrder
firebase deploy --only functions:updateStoreSettings
firebase deploy --only functions:asaasWebhook
firebase deploy --only functions:startAsaasSubscription,functions:createPaymentMethodUpdateCheckout
firebase deploy --only functions:getPublicStoreProfile,functions:getPublicCatalog
firebase deploy --only functions:sendWelcomeEmailOnUserCreate,functions:sendWelcomeEmailOnUserWrite
```

Se a região estourar quota de CPU, deployar em lotes menores.

---

## 12. Checklist E2E para piloto

Antes de chamar MVP pronto, testar:

```txt
Cadastro de lojista
Welcome e-mail
Configuração billing Asaas
CPF/CNPJ inválido bloqueia checkout
CPF/CNPJ válido chama checkout
Loja abre/fecha via updateStoreSettings
Loja pública abre por slug
Produtos/categorias aparecem
Produto oculto/inativo não aparece
Cupom válido funciona
Cupom mínimo revalida quando carrinho muda
CEP/bairro atendido funciona
CEP fora da área bloqueia
Pedido válido é criado
Pedido aparece no OrdersPage
Pedido antigo não dispara som
Pedido novo dispara notificação
Confirmar pedido
Pedido aparece no KDS
KDS: confirmado → preparando → pronto
Painel de Retirada mostra em preparo/pronto sem delivery
Tracking abre em aba anônima
Pedido entregue/finalizado permite avaliação
Review cria corretamente
Settings salva via Cloud Function
Backfill publicStores feito
Indexes deployados
```

---

## 13. Roadmap pós-MVP

P1 recomendado:

- App Check frontend com `VITE_FIREBASE_APPCHECK_ENABLED=true` + `VITE_FIREBASE_APPCHECK_SITE_KEY` + monitor mode + enforcement depois.
- Testes de Firestore Rules com Emulator.
- Testes E2E com Playwright.
- Lazy loading por rota para reduzir bundle.
- PublicDisplay materializado sem PII.
- FCM para lojista.
- Sync/reconciliação Asaas periódica.

P2:

- FCM para cliente no tracking.
- Storefront SSR/Next.js para SEO.
- TypeScript gradual.
- Equipe/permissões por atendente.
- Relatórios e export CSV.
- Cardápio por dia/horário.
- Filtros avançados no KDS.
- Modo TV limpa para painéis.

---

## 14. Observações conhecidas

- O bundle JS está grande; considerar code-splitting/lazy loading.
- Smart TVs antigas podem travar com animações; recomendar TV Box, tablet, Chromecast ou mini PC.
- `CustomerDisplayPage` ainda lê `orders` no client autenticado; ideal futuro é `publicDisplays` sem PII.
- App Check não deve ser ativado em enforcement enquanto frontend não tiver `VITE_FIREBASE_APPCHECK_ENABLED=true` e `VITE_FIREBASE_APPCHECK_SITE_KEY` configurados e monitorados.
- `entregue` pode marcar pagamento como `paid`; revisar se essa regra serve para todos os métodos.

---

## 15. Como contribuir com segurança

Antes de abrir PR/commit:

```txt
1. Verificar se a mudança toca pedido, billing, settings, rules ou catálogo público.
2. Confirmar que a fonte de verdade continua no backend quando houver preço/status/billing.
3. Evitar dependência nova para problema simples.
4. Separar deploy de hosting, functions e indexes em lotes pequenos.
5. Documentar validações rodadas e testes manuais recomendados.
```

Não classificar uma mudança como pronta para produção sem deploy/teste real no ambiente correto.
