import { httpsCallable } from 'firebase/functions'

import { functions } from './firebase'

const saveMenuItemCallable = httpsCallable(functions, 'saveMenuItem')

export async function saveMenuItem({ storeId, entityType, entityId, payload }) {
  const result = await saveMenuItemCallable({
    storeId,
    entityType,
    entityId: entityId || null,
    payload,
  })

  return result.data
}
