# Legal version rollout

`termsVersion` e `privacyVersion` ainda existem em Functions, frontend e Firestore Rules. Nao e seguro trocar as Rules para depender de configuracao sem testar signup/onboarding e sem garantir que o documento de configuracao sempre exista.

## Estrategia segura

1. Criar `/config/legal`:
   - `termsVersion`
   - `privacyVersion`
   - `updatedAt`
2. Atualizar Functions para ler `/config/legal` com fallback para a versao atual.
3. Atualizar frontend para ler a mesma configuracao antes do signup.
4. So depois alterar Firestore Rules para validar contra `get(/databases/$(database)/documents/config/legal)`.
5. Rodar dry-run de rules e testar signup completo.

## TODO operacional

Manter o hardcode atual ate executar o rollout acima. Mudar apenas Rules ou apenas frontend criaria risco de bloquear cadastros reais.
