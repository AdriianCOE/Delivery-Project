---
name: firebase-rules-reviewer
description: Use no PratoBy para revisar firestore.rules, storage.rules, permissões Firebase, bypass de client, dados públicos, App Check, ownership, pedidos, billing, planos e segurança.
---

# Firebase Rules Reviewer

Use esta skill quando a tarefa tocar:

- `firestore.rules`
- `storage.rules`
- permissões de leitura/escrita
- dados públicos
- dados de pedidos
- loja pública
- produtos/categorias
- clientes
- billing
- assinatura/trial
- planos
- App Check
- bypass de frontend

## Objetivo

Revisar regras Firebase do PratoBy sem relaxar segurança e sem mover autoridade sensível para o frontend.

## Regras críticas

- Firestore Rules devem bloquear bypass direto do client.
- O backend deve ser autoridade para preço, pedido, cupom, taxa de entrega, status, plano e billing.
- Cliente autenticado não pode alterar campos financeiros, status financeiro, plano, assinatura, trial ou dados internos.
- Loja pública não deve expor PII.
- Dados públicos devem usar projeções seguras quando esse padrão existir.
- Não permita `allow write: if isOwner` em documentos com campos sensíveis sem validação campo a campo.
- Não relaxe rules para corrigir erro de frontend sem justificar.
- Nunca confie em campos que o próprio usuário pode alterar para conceder permissão.

## Checklist de revisão

Procure:

1. Escrita direta que deveria passar por Cloud Function.
2. Campo sensível alterável pelo client.
3. Leitura pública de dados privados.
4. Validação de ownership ausente ou fraca.
5. Permissões de admin/merchant amplas demais.
6. Inconsistência entre Cloud Functions e Rules.
7. Campos de billing, plano, trial ou assinatura editáveis pelo client.
8. Status de pedido ou pagamento alterável fora do backend.
9. Produtos/categorias criando bypass de limite de plano.
10. `deliveryFees` ou configurações operacionais editáveis direto do frontend.
11. PII de pedidos, clientes ou lojistas exposta em rota pública.
12. Storage aceitando upload amplo, extensão insegura ou owner falso.

## Formato obrigatório para auditoria

Quando o usuário pedir revisão, primeiro não edite. Responda:

```text
## Achados

### 1. Título do achado
- Severidade: baixa/média/alta/crítica
- Arquivo/linha: caminho aproximado
- Problema:
- Risco:
- Correção mínima:
- Teste recomendado:
```

## Ao editar

Se o usuário pedir correção:

- faça o menor diff seguro possível;
- preserve comportamento do MVP;
- não altere UI;
- atualize testes quando existirem;
- explique antes/depois;
- liste riscos restantes;
- recomende teste manual.
