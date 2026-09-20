/**
 * Ajudantes compartilhados pelos testes: um banco em memória, sem tocar no localStorage.
 */
import { createMemoryBackend, createStorage } from '../js/data/storage.js';
import { createDb } from '../js/data/db.js';

export const TODAY = '2026-06-15';

export function createTestDb() {
  return createDb(createStorage(createMemoryBackend()));
}

/** Banco com 1 cliente e 2 produtos, suficiente para testar vendas. */
export function createDbWithBasics() {
  const db = createTestDb();
  const client = db.clients.add({ name: 'Maria Teste', email: 'maria@example.com', phone: '', city: 'Franca' });
  const pen = db.products.add({ name: 'Pen Drive', category: 'Armazenamento', priceCents: 3990, stock: 10 });
  const cable = db.products.add({ name: 'Cabo HDMI', category: 'Cabos', priceCents: 2490, stock: 3 });
  return { db, client, pen, cable };
}
