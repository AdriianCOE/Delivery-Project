# Backfill do Catálogo Público

Este script garante que lojas criadas *antes* da introdução das Cloud Functions de materialização (`materializePublicProduct`, etc) tenham seu catálogo copiado para as subcoleções públicas.

## Coleções Alvo:
- `publicStores/{storeId}`
- `publicStores/{storeId}/categories`
- `publicStores/{storeId}/products`

## Como Executar

No diretório `functions`, execute o script via npm:

```bash
# Executar em modo Dry Run (Apenas leitura/log):
npm run backfill:public-catalog -- --dry-run

# Executar para uma loja específica:
npm run backfill:public-catalog -- --storeId=SUA_LOJA_ID

# Executar migração real para TODAS as lojas (Atenção a limites de gravação):
npm run backfill:public-catalog
```

> IMPORTANTE: Em caso de muitas lojas, observe a aba Uso do Firestore para não estourar a cota diária de gravações durante o backfill.
