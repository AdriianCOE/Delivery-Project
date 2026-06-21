# App Check rollout

Status atual: as callable functions publicas aceitam enforcement por `ENFORCE_APP_CHECK=true`, mas o padrao seguro continua sem bloqueio para nao quebrar pedidos reais.

## Functions cobertas

- `createPublicOrder`
- `getPublicStoreProfile`
- `getPublicCatalog`
- `validatePublicCoupon`
- `registerCustomerOrderPushToken`
- `disableCustomerOrderPushToken`
- `confirmCustomerDelivery`
- `markCustomerPixProofSent`
- `requestCustomerOrderCancellation`
- `submitPublicOrderReview`

Quando `ENFORCE_APP_CHECK=false` fora do emulador, as Functions registram warning no cold start para lembrar que o rollout ainda esta em modo monitoramento.

## Fora do enforcement de App Check por enquanto

- `storefrontSeoPreview` e `sitemapXml` sao HTTP publicas para crawlers e nao devem exigir App Check.
- Webhooks de pagamento continuam protegidos por segredo/assinatura do provedor, nao por App Check.
- Callables de painel, admin e billing devem entrar em uma etapa separada depois de validar que todos os clients autenticados inicializam App Check antes de chamar Functions.

## Plano seguro

1. Configurar App Check no Firebase Console para Web App e Hosting, mantendo monitoramento sem bloqueio.
2. Configurar `VITE_FIREBASE_APPCHECK_SITE_KEY` no ambiente de build do frontend.
3. Definir `VITE_FIREBASE_APPCHECK_ENABLED=true` somente no ambiente em monitoramento.
4. Ativar modo monitor primeiro, sem enforcement.
5. Testar em producao assistida:
   - abrir loja publica por slug;
   - carregar catalogo;
   - validar cupom valido e invalido;
   - criar pedido publico;
   - abrir tracking do pedido.
   - confirmar recebimento no tracking;
   - enviar avaliacao no tracking.
6. Conferir metricas/logs de App Check no Console.
7. So depois ativar enforcement nas Functions publicas com `ENFORCE_APP_CHECK=true`.
8. Repetir os testes publicos depois do enforcement.

## Variavel

```bash
VITE_FIREBASE_APPCHECK_ENABLED=true
VITE_FIREBASE_APPCHECK_PROVIDER=enterprise
VITE_FIREBASE_APPCHECK_SITE_KEY=site_key_web_app
ENFORCE_APP_CHECK=false
```

Para desenvolvimento local, prefira debug token em vez de reCAPTCHA real:

```bash
VITE_FIREBASE_APPCHECK_ENABLED=true
VITE_FIREBASE_APPCHECK_PROVIDER=enterprise
VITE_FIREBASE_APPCHECK_SITE_KEY=site_key_web_app
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true
```

Na primeira execução, copie o debug token exibido no console do navegador e cadastre em Firebase Console > App Check > Manage debug tokens. Depois substitua `true` pelo token cadastrado se quiser deixar fixo no `.env.local`.

Nao defina `VITE_FIREBASE_APPCHECK_ENABLED=true` em dev/local sem chave reCAPTCHA valida para o dominio atual. Nao defina `ENFORCE_APP_CHECK=true` antes de validar a loja publica, cupom, pedido e tracking com tokens App Check reais.

## Gate de producao

Este item nao fecha por codigo local. Ele so esta concluido quando o Console mostra requisicoes validas em monitoramento para o dominio de producao e a build publicada contem:

- `VITE_FIREBASE_APPCHECK_ENABLED=true`
- `VITE_FIREBASE_APPCHECK_PROVIDER=enterprise`
- `VITE_FIREBASE_APPCHECK_SITE_KEY`

Depois do enforcement, qualquer falha em storefront, cupom, pedido ou tracking deve ser tratada como rollback imediato de `ENFORCE_APP_CHECK=true`.
