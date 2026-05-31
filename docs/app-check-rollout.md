# App Check rollout

Status atual: as callable functions publicas aceitam enforcement por `ENFORCE_APP_CHECK=true`, mas o padrao seguro continua sem bloqueio para nao quebrar pedidos reais.

## Functions cobertas

- `createPublicOrder`
- `getPublicStoreProfile`
- `getPublicCatalog`
- `validatePublicCoupon`
- `confirmCustomerDelivery`
- `markCustomerPixProofSent`
- `requestCustomerOrderCancellation`
- `submitPublicOrderReview`

Quando `ENFORCE_APP_CHECK=false` fora do emulador, as Functions registram warning no cold start para lembrar que o rollout ainda esta em modo monitoramento.

## Plano seguro

1. Configurar App Check no Firebase Console para Web App e Hosting.
2. Configurar `VITE_FIREBASE_APPCHECK_SITE_KEY` no ambiente de build do frontend.
3. Ativar modo monitor primeiro, sem enforcement.
4. Testar em producao assistida:
   - abrir loja publica por slug;
   - carregar catalogo;
   - validar cupom valido e invalido;
   - criar pedido publico;
   - abrir tracking do pedido.
   - confirmar recebimento no tracking;
   - enviar avaliacao no tracking.
5. Conferir metricas/logs de App Check no Console.
6. So depois ativar enforcement nas Functions publicas.

## Variavel

```bash
VITE_FIREBASE_APPCHECK_SITE_KEY=site_key_web_app
ENFORCE_APP_CHECK=true
```

Nao defina `ENFORCE_APP_CHECK=true` antes de validar a loja publica, cupom, pedido e tracking com tokens App Check reais.
