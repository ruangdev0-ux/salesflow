import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clientSummary,
  dashboardStats,
  filterClients,
  filterProducts,
  filterSales,
  revenueByMonth,
  topProducts,
} from '../js/services/queries.js';
import { buildDemoData } from '../js/data/seed.js';
import { TODAY } from './helpers.js';

const { clients, products, sales } = buildDemoData(TODAY);

test('busca de clientes ignora acentos e maiúsculas', () => {
  assert.ok(filterClients(clients, 'ribeirao').length >= 2);
  assert.equal(filterClients(clients, 'MARIANA')[0].name, 'Mariana Souza');
  assert.equal(filterClients(clients, 'zzzz').length, 0);
});

test('filtros de produtos: texto, categoria e estoque', () => {
  assert.ok(filterProducts(products, { text: 'ssd' }).every((p) => p.name.includes('SSD')));
  assert.ok(filterProducts(products, { category: 'Áudio' }).every((p) => p.category === 'Áudio'));
  const low = filterProducts(products, { stock: 'low' });
  assert.ok(low.length > 0 && low.every((p) => p.stock <= 5));
});

test('filtros de vendas: status, período e texto', () => {
  const paid = filterSales(sales, clients, { status: 'paid' });
  assert.ok(paid.length > 0 && paid.every((s) => s.status === 'paid'));

  const recent = filterSales(sales, clients, { from: '2026-06-01', to: TODAY });
  assert.ok(recent.every((s) => s.date >= '2026-06-01' && s.date <= TODAY));

  const byClient = filterSales(sales, clients, { text: 'mariana' });
  assert.ok(byClient.length > 0);

  const byNumber = filterSales(sales, clients, { text: '#0007' });
  assert.ok(byNumber.some((s) => s.number === 7));

  const sorted = filterSales(sales, clients);
  assert.ok(sorted.every((s, i) => i === 0 || sorted[i - 1].date >= s.date), 'deveria vir da mais recente para a mais antiga');
});

test('dashboard: faturamento soma só vendas pagas; pendentes vão para "a receber"', () => {
  const stats = dashboardStats({ clients, products, sales });
  const expectedRevenue = sales.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.totalCents, 0);
  const expectedPending = sales.filter((s) => s.status === 'pending').reduce((sum, s) => sum + s.totalCents, 0);

  assert.equal(stats.revenueCents, expectedRevenue);
  assert.equal(stats.pendingCents, expectedPending);
  assert.equal(stats.salesCount, sales.length);
  assert.equal(stats.clientsCount, clients.length);
  assert.equal(stats.productsCount, products.length);
  assert.equal(stats.byStatus.cancelled.count, sales.filter((s) => s.status === 'cancelled').length);
});

test('dashboard com dados vazios não quebra (ticket médio 0)', () => {
  const stats = dashboardStats({ clients: [], products: [], sales: [] });
  assert.equal(stats.revenueCents, 0);
  assert.equal(stats.averageTicketCents, 0);
});

test('faturamento por mês: 6 meses terminando no mês atual, só vendas pagas', () => {
  const months = revenueByMonth(
    [
      { date: '2026-06-10', status: 'paid', totalCents: 1000 },
      { date: '2026-06-11', status: 'pending', totalCents: 5000 },
      { date: '2026-01-31', status: 'paid', totalCents: 700 },
      { date: '2025-12-31', status: 'paid', totalCents: 999 }, // fora da janela
    ],
    TODAY,
    6,
  );
  assert.deepEqual(months.map((m) => m.key), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  assert.equal(months[5].totalCents, 1000);
  assert.equal(months[0].totalCents, 700);
  assert.equal(months[0].label, 'jan');
});

test('mais vendidos e resumo por cliente ignoram vendas canceladas', () => {
  const top = topProducts(sales, 3);
  assert.equal(top.length, 3);
  assert.ok(top[0].quantity >= top[1].quantity && top[1].quantity >= top[2].quantity);

  const cancelledOnly = [{ clientId: 'x', status: 'cancelled', totalCents: 100, items: [{ productId: 'p', name: 'P', quantity: 1, unitPriceCents: 100 }] }];
  assert.equal(topProducts(cancelledOnly).length, 0);
  assert.equal(clientSummary(cancelledOnly).size, 0);
});
