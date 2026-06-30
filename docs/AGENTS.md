# AGENTS.md — Instruções para IA/Codex/Claude no PratoBy

Última atualização: 2026-05-31

Este arquivo contém regras obrigatórias para qualquer IA/agente que analise ou altere o projeto PratoBy.

Leia antes de modificar qualquer arquivo.

Antes de implementar, leia:

- `docs/AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/deploy-runbook.md`
- `docs/notification-matrix.md`

Não recrie helpers, não altere fora do escopo e respeite as decisões documentadas.

---

## 1. Papel esperado do agente

Você deve atuar como lead dev sênior cuidadoso, com foco em:

- segurança;
- estabilidade do MVP;
- mudanças cirúrgicas;
- preservação do fluxo de pedido;
- clareza de UX;
- validação antes de deploy.

Não aja como gerador de features soltas. Antes de implementar, entenda a área e confirme impacto.

Modo de trabalho esperado:

```txt
1. Ler o contexto local antes de editar.
2. Identificar se a mudança toca pedido, billing, settings, catálogo público, rules ou dados privados.
3. Fazer a menor alteração segura que resolve a tarefa.
4. Preservar mudanças existentes de outros agentes/usuário.
5. Validar com comandos compatíveis com o tipo de alteração.
6. Informar claramente o que foi feito, o que não foi validado e o que precisa de deploy/teste manual.
```

Se o usuário pedir plano técnico, auditoria ou análise sem implementação, não editar arquivos.

---

## 2. Regras absolutas

Nunca fazer sem aprovação explícita:

- Não reescrever arquivos inteiros sem necessidade.
- Não implementar WhatsApp Cloud API.
- Não alterar billing/Asaas de forma ampla.
- Não afrouxar `firestore.rules`.
- Não expor secrets no frontend.
- Não copiar dados privados para `publicStores`.
- Não criar `publicStores/{slug}` como catálogo duplicado.
- Não criar pedido direto no Firestore pelo client.
- Não usar `updateDoc` direto em `orders`.
- Não usar `updateDoc` direto em `stores.isOpen` pelo frontend merchant.
- Não confiar no frontend para preço, cupom, total, billing, plano ou status.
- Não adicionar biblioteca nova sem justificar.
- Não commitar `node_modules/.vite`, logs temporários ou patches sem necessidade.
- Não tratar `dist/` como alteração obrigatória sem confirmar o fluxo de deploy.
- Não fazer refatoração ampla durante correção pontual.
- Não apagar alterações não relacionadas no working tree.

---

## 3. Regras para mudanças sensíveis

### Pedidos

Usar:

```txt
functions/merchantOrder.js → updateMerchantOrder
```

Não usar:

```txt
updateDoc direto em orders
```

Fluxo conceitual:

```txt
pendente/novo → confirmado → preparando → pronto → em_rota/entregue/cancelado
```

KDS:

```txt
confirmado → preparando → pronto
```

Delivery:

```txt
pronto → em_rota → entregue
```

Isso deve acontecer na OrdersPage, não na KDS.

### Loja/settings

Usar:

```txt
updateStoreSettings
```

Para:

- abrir/fechar loja;
- settings sensíveis;
- alterações que exigem validação/audit.

Não usar `updateDoc` direto em `stores.isOpen`.

### Pedido público

Usar:

```txt
createPublicOrder
```

Regras:

- Backend recalcula tudo.
- Frontend só faz preview/UX.
- Cliente não cria pedido direto em `orders`.

### Agendamento

Regras:

- Não criar status principal `agendado`.
- Usar `orderTiming: "asap" | "scheduled"`.
- Pedido agendado futuro não é atrasado.
- Pedido agendado futuro não deve aparecer no KDS principal.
- KDS só mostra agendado quando estiver dentro da janela de preparo, atrasado, preparando ou pronto.
- Não imprimir comanda ao apenas confirmar agendamento.
- Imprimir ao mudar para preparando, se a configuração da loja já faz isso.

### Cupom

Usar:

```txt
validatePublicCoupon → preview
createPublicOrder → validação final
```

Cupons não devem ser listáveis publicamente.

### Catálogo público

Usar:

```txt
publicStores/{storeId}
```

Não duplicar catálogo por slug.

Slug deve resolver para `storeId` canônico.

### Billing/Asaas

Arquivos sensíveis:

```txt
functions/asaas.js
src/pages/merchant/BillingPage.jsx
src/pages/merchant/SubscriptionManagementPage.jsx
```

Regras:

- CPF/CNPJ com dígito verificador.
- Não chamar Asaas se documento inválido.
- Backend também valida.
- Webhook idempotente.
- Fluxos que chamam provedor devem ser lock-first quando houver risco de duplicidade.
- Se o provedor confirmar e o commit local falhar, registrar recuperação explícita.
- Mensagens honestas: não prometer automação se só é solicitação.

### Brevo

Arquivos:

```txt
functions/brevo.js
functions/index.js
functions/asaas.js
```

Regras:

- API key só no backend/Secret Manager.
- `notificationLogs` para idempotência.
- Falha de e-mail não quebra fluxo principal.

---

## 4. Mapa rápido por arquivo

### Functions

```txt
functions/index.js
- exports principais;
- updateStoreSettings;
- public catalog callables;
- triggers gerais;
- Brevo welcome/trial schedulers;
- presença/agregação.

functions/publicOrder.js
- createPublicOrder;
- validação server-side de carrinho, cupom, bairro, entrega e total.

functions/merchantOrder.js
- updateMerchantOrder;
- fluxo/status/auditoria de pedidos merchant.

functions/asaas.js
- billing Asaas;
- checkout;
- webhook;
- CPF/CNPJ backend;
- sync de assinatura.

functions/brevo.js
- templates Brevo;
- helpers de envio;
- support URL;
- Secret Manager.

functions/scripts/backfillPublicCatalog.js
- backfill de publicStores.
```

### Storefront

```txt
src/pages/store/StoreFrontPage.jsx
- carrega loja pública;
- resolve slug/storeId;
- usa publicStores.

src/pages/store/CartDrawer.jsx
- carrinho;
- cupom;
- CEP/bairro;
- createPublicOrder.

src/pages/store/ProductCard.jsx
- card público de produto;
- badges públicos.

src/pages/store/ProductOptionsModal.jsx
- opções/adicionais.

src/pages/store/OrderTrackingPage.jsx
- tracking público por token.
```

### Merchant

```txt
src/pages/merchant/OrdersPage.jsx
- gestão geral de pedidos;
- atendimento/caixa;
- status completo;
- WhatsApp manual.

src/pages/merchant/KitchenDisplayPage.jsx
- KDS/cozinha;
- confirmado/preparando/pronto;
- usa updateMerchantOrder.

src/pages/merchant/CustomerDisplayPage.jsx
- painel público de retirada;
- em preparo/prontos;
- sem delivery;
- sem PII na UI.

src/pages/merchant/Settings.jsx
- configurações da loja;
- deve usar updateStoreSettings.

src/pages/merchant/BillingPage.jsx
- cobrança/status/trial/configurar pagamento.

src/pages/merchant/SubscriptionManagementPage.jsx
- gestão de assinatura.

src/pages/merchant/MenuManagementPage.jsx e src/pages/merchant/menu/*
- produtos, categorias, bairros, cupons.
```

### Utils importantes

```txt
src/utils/brazilianDocuments.js
- CPF/CNPJ limpar/formatar/validar.

src/utils/phone.js
- telefone brasileiro.

src/utils/orderSummary.js
- resumo copiável/WhatsApp.

src/utils/orderNumber.js
- número/senha do pedido.

src/utils/storeIdentity.js
- slug/identidade de loja.

src/utils/merchantDisplayBranding.js
- branding KDS/CustomerDisplay.

src/utils/browserNotifications.js
- Notification API local.
```

---

## 5. Fluxos que não podem quebrar

Antes de finalizar qualquer alteração, pense se afeta:

```txt
Cadastro merchant
Login Google/email
Billing Asaas
Loja pública por slug
Catálogo publicStores
Carrinho
Cupom mínimo
CEP/bairro
createPublicOrder
OrdersPage
KDS
CustomerDisplay
Tracking
Reviews
Brevo
Settings/updateStoreSettings
Firestore Rules
```

Se mexer em um deles, adicione teste manual recomendado.

---

## 6. Padrões de código desejados

- Preferir helpers pequenos e puros.
- Evitar duplicar lógica sensível.
- Validar no frontend para UX e no backend para segurança.
- Não criar estados globais desnecessários.
- Não adicionar dependências para coisa simples.
- Manter mobile/dark/light.
- Evitar alert nativo se já existe UI/toast.
- Evitar textos enganadores.
- Manter valores financeiros em centavos.
- Usar logs claros em Functions, sem secrets.
- Manter nomes comerciais atuais: plano `Profissional`, não `Plus`.
- Preferir estados explícitos de erro/recuperação a falhas silenciosas.
- Para UI operacional, priorizar densidade, legibilidade e fluxo de trabalho, não aparência de landing page.

---

## 7. Como propor mudanças

Ao terminar uma tarefa, responder com:

```txt
Arquivos alterados
O que mudou
Segurança/impacto
Validações rodadas
Deploy necessário
Testes manuais recomendados
Pendências/TODOs
```

Se algo não foi feito, dizer claramente.

Não dizer “pronto para produção” sem deploy/teste real.

---

## 8. Validações obrigatórias por tipo de alteração

Para docs only:

```bash
git diff --check
```

### Frontend

```bash
npm run lint
npm run build
git diff --check
```

No Windows, se `npm` global estiver quebrado:

```bat
.\node_modules\.bin\eslint.cmd . --quiet
.\node_modules\.bin\vite.cmd build
```

### Functions

```bash
node --check functions/index.js
node --check functions/publicOrder.js
node --check functions/merchantOrder.js
node --check functions/asaas.js
node --check functions/brevo.js
node --check functions/scripts/backfillPublicCatalog.js
```

### Firebase deploy dry-run

Se alterar frontend:

```bash
firebase deploy --only hosting --dry-run
```

Se alterar functions:

```bash
firebase deploy --only functions --dry-run
```

Se alterar indexes:

```bash
firebase deploy --only firestore:indexes --dry-run
```

---

## 9. Deploy recomendado

Preferir deploy em lotes pequenos:

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

Se ocorrer quota CPU em `southamerica-east1`, reduzir lote.

---

## 10. Itens que parecem tentadores, mas são pós-MVP

Não implementar sem aprovação:

- WhatsApp Cloud API.
- Reescrever ou trocar o fluxo FCM/Web Push existente sem necessidade comprovada.
- publicDisplays sem PII.
- Next.js/SSR.
- TypeScript total.
- Reescrever dashboard.
- Refatorar rules grandes.
- Alteração automática avançada de plano/cancelamento/vencimento.
- Cardápio por dia/horário.
- Equipe/permissões complexas.
- Reorganização completa de arquitetura, rotas ou design system.

### FCM/Web Push existente

O FCM/Web Push ja existe no MVP. Nao remover nem desativar sem aprovacao.

Responsabilidades atuais:

- `src/utils/fcmNotifications.js`: tokens, listener foreground e preferencias.
- `public/firebase-messaging-sw.js`: background push e click de notificacao.
- `functions/fcmNotifications.js`: envio e registro seguro via Functions.
- `functions/publicOrder.js`: push de novo pedido para lojista.
- `functions/merchantOrder.js`: push de status apos mutacao real do pedido.

Regras:

- Nao enviar PII no payload.
- Cliente registra token de tracking via callable, nao por escrita direta em `orders`.
- Lojista salva tokens apenas nos caminhos permitidos.
- Falha de push nao pode quebrar criacao de pedido nem alteracao de status.

---

## 11. Problemas conhecidos/TODOs

- App Check frontend precisa de `VITE_FIREBASE_APPCHECK_ENABLED=true` e `VITE_FIREBASE_APPCHECK_SITE_KEY` configurados e testados antes do enforcement.
- CustomerDisplay deve virar `publicDisplays` sem PII no futuro.
- Bundle JS grande; aplicar lazy loading.
- Firestore Rules precisam testes com Emulator.
- Playwright E2E recomendado.
- Smart TVs antigas podem ter problemas com áudio/animações.
- `entregue` não marca pagamento como `paid`; confirmação financeira exige ação/integração explícita.
- Deploy/backfill/indexes precisam ser confirmados antes de piloto.
- Bundle grande deve ser tratado com lazy loading em etapa própria.

---

## 12. Checklist mental antes de qualquer commit

Pergunte:

```txt
Isso expõe dado privado?
Isso cria write direto indevido?
Isso quebra pedido público?
Isso quebra billing?
Isso altera regra financeira?
Isso afeta slug/publicStores?
Isso precisa deploy de functions?
Isso precisa backfill?
Isso precisa index?
Isso precisa teste manual?
Tem arquivo untracked importante?
Tem dist/node_modules/log no commit?
```

Se sim, documente.

---

## 13. Arquivos que normalmente não devem entrar no commit

Verificar antes:

```txt
node_modules/.vite
firebase-debug.log
*.patch temporário
walkthrough.md temporário de agente
arquivos de brain/cache de agente
```

`dist/` depende do fluxo do projeto. Se o deploy do Firebase Hosting usa o build local, pode ser mantido; se não, restaurar antes do commit.

---

## 14. Glossário rápido

```txt
OrdersPage = atendimento/caixa/gestão geral.
KitchenDisplayPage = cozinha/produção.
CustomerDisplayPage = painel público de retirada.
publicStores = catálogo público materializado.
stores = documento privado/operacional da loja.
createPublicOrder = única forma pública de criar pedido.
updateMerchantOrder = única forma segura de alterar status.
updateStoreSettings = forma segura de alterar configurações da loja.
paymentPix = aceita Pix como método.
pixEnabled = Pix manual configurado.
```

---

## 15. Resposta final esperada do agente

Ao finalizar alteração, usar este formato compacto:

```txt
Arquivos alterados
O que mudou
Segurança/impacto
Validações rodadas
Deploy necessário
Testes manuais recomendados
Pendências/TODOs
```

Se não rodou uma validação por limitação local, dizer explicitamente. Não transformar ausência de erro local em garantia de produção.
