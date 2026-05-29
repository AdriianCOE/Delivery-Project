# App Check rollout

Status atual: as callable functions publicas aceitam enforcement por `ENFORCE_APP_CHECK=true`, mas o padrao seguro continua sem bloqueio para nao quebrar pedidos reais.

## Functions cobertas

- `createPublicOrder`
- `getPublicStoreProfile`
- `getPublicCatalog`
- `validatePublicCoupon`

Quando `ENFORCE_APP_CHECK=false` fora do emulador, as Functions registram warning no cold start para lembrar que o rollout ainda esta em modo monitoramento.

## Plano seguro

1. Configurar App Check no Firebase Console para Web App e Hosting.
2. Ativar modo monitor primeiro, sem enforcement.
3. Testar em producao assistida:
   - abrir loja publica por slug;
   - carregar catalogo;
   - validar cupom valido e invalido;
   - criar pedido publico;
   - abrir tracking do pedido.
4. Conferir metricas/logs de App Check no Console.
5. So depois ativar enforcement nas Functions publicas.

## Variavel

```bash
ENFORCE_APP_CHECK=true
```

Nao defina essa variavel antes de validar a loja publica, cupom e pedido com tokens App Check reais.
