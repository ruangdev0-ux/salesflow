import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateClient, validateProduct, validateSale } from '../js/services/validators.js';
import { TODAY } from './helpers.js';

test('cliente: nome é obrigatório e e-mail precisa ser válido', () => {
  const result = validateClient({ name: '  ', email: 'sem-arroba', phone: '', city: '' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.email);
});

test('cliente válido: limpa espaços e guarda só os dígitos do telefone', () => {
  const result = validateClient({ name: '  Ana   Paula ', email: 'ANA@Example.com', phone: '(16) 99999-0001', city: 'Franca' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.values, { name: 'Ana Paula', email: 'ana@example.com', phone: '16999990001', city: 'Franca' });
});

test('cliente: e-mail duplicado é recusado, mas o próprio cliente pode manter o seu', () => {
  const existing = [{ id: '1', name: 'Ana', email: 'ana@example.com' }];
  assert.ok(validateClient({ name: 'Outra Ana', email: 'ana@example.com' }, { existing }).errors.email);
  assert.equal(validateClient({ name: 'Ana', email: 'ana@example.com' }, { existing, currentId: '1' }).ok, true);
});

test('cliente: telefone com poucos dígitos é inválido', () => {
  assert.ok(validateClient({ name: 'Ana', phone: '12345' }).errors.phone);
});

test('produto: converte preço para centavos e valida estoque', () => {
  const ok = validateProduct({ name: 'Mouse', category: 'Periféricos', price: '79,90', stock: '12' });
  assert.equal(ok.ok, true);
  assert.equal(ok.values.priceCents, 7990);
  assert.equal(ok.values.stock, 12);

  const bad = validateProduct({ name: '', category: '', price: '0', stock: '-1' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.name && bad.errors.category && bad.errors.price && bad.errors.stock);
});

test('produto: estoque decimal ou vazio é inválido, zero é permitido', () => {
  assert.ok(validateProduct({ name: 'X1', category: 'Cat', price: '1', stock: '1,5' }).errors.stock);
  assert.ok(validateProduct({ name: 'X1', category: 'Cat', price: '1', stock: '' }).errors.stock);
  assert.equal(validateProduct({ name: 'X1', category: 'Cat', price: '1', stock: '0' }).ok, true);
});

test('produto: nome repetido (ignorando maiúsculas e acentos) é recusado', () => {
  const existing = [{ id: '1', name: 'Câmera' }];
  assert.ok(validateProduct({ name: 'camera', category: 'A1', price: '1', stock: '1' }, { existing }).errors.name);
});

const clients = [{ id: 'c1' }];
const products = [
  { id: 'p1', name: 'Pen Drive', stock: 5 },
  { id: 'p2', name: 'Cabo', stock: 0 },
];
const baseSale = { clientId: 'c1', date: TODAY, status: 'pending', items: [{ productId: 'p1', quantity: '2' }] };

test('venda válida passa e converte a quantidade para número', () => {
  const result = validateSale(baseSale, { clients, products, today: TODAY });
  assert.equal(result.ok, true);
  assert.equal(result.values.items[0].quantity, 2);
});

test('venda: exige cliente, itens e não aceita data futura', () => {
  const result = validateSale({ ...baseSale, clientId: '', date: '2026-06-16', items: [] }, { clients, products, today: TODAY });
  assert.ok(result.errors.clientId);
  assert.ok(result.errors.date);
  assert.ok(result.errors.items);
});

test('venda: bloqueia quantidade acima do estoque, produto sem estoque e produto repetido', () => {
  const result = validateSale(
    {
      ...baseSale,
      items: [
        { productId: 'p1', quantity: '6' }, // estoque é 5
        { productId: 'p2', quantity: '1' }, // sem estoque
        { productId: 'p1', quantity: '1' }, // repetido
        { productId: '', quantity: '1' }, // sem produto
      ],
    },
    { clients, products, today: TODAY },
  );
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors.lines), ['0', '1', '2', '3']);
});

test('venda: quantidade zero, negativa ou decimal é inválida', () => {
  for (const quantity of ['0', '-1', '1.5', '', 'abc']) {
    const result = validateSale({ ...baseSale, items: [{ productId: 'p1', quantity }] }, { clients, products, today: TODAY });
    assert.ok(result.errors.lines?.[0], `quantidade ${JSON.stringify(quantity)} deveria falhar`);
  }
});
