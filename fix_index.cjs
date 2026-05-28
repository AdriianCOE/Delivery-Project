const fs = require('fs');
const lines = fs.readFileSync('functions/index.js', 'utf8').split('\n');

// The file was mangled. We need to find `setGlobalOptions({` and `async function createAuditLog(data) {`
const startIdx = lines.findIndex(l => l.includes('setGlobalOptions({'));
const endIdx = lines.findIndex(l => l.includes('async function createAuditLog(data) {'));

const top = lines.slice(0, startIdx).join('\n');
const bottom = lines.slice(endIdx).join('\n');

const middle = `setGlobalOptions({
  region: 'southamerica-east1',
  minInstances: 0,
  maxInstances: 3,
  cpu: 'gcf_gen1'
})

admin.initializeApp()

const db = admin.firestore()
const asaasFunctions = createAsaasFunctions({ db, admin, logger })
const TERMS_VERSION = '2026-05-24'
const PRIVACY_VERSION = '2026-05-24'
const REGION = 'southamerica-east1'
const ENFORCE_APP_CHECK = String(process.env.ENFORCE_APP_CHECK || '').toLowerCase() === 'true'

exports.startAsaasSubscription = asaasFunctions.startAsaasSubscription
exports.getSubscriptionManagementData = asaasFunctions.getSubscriptionManagementData
exports.changeSubscriptionPlan = asaasFunctions.changeSubscriptionPlan
exports.cancelSubscription = asaasFunctions.cancelSubscription
exports.requestSubscriptionDueDateChange = asaasFunctions.requestSubscriptionDueDateChange
exports.syncAsaasSubscriptionStatus = asaasFunctions.syncAsaasSubscriptionStatus
exports.createPaymentMethodUpdateCheckout = asaasFunctions.createPaymentMethodUpdateCheckout
exports.asaasWebhook = asaasFunctions.asaasWebhook

exports.createPublicOrder = onCall(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 10,
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  createPublicOrderHandler({
    db,
    admin,
    HttpsError,
    logger,
    maxOrderCents: 100000000,
  })
)

function getChangedFields(beforeData, afterData, fields) {
    return fields.filter((field) => {
      const beforeValue = field
        .split('.')
        .reduce((acc, key) => acc?.[key], beforeData)
  
      const afterValue = field
        .split('.')
        .reduce((acc, key) => acc?.[key], afterData)
  
      return JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null)
    })
  }
  
  function pickActorUid(beforeData, afterData) {
    return (
      afterData.statusUpdatedBy ||
      afterData.canceledBy ||
      afterData.cancelledBy ||
      afterData.payment?.confirmedBy ||
      afterData.storeThankedCustomerBy ||
      afterData.updatedBy ||
      afterData.lastUpdatedBy ||
      null
    )
  }
  
  `;

fs.writeFileSync('functions/index.js', top + (top ? '\n' : '') + middle + bottom);
console.log('Fixed index.js completely');
