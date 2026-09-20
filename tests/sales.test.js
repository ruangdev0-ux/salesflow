import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canChangeStatus, changeSaleStatus, registerSale } from '../js/services/sales.js';
import { deleteClient, deleteProduct } from '../js/services/deletion.js';
import { createDbWithBasics, TODAY } from './helpers.js';

function newSaleInput(client, items, extra = {}) {
  return { clientId: client.id, date: TODAY, status: 'pending', items, ...extra };
}

test('registrar venda calcula o total, numera e desconta o estoque', () => {
  const { db, client, pen, cable } = createDbWithBasics();
  const result = registerSale(db, newSaleInput(client, [{ productId: pen.id, quantity: '2' }, { productId: cable.id, quantity: '1' }]), { today: TODAY });

  assert.equal(result.ok, true);
  assert.equal(result.sale.number, 1);
  assert.equal(result.sale.totalCents, 2 * 3990 + 2490);
  assert.equal(db.products.get(pen.id).stock, 8);
  assert.equal(db.products.get(cable.id).stock, 2);

  const second = registerSale(db, newSaleInput(client, [{ productId: pen.id, quantity: '1' }]), { today: TODAY });
  assert.equal(second.sale.number, 2);
});

test('venda inválida não altera estoque nem grava nada', () => {
  const { db, client, cable } = createDbWithBasics();
  const result = registerSale(db, newSaleInput(client, [{ productId: cable.id, quantity: '99' }]), { today: TODAY });

  assert.equal(result.ok, false);
  assert.ok(result.errors.lines[0]);
  assert.equal(db.sales.all().length, 0);
  assert.equal(db.products.get(cable.id).stock, 3);
});

test('o item guarda o preço da época da venda', () => {
  const { db, client, pen } = createDbWithBasics();
  const { sale } = registerSale(db, newSaleInput(client, [{ productId: pen.id, quantity: '1' }]), { today: TODAY });
  db.products.update(pen.id, { priceCents: 9999 });
  assert.equal(db.sales.get(sale.id).items[0].unitPriceCents, 3990);
});

test('transições de status permitidas', () => {
  assert.equal(canChangeStatus('pending', 'paid'), true);
  assert.equal(canChangeStatus('pending', 'cancelled'), true);
  assert.equal(canChangeStatus('paid', 'cancelled'), true);
  assert.equal(canChangeStatus('paid', 'pending'), false);
  assert.equal(canChangeStatus('cancelled', 'paid'), false);
});

test('cancelar uma venda devolve os produtos ao estoque', () => {
  const { db, client, pen } = createDbWithBasics();
  const { sale } = registerSale(db, newSaleInput(client, [{ productId: pen.id, quantity: '4' }]), { today: TODAY });
  assert.equal(db.products.get(pen.id).stock, 6);

  const result = changeSaleStatus(db, sale.id, 'cancelled');
  assert.equal(result.ok, true);
  assert.equal(db.products.get(pen.id).stock, 10);
  assert.equal(db.sales.get(sale.id).status, 'cancelled');
});

test('marcar como paga não mexe no estoque e status inválido é recusado', () => {
  const { db, client, pen } = createDbWithBasics();
  const { sale } = registerSale(db, newSaleInput(client, [{ productId: pen.id, quantity: '1' }]), { today: TODAY });

  assert.equal(changeSaleStatus(db, sale.id, 'paid').ok, true);
  assert.equal(db.products.get(pen.id).stock, 9);

  changeSaleStatus(db, sale.id, 'cancelled');
  const again = changeSaleStatus(db, sale.id, 'paid');
  assert.equal(again.ok, false);
});

test('não exclui cliente nem produto que já tem venda, mas exclui os sem vínculo', () => {
  const { db, client, pen, cable } = createDbWithBasics();
  registerSale(db, newSaleInput(client, [{ productId: pen.id, quantity: '1' }]), { today: TODAY });

  assert.equal(deleteClient(db, client.id).ok, false);
  assert.equal(deleteProduct(db, pen.id).ok, false);
  assert.equal(deleteProduct(db, cable.id).ok, true);
  assert.equal(db.products.get(cable.id), null);

  const other = db.clients.add({ name: 'Sem Vendas' });
  assert.equal(deleteClient(db, other.id).ok, true);
});
