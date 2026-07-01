---
name: test-writer-pratoby
description: Use no PratoBy para criar ou revisar testes de regressão em Cloud Functions, Firestore Rules, pedidos, checkout, planos, deliveryFees, menu, billing, segurança e UI crítica.
---

# Test Writer PratoBy

Use esta skill quando o usuário pedir testes ou quando uma correção tocar regra sensível.

## Objetivo

Criar testes pequenos, úteis e direcionados para impedir regressão.

## Prioridades de teste

Priorize testes para:

- preço e `priceCents`;
- cálculo de pedido;
- cupom;
- taxa de entrega;
- criação de pedido público;
- limite de plano;
- criar/duplicar/restaurar/ativar produto;
- criar/ativar categoria;
- `deliveryFees`;
- status `entregue` separado de `paid`;
- App Check;
- ownership;
- payload malicioso;
- Firestore Rules;
- billing/trial/assinatura.

## Regras

- Não teste implementação interna demais quando o comportamento público é mais importante.
- Prefira testes pequenos e legíveis.
- Não crie mocks gigantes desnecessários.
- Se a função for difícil de testar, extraia helpers puros com menor diff possível.
- Não altere regra de negócio apenas para facilitar teste.
- Testes devem falhar antes da correção e passar depois, quando possível.

## Casos obrigatórios para menu

Quando mexer em `saveMenuItem` ou menu:

- criar produto abaixo do limite passa;
- criar produto no limite falha;
- reativar produto no limite falha;
- editar produto existente no limite passa;
- `price` sem `priceCents` é rejeitado ou ignorado com segurança;
- `categoryId` de outra loja é rejeitado;
- payload com campo não permitido é rejeitado.

## Casos obrigatórios para pedidos

Quando mexer em pedido/checkout:

- total enviado pelo client não é aceito como verdade;
- preço é recalculado;
- frete é recalculado;
- cupom inválido é rejeitado;
- loja bloqueada por assinatura não recebe pedido;
- pagamento online pendente não vira `paid` por status logístico.

## Formato antes de escrever testes

```text
## Plano de testes

- Comportamento protegido:
- Arquivos de teste:
- Casos:
- Mocks necessários:
```

## Depois

```text
## Testes adicionados

- Casos cobertos:
- Comandos executados:
- Resultado:
- Lacunas restantes:
```
