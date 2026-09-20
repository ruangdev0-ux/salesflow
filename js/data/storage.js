/**
 * Camada de armazenamento.
 *
 * O SalesFlow não tem servidor: os dados ficam no `localStorage` do navegador
 * de quem usa o sistema. O localStorage guarda apenas TEXTO (chave -> texto),
 * então convertemos os dados para JSON ao salvar e de volta ao ler.
 *
 * Este módulo isola essa parte. O resto do app nunca chama `localStorage`
 * diretamente, o que traz duas vantagens:
 *  1. Tratamento de erros em um só lugar (armazenamento cheio, bloqueado, JSON quebrado).
 *  2. Facilidade para testar: nos testes trocamos o localStorage por um objeto em memória.
 */

/** Erro próprio do armazenamento, com mensagem pronta para mostrar ao usuário. */
export class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

/** Armazenamento em memória com a mesma interface do localStorage. */
export function createMemoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

/**
 * Tenta usar o localStorage. Em alguns casos (modo privado antigo, cookies
 * bloqueados) só acessar `window.localStorage` já lança erro, por isso o try/catch.
 * Retorna null se não estiver disponível.
 */
function getBrowserLocalStorage() {
  try {
    const storage = globalThis.localStorage;
    const probe = '__salesflow_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Cria o objeto de armazenamento usado pelo app.
 * @param {object} [backend] algo com getItem/setItem/removeItem. Por padrão, o localStorage.
 */
export function createStorage(backend) {
  const browserStorage = backend ?? getBrowserLocalStorage();
  // Se não há localStorage, o app continua funcionando, mas só até fechar a aba.
  const persistent = Boolean(browserStorage);
  const store = browserStorage ?? createMemoryBackend();

  return {
    /** false quando os dados só existem em memória (não sobrevivem ao recarregar). */
    persistent,

    /** Lê e converte o JSON. Se estiver corrompido, guarda uma cópia e devolve `fallback`. */
    read(key, fallback) {
      const text = store.getItem(key);
      if (text === null) return fallback;
      try {
        return JSON.parse(text);
      } catch (error) {
        console.error(`[storage] Dados corrompidos em "${key}". Uma cópia foi mantida.`, error);
        try {
          store.setItem(`${key}.corrompido`, text);
        } catch {
          /* sem espaço para a cópia: seguimos sem ela */
        }
        return fallback;
      }
    },

    /** Converte para JSON e grava. Lança StorageError se não for possível gravar. */
    write(key, value) {
      try {
        store.setItem(key, JSON.stringify(value));
      } catch (error) {
        throw new StorageError(
          'Não foi possível salvar os dados: o armazenamento do navegador está cheio ou bloqueado.',
          error,
        );
      }
    },

    remove(key) {
      store.removeItem(key);
    },
  };
}
