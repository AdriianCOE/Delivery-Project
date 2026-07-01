---
name: minimal-diff-fixer
description: Use no PratoBy para corrigir bugs com menor diff seguro possível, sem refatorar arquitetura, UI, rotas ou fluxos fora do escopo.
---

# Minimal Diff Fixer

Use esta skill para bugfixes e ajustes pontuais.

## Objetivo

Corrigir a causa raiz com o menor diff seguro possível.

## Antes de editar

1. Localize a causa raiz.
2. Liste arquivos realmente necessários.
3. Explique o risco.
4. Defina critério de aceite.
5. Diga explicitamente o que não será alterado.

## Durante a edição

- Não reescreva arquivos inteiros.
- Não faça redesign em tarefa de bug.
- Não altere backend em tarefa visual.
- Não altere UI em tarefa de backend, salvo se necessário.
- Não renomeie APIs públicas sem motivo.
- Não altere rotas sem justificativa.
- Não crie abstrações grandes para problema pequeno.
- Não remova validações.
- Não relaxe regras de segurança para “fazer passar”.
- Preserve compatibilidade do MVP.

## Depois de editar

Responda:

```text
## Correção aplicada

- Antes:
- Depois:
- Arquivos alterados:
- Testes executados:
- Riscos restantes:
- Checklist manual:
```

## Combinações recomendadas

Backend sensível:

```text
Use $minimal-diff-fixer, $pratoby-project-guard e @ponytail lite.
```

UI pontual:

```text
Use $minimal-diff-fixer e $pratoby-ui-polish.
```

Revisão de diff:

```text
Use $minimal-diff-fixer e @ponytail-review. Não edite ainda.
```
