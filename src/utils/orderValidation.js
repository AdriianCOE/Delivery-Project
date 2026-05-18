export function getPricingValidation(order) {
    const validation = order?.pricingValidation || {}
    const status = validation?.status || 'pending'
  
    if (status === 'valid') {
      return {
        status: 'valid',
        label: 'Valor validado',
        tone: 'success',
        message: 'O valor do pedido foi conferido automaticamente pelo PratoBy.',
      }
    }
  
    if (status === 'review') {
      return {
        status: 'review',
        label: 'Revisar valor',
        tone: 'warning',
        message:
          'O pedido precisa de revisão. Alguma opção, adicional ou regra de preço não foi validada automaticamente.',
      }
    }
  
    if (status === 'invalid') {
      return {
        status: 'invalid',
        label: 'Valor suspeito',
        tone: 'danger',
        message:
          'O valor enviado pelo cliente não bate com o valor calculado pelo PratoBy. Confira antes de aceitar.',
      }
    }
  
    return {
      status: 'pending',
      label: 'Validando valor',
      tone: 'neutral',
      message: 'O PratoBy ainda está conferindo o valor deste pedido.',
    }
  }
  
  export function shouldBlockOrderAcceptance(order) {
    const status = order?.pricingValidation?.status
  
    return status === 'invalid'
  }
  
  export function shouldWarnOrderAcceptance(order) {
    const status = order?.pricingValidation?.status
  
    return status === 'review' || order?.requiresManualPriceReview === true
  }