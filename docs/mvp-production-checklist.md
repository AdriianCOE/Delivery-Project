# MVP production checklist

Checklist curto para deploy e piloto assistido do PratoBy.

## Ambiente

- Firebase Web App publicado com envs de producao.
- Firebase Functions na regiao `southamerica-east1`.
- Dominio principal e dominio da loja publica apontando para Hosting.
- Search Console configurado para dominio e sitemap.

## Pagamentos

- Asaas em modo correto: sandbox ou producao, nunca misturado.
- Secrets Asaas configurados nas Functions.
- Webhook Asaas publicado e validado no painel do provedor.
- Mercado Pago com access tokens sandbox/producao configurados nas Functions.
- Webhook Mercado Pago publicado e validado no painel do provedor.

## Cloudinary

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` configurados como secrets/env de Functions.
- Frontend sem `api_secret`.
- `VITE_CLOUDINARY_ALLOW_UNSIGNED_FALLBACK` ausente ou `false` em producao.
- Testar upload de logo/produto com lojista autenticado.
- Confirmar que falha de upload mostra mensagem clara e nao salva produto quebrado.

## FCM

- `VITE_FIREBASE_MESSAGING_VAPID_KEY` configurado no frontend.
- `public/firebase-messaging-sw.js` publicado no Hosting.
- Testar permissao de notificacao no dashboard.
- Testar push de novo pedido e confirmar alerta visual no painel mesmo sem push.

## App Check

- App Check configurado no Firebase Console em monitoramento.
- Build publicada com `VITE_FIREBASE_APPCHECK_ENABLED=true`.
- Build publicada com `VITE_FIREBASE_APPCHECK_SITE_KEY`.
- `ENFORCE_APP_CHECK=false` durante monitoramento inicial.
- Ativar enforcement primeiro em funcoes autenticadas/admin.
- Ativar enforcement publico somente depois de testar loja, cupom, pedido e tracking.
- Rollback: voltar `ENFORCE_APP_CHECK=false` se loja publica, cupom, pedido ou tracking falhar.

## Testes de piloto

- Pedido manual: loja publica, carrinho, checkout, painel e tracking.
- Pedido com pagamento online: link/checkout criado, falha de provedor tratada, retry disponivel.
- Pedido com cupom valido e invalido.
- Pedido com trial expirado bloqueado no backend.
- Assinatura ativa liberando publicacao e pedidos.
- Loja fechada e produto indisponivel com mensagens amigaveis.
