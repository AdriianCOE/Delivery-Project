# Repomix guide

Para tarefas de loja pública:
- src/pages/store/**
- src/contexts/CartContext.jsx
- src/services/firebase*.js
- src/utils/public*.js
- functions/publicOrder.js
- firestore.rules

Para menu:
- src/pages/merchant/menu/**
- src/services/menuManagement.js
- functions/menuManagement.js
- firestore.rules
- src/utils/planCatalog.js

Para billing:
- src/pages/merchant/BillingPage.jsx
- src/pages/merchant/SubscriptionManagementPage.jsx
- functions/asaas.js
- functions/shared/asaasOrders.js
- src/utils/billing*.js
- firestore.rules

Para UI:
- arquivo da página
- componentes compartilhados usados por ela
- tailwind.config.js
- src/index.css