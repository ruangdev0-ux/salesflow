/**
 * Constantes das regras de negócio, num só lugar.
 * Assim, se uma regra mudar (ex.: o limite de "estoque baixo"), basta mexer aqui.
 */

/** Os três estados possíveis de uma venda. */
export const SALE_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

/** Texto mostrado na tela para cada status. */
export const STATUS_LABEL = {
  [SALE_STATUS.PENDING]: 'Pendente',
  [SALE_STATUS.PAID]: 'Paga',
  [SALE_STATUS.CANCELLED]: 'Cancelada',
};

/**
 * Para quais status uma venda pode mudar a partir de cada status atual.
 *  - pendente  -> paga ou cancelada
 *  - paga      -> cancelada (estorno)
 *  - cancelada -> nenhuma (estado final)
 */
export const ALLOWED_TRANSITIONS = {
  [SALE_STATUS.PENDING]: [SALE_STATUS.PAID, SALE_STATUS.CANCELLED],
  [SALE_STATUS.PAID]: [SALE_STATUS.CANCELLED],
  [SALE_STATUS.CANCELLED]: [],
};

/** Produtos com estoque menor ou igual a este número são marcados como "estoque baixo". */
export const LOW_STOCK_THRESHOLD = 5;
