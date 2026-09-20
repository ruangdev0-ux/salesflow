import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryBackend, createStorage, StorageError } from '../js/data/storage.js';
import { createRepository } from '../js/data/repository.js';
import { clearAllData, createDb, ensureDemoData, resetToDemoData } from '../js/data/db.js';
import { buildDemoData } from '../js/data/seed.js';
import { calcTotalCents } from '../js/services/sales.js';
import { LOW_STOCK_THRESHOLD } from '../js/services/constants.js';
import { TODAY } from './helpers.js';

test('storage grava e lê JSON', () => {
  const storage = createStorage(createMemoryBackend());
  storage.write('k', { a: 1 });
  assert.deepEqual(storage.read('k', null), { a: 1 });
  assert.equal(storage.read('inexistente', 'padrao'), 'padrao');
});

test('storage com JSON corrompido devolve o valor padrão e guarda uma cópia', () => {
  const backend = createMemoryBackend();
  backend.setItem('k', '{quebrado');
  const storage = createStorage(backend);
  const originalError = console.error;
  console.error = () => {}; // silencia o aviso esperado
  try {
    assert.deepEqual(storage.read('k', []), []);
  } finally {
    console.error = originalError;
  }
  assert.equal(backend.getItem('k.corrompido'), '{quebrado');
});

test('storage lança StorageError quando o navegador recusa gravar (ex.: cheio)', () => {
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
  const storage = createStorage(full);
  assert.throws(() => storage.write('k', 1), StorageError);
});

test('repositório: adicionar, buscar, atualizar e remover', () => {
  const repo = createRepository(createStorage(createMemoryBackend()), 'items');
  const item = repo.add({ name: 'A' });
  assert.ok(item.id);
  assert.equal(repo.get(item.id).name, 'A');
  repo.update(item.id, { name: 'B' });
  assert.equal(repo.get(item.id).name, 'B');
  repo.remove(item.id);
  assert.equal(repo.all().length, 0);
  assert.throws(() => repo.update('nao-existe', {}), /não encontrado/);
});

test('repositório: os dados sobrevivem a "recarregar a página" (novo repositório, mesmo storage)', () => {
  const storage = createStorage(createMemoryBackend());
  createRepository(storage, 'items').add({ name: 'Persistido' });
  const reloaded = createRepository(storage, 'items');
  assert.equal(reloaded.all()[0].name, 'Persistido');
});

test('repositório: se a gravação falha, a memória não muda', () => {
  let failing = false;
  const backend = createMemoryBackend();
  const original = backend.setItem;
  backend.setItem = (key, value) => {
    if (failing) throw new Error('cheio');
    return original(key, value);
  };
  const repo = createRepository(createStorage(backend), 'items');
  repo.add({ name: 'A' });
  failing = true;
  assert.throws(() => repo.add({ name: 'B' }), StorageError);
  assert.equal(repo.all().length, 1);
});

test('dados de demonstração: coerentes (totais, estoque não negativo, estoque baixo presente)', () => {
  const { clients, products, sales } = buildDemoData(TODAY);
  assert.ok(clients.length >= 5 && products.length >= 8 && sales.length >= 15);
  assert.ok(products.every((p) => p.stock >= 0), 'estoque negativo no seed');
  assert.ok(products.some((p) => p.stock <= LOW_STOCK_THRESHOLD), 'deveria haver produto com estoque baixo');
  assert.ok(sales.every((s) => s.totalCents === calcTotalCents(s.items)));
  assert.ok(sales.every((s) => clients.some((c) => c.id === s.clientId)));
  assert.ok(sales.every((s) => s.items.every((i) => products.some((p) => p.id === i.productId))));
  assert.ok(sales.every((s) => s.date <= TODAY));
  assert.equal(new Set(sales.map((s) => s.number)).size, sales.length, 'números de venda repetidos');
  const statuses = new Set(sales.map((s) => s.status));
  assert.deepEqual([...statuses].sort(), ['cancelled', 'paid', 'pending']);
});

test('ensureDemoData carrega só na primeira vez; apagar tudo não recarrega a demonstração', () => {
  const storage = createStorage(createMemoryBackend());
  const db = createDb(storage);
  assert.equal(ensureDemoData(db, TODAY), true);
  assert.ok(db.sales.all().length > 0);

  clearAllData(db);
  assert.equal(db.clients.all().length, 0);
  assert.equal(ensureDemoData(createDb(storage), TODAY), false); // "recarregou a página"
  assert.equal(createDb(storage).clients.all().length, 0);

  resetToDemoData(db, TODAY);
  assert.ok(db.clients.all().length > 0);
});
