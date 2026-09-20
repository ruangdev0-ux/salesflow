/**
 * Tela de Produtos: lista com busca e filtros (categoria e estoque) + cadastro, edição e exclusão.
 * Segue o mesmo padrão da tela de Clientes.
 */
import { html } from '../utils/html.js';
import { emptyState, iconButton, pageHeader } from '../ui/components.js';
import { field } from '../ui/forms.js';
import { confirmDialog, openFormDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';
import { validateProduct } from '../services/validators.js';
import { deleteProduct } from '../services/deletion.js';
import { filterProducts, listCategories } from '../services/queries.js';
import { LOW_STOCK_THRESHOLD } from '../services/constants.js';
import { centsToInput, formatCurrency } from '../utils/format.js';

function stockBadge(stock) {
  if (stock === 0) return html`<span class="badge badge-out">Sem estoque</span>`;
  if (stock <= LOW_STOCK_THRESHOLD) return html`<span class="badge badge-low">Estoque baixo</span>`;
  return '';
}

export function mountProducts(container, { db, toast }) {
  const state = { text: '', category: '', stock: '' };

  container.innerHTML = html`
    ${pageHeader({
      title: 'Produtos',
      subtitle: 'Controle o catálogo, os preços e o estoque disponível.',
      actionLabel: 'Novo produto',
      actionName: 'new',
    })}
    <section class="card">
      <div class="toolbar">
        <div class="field field-grow">
          <label class="sr-only" for="product-search">Buscar produtos</label>
          <div class="input-icon">
            ${icon('search')}
            <input id="product-search" type="search" placeholder="Buscar por nome ou categoria" autocomplete="off">
          </div>
        </div>
        <div class="field">
          <label class="sr-only" for="product-category">Categoria</label>
          <select id="product-category" data-filter="category"></select>
        </div>
        <div class="field">
          <label class="sr-only" for="product-stock">Situação do estoque</label>
          <select id="product-stock" data-filter="stock">
            <option value="">Todo o estoque</option>
            <option value="low">Estoque baixo (até ${LOW_STOCK_THRESHOLD})</option>
            <option value="out">Sem estoque</option>
          </select>
        </div>
      </div>
      <div data-list></div>
    </section>`.toString();

  const listEl = container.querySelector('[data-list]');
  const categorySelect = container.querySelector('#product-category');

  /** As opções de categoria dependem dos produtos cadastrados, então são recriadas. */
  function renderCategoryOptions() {
    const categories = listCategories(db.products.all());
    if (state.category && !categories.includes(state.category)) state.category = '';
    categorySelect.innerHTML = html`
      <option value="">Todas as categorias</option>
      ${categories.map((c) => html`<option value="${c}"${c === state.category ? ' selected' : ''}>${c}</option>`)}`.toString();
  }

  function renderList() {
    const allProducts = db.products.all();
    const products = filterProducts(allProducts, state);

    if (allProducts.length === 0) {
      listEl.innerHTML = emptyState({
        title: 'Nenhum produto cadastrado',
        text: 'Clique em "Novo produto" para cadastrar o primeiro.',
      }).toString();
      return;
    }
    if (products.length === 0) {
      listEl.innerHTML = emptyState({
        title: 'Nenhum produto encontrado',
        text: 'Ajuste a busca ou os filtros para ver mais resultados.',
      }).toString();
      return;
    }

    listEl.innerHTML = html`
      <p class="result-count">${products.length} de ${allProducts.length} produto(s)</p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Produto</th><th>Categoria</th><th class="num">Preço</th><th class="num">Estoque</th><th class="actions-col"><span class="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            ${products.map(
              (product) => html`
                <tr>
                  <td data-label="Produto"><strong>${product.name}</strong></td>
                  <td data-label="Categoria">${product.category}</td>
                  <td data-label="Preço" class="num">${formatCurrency(product.priceCents)}</td>
                  <td data-label="Estoque" class="num"><div>${product.stock} ${stockBadge(product.stock)}</div></td>
                  <td class="actions-col">
                    ${iconButton({ action: 'edit', id: product.id, label: `Editar ${product.name}`, iconName: 'edit' })}
                    ${iconButton({ action: 'delete', id: product.id, label: `Excluir ${product.name}`, iconName: 'trash', danger: true })}
                  </td>
                </tr>`,
            )}
          </tbody>
        </table>
      </div>`.toString();
  }

  function openProductForm(product = null) {
    const categories = listCategories(db.products.all());
    openFormDialog({
      title: product ? 'Editar produto' : 'Novo produto',
      submitLabel: product ? 'Salvar alterações' : 'Cadastrar produto',
      body: html`
        ${field({ label: 'Nome', name: 'name', value: product?.name, required: true, extra: { maxlength: 80, autocomplete: 'off' } })}
        <div class="field">
          <label for="f-category">Categoria<span class="req" aria-hidden="true"> *</span></label>
          <input id="f-category" name="category" type="text" list="category-options" value="${product?.category ?? ''}" maxlength="40" autocomplete="off" aria-describedby="err-category">
          <datalist id="category-options">${categories.map((c) => html`<option value="${c}"></option>`)}</datalist>
          <p class="field-hint">Escolha uma categoria existente ou digite uma nova.</p>
          <p class="field-error" id="err-category" data-error-for="category" hidden></p>
        </div>
        <div class="field-row">
          ${field({ label: 'Preço (R$)', name: 'price', value: product ? centsToInput(product.priceCents) : '', required: true, extra: { inputmode: 'decimal', placeholder: '0,00' } })}
          ${field({ label: 'Estoque (unidades)', name: 'stock', type: 'number', value: product?.stock ?? '', required: true, extra: { min: 0, step: 1, inputmode: 'numeric' } })}
        </div>`,
      onSubmit(formData) {
        const result = validateProduct(Object.fromEntries(formData), {
          existing: db.products.all(),
          currentId: product?.id,
        });
        if (!result.ok) return { ok: false, errors: result.errors };

        if (product) db.products.update(product.id, result.values);
        else db.products.add(result.values);

        toast.success(product ? 'Produto atualizado.' : 'Produto cadastrado.');
        renderCategoryOptions();
        renderList();
        return { ok: true };
      },
    });
  }

  async function removeProduct(id) {
    const product = db.products.get(id);
    if (!product) return;
    const confirmed = await confirmDialog({
      title: 'Excluir produto',
      message: `Tem certeza de que deseja excluir "${product.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) return;

    try {
      const result = deleteProduct(db, id);
      if (result.ok) toast.success('Produto excluído.');
      else toast.error(result.message);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Não foi possível excluir o produto.');
    }
    renderCategoryOptions();
    renderList();
  }

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'new') openProductForm();
    if (action === 'edit') openProductForm(db.products.get(id));
    if (action === 'delete') removeProduct(id);
  });

  container.querySelector('#product-search').addEventListener('input', (event) => {
    state.text = event.target.value;
    renderList();
  });
  container.addEventListener('change', (event) => {
    const filter = event.target.dataset?.filter;
    if (!filter) return;
    state[filter] = event.target.value;
    renderList();
  });

  renderCategoryOptions();
  renderList();
}
