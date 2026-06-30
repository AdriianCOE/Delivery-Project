---
name: pratoby-project-guard
description: Use em qualquer tarefa no PratoBy envolvendo código, UI, loja pública, dashboard, pedidos, checkout, billing, planos, Firestore, Cloud Functions, Firebase Rules, segurança, refatoração ou melhoria visual.
---

# PratoBy Project Guard

Você está trabalhando no **PratoBy**, um SaaS de cardápio digital e delivery sem comissão.

O PratoBy permite que restaurantes, lanchonetes, pizzarias, confeitarias e outros negócios criem uma loja/cardápio digital, recebam pedidos, gerenciem produtos, acompanhem produção e operem sem comissão por venda.

Mensagem central do produto:

> Seu cardápio. Seu link. Seus pedidos. Zero comissão.

---

## 1. Princípios obrigatórios de arquitetura

Estas regras são prioridade máxima em qualquer alteração.

- O backend é autoridade para:
  - preço;
  - pedido;
  - cupom;
  - taxa de entrega;
  - estoque;
  - status do pedido;
  - status financeiro;
  - plano;
  - assinatura;
  - trial;
  - billing;
  - permissão de publicação;
  - permissão para receber pedidos.

- Nunca confie no frontend para:
  - total do pedido;
  - subtotal;
  - desconto;
  - frete;
  - permissões sensíveis;
  - plano ativo;
  - status financeiro;
  - status de pedido;
  - ownership crítico;
  - limite de produtos/categorias.

- Pedidos públicos devem passar por Cloud Function/callable.
- Mudanças de status de pedido devem passar por backend auditável.
- Billing, trial, assinatura e bloqueio de publicação devem ser validados no backend.
- Firestore Rules devem bloquear bypass direto pelo client.
- Rotas públicas não devem expor PII.
- Dados públicos devem vir de projeções seguras, como catálogo público/materializado, quando esse padrão existir no projeto.
- Preserve a compatibilidade do MVP.
- Faça mudanças pequenas, testáveis e com o menor diff seguro possível.

---

## 2. Regras para loja pública

Em rotas públicas de loja/cardápio:

- Visitantes anônimos devem conseguir acessar a loja normalmente.
- Não force login em visitantes públicos.
- Não exponha dados sensíveis do lojista ou dos clientes.
- Não exponha pedidos completos, telefone, endereço, dados financeiros ou informações internas.
- O dono logado pode ser reconhecido como dono apenas quando houver autenticação válida.
- A detecção de dono não deve depender de dados manipuláveis pelo frontend.
- A loja pública não deve quebrar quando não houver `AuthProvider`, sessão ou usuário autenticado.
- Fallbacks públicos devem ser seguros e não devem conceder permissões especiais.

Ao corrigir edição da loja pública pelo dono:

- Garanta que o dono autenticado consiga ser reconhecido.
- Garanta que visitante deslogado continue acessando.
- Não redirecione loja pública para login.
- Não torne `isOwner` verdadeiro baseado apenas em slug, query string ou localStorage inseguro.

---

## 3. Regras para pedidos, checkout e pagamento

Pedidos são área sensível.

Nunca faça:

- cálculo final de pedido somente no frontend;
- alteração direta de total no Firestore;
- alteração direta de status de pedido pelo client;
- alteração direta de status financeiro pelo client;
- marcar pagamento online como `paid` apenas porque o pedido foi entregue;
- confiar em preço enviado pelo carrinho;
- aceitar cupom sem validação no backend.

O backend deve validar:

- loja;
- publicação;
- plano;
- assinatura/trial;
- disponibilidade para receber pedido;
- produtos;
- categorias;
- preços atuais;
- estoque, se aplicável;
- cupom;
- taxa de entrega;
- método de pagamento;
- status financeiro;
- status logístico.

Status logístico e status financeiro devem ser tratados como coisas diferentes.

Exemplo:

- `entregue` não significa necessariamente `paid`.
- Pagamento online pendente, falho ou cancelado não pode virar `paid` automaticamente.
- Pagamento na entrega só pode virar `paid` quando a regra de negócio permitir de forma explícita e segura.

---

## 4. Regras para planos, limites e assinatura

Limites de plano não podem ser apenas UX.

O backend deve ser autoridade para limites como:

- número de produtos;
- número de categorias;
- recursos premium;
- imagens extras;
- cupons;
- publicação;
- recebimento de pedidos;
- integrações;
- recursos de delivery.

Ao mexer em produtos/categorias:

- criação deve respeitar plano;
- duplicação deve respeitar plano;
- restauração deve respeitar plano;
- ativação/publicação deve respeitar plano;
- edição de item existente não deve ser bloqueada indevidamente;
- reordenação não deve contar como novo item;
- alteração de preço/nome/descrição não deve burlar limite;
- Firestore Rules ou backend devem impedir bypass direto.

Quando o limite for atingido:

- mostrar mensagem clara;
- explicar o limite;
- sugerir upgrade quando fizer sentido;
- não deixar o sistema falhar silenciosamente.

---

## 5. Regras para configurações operacionais

Configurações que impactam pedido, preço, venda ou disponibilidade devem passar por backend/callable.

Exemplos sensíveis:

- `deliveryFees`;
- áreas de entrega;
- retirada/entrega ativa;
- loja aberta/fechada;
- meios de pagamento;
- pedido mínimo;
- horários;
- taxa de serviço;
- publicação da loja.

Para `deliveryFees`:

- não salvar diretamente com `updateDoc` no frontend;
- validar ownership no backend;
- validar formato;
- validar tipos numéricos;
- validar limites aceitáveis;
- impedir bypass em Firestore Rules;
- garantir que o checkout use a fonte confiável.

---

## 6. Regras para Firestore Rules

Ao revisar ou alterar `firestore.rules`, procure:

- escrita direta que deveria passar por Cloud Function;
- dados sensíveis legíveis em rota pública;
- ausência de validação de ownership;
- campos financeiros alteráveis pelo client;
- status de pedido alterável fora do backend;
- plano/assinatura/trial manipulável pelo client;
- inconsistência entre Rules e Cloud Functions;
- exceções antigas que ficaram abertas;
- permissões amplas demais;
- validações que dependem de campos que o próprio usuário consegue alterar.

Sempre que alterar Rules, entregue:

1. achados;
2. risco;
3. arquivo/linha aproximada;
4. correção mínima;
5. teste manual recomendado.

Não relaxe regras para “fazer funcionar” sem justificar.

---

## 7. Regras para Cloud Functions

Cloud Functions devem ser a camada de autoridade para operações sensíveis.

Ao editar functions:

- valide autenticação quando a operação for privada;
- valide App Check quando aplicável;
- valide ownership;
- valide plano;
- valide assinatura/trial;
- valide payload;
- valide tipos;
- valide limites;
- faça logs úteis, sem expor dados sensíveis;
- mantenha compatibilidade com dados antigos;
- evite efeitos colaterais ocultos;
- separe status financeiro de status operacional.

Não coloque lógica crítica apenas no frontend.

---

## 8. Minimal Diff Fixer

Antes de editar:

- localize a causa raiz;
- liste os arquivos realmente necessários;
- proponha um plano curto;
- explique o risco da mudança;
- evite refatoração fora do escopo.

Durante a edição:

- não reescreva arquivos inteiros sem necessidade;
- não altere UI sem necessidade em tarefa de backend;
- não altere lógica de negócio em tarefa visual;
- não mude nomes públicos sem motivo;
- não troque rotas sem justificar;
- não remova validações;
- preserve comportamento existente;
- prefira funções pequenas e claras;
- não crie abstrações grandes para problemas pequenos.

Depois de editar:

- explique antes/depois;
- liste arquivos alterados;
- rode testes possíveis;
- liste riscos restantes;
- diga claramente se algum comando não pôde ser executado.

---

## 9. Regras de UI e design do PratoBy

Use estas regras apenas quando a tarefa envolver interface, landing page, dashboard, loja pública, pricing, changelog, onboarding, componentes visuais ou melhoria de layout.

Identidade visual:

- laranja como cor principal;
- azul-marinho escuro;
- bege/off-white;
- branco limpo;
- cantos arredondados consistentes;
- sombras suaves;
- aparência moderna, confiável e profissional;
- estilo SaaS premium;
- visual amigável para restaurantes e pequenos negócios;
- nada de aparência genérica de template.

Melhore sempre que fizer sentido:

- hierarquia visual;
- espaçamento;
- responsividade;
- contraste;
- legibilidade;
- estados vazios;
- estados de loading;
- estados de erro;
- microcopy;
- CTA;
- acessibilidade;
- consistência entre cards, botões e badges.

Não faça:

- poluição visual;
- excesso de gradientes;
- excesso de animações;
- texto pequeno demais;
- cards demais sem hierarquia;
- layout bonito que quebra mobile;
- alteração de regra de negócio durante redesign;
- mudança de labels importantes sem justificar.

Antes de editar uma tela:

1. faça uma auditoria rápida da UI;
2. diga quais problemas visuais encontrou;
3. diga quais arquivos vai alterar;
4. confirme que não vai alterar regra de negócio.

Depois de editar:

1. explique o antes/depois;
2. informe melhorias de responsividade;
3. informe melhorias de acessibilidade;
4. rode build/lint quando possível.

---

## 10. Uso de Taste Skill

Use skills de design apenas quando necessário para UI.

Recomendado para tarefas visuais:

- `$gpt-taste`
- `$redesign-existing-projects`
- `$high-end-visual-design`
- `$minimalist-ui`
- `$brandkit`
- `$image-to-code`

Use em conjunto com esta skill quando for redesign:

```text
Use $gpt-taste, $redesign-existing-projects e $pratoby-project-guard.