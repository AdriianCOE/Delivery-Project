# WhatsApp Cloud API TODO

Nao implementar neste patch.

Card tecnico sugerido:

- Notificar lojista ao receber novo pedido.
- Template: `novo_pedido_lojista`.
- Payload minimo: numero do pedido, cliente, total, tipo de entrega e link do dashboard.
- Fallback obrigatorio: alerta sonoro/toast/titulo da aba enquanto a integracao nao estiver ativa.
- Nao enviar dados sensiveis alem do necessario no template.
- Registrar opt-in/configuracao por loja antes de ativar envio.
