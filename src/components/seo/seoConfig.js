export const SITE_URL = 'https://pratoby.com'
export const SITE_NAME = 'PratoBy'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/pratoby-cover.png`
export const DEFAULT_IMAGE_ALT =
  'PratoBy - cardápio digital, delivery próprio e pedidos online sem comissão'

export const DEFAULT_SEO = {
  title: 'PratoBy | Cardápio digital e delivery próprio sem comissão',
  description:
    'Crie seu cardápio digital, receba pedidos online pelo próprio link e venda sem comissão por pedido. O PratoBy é feito para restaurantes, lanchonetes, pizzarias e confeitarias.',
  path: '/',
  image: DEFAULT_OG_IMAGE,
  imageAlt: DEFAULT_IMAGE_ALT,
}

export const MARKETING_SEO = {
  home: DEFAULT_SEO,
  plans: {
    title: 'Planos PratoBy | Delivery próprio sem comissão',
    description:
      'Compare os planos do PratoBy para vender online com cardápio digital, pedidos em tempo real, pagamentos e recursos para crescer sem comissão por venda.',
    path: '/planos',
  },
  about: {
    title: 'Sobre o PratoBy | Cardápio digital para vender direto',
    description:
      'Conheça o PratoBy, uma plataforma de cardápio digital e delivery próprio para lojistas venderem pelo próprio link, com pedidos organizados e sem comissão.',
    path: '/sobre',
  },
  contact: {
    title: 'Contato | PratoBy',
    description:
      'Fale com o PratoBy para criar seu cardápio digital, tirar dúvidas sobre planos ou começar sua loja online com venda direta e sem comissão.',
    path: '/contato',
  },
  privacy: {
    title: 'Política de Privacidade | PratoBy',
    description:
      'Entenda como o PratoBy coleta, usa e protege dados de lojistas e clientes em sua plataforma de cardápio digital e pedidos online.',
    path: '/privacidade',
    noIndex: true,
  },
  terms: {
    title: 'Termos de Uso | PratoBy',
    description:
      'Consulte as regras de uso do PratoBy para lojistas, pedidos online, assinaturas, lojas públicas e serviços digitais.',
    path: '/termos',
    noIndex: true,
  },
  examples: {
    title: 'Exemplos de lojas PratoBy | Cardápio digital e delivery',
    description:
      'Teste lojas modelo do PratoBy com cardápio digital, carrinho, adicionais, entrega, retirada e pedidos online para restaurantes, lanchonetes e confeitarias.',
    path: '/exemplos',
  },
}

export const SEO_INTENT_PAGES = {
  '/cardapio-digital': {
    title: 'Cardápio digital para vender online | PratoBy',
    description:
      'Crie um cardápio digital com link próprio, produtos, categorias, carrinho e pedidos online para vender direto sem comissão por pedido.',
    h1: 'Cardápio digital para vender pelo seu próprio link',
    eyebrow: 'Cardápio digital',
    subtitle:
      'Monte sua loja online, organize produtos e receba pedidos direto pelo link do seu restaurante, lanchonete ou delivery.',
    intro:
      'O PratoBy transforma seu cardápio em uma experiência de compra mobile-first, com categorias, fotos, adicionais, carrinho e pedidos organizados no painel.',
    path: '/cardapio-digital',
    benefits: [
      'Link próprio para bio, WhatsApp, QR Code e Google Business',
      'Produtos, categorias, adicionais e observações em um fluxo simples',
      'Carrinho e pedido online sem depender de marketplace',
      'Painel para acompanhar pedidos em tempo real',
    ],
    steps: [
      'Cadastre a loja e personalize nome, cores e horários.',
      'Monte categorias, produtos, fotos, adicionais e formas de entrega.',
      'Divulgue o link e acompanhe os pedidos no painel do lojista.',
    ],
    audiences: ['Restaurantes', 'Lanchonetes', 'Pizzarias', 'Confeitarias', 'Marmitarias'],
    faqs: [
      {
        q: 'O cardápio digital substitui meu cardápio impresso?',
        a: 'Ele pode substituir ou complementar. Você pode divulgar por link e QR Code, mantendo produtos, preços e disponibilidade sempre atualizados.',
      },
      {
        q: 'O cliente precisa baixar aplicativo?',
        a: 'Não. O cliente acessa a loja pelo navegador do celular, escolhe os produtos e envia o pedido online.',
      },
      {
        q: 'Consigo editar produtos sozinho?',
        a: 'Sim. O lojista pode criar categorias, alterar preços, publicar fotos e pausar itens pelo painel.',
      },
      {
        q: 'O PratoBy cobra comissão por pedido?',
        a: 'Não cobramos comissão por pedido. A proposta é vender direto pelo link da sua loja.',
      },
    ],
  },
  '/delivery-sem-comissao': {
    title: 'Delivery sem comissão para restaurantes | PratoBy',
    description:
      'Receba pedidos online pelo próprio link, organize entregas e venda sem pagar comissão por pedido com o PratoBy.',
    h1: 'Delivery sem comissão para vender direto',
    eyebrow: 'Delivery próprio',
    subtitle:
      'Receba pedidos no seu próprio canal, organize entrega ou retirada e mantenha a relação direta com seus clientes.',
    intro:
      'Com o PratoBy, sua loja deixa de depender de comissões por venda para ter um link próprio de pedidos, cardápio atualizado e painel operacional.',
    path: '/delivery-sem-comissao',
    benefits: [
      'Sem comissão do PratoBy por pedido',
      'Pedidos organizados por status em tempo real',
      'Entrega, retirada e formas de pagamento configuradas pela loja',
      'Link próprio para campanhas, redes sociais e clientes recorrentes',
    ],
    steps: [
      'Configure sua loja, horários e áreas de atendimento.',
      'Publique o cardápio e compartilhe o link com seus clientes.',
      'Receba pedidos no painel e acompanhe preparo, entrega ou retirada.',
    ],
    audiences: ['Restaurantes com delivery', 'Lanchonetes', 'Pizzarias', 'Hamburguerias', 'Pequenos deliveries'],
    faqs: [
      {
        q: 'Delivery sem comissão significa sem custo?',
        a: 'Não. O PratoBy trabalha com assinatura, mas não cobra percentual sobre cada pedido recebido pela loja.',
      },
      {
        q: 'Posso continuar usando WhatsApp?',
        a: 'Sim. O link do PratoBy pode ser divulgado pelo WhatsApp, mas o pedido chega mais organizado no painel.',
      },
      {
        q: 'A entrega é feita pelo PratoBy?',
        a: 'Não. A operação de entrega continua sendo responsabilidade da loja, com regras e taxas configuradas pelo lojista.',
      },
      {
        q: 'Posso aceitar retirada no local?',
        a: 'Sim. A loja pode trabalhar com entrega, retirada ou ambos, conforme sua rotina.',
      },
    ],
  },
  '/sistema-para-confeitaria': {
    title: 'Sistema para confeitaria com encomendas online | PratoBy',
    description:
      'Monte uma loja online para confeitaria, receba pedidos e encomendas pelo próprio link e organize tudo em um painel simples.',
    h1: 'Sistema para confeitaria vender online sem comissão',
    eyebrow: 'Confeitarias',
    subtitle:
      'Venda bolos, doces, kits festa e encomendas pelo seu próprio link, com cardápio online e pedidos organizados.',
    intro:
      'O PratoBy ajuda confeitarias a apresentar produtos com fotos, descrições, categorias e pedidos online, sem depender de mensagens soltas para cada venda.',
    path: '/sistema-para-confeitaria',
    benefits: [
      'Loja online para bolos, doces, sobremesas e kits festa',
      'Produtos com fotos, descrições, adicionais e observações',
      'Fluxo simples para pedidos, retirada e entrega',
      'Painel para organizar pedidos e histórico da confeitaria',
    ],
    steps: [
      'Crie categorias como bolos, doces, kits e encomendas.',
      'Adicione fotos, tamanhos, sabores e informações importantes.',
      'Compartilhe o link e receba pedidos organizados no painel.',
    ],
    audiences: ['Confeitarias', 'Docerias', 'Bolos caseiros', 'Brigaderias', 'Kits festa'],
    faqs: [
      {
        q: 'O PratoBy serve para encomendas?',
        a: 'Sim. A confeitaria pode organizar produtos planejados, kits e pedidos com observações do cliente.',
      },
      {
        q: 'Posso vender produtos por tamanho ou sabor?',
        a: 'Sim. Os produtos podem ter opções, adicionais e observações para adaptar a venda ao seu cardápio.',
      },
      {
        q: 'Preciso ter site próprio?',
        a: 'Não. O PratoBy gera uma loja online por link para divulgar nas redes sociais, WhatsApp e QR Code.',
      },
      {
        q: 'Existe comissão sobre cada encomenda?',
        a: 'Não cobramos comissão por pedido. A confeitaria vende direto pelo próprio link.',
      },
    ],
  },
  '/sistema-para-lanchonete': {
    title: 'Sistema para lanchonete vender online | PratoBy',
    description:
      'Crie uma loja online para lanchonete, receba pedidos pelo próprio link e organize entrega, retirada e pagamentos sem comissão por pedido.',
    h1: 'Sistema para lanchonete vender online pelo próprio link',
    eyebrow: 'Lanchonetes',
    subtitle:
      'Organize combos, adicionais, bebidas, entrega e retirada em uma loja online feita para pedidos rápidos pelo celular.',
    intro:
      'O PratoBy ajuda lanchonetes a sair das mensagens soltas no WhatsApp para um fluxo com cardápio digital, carrinho, pedido online e painel do lojista.',
    path: '/sistema-para-lanchonete',
    benefits: [
      'Cardápio com categorias para lanches, combos, bebidas e adicionais',
      'Pedido online com observações do cliente e acompanhamento no painel',
      'Link próprio para Instagram, WhatsApp, QR Code e clientes recorrentes',
      'Entrega e retirada configuradas conforme a rotina da lanchonete',
    ],
    steps: [
      'Cadastre os produtos, adicionais e opções mais vendidos.',
      'Configure horários, formas de pagamento, entrega e retirada.',
      'Divulgue o link e acompanhe cada pedido em tempo real.',
    ],
    audiences: ['Lanchonetes', 'Hamburguerias', 'Pastelarias', 'Açaíterias', 'Pequenos deliveries'],
    faqs: [
      {
        q: 'Consigo vender combos e adicionais?',
        a: 'Sim. Você pode organizar produtos, adicionais, observações e categorias para deixar o pedido mais claro.',
      },
      {
        q: 'O cliente finaliza pelo celular?',
        a: 'Sim. A loja pública é mobile-first e o cliente compra pelo navegador, sem baixar aplicativo.',
      },
      {
        q: 'Posso receber pedidos para retirada?',
        a: 'Sim. A lanchonete pode trabalhar com entrega, retirada ou ambos.',
      },
      {
        q: 'Existe comissão por pedido?',
        a: 'Não. O PratoBy não cobra comissão sobre cada venda feita pelo link da loja.',
      },
    ],
  },
  '/sistema-para-pizzaria': {
    title: 'Sistema para pizzaria com pedidos online | PratoBy',
    description:
      'Venda pizzas pelo próprio link, organize sabores, adicionais, entrega e retirada em uma loja online sem comissão por pedido.',
    h1: 'Sistema para pizzaria receber pedidos online sem comissão',
    eyebrow: 'Pizzarias',
    subtitle:
      'Monte uma loja online para divulgar sabores, bordas, adicionais, bebidas e pedidos de entrega ou retirada.',
    intro:
      'O PratoBy cria um canal próprio para pizzarias venderem direto, com cardápio digital, carrinho e pedidos organizados no painel.',
    path: '/sistema-para-pizzaria',
    benefits: [
      'Loja online por link para divulgar sabores e promoções',
      'Organização de categorias, adicionais, observações e bebidas',
      'Pedidos em tempo real para entrega ou retirada',
      'Venda direta sem comissão do PratoBy por pedido',
    ],
    steps: [
      'Cadastre sabores, tamanhos, adicionais e bebidas.',
      'Configure horários, taxas e opções de atendimento.',
      'Compartilhe o link da pizzaria e acompanhe os pedidos no painel.',
    ],
    audiences: ['Pizzarias', 'Esfiharias', 'Delivery noturno', 'Restaurantes com pizzas', 'Pequenas redes locais'],
    faqs: [
      {
        q: 'O PratoBy serve para delivery de pizza?',
        a: 'Sim. A pizzaria pode receber pedidos online para entrega ou retirada pelo próprio link.',
      },
      {
        q: 'Posso cadastrar adicionais e observações?',
        a: 'Sim. O cardápio permite trabalhar com adicionais, observações e produtos complementares.',
      },
      {
        q: 'Preciso pagar percentual sobre pedidos?',
        a: 'Não. O PratoBy trabalha sem comissão por pedido.',
      },
      {
        q: 'Posso divulgar o link no WhatsApp?',
        a: 'Sim. O link pode ir para WhatsApp, Instagram, Google Business, panfletos e QR Codes.',
      },
    ],
  },
  '/cardapio-digital-para-restaurante': {
    title: 'Cardápio digital para restaurante | PratoBy',
    description:
      'Monte um cardápio digital para restaurante, receba pedidos online e venda direto pelo seu próprio link sem comissão por venda.',
    h1: 'Cardápio digital para restaurante vender direto',
    eyebrow: 'Restaurantes',
    subtitle:
      'Crie um cardápio online com categorias, produtos, carrinho e pedidos para entrega, retirada ou encomendas.',
    intro:
      'Para restaurantes, o PratoBy funciona como uma loja online própria: o cliente acessa o link, escolhe os itens e a equipe acompanha tudo no painel.',
    path: '/cardapio-digital-para-restaurante',
    benefits: [
      'Cardápio digital com link próprio para divulgar em qualquer canal',
      'Pedidos online sem comissão por venda',
      'Categorias, produtos, fotos e disponibilidade sob controle do lojista',
      'Painel para organizar atendimento, preparo e histórico',
    ],
    steps: [
      'Configure a identidade, horários e operação do restaurante.',
      'Publique categorias, produtos, fotos e formas de atendimento.',
      'Receba pedidos e acompanhe status no painel do lojista.',
    ],
    audiences: ['Restaurantes', 'Marmitarias', 'Comida caseira', 'Cozinhas delivery', 'Restaurantes de bairro'],
    faqs: [
      {
        q: 'Um restaurante pode usar PratoBy sem marketplace?',
        a: 'Sim. A loja vende pelo próprio link, mantendo relacionamento direto com o cliente.',
      },
      {
        q: 'O cardápio digital aceita fotos e categorias?',
        a: 'Sim. Você pode organizar produtos, categorias, descrições, fotos e disponibilidade.',
      },
      {
        q: 'A taxa de entrega entra na comissão?',
        a: 'O PratoBy não cobra comissão por pedido. Taxas operacionais configuradas pela loja continuam sob responsabilidade do lojista.',
      },
      {
        q: 'Posso usar o link em QR Code?',
        a: 'Sim. O link pode ser divulgado em QR Code, bio, WhatsApp e materiais físicos.',
      },
    ],
  },
  '/Cardapio-Digital': {
    title: 'Cardápio digital para restaurante sem comissão | PratoBy',
    description:
      'Crie um cardápio digital para restaurante com categorias, produtos, carrinho e pedidos para vender direto sem comissão.',
    h1: 'Cardápio digital para restaurante vender sem comissão',
    eyebrow: 'Cardápio digital',
    subtitle:
      'Tenha um canal próprio de pedidos com cardápio, carrinho, link público e painel para acompanhar a operação.',
    intro:
      'A loja online do PratoBy ajuda restaurantes a venderem direto, sem depender apenas de WhatsApp ou marketplaces para receber pedidos.',
    path: '/Cardapio-Digital',
    benefits: [
      'Loja online com URL própria no PratoBy',
      'Cardápio, carrinho e pedidos em uma experiência mobile-first',
      'Venda direta sem comissão por pedido',
      'Painel para atualizar produtos, acompanhar pedidos e organizar a rotina',
    ],
    steps: [
      'Crie sua conta e configure a loja pública.',
      'Cadastre o cardápio, formas de atendimento e pagamentos.',
      'Compartilhe o link e acompanhe os pedidos no painel.',
    ],
    audiences: ['Restaurantes', 'Lanchonetes', 'Pizzarias', 'Confeitarias', 'Delivery próprio'],
    faqs: [
      {
        q: 'Qual a diferença entre loja online e marketplace?',
        a: 'Na loja online própria, o cliente compra pelo link da sua marca. O PratoBy não cobra comissão por pedido.',
      },
      {
        q: 'Preciso de domínio próprio?',
        a: 'Não. Você recebe um link público do PratoBy para divulgar sua loja.',
      },
      {
        q: 'O pedido fica organizado no painel?',
        a: 'Sim. Os pedidos chegam ao painel do lojista para acompanhamento e gestão.',
      },
      {
        q: 'A loja online funciona no celular?',
        a: 'Sim. A experiência pública é mobile-first para o cliente comprar pelo navegador.',
      },
    ],
  },
}

export function absoluteUrl(path = '/') {
  const cleanPath = String(path || '/')
    .split('?')[0]
    .split('#')[0]
    .replace(/^\/?/, '/')
    .replace(/\/{2,}/g, '/')

  return `${SITE_URL}${cleanPath === '/index.html' ? '/' : cleanPath}`
}

export function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function buildFaqPageJsonLd(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q || faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a || faq.answer,
      },
    })),
  }
}

export function buildWebPageJsonLd(page) {
  if (!page?.path) return null

  const url = absoluteUrl(page.path)

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    inLanguage: 'pt-BR',
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
  }
}

export function buildMarketingJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        legalName: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icons/android-chrome-512x512.png`,
        image: DEFAULT_OG_IMAGE,
        description:
          'Plataforma de cardápio digital e delivery próprio para restaurantes, lanchonetes, pizzarias e confeitarias receberem pedidos online pelo próprio link e venderem sem comissão por pedido.',
        areaServed: {
          '@type': 'Country',
          name: 'Brasil',
        },
        sameAs: ['https://www.instagram.com/pratobybr'],
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            availableLanguage: ['pt-BR'],
            url: `${SITE_URL}/contato`,
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        alternateName: 'PratoBy Cardápio Digital',
        description:
          'Cardápio digital, delivery próprio e pedidos online para restaurantes, lanchonetes, pizzarias e confeitarias venderem pelo próprio link sem comissão por pedido.',
        inLanguage: 'pt-BR',
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        image: DEFAULT_OG_IMAGE,
        description:
          'Crie seu cardápio digital, receba pedidos online pelo próprio link e opere delivery próprio sem comissão por pedido. Plataforma feita para restaurantes, lanchonetes, pizzarias e confeitarias.',
        inLanguage: 'pt-BR',
        provider: {
          '@id': `${SITE_URL}/#organization`,
        },
        audience: {
          '@type': 'Audience',
          audienceType:
            'Restaurantes, lanchonetes, pizzarias, confeitarias e pequenos deliveries',
        },
      },
    ],
  }
}
