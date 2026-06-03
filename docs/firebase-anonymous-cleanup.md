# Firebase anonymous users cleanup

O projeto usa Auth anonymous para presenca publica. Esses usuarios nao devem acessar dashboard nem serem tratados como lojistas reais.

## Limpeza nativa recomendada

Preferir a limpeza nativa do Firebase/Identity Platform quando disponivel no projeto, configurada no Console. Essa abordagem evita manter rotina customizada de delecao em producao.

## Scheduler existente

`cleanupAnonymousUsers` existe como rotina operacional, mas agora fica protegida por flags:

- `CLEANUP_ANONYMOUS_USERS_ENABLED=true` permite delecao.
- `CLEANUP_ANONYMOUS_USERS_DRY_RUN=false` desativa dry run.

Sem essas duas condicoes, a rotina apenas lista usuarios elegiveis e registra resumo.

Regras da rotina:

- pagina usuarios com `listUsers`;
- considera apenas contas com `providerData.length === 0`;
- respeita idade minima de 30 dias usando `lastSignInTime` ou `creationTime`;
- nao grava audit log de negocio;
- registra totais em logs operacionais.

## Procedimento

1. Rodar em dry run e conferir `totalEligible`.
2. Confirmar que Anonymous Auth e presenca publica estao saudaveis.
3. Configurar em producao `CLEANUP_ANONYMOUS_USERS_ENABLED=true`.
4. Configurar em producao `CLEANUP_ANONYMOUS_USERS_DRY_RUN=false` somente durante janela operacional monitorada.
5. Conferir logs de `totalDeleted` e amostra de contas elegiveis.
6. Voltar `CLEANUP_ANONYMOUS_USERS_DRY_RUN=true` apos a limpeza, se a limpeza nativa nao estiver habilitada.
7. Remover `CLEANUP_ANONYMOUS_USERS_ENABLED=true` quando a limpeza nativa estiver ativa e validada.
