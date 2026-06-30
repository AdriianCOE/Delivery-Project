# Menu management rules

- Limites de plano não podem ser apenas UX.
- Criar, duplicar, restaurar ou ativar produtos/categorias deve respeitar backend.
- Edição de item existente não deve ser bloqueada indevidamente.
- deliveryFees deve passar por backend validado.
- Não usar updateDoc direto para campos que impactam pedido, preço ou disponibilidade.
- price/priceCents: backend deve ser fonte de verdade para normalização.
- categoryName deve ser derivado de categoryId no backend quando aplicável.