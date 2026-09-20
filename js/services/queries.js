/**
 * Consultas: busca, filtros e cálculos usados nas listas e no dashboard.
 *
 * Todas são funções puras: recebem listas e devolvem novas listas/números,
 * sem alterar os dados originais. Por isso o teste é simples (entrada -> saída).
 */
import { LOW_STOCK_THRESHOLD, SALE_STATUS } from './constants.js';
import { formatSaleNumber, normalizeText } from '../utils/format.js';

const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');

/** Clientes cujo nome, e-mail, telefone ou cidade contém o texto buscado. */
export function filterClients(clients, text = '') {
  const query = normalizeText(text);
  return clients
    .filter((c) => !query || normalizeText(`${c.name} ${c.email} ${c.phone} ${c.city}`).includes(query))
    .sort(byName);
}

/**
 * Produtos filtrados por texto (nome/categoria), categoria exata e situação do estoque:
 * stock = 'low' (estoque baixo, inclui zerado) ou 'out' (zerado).
 */
export function filterProducts(products, { text = '', category = '', stock = '' } = {}) {
  const query = normalizeText(text);
  return products
    .filter((p) => !query || normalizeText(`${p.name} ${p.category}`).includes(query))
    .filter((p) => !category || p.category === category)
    .filter((p) => {
      if (stock === 'low') return p.stock <= LOW_STOCK_THRESHOLD;
      if (stock === 'out') return p.stock === 0;
      return true;
    })
    .sort(byName);
}

/** Categorias distintas dos produtos, em ordem alfabética. */
export function listCategories(products) {
  return [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Vendas filtradas por:
 *  - text: número (#0007 ou 7), nome do cliente ou nome de algum produto vendido;
 *  - status; from/to: período (AAAA-MM-DD, inclusivo).
 * Ordem: da mais recente para a mais antiga.
 */
export function filterSales(sales, clients, { text = '', status = '', from = '', to = '' } = {}) {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const query = normalizeText(text);

  return sales
    .filter((sale) => {
      if (status && sale.status !== status) return false;
      if (from && sale.date < from) return false;
      if (to && sale.date > to) return false;
      if (!query) return true;
      const haystack = normalizeText(
        [
          formatSaleNumber(sale.number),
          sale.number,
          clientById.get(sale.clientId)?.name,
          ...sale.items.map((item) => item.name),
        ].join(' '),
      );
      return haystack.includes(query);
    })
    .sort((a, b) => (a.date === b.date ? b.number - a.number : b.date.localeCompare(a.date)));
}

/** Soma dos totais (em centavos) das vendas informadas. */
export function sumTotals(sales) {
  return sales.reduce((sum, sale) => sum + sale.totalCents, 0);
}

/**
 * Números do dashboard.
 *  - faturamento: soma só das vendas PAGAS;
 *  - a receber: soma das vendas PENDENTES;
 *  - vendas canceladas não entram em valores.
 */
export function dashboardStats({ clients, products, sales }) {
  const byStatus = {};
  for (const status of Object.values(SALE_STATUS)) {
    const group = sales.filter((sale) => sale.status === status);
    byStatus[status] = { count: group.length, totalCents: sumTotals(group) };
  }

  const paid = byStatus[SALE_STATUS.PAID];
  return {
    revenueCents: paid.totalCents,
    pendingCents: byStatus[SALE_STATUS.PENDING].totalCents,
    averageTicketCents: paid.count ? Math.round(paid.totalCents / paid.count) : 0,
    salesCount: sales.length,
    clientsCount: clients.length,
    productsCount: products.length,
    lowStockCount: products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length,
    byStatus,
  };
}

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Faturamento (vendas pagas) dos últimos `months` meses, incluindo o mês atual.
 * Retorna [{ key: '2026-09', label: 'set', totalCents }] do mais antigo ao mais recente.
 */
export function revenueByMonth(sales, today, months = 6) {
  const [year, month] = today.split('-').map(Number);
  const result = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(year, month - 1 - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    result.push({ key, label: MONTH_NAMES[date.getMonth()], totalCents: 0 });
  }

  for (const sale of sales) {
    if (sale.status !== SALE_STATUS.PAID) continue;
    const entry = result.find((item) => item.key === sale.date.slice(0, 7));
    if (entry) entry.totalCents += sale.totalCents;
  }
  return result;
}

/** Produtos mais vendidos (por quantidade), ignorando vendas canceladas. */
export function topProducts(sales, limit = 5) {
  const totals = new Map();
  for (const sale of sales) {
    if (sale.status === SALE_STATUS.CANCELLED) continue;
    for (const item of sale.items) {
      const entry = totals.get(item.productId) ?? { productId: item.productId, name: item.name, quantity: 0, totalCents: 0 };
      entry.quantity += item.quantity;
      entry.totalCents += item.quantity * item.unitPriceCents;
      totals.set(item.productId, entry);
    }
  }
  return [...totals.values()].sort((a, b) => b.quantity - a.quantity || b.totalCents - a.totalCents).slice(0, limit);
}

/** Quantas compras (não canceladas) e quanto cada cliente já comprou: Map(clientId -> resumo). */
export function clientSummary(sales) {
  const summary = new Map();
  for (const sale of sales) {
    if (sale.status === SALE_STATUS.CANCELLED) continue;
    const entry = summary.get(sale.clientId) ?? { count: 0, totalCents: 0 };
    entry.count += 1;
    entry.totalCents += sale.totalCents;
    summary.set(sale.clientId, entry);
  }
  return summary;
}
