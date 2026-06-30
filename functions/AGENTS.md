# Functions rules

- Toda callable sensível deve validar auth, ownership, payload e plano quando aplicável.
- Callables públicas devem validar App Check quando aplicável.
- Nunca confiar em preço, frete, cupom ou status enviado pelo client.
- Separar status logístico de status financeiro.
- Não marcar pagamento online como paid por mudança de status logístico.
- Adicionar ou atualizar testes em `functions/*.test.js` ou `functions/shared/*.test.js`.
- Após mudanças, rodar testes relevantes em `functions`.
- Validar payload com whitelist de campos.
- Não aceitar campos financeiros, plano, owner ou storeId vindos do client como fonte de verdade.
- Webhooks devem validar assinatura/segredo quando aplicável.