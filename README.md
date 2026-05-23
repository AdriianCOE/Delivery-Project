# 🍳 PratoBy - Plataforma Premium de Delivery e Cardápio Digital

O **PratoBy** é uma solução completa e de alta performance projetada para revolucionar o delivery direto de estabelecimentos de alimentação. A plataforma permite que restaurantes e lojistas criem suas próprias lojas virtuais, exibam seus cardápios digitais, gerenciem pedidos em tempo real e controlem faturamentos e planos, tudo com **0% de taxa sobre as vendas**.

---

## 🚀 Principais Funcionalidades

### 🛒 Cardápio e Vendas Online
* **Cardápio Digital Ilimitado:** Visualização rica e fluida dos produtos, categorias e opcionais.
* **Carrinho por Loja:** Isolamento automático de itens por estabelecimento para evitar conflito de pedidos de múltiplos locais.
* **Integração de Pedidos:** Processamento rápido de pedidos em tempo real diretamente no painel do lojista.

### 💳 Assinatura e Faturamento (Fluxo Asaas)
* **Onboarding com 14 Dias Grátis:** Novos estabelecimentos podem se cadastrar e iniciar o teste sem barreiras.
* **Planos Sob Medida:**
  * **Essencial (essential):** R$ 59,00/mês ou R$ 590,00/ano — O começo ideal para vendas rápidas.
  * **Profissional (professional - *Recomendado*):** R$ 89,00/mês ou R$ 890,00/ano — Automação total, WhatsApp integrado e cupons.
  * **Premium (premium):** R$ 159,00/mês ou R$ 1.590,00/ano — Multi-lojas, API de integração e domínio próprio.
* **Checkout Descomplicado:** Painel premium de faturamento integrado aos webhooks do **Asaas** com faturamento simplificado (coleta segura de Nome/Razão Social, CPF/CNPJ, E-mail e Telefone).
* **Segurança Financeira:** Coleta e processamento centralizados via Cloud Functions, mantendo conformidade e blindagem contra manipulações no cliente.

### 👤 Painel do Lojista e Segurança
* **Edição Cadastral Rápida:** Troca ágil de avatar utilizando upload otimizado do **Cloudinary**.
* **Gestão de Segurança:** Badges dinâmicos de verificação para E-mail e WhatsApp (Verificado, Pendente ou Não Cadastrado), totalmente responsivos para dispositivos móveis (`360px` e `390px`).
* **Área Administrativa (`/admin`):** Painel corporativo para gerenciamento centralizado de lojas, faturamento e auditoria de status de planos.

---

## 🛠️ Stack Tecnológica

### Frontend
* **Core:** React 18+ & Vite (HMR ultra rápido para desenvolvimento)
* **Roteamento:** React Router DOM v6
* **Estilização:** Tailwind CSS (Estética moderna, harmoniosa e fluida) & Vanilla CSS
* **Ícones:** React Icons (Pacote `react-icons/fi`)
* **Animações:** Framer Motion / Motion

### Backend (Serverless)
* **Autenticação:** Firebase Auth (Email/Senha e Provedores Sociais)
* **Banco de Dados:** Cloud Firestore (Estrutura de dados em tempo real)
* **Serverless Functions:** Cloud Functions (Firebase Functions Callable escritas em Node.js com proteção de abuse/spam/rate-limit)
* **CDNs:** Cloudinary (Otimização de tamanho e entrega ultra rápida de imagens)

---

## 📁 Estrutura de Pastas Principal

```bash
├── public/                 # Assets públicos do sistema
├── functions/              # Cloud Functions do Firebase (Backend)
│   ├── index.js            # Inicialização e exports das callable functions
│   └── publicOrder.js      # Lógica e rate limit de processamento de pedidos
├── src/
│   ├── components/         # Componentes compartilhados
│   │   ├── billing/        # SubscriptionStatusBadge e blocos financeiros
│   │   ├── layouts/        # DashboardLayout, DashboardPageHeader, etc.
│   │   └── merchant/       # ProfilePanel (modal/configurações da conta)
│   ├── contexts/           # Provedores de contexto (AuthContext, CartContext)
│   ├── pages/              # Telas da aplicação
│   │   ├── admin/          # AdminDashboard, AdminSubscriptionsPage
│   │   ├── auth/           # Login, OnboardingPage, SignupPage
│   │   ├── landing/        # PricingSection comercial do site
│   │   └── merchant/       # BillingPage (faturamento/planos), ProfilePage
│   ├── routes/             # Definição e proteção de rotas (AppRoutes)
│   ├── services/           # Conectores externos (firebase, cloudinary)
│   └── utils/              # Funções utilitárias (billingStatus)
├── tailwind.config.js      # Configurações do Tailwind CSS
└── vite.config.js          # Configurações do Vite
```

---

## 💻 Como Rodar o Projeto Localmente

### 1. Requisitos
Certifique-se de possuir o **Node.js (versão 18 ou superior)** instalado em sua máquina.

### 2. Instalação de Dependências
Na raiz do projeto, instale as dependências executando:
```bash
npm install
```

### 3. Rodar em Modo de Desenvolvimento
Inicie o servidor de desenvolvimento local:
```bash
npm run dev
```
Acesse a aplicação no navegador em: `http://localhost:5173` (ou a porta atribuída pelo Vite).

### 4. Compilação para Produção (Build)
Para compilar e otimizar os arquivos estáticos para implantação em produção:
```bash
npm run build
```
O build otimizado será gerado na pasta `/dist`.

---

## 🛡️ Diretrizes de Desenvolvimento e Segurança

* **Blindagem de Regras de Negócio:** Nenhuma mutação de dados críticos de faturamento ou planos deve ser realizada no cliente. Todo o status de cobrança é atualizado unicamente pelas integrações de Webhook e Cloud Functions em ambiente seguro.
* **Prevenção de Abuso:** O endpoint de pedidos públicos (`createPublicOrder`) possui rate limit integrado por IP/Telefone, prevenindo ataques de spam e criação de ordens fraudulentas.
* **Layout Fluido:** Desenvolva sempre pensando em **Mobile-First**. Verifique a integridade em resoluções pequenas de celular (`360px` e `390px`) prevenindo overflows horizontais.
* **Acentuação e Codificação:** Mantenha todos os arquivos em formato **UTF-8 nativo** para evitar corrupção de strings acentuadas no navegador.
