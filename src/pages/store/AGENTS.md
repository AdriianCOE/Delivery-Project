# Storefront rules

- Loja pública deve funcionar para visitantes anônimos.
- Não exigir login na loja pública.
- Não expor PII.
- Carrinho pode montar intenção, mas backend calcula preço final.
- Checkout deve chamar callable.
- Dono autenticado pode ter UX extra, mas permissões reais ficam no backend.
- Preserve mobile-first e performance.
- Visitante anônimo nunca deve ser redirecionado para login.
- UX de dono autenticado não substitui autorização no backend.
- Não mostrar dados internos da loja, pedidos ou clientes.