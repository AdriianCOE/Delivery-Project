# PratoBy — instruções para agentes

## Projeto

PratoBy é um SaaS de cardápio digital e delivery sem comissão.

Mensagem central:
Seu cardápio. Seu link. Seus pedidos. Zero comissão.

## Regras críticas

- Backend é autoridade para preço, pedido, cupom, taxa de entrega, plano, trial, billing, status do pedido e status financeiro.
- Frontend nunca deve ser autoridade para totais, permissões sensíveis ou status financeiro.
- Pedidos públicos passam por Cloud Function/callable.
- Mudanças de status de pedido passam por backend auditável.
- Firestore Rules devem bloquear bypass direto.
- Rotas públicas não devem expor PII.
- Preserve compatibilidade do MVP.
- Faça menor diff seguro possível.

## Antes de editar

- Explique diagnóstico curto.
- Liste arquivos que serão alterados.
- Diga o que será preservado.
- Não faça refatoração fora do escopo.

## Depois de editar

- Rode `npm run lint` se disponível.
- Rode `npm run build`.
- Rode testes relevantes.
- Liste arquivos alterados, riscos restantes e checklist manual.

## Quando usar skills

Backend/segurança:
Use `$pratoby-project-guard` e `@ponytail lite`.

Firestore Rules:
Use `$firebase-rules-reviewer`.

Cloud Functions:
Use `$firebase-functions-guardian`.

UI:
Use `$pratoby-ui-polish`, `$gpt-taste` e `$redesign-existing-projects`.