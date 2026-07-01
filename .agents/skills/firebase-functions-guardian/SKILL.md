---
name: firebase-functions-guardian
description: Use no PratoBy para revisar ou editar Cloud Functions, callables, webhooks, checkout, pedidos, billing, planos, App Check, validação de payload, ownership e efeitos colaterais sensíveis.
---

# Firebase Functions Guardian

Use esta skill quando a tarefa tocar arquivos em `functions/` ou qualquer fluxo sensível chamado pelo frontend.

## Objetivo

Garantir que Cloud Functions continuem sendo a camada de autoridade do PratoBy.

## Regras críticas

- Toda callable privada deve validar autenticação.
- Toda operação por loja deve validar ownership.
- Toda operação sensível deve validar payload com whitelist de campos.
- Nunca aceite `storeId`, `merchantId`, `ownerId`, plano, preço, total, frete, cupom ou status financeiro vindos do client como fonte de verdade.
- Callables públicas devem validar App Check quando aplicável.
- Webhooks devem validar assinatura/segredo quando aplicável.
- Logs devem ajudar debug sem expor PII ou segredos.
- Status logístico e financeiro são separados.
- `entregue` não significa `paid`.
- Pagamento online nunca deve virar `paid` apenas por mudança logística.
- Planos, trial e assinatura devem ser validados no backend.
- Limite de produtos/categorias precisa de enforcement backend, não só UX.

## Checklist para callables

Antes de aceitar uma callable, confirme:

1. A função exige auth quando necessário.
2. A função valida App Check quando necessário.
3. O usuário pertence à loja ou tem papel permitido.
4. O payload tem whitelist.
5. Tipos, tamanhos e limites são validados.
6. Campos perigosos são rejeitados:
   - `__proto__`
   - `prototype`
   - `constructor`
   - `ownerId`
   - `merchantId`
   - `plan`
   - `billing`
   - `payment.status`
7. Operações de escrita usam transaction quando houver contagem, estoque, preço, cupom ou limite.
8. Firestore Rules continuam bloqueando bypass direto.
9. Há compatibilidade com dados antigos.
10. Há teste unitário ou plano manual claro.

## Checklist específico para pedidos

- Recalcular preço no backend.
- Recalcular frete no backend.
- Validar disponibilidade da loja.
- Validar publicação/assinatura/trial.
- Validar produtos ativos/publicáveis.
- Validar cupom no backend.
- Validar método de pagamento.
- Não confiar no carrinho para totais.

## Checklist específico para menu

- Criar, duplicar, restaurar ou ativar produto/categoria respeita limite de plano.
- `priceCents` é a fonte de verdade para preço.
- `price` é derivado no backend.
- `categoryName` deve ser derivado de `categoryId` quando aplicável.
- Categoria deve existir, pertencer à loja e não estar deletada.

## Formato de resposta antes de editar

```text
## Diagnóstico

- Função/fluxo:
- Risco:
- Arquivos envolvidos:

## Plano

- Correção mínima:
- Validações:
- Testes:
```

## Depois de editar

```text
## Correção aplicada

- Antes:
- Depois:
- Arquivos alterados:
- Testes executados:
- Riscos restantes:
```
