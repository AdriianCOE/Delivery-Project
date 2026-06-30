---
name: pratoby-release-checklist
description: Use no PratoBy antes de deploy, release, merge ou revisão final de patch envolvendo frontend, functions, Firestore Rules, Hosting, billing, pedidos ou segurança.
---

# PratoBy Release Checklist

Use esta skill para preparar revisão final antes de deploy/merge.

## Objetivo

Evitar deploy quebrado ou inseguro.

## Regra principal

Não altere código durante a checklist, a menos que o usuário peça explicitamente.

## Checklist geral

Verifique:

- build;
- lint;
- testes unitários;
- testes de functions;
- testes de regras;
- e2e relevante;
- dry-run de deploy quando aplicável;
- changelog;
- docs;
- ordem segura de deploy;
- riscos restantes;
- rollback.

## Comandos recomendados

Execute quando existirem:

```bash
npm run lint
npm run build
npm test
npm run test
npm run test:unit
npm run test:e2e
npm run test:plan-consistency
```

Para functions:

```bash
cd functions && npm test
cd functions && npm run lint
```

Para Firebase, se disponível:

```bash
firebase deploy --only functions --dry-run
firebase deploy --only firestore:rules --dry-run
firebase deploy --only hosting --dry-run
```

## Ordem segura de deploy

Quando Firestore Rules passam a bloquear escrita antiga, prefira:

1. Cloud Functions
2. Hosting/frontend
3. Firestore Rules
4. Storage Rules, se aplicável

Explique quando essa ordem mudar.

## Checklist manual para PratoBy

Sempre que aplicável, peça validação manual de:

- criar loja;
- cadastrar produto;
- criar categoria;
- ativar/restaurar produto no limite do plano;
- abrir loja pública;
- criar pedido público;
- aplicar cupom;
- calcular entrega;
- mudar status do pedido;
- confirmar pagamento quando aplicável;
- KDS;
- tracking;
- billing/trial;
- loja bloqueada por assinatura.

## Formato de resposta

```text
## Pré-deploy

### Comandos executados
- comando: resultado

### Validação funcional
- item: aprovado/pendente

### Ordem recomendada de deploy
1.
2.
3.

### Riscos restantes
-

### Checklist manual
-
```

Se algum comando não existir, diga:

```text
Comando não executado porque não existe no package.json.
```

Se falhar por ambiente/dependência, diga:

```text
Comando falhou por motivo de ambiente/dependência, não necessariamente por erro da alteração.
```
