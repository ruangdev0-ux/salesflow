/**
 * Dados de demonstração (todos fictícios).
 *
 * Servem para o sistema já abrir com informações e o dashboard ter o que mostrar.
 * As datas das vendas são calculadas a partir de "hoje" (ex.: "há 18 dias"),
 * então o gráfico dos últimos meses continua fazendo sentido em qualquer dia.
 *
 * O estoque final de cada produto = estoque inicial - unidades vendidas
 * (vendas canceladas não descontam), exatamente como o sistema faz ao registrar uma venda.
 */
import { SALE_STATUS } from '../services/constants.js';
import { addDaysISO, todayISO } from '../utils/format.js';

const { PAID, PENDING, CANCELLED } = SALE_STATUS;

const CLIENTS = [
  { name: 'Mariana Souza', email: 'mariana.souza@example.com', phone: '16999990001', city: 'Franca' },
  { name: 'Carlos Eduardo Lima', email: 'carlos.lima@example.com', phone: '16999990002', city: 'Franca' },
  { name: 'Studio Bela Forma', email: 'contato@belaforma.example.com', phone: '1633330003', city: 'Ribeirão Preto' },
  { name: 'Mercadinho Central', email: 'compras@mercadinhocentral.example.com', phone: '1633330004', city: 'Franca' },
  { name: 'Juliana Prado', email: 'juliana.prado@example.com', phone: '16999990005', city: 'Batatais' },
  { name: 'TechFix Assistência', email: 'suporte@techfix.example.com', phone: '16999990006', city: 'Franca' },
  { name: 'Rafael Andrade', email: 'rafael.andrade@example.com', phone: '16999990007', city: 'Ituverava' },
  { name: 'Escritório Alvorada', email: 'financeiro@alvorada.example.com', phone: '1633330008', city: 'Ribeirão Preto' },
];

// [nome, categoria, preço em centavos, estoque inicial]
const PRODUCTS = [
  ['Teclado Mecânico Compacto', 'Periféricos', 28990, 30],
  ['Mouse Sem Fio', 'Periféricos', 7990, 60],
  ['Headset USB com Microfone', 'Áudio', 14990, 25],
  ['Webcam Full HD', 'Periféricos', 19900, 6],
  ['Hub USB-C 6 em 1', 'Acessórios', 12990, 35],
  ['Suporte para Notebook', 'Acessórios', 8990, 40],
  ['Carregador Rápido 65 W', 'Acessórios', 11990, 9],
  ['Cabo HDMI 2 m', 'Cabos', 2490, 80],
  ['Pen Drive 64 GB', 'Armazenamento', 3990, 70],
  ['SSD Externo 500 GB', 'Armazenamento', 37900, 12],
  ['Mousepad Grande', 'Acessórios', 4990, 45],
  ['Caixa de Som Bluetooth', 'Áudio', 15990, 11],
];

// [há quantos dias, índice do cliente, status, [[índice do produto, quantidade], ...]]
const SALES = [
  [148, 0, PAID, [[0, 1], [1, 1]]],
  [141, 3, PAID, [[7, 4], [8, 5]]],
  [133, 5, PAID, [[9, 2]]],
  [126, 1, PAID, [[2, 1], [10, 1]]],
  [118, 6, CANCELLED, [[3, 2]]],
  [112, 2, PAID, [[4, 3], [5, 3]]],
  [104, 7, PAID, [[11, 2]]],
  [97, 0, PAID, [[6, 2], [7, 2]]],
  [90, 4, PAID, [[1, 5], [10, 5]]],
  [83, 3, PAID, [[0, 2]]],
  [75, 5, PAID, [[9, 3], [8, 6]]],
  [68, 1, PAID, [[11, 1], [2, 1]]],
  [60, 6, PAID, [[4, 2], [6, 2]]],
  [52, 2, PAID, [[5, 4], [10, 4]]],
  [45, 7, PAID, [[0, 1], [3, 1]]],
  [38, 0, PAID, [[9, 1], [7, 3]]],
  [31, 4, PAID, [[2, 2], [11, 2]]],
  [24, 3, PAID, [[1, 3], [8, 4]]],
  [18, 5, PENDING, [[9, 2]]],
  [14, 1, PAID, [[6, 3]]],
  [9, 6, PENDING, [[0, 1], [5, 2]]],
  [6, 2, PAID, [[11, 3], [1, 2]]],
  [3, 7, PENDING, [[4, 4]]],
  [1, 0, PAID, [[2, 2], [10, 3]]],
  [0, 3, PAID, [[7, 6]]],
];

/**
 * Monta os três conjuntos de dados (clientes, produtos, vendas).
 * @param {string} [today] data de referência AAAA-MM-DD (útil nos testes)
 */
export function buildDemoData(today = todayISO()) {
  const clients = CLIENTS.map((client, index) => ({ id: `demo-cli-${index + 1}`, ...client }));

  const products = PRODUCTS.map(([name, category, priceCents, stock], index) => ({
    id: `demo-prod-${index + 1}`,
    name,
    category,
    priceCents,
    stock,
  }));

  const sales = SALES.map(([daysAgo, clientIndex, status, lines], index) => {
    const items = lines.map(([productIndex, quantity]) => {
      const product = products[productIndex];
      // Vendas não canceladas descontam do estoque.
      if (status !== CANCELLED) product.stock -= quantity;
      return {
        productId: product.id,
        name: product.name,
        unitPriceCents: product.priceCents,
        quantity,
      };
    });

    return {
      id: `demo-sale-${index + 1}`,
      number: index + 1,
      clientId: clients[clientIndex].id,
      date: addDaysISO(today, -daysAgo),
      status,
      notes: '',
      items,
      totalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
    };
  });

  return { clients, products, sales };
}
