

function getQuantity(option) {
  const quantity = Number(
    option?.quantity ??
    option?.qty ??
    option?.count ??
    option?.chargedQuantity ??
    1
  )

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

function getOptionName(option) {
  return (
    option?.name ||
    option?.label ||
    option?.title ||
    option?.optionName ||
    'Opção'
  )
}

function normalizeOption(option) {
  const quantity = getQuantity(option)
  const totalCents = Number(option?.totalCents ?? 0)
  const unitPriceCents = Number(
    option?.unitPriceCents ??
    option?.priceCents ??
    (totalCents && quantity ? Math.round(totalCents / quantity) : 0)
  )

  return {
    id: option?.id || option?.optionId || getOptionName(option),
    name: getOptionName(option),
    quantity,
    unitPriceCents,
    totalCents: totalCents || unitPriceCents * quantity,
  }
}

function uniqueOptions(options = []) {
  const map = new Map()

  options.forEach((option) => {
    const normalized = normalizeOption(option)
    const key = `${normalized.id}-${normalized.name}-${normalized.unitPriceCents}`

    if (map.has(key)) return

    map.set(key, normalized)
  })

  return Array.from(map.values())
}

function normalizeGroup(group, index = 0) {
  const rawOptions =
    group?.options ||
    group?.selectedOptions ||
    group?.items ||
    group?.choices ||
    group?.values ||
    []

  const options = uniqueOptions(rawOptions).filter((option) => option.quantity > 0)

  if (!options.length) return null

  return {
    id: group?.groupId || group?.id || `group-${index}`,
    name:
      group?.groupName ||
      group?.name ||
      group?.title ||
      group?.label ||
      'Opções',
    options,
  }
}

function getFirstNonEmptyArray(...arrays) {
  return arrays.find((array) => Array.isArray(array) && array.length > 0) || []
}

function groupFlatOptions(flatOptions = []) {
  const groupsMap = new Map()

  flatOptions.forEach((option) => {
    const groupName =
      option?.groupName ||
      option?.groupTitle ||
      option?.category ||
      option?.typeLabel ||
      'Adicionais'

    const groupId = option?.groupId || groupName

    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, {
        id: groupId,
        name: groupName,
        options: [],
      })
    }

    groupsMap.get(groupId).options.push(option)
  })

  return Array.from(groupsMap.values())
    .map((group, index) => normalizeGroup(group, index))
    .filter(Boolean)
}

export function getItemDisplayOptionGroups(item) {
  const structuredGroups = getFirstNonEmptyArray(
    item?.selectedOptionGroups,
    item?.optionGroupsSnapshot,
    item?.selectedOptionsGroups,
    item?.customizationGroupsSnapshot
  )

  if (structuredGroups.length) {
    return structuredGroups
      .map((group, index) => normalizeGroup(group, index))
      .filter(Boolean)
  }

  const flatOptions = getFirstNonEmptyArray(
    item?.selectedOptionsFlat,
    item?.selectedOptions,
    item?.extras,
    item?.addons,
    item?.additionals
  )

  return groupFlatOptions(flatOptions)
}

