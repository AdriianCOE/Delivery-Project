# Matriz de notificacoes do dashboard

Base atual do MVP para notificacoes do lojista.

| Evento | internal/sino | badge | toast | sound | browser | fcm | title | email |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Novo pedido | Sim | Pedidos | Sim | Sim | Configuravel | Sim, data-only | Sim | Nao |
| Avaliacao nova | Sim | Avaliacoes | Nao por padrao | Nao | Configuravel | Futuro | Nao | Nao |
| Billing/assinatura | Sim | Assinatura | Apenas urgente | Nao | Configuravel | Futuro | Nao | Transacional existente |
| Loja fechada/configuracao | Opcional | Configuracoes | Apenas acao do usuario | Nao | Nao | Nao | Nao | Nao |
| Promocoes/relatorios | Futuro | Geral | Nao | Nao | Nao | Nao | Nao | Nao |

Preferencias locais sao salvas em `pratoby:notifications-read:{uid}:{storeId}` dentro de `preferences`.

FCM permanece sem PII: backend envia apenas `type`, `orderId`, `storeId` e `url`; o service worker monta titulo/corpo.
