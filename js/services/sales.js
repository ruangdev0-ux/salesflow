/**
 * Regras de negócio das vendas.
 *
 * Aqui ficam as decisões do sistema, separadas da tela:
 *  - registrar uma venda valida os dados, calcula o total e desconta o estoque;
 *  - mudar o status segue as transições permitidas;
 *  - cancelar uma venda devolve os produtos ao estoque.
 *
 * As funções recebem o `db` como parâmetro (injeção de dependência), então nos testes
 * basta passar um banco em memória.
 */
import { ALLOWED_TRANSITIONS, SALE_STATUS } from './constants.js';
import { validateSale } from './validators.js';
import { todayISO } from '../utils/format.js';

/** Soma quantidade x preço unitário de todos os itens (em centavos). */
export function calcTotalCents(items) {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

/** O próximo número sequencial de venda (maior existente + 1). */
export function nextSaleNumber(sales) {
  return sales.reduce((max, sale) => Math.max(max, sale.number), 0) + 1;
}

export function canChangeStatus(from, to) {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Registra uma venda.
 * @returns {{ok: true, sale: object} | {ok: false, errors: object}}
 * Lança erro apenas se o armazenamento falhar (o estoque é restaurado antes).
 */
export function registerSale(db, input, { today = todayISO() } = {}) {
  const products = db.products.all();
  const result = validateSale(input, { clients: db.clients.all(), products, today });
  if (!result.ok) return { ok: false, errors: result.errors };

  const { values } = result;

  // O item guarda uma "foto" do nome e do preço no momento da venda. Assim, se o
  // preço do produto mudar depois, o histórico continua mostrando o valor cobrado.
  const items = values.items.map(({ productId, quantity }) => {
    const product = products.find((p) => p.id === productId);
    return { productId, name: product.name, unitPriceCents: product.priceCents, quantity };
  });

  const sale = {
    number: nextSaleNumber(db.sales.all()),
    clientId: values.clientId,
    date: values.date,
    status: values.status,
    notes: values.notes,
    items,
    totalCents: calcTotalCents(items),
  };

  // Desconta o estoque e grava a venda. Se algo falhar no meio, desfaz o estoque.
  const previousStock = [];
  try {
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      previousStock.push({ id: product.id, stock: product.stock });
      db.products.update(product.id, { stock: product.stock - item.quantity });
    }
    return { ok: true, sale: db.sales.add(sale) };
  } catch (error) {
    for (const { id, stock } of previousStock) {
      try {
        db.products.update(id, { stock });
      } catch {
        /* melhor esforço: o erro original é o que importa para o usuário */
      }
    }
    throw error;
  }
}

/**
 * Muda o status de uma venda respeitando as transições permitidas.
 * Ao cancelar, os produtos voltam para o estoque.
 * @returns {{ok: true, sale: object} | {ok: false, message: string}}
 */
export function changeSaleStatus(db, saleId, nextStatus) {
  const sale = db.sales.get(saleId);
  if (!sale) return { ok: false, message: 'Venda não encontrada.' };
  if (!canChangeStatus(sale.status, nextStatus)) {
    return { ok: false, message: 'Esta mudança de status não é permitida.' };
  }

  const updatedSale = db.sales.update(saleId, { status: nextStatus });

  if (nextStatus === SALE_STATUS.CANCELLED) {
    for (const item of sale.items) {
      const product = db.products.get(item.productId);
      if (product) db.products.update(product.id, { stock: product.stock + item.quantity });
    }
  }
  return { ok: true, sale: updatedSale };
}
