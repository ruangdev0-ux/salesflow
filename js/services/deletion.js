/**
 * Regras de exclusão.
 *
 * Um cliente ou produto que já aparece em alguma venda NÃO pode ser excluído,
 * senão o histórico de vendas ficaria apontando para algo que não existe mais
 * (é o que os bancos de dados chamam de "integridade referencial").
 *
 * As funções devolvem { ok, message } para a tela decidir o que mostrar.
 */

export function deleteClient(db, clientId) {
  const client = db.clients.get(clientId);
  if (!client) return { ok: false, message: 'Cliente não encontrado.' };

  const salesCount = db.sales.all().filter((sale) => sale.clientId === clientId).length;
  if (salesCount > 0) {
    return {
      ok: false,
      message: `Não é possível excluir "${client.name}": o cliente possui ${salesCount} venda(s) registrada(s).`,
    };
  }

  db.clients.remove(clientId);
  return { ok: true };
}

export function deleteProduct(db, productId) {
  const product = db.products.get(productId);
  if (!product) return { ok: false, message: 'Produto não encontrado.' };

  const salesCount = db.sales
    .all()
    .filter((sale) => sale.items.some((item) => item.productId === productId)).length;
  if (salesCount > 0) {
    return {
      ok: false,
      message: `Não é possível excluir "${product.name}": o produto aparece em ${salesCount} venda(s). Zere o estoque, se não quiser mais vendê-lo.`,
    };
  }

  db.products.remove(productId);
  return { ok: true };
}
