// src/data/changelog.js

/**
 * Tipos aceitos no changelog.
 * Mantenha esses valores sincronizados com os estilos da página de changelog.
 */
export const changelogTypes = {
  NEW: 'new',
  IMPROVED: 'improved',
  FIXED: 'fixed',
  SECURITY: 'security',
}

export const changelogTypeLabels = {
  [changelogTypes.NEW]: 'Novo',
  [changelogTypes.IMPROVED]: 'Melhorado',
  [changelogTypes.FIXED]: 'Corrigido',
  [changelogTypes.SECURITY]: 'Segurança',
}

/**
 * Ordem usada para exibir os tipos dentro de cada atualização.
 */
export const changelogTypeOrder = [
  changelogTypes.NEW,
  changelogTypes.IMPROVED,
  changelogTypes.FIXED,
  changelogTypes.SECURITY,
]

/**
 * @typedef {Object} ChangelogItem
 * @property {'new' | 'improved' | 'fixed' | 'security'} type
 * @property {string} text
 */

/**
 * @typedef {Object} ChangelogEntry
 * @property {string} id
 * @property {string} date
 * @property {string} title
 * @property {string} summary
 * @property {string[]} tags
 * @property {ChangelogItem[]} items
 */

/**
 * Lista principal de atualizações do PratoBy.
 *
 * Regras:
 * - Use datas no formato YYYY-MM-DD.
 * - Mantenha IDs únicos.
 * - Escreva textos curtos e claros para lojistas.
 * - Evite linguagem muito técnica.
 *
 * @type {ChangelogEntry[]}
 */
const entries = [
  {
    id: '2026-06-27-estoque-pedidos-seguros',
    date: '2026-06-27',
    title: 'Pedidos com estoque mais confiável',
    summary:
      'Ajustes para deixar a criação de pedidos mais segura quando produtos mudam durante a venda.',
    tags: ['Pedidos', 'Cardápio', 'Segurança'],
    items: [
      {
        type: changelogTypes.IMPROVED,
        text: 'Melhoramos a validação dos produtos no momento em que o pedido é criado.',
      },
      {
        type: changelogTypes.SECURITY,
        text: 'Reforçamos proteções para evitar inconsistências entre loja, cardápio e pedido.',
      },
      {
        type: changelogTypes.FIXED,
        text: 'Ajustamos situações em que um cancelamento poderia ficar preso por alterações no cardápio.',
      },
    ],
  },
  {
    id: '2026-06-26-cardapio-publico-polido',
    date: '2026-06-26',
    title: 'Melhorias visuais no cardápio público',
    summary:
      'A loja pública recebeu ajustes de aparência e navegação para ficar mais clara para o cliente.',
    tags: ['Loja pública', 'Cardápio'],
    items: [
      {
        type: changelogTypes.IMPROVED,
        text: 'Melhoramos a barra de categorias e a experiência de navegação no cardápio.',
      },
      {
        type: changelogTypes.IMPROVED,
        text: 'Ajustamos a apresentação das informações da loja e dos estados de loja fechada.',
      },
      {
        type: changelogTypes.FIXED,
        text: 'Corrigimos um comportamento que podia atrapalhar o scroll em cardápios maiores.',
      },
    ],
  },
  {
    id: '2026-06-25-billing-trial-publicacao',
    date: '2026-06-25',
    title: 'Assinatura e teste grátis mais consistentes',
    summary:
      'Melhorias para deixar mais claro quando a loja pode publicar, receber pedidos e gerenciar a assinatura.',
    tags: ['Assinatura', 'Dashboard', 'Pedidos'],
    items: [
      {
        type: changelogTypes.IMPROVED,
        text: 'Deixamos os estados de assinatura e teste grátis mais consistentes entre painel e pedidos.',
      },
      {
        type: changelogTypes.FIXED,
        text: 'Ajustamos chamadas de ação para evitar convite de teste grátis quando o teste já foi usado.',
      },
      {
        type: changelogTypes.SECURITY,
        text: 'Reforçamos validações para bloquear pedidos quando a loja não está liberada para vender.',
      },
    ],
  },
  {
    id: '2026-06-24-alertas-pedidos',
    date: '2026-06-24',
    title: 'Painel de pedidos mais atento',
    summary: 'Acompanhamento de pedidos ficou mais fácil para a rotina do lojista.',
    tags: ['Pedidos', 'Dashboard'],
    items: [
      {
        type: changelogTypes.NEW,
        text: 'Adicionamos alertas visuais para novos pedidos no painel.',
      },
      {
        type: changelogTypes.IMPROVED,
        text: 'Melhoramos a organização das informações dos pedidos para leitura mais rápida.',
      },
    ],
  },
]

const sortEntriesByDateDesc = (a, b) => {
  return new Date(b.date).getTime() - new Date(a.date).getTime()
}

const sortItemsByType = (items = []) => {
  return [...items].sort((a, b) => {
    const aIndex = changelogTypeOrder.indexOf(a.type)
    const bIndex = changelogTypeOrder.indexOf(b.type)

    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
  })
}

const normalizeEntry = entry => ({
  ...entry,
  tags: Array.isArray(entry.tags) ? entry.tags : [],
  items: sortItemsByType(entry.items),
})

/**
 * Entradas normalizadas e ordenadas da mais recente para a mais antiga.
 */
export const changelogEntries = entries
  .map(normalizeEntry)
  .sort(sortEntriesByDateDesc)

/**
 * Última atualização publicada.
 */
export const latestChangelogEntry = changelogEntries[0] ?? null

/**
 * Retorna o label de um tipo de changelog.
 *
 * @param {string} type
 * @returns {string}
 */
export const getChangelogTypeLabel = type => {
  return changelogTypeLabels[type] ?? 'Atualização'
}

/**
 * Retorna todas as tags únicas usadas no changelog.
 */
export const changelogTags = Array.from(
  new Set(changelogEntries.flatMap(entry => entry.tags)),
).sort((a, b) => a.localeCompare(b, 'pt-BR'))

/**
 * Busca atualizações por tag.
 *
 * @param {string} tag
 * @returns {ChangelogEntry[]}
 */
export const getChangelogEntriesByTag = tag => {
  if (!tag) return changelogEntries

  return changelogEntries.filter(entry => entry.tags.includes(tag))
}