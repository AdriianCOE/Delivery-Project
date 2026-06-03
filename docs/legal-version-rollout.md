# Legal version rollout

`termsVersion` e `privacyVersion` agora devem vir de `/config/legal`.

O documento precisa existir antes do deploy de `firestore.rules`, Functions e Hosting que dependem dele.

## Documento obrigatorio

Criar ou atualizar `/config/legal`:

```txt
termsVersion: YYYY-MM-DD
privacyVersion: YYYY-MM-DD
updatedAt: server timestamp
```

Use a versao publicada nas paginas legais vigentes. Nao publique Rules novas sem esse documento em producao.

## Fluxo seguro

1. Criar ou conferir `/config/legal`:
   - `termsVersion`
   - `privacyVersion`
   - `updatedAt`
2. Deploy de `firestore.rules`.
3. Deploy de Functions, incluindo `acceptLatestTerms`.
4. Deploy de Hosting com o signup lendo `/config/legal`.
5. Testar signup por e-mail e Google.
6. Testar aceite de termos atualizado em conta existente.

## Comportamento esperado

- Signup bloqueia se `/config/legal` nao existir ou tiver versoes invalidas.
- Firestore Rules negam `users/{uid}` novo se as versoes enviadas nao baterem com `/config/legal`.
- `acceptLatestTerms` grava as versoes lidas de `/config/legal` e falha com `failed-precondition` se a configuracao estiver ausente.
