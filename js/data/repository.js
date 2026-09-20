/**
 * Repositório: um "CRUD" genérico para uma coleção (clientes, produtos ou vendas).
 *
 * CRUD = Create, Read, Update, Delete (criar, ler, atualizar, excluir).
 * O mesmo código atende as três coleções; só muda a chave usada no armazenamento.
 *
 * A lista fica em memória (`items`) para leituras rápidas e é gravada no
 * storage a cada alteração. Regra importante: primeiro GRAVAMOS, depois
 * atualizamos a memória. Se a gravação falhar, a memória continua igual
 * ao que está salvo e nada fica inconsistente.
 */

/** Gera um identificador único para cada registro novo. */
export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Alternativa simples para navegadores sem randomUUID.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRepository(storage, key) {
  const saved = storage.read(key, []);
  let items = Array.isArray(saved) ? saved : [];

  function commit(nextItems) {
    storage.write(key, nextItems); // pode lançar StorageError
    items = nextItems;
  }

  return {
    /** Devolve uma cópia da lista (quem chama não altera a lista original sem querer). */
    all() {
      return [...items];
    },

    get(id) {
      return items.find((item) => item.id === id) ?? null;
    },

    /** Cria um registro novo (gerando o id) e devolve o registro salvo. */
    add(data) {
      const item = { ...data, id: data.id ?? newId() };
      commit([...items, item]);
      return item;
    },

    /** Atualiza só os campos informados em `changes`. */
    update(id, changes) {
      const current = items.find((item) => item.id === id);
      if (!current) throw new Error('Registro não encontrado.');
      const updated = { ...current, ...changes, id };
      commit(items.map((item) => (item.id === id ? updated : item)));
      return updated;
    },

    remove(id) {
      if (!items.some((item) => item.id === id)) throw new Error('Registro não encontrado.');
      commit(items.filter((item) => item.id !== id));
    },

    /** Troca a coleção inteira (usado ao carregar/restaurar os dados de demonstração). */
    replaceAll(list) {
      commit([...list]);
    },
  };
}
