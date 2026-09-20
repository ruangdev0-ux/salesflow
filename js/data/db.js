/**
 * "Banco de dados" do app: junta os três repositórios num só objeto.
 *
 *   db.clients  -> clientes
 *   db.products -> produtos
 *   db.sales    -> vendas
 *
 * As chaves têm o prefixo "salesflow.v1." O "v1" indica a versão do formato dos
 * dados: se um dia o formato mudar, uma versão "v2" evita misturar dados antigos.
 */
import { createRepository } from './repository.js';
import { buildDemoData } from './seed.js';

const KEYS = {
  clients: 'salesflow.v1.clients',
  products: 'salesflow.v1.products',
  sales: 'salesflow.v1.sales',
  seeded: 'salesflow.v1.seeded', // marca que os dados de demonstração já foram carregados
};

export function createDb(storage) {
  return {
    storage,
    clients: createRepository(storage, KEYS.clients),
    products: createRepository(storage, KEYS.products),
    sales: createRepository(storage, KEYS.sales),
  };
}

function loadDemo(db, today) {
  const data = buildDemoData(today);
  db.clients.replaceAll(data.clients);
  db.products.replaceAll(data.products);
  db.sales.replaceAll(data.sales);
  db.storage.write(KEYS.seeded, true);
}

/**
 * Na primeira visita (nada salvo ainda) carrega os dados de demonstração.
 * A marca "seeded" impede que eles voltem sozinhos se o usuário apagar tudo depois.
 */
export function ensureDemoData(db, today) {
  const alreadySeeded = db.storage.read(KEYS.seeded, false) === true;
  const hasData = db.clients.all().length + db.products.all().length + db.sales.all().length > 0;
  if (alreadySeeded || hasData) return false;
  loadDemo(db, today);
  return true;
}

/** Substitui tudo pelos dados de demonstração (botão "Restaurar demonstração"). */
export function resetToDemoData(db, today) {
  loadDemo(db, today);
}

/** Apaga todos os registros (botão "Apagar todos os dados"). */
export function clearAllData(db) {
  db.clients.replaceAll([]);
  db.products.replaceAll([]);
  db.sales.replaceAll([]);
  db.storage.write(KEYS.seeded, true);
}
