/**
 * Ponto de entrada do app: monta as peças e inicia a navegação.
 *
 *   storage (localStorage) -> db (clientes, produtos, vendas) -> telas
 */
import { createStorage } from './data/storage.js';
import { createDb, ensureDemoData } from './data/db.js';
import { createToaster } from './ui/toast.js';
import { startRouter } from './router.js';
import { todayISO } from './utils/format.js';

const storage = createStorage();
const db = createDb(storage);
const toast = createToaster(document.getElementById('toasts'));

// Objeto compartilhado com todas as telas. `refresh` é preenchido logo abaixo.
const ctx = { db, toast, refresh: () => {} };

try {
  ensureDemoData(db, todayISO()); // só carrega os dados de exemplo na primeira visita
} catch (error) {
  console.error(error);
  toast.error(error.message || 'Não foi possível carregar os dados iniciais.');
}

const router = startRouter({
  outlet: document.getElementById('main'),
  nav: document.getElementById('nav'),
  ctx,
});
ctx.refresh = router.refresh;

if (!storage.persistent) {
  document.getElementById('storage-warning').hidden = false;
}

// Rede de segurança: qualquer erro não tratado vira um aviso em vez de falha silenciosa.
window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
  toast.error('Ocorreu um erro inesperado. Tente novamente.');
});
