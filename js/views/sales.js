/**
 * Tela de Vendas: histórico com busca e filtros, registro de nova venda
 * e detalhes com mudança de status.
 */
import { html } from '../utils/html.js';
import { emptyState, iconButton, pageHeader, statusBadge } from '../ui/components.js';
import { field, selectField } from '../ui/forms.js';
import { confirmDialog, openFormDialog, openInfoDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';
import { changeSaleStatus, registerSale } from '../services/sales.js';
import { filterSales, sumTotals } from '../services/queries.js';
import { ALLOWED_TRANSITIONS, SALE_STATUS, STATUS_LABEL } from '../services/constants.js';
import { formatCurrency, formatDate, formatSaleNumber, todayISO } from '../utils/format.js';

const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');

export function mountSales(container, { db, toast }) {
  const state = { text: '', status: '', from: '', to: '' };

  container.innerHTML = html`
    ${pageHeader({
      title: 'Vendas',
      subtitle: 'Registre vendas e acompanhe o histórico e o status de cada uma.',
      actionLabel: 'Nova venda',
      actionName: 'new',
    })}
    <section class="card">
      <div class="toolbar toolbar-wrap">
        <div class="field field-grow">
          <label class="sr-only" for="sale-search">Buscar vendas</label>
          <div class="input-icon">
            ${icon('search')}
            <input id="sale-search" type="search" placeholder="Buscar cliente, produto ou nº" autocomplete="off">
          </div>
        </div>
        <div class="field field-full">
          <label class="sr-only" for="sale-status">Status</label>
          <select id="sale-status" data-filter="status">
            <option value="">Todos os status</option>
            ${Object.values(SALE_STATUS).map((status) => html`<option value="${status}">${STATUS_LABEL[status]}</option>`)}
          </select>
        </div>
        <div class="field field-date">
          <label for="sale-from">De</label>
          <input id="sale-from" type="date" data-filter="from">
        </div>
        <div class="field field-date">
          <label for="sale-to">Até</label>
          <input id="sale-to" type="date" data-filter="to">
        </div>
        <button type="button" class="btn btn-secondary" data-action="clear-filters">Limpar filtros</button>
      </div>
      <div data-list></div>
    </section>`.toString();

  const listEl = container.querySelector('[data-list]');

  function clientName(clientId) {
    return db.clients.get(clientId)?.name ?? 'Cliente removido';
  }

  function renderList() {
    const allSales = db.sales.all();
    const sales = filterSales(allSales, db.clients.all(), state);

    if (allSales.length === 0) {
      listEl.innerHTML = emptyState({
        title: 'Nenhuma venda registrada',
        text: 'Clique em "Nova venda" para registrar a primeira.',
      }).toString();
      return;
    }
    if (sales.length === 0) {
      listEl.innerHTML = emptyState({
        title: 'Nenhuma venda encontrada',
        text: 'Ajuste a busca, o status ou o período para ver mais resultados.',
      }).toString();
      return;
    }

    const validTotal = sumTotals(sales.filter((sale) => sale.status !== SALE_STATUS.CANCELLED));

    listEl.innerHTML = html`
      <p class="result-count">
        ${sales.length} de ${allSales.length} venda(s) · Total listado (sem canceladas): <strong>${formatCurrency(validTotal)}</strong>
      </p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Nº</th><th>Data</th><th>Cliente</th><th class="num">Itens</th><th class="num">Total</th><th>Status</th><th class="actions-col"><span class="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            ${sales.map(
              (sale) => html`
                <tr>
                  <td data-label="Nº"><strong>${formatSaleNumber(sale.number)}</strong></td>
                  <td data-label="Data">${formatDate(sale.date)}</td>
                  <td data-label="Cliente">${clientName(sale.clientId)}</td>
                  <td data-label="Itens" class="num">${sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td data-label="Total" class="num">${formatCurrency(sale.totalCents)}</td>
                  <td data-label="Status">${statusBadge(sale.status)}</td>
                  <td class="actions-col">${iconButton({ action: 'details', id: sale.id, label: `Ver detalhes da venda ${formatSaleNumber(sale.number)}`, iconName: 'eye' })}</td>
                </tr>`,
            )}
          </tbody>
        </table>
      </div>`.toString();
  }

  // ---------- Nova venda ----------

  function productOptions(products) {
    return products.map((product) => ({
      value: product.id,
      label: product.stock === 0
        ? `${product.name} — sem estoque`
        : `${product.name} — ${formatCurrency(product.priceCents)} · ${product.stock} un.`,
      disabled: product.stock === 0,
    }));
  }

  function lineTemplate(products) {
    return html`
      <div class="sale-line" data-line>
        <div class="field">
          <select name="productId" aria-label="Produto">
            <option value="">Selecione um produto</option>
            ${productOptions(products).map(
              (o) => html`<option value="${o.value}"${o.disabled ? ' disabled' : ''}>${o.label}</option>`,
            )}
          </select>
        </div>
        <div class="field field-qty">
          <input name="quantity" type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="Quantidade">
        </div>
        <output class="line-subtotal" data-subtotal>R$ 0,00</output>
        <button type="button" class="btn btn-ghost btn-icon btn-danger-text" data-remove-line aria-label="Remover item">${icon('trash', 16)}</button>
        <p class="field-error line-error" data-line-error hidden></p>
      </div>`;
  }

  /** Mostra a mensagem de erro embaixo da linha de item correspondente. */
  function showLineErrors(form, lines = {}) {
    const rows = form.querySelectorAll('[data-line]');
    for (const [index, message] of Object.entries(lines)) {
      const row = rows[Number(index)];
      if (!row) continue;
      const messageEl = row.querySelector('[data-line-error]');
      messageEl.textContent = message;
      messageEl.hidden = false;
      row.querySelector('select').setAttribute('aria-invalid', 'true');
    }
  }

  function openSaleForm() {
    const clients = db.clients.all().sort(byName);
    const products = db.products.all().sort(byName);

    if (clients.length === 0 || !products.some((p) => p.stock > 0)) {
      toast.error('Para registrar uma venda, cadastre pelo menos um cliente e tenha um produto com estoque.');
      return;
    }

    const today = todayISO();

    openFormDialog({
      title: 'Nova venda',
      submitLabel: 'Registrar venda',
      size: 'lg',
      body: html`
        ${selectField({
          label: 'Cliente',
          name: 'clientId',
          required: true,
          placeholder: 'Selecione o cliente',
          options: clients.map((c) => ({ value: c.id, label: c.name })),
        })}
        <div class="field-row">
          ${field({ label: 'Data da venda', name: 'date', type: 'date', value: today, required: true, extra: { max: today } })}
          ${selectField({
            label: 'Status inicial',
            name: 'status',
            value: SALE_STATUS.PENDING,
            options: [SALE_STATUS.PENDING, SALE_STATUS.PAID].map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          })}
        </div>

        <fieldset class="lines">
          <legend>Itens da venda <span class="req" aria-hidden="true">*</span></legend>
          <div data-lines></div>
          <p class="field-error" id="err-items" data-error-for="items" hidden></p>
          <button type="button" class="btn btn-secondary btn-sm" data-add-line>${icon('plus', 16)} Adicionar item</button>
        </fieldset>

        <div class="field">
          <label for="f-notes">Observações (opcional)</label>
          <textarea id="f-notes" name="notes" rows="2" maxlength="200" aria-describedby="err-notes"></textarea>
          <p class="field-error" id="err-notes" data-error-for="notes" hidden></p>
        </div>

        <div class="sale-total">Total da venda <strong data-total>R$ 0,00</strong></div>`,

      onOpen(form) {
        const linesEl = form.querySelector('[data-lines]');
        const totalEl = form.querySelector('[data-total]');

        /** Recalcula o subtotal de cada linha e o total geral da venda. */
        function recalculate() {
          let total = 0;
          linesEl.querySelectorAll('[data-line]').forEach((row) => {
            const product = db.products.get(row.querySelector('select').value);
            const quantity = Number(row.querySelector('input').value);
            const subtotal = product && Number.isInteger(quantity) && quantity > 0 ? product.priceCents * quantity : 0;
            row.querySelector('[data-subtotal]').textContent = formatCurrency(subtotal);
            total += subtotal;
          });
          totalEl.textContent = formatCurrency(total);
          // Sempre deve sobrar pelo menos uma linha.
          const onlyOne = linesEl.querySelectorAll('[data-line]').length === 1;
          linesEl.querySelectorAll('[data-remove-line]').forEach((btn) => { btn.disabled = onlyOne; });
        }

        function addLine() {
          linesEl.insertAdjacentHTML('beforeend', lineTemplate(products).toString());
          recalculate();
        }

        form.addEventListener('click', (event) => {
          if (event.target.closest('[data-add-line]')) addLine();
          const removeButton = event.target.closest('[data-remove-line]');
          if (removeButton) {
            removeButton.closest('[data-line]').remove();
            recalculate();
          }
        });
        form.addEventListener('input', recalculate);
        form.addEventListener('change', recalculate);

        addLine();
      },

      onSubmit(formData, form) {
        const productIds = formData.getAll('productId');
        const quantities = formData.getAll('quantity');

        const result = registerSale(db, {
          clientId: formData.get('clientId'),
          date: formData.get('date'),
          status: formData.get('status'),
          notes: formData.get('notes'),
          items: productIds.map((productId, index) => ({ productId, quantity: quantities[index] })),
        });

        if (!result.ok) {
          // Erros das linhas de item aparecem sob cada linha; os demais, sob cada campo.
          const { lines, ...fieldErrors } = result.errors;
          showLineErrors(form, lines);
          return { ok: false, errors: fieldErrors };
        }

        toast.success(`Venda ${formatSaleNumber(result.sale.number)} registrada com sucesso.`);
        renderList();
        return { ok: true };
      },
    });
  }

  // ---------- Detalhes e mudança de status ----------

  function openSaleDetails(saleId) {
    const sale = db.sales.get(saleId);
    if (!sale) return;

    const nextStatuses = ALLOWED_TRANSITIONS[sale.status] ?? [];
    const number = formatSaleNumber(sale.number);

    openInfoDialog({
      title: `Venda ${number}`,
      size: 'lg',
      body: html`
        <dl class="details">
          <div><dt>Cliente</dt><dd>${clientName(sale.clientId)}</dd></div>
          <div><dt>Data</dt><dd>${formatDate(sale.date)}</dd></div>
          <div><dt>Status</dt><dd>${statusBadge(sale.status)}</dd></div>
          ${sale.notes ? html`<div><dt>Observações</dt><dd>${sale.notes}</dd></div>` : ''}
        </dl>
        <div class="table-wrap">
          <table class="table table-compact">
            <thead><tr><th>Produto</th><th class="num">Qtd.</th><th class="num">Preço un.</th><th class="num">Subtotal</th></tr></thead>
            <tbody>
              ${sale.items.map(
                (item) => html`
                  <tr>
                    <td data-label="Produto">${item.name}</td>
                    <td data-label="Qtd." class="num">${item.quantity}</td>
                    <td data-label="Preço un." class="num">${formatCurrency(item.unitPriceCents)}</td>
                    <td data-label="Subtotal" class="num">${formatCurrency(item.unitPriceCents * item.quantity)}</td>
                  </tr>`,
              )}
            </tbody>
          </table>
        </div>
        <div class="sale-total">Total da venda <strong>${formatCurrency(sale.totalCents)}</strong></div>
        ${nextStatuses.length === 0 ? html`<p class="field-hint">Vendas canceladas não podem mais ser alteradas.</p>` : ''}`,
      footer: html`
        <button type="button" class="btn btn-secondary" data-close>Fechar</button>
        ${nextStatuses.map((status) =>
          status === SALE_STATUS.CANCELLED
            ? html`<button type="button" class="btn btn-danger" data-status="${status}">Cancelar venda</button>`
            : html`<button type="button" class="btn btn-primary" data-status="${status}">Marcar como ${STATUS_LABEL[status].toLowerCase()}</button>`,
        )}`,
      onOpen(dialog) {
        dialog.addEventListener('click', async (event) => {
          const button = event.target.closest('[data-status]');
          if (!button) return;
          const nextStatus = button.dataset.status;

          if (nextStatus === SALE_STATUS.CANCELLED) {
            const confirmed = await confirmDialog({
              title: 'Cancelar venda',
              message: `Cancelar a venda ${number}? Os produtos voltarão ao estoque e a venda não poderá mais ser alterada.`,
              confirmLabel: 'Cancelar venda',
              danger: true,
            });
            if (!confirmed) return;
          }

          try {
            const result = changeSaleStatus(db, sale.id, nextStatus);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(`Venda ${number} atualizada para "${STATUS_LABEL[nextStatus]}".`);
            dialog.close();
            renderList();
          } catch (error) {
            console.error(error);
            toast.error(error.message || 'Não foi possível atualizar a venda.');
          }
        });
      },
    });
  }

  // ---------- Eventos da página ----------

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'new') openSaleForm();
    if (action === 'details') openSaleDetails(id);
    if (action === 'clear-filters') {
      Object.assign(state, { text: '', status: '', from: '', to: '' });
      container.querySelector('#sale-search').value = '';
      container.querySelector('#sale-status').value = '';
      container.querySelector('#sale-from').value = '';
      container.querySelector('#sale-to').value = '';
      renderList();
    }
  });

  container.querySelector('#sale-search').addEventListener('input', (event) => {
    state.text = event.target.value;
    renderList();
  });
  container.addEventListener('change', (event) => {
    const filter = event.target.dataset?.filter;
    if (!filter) return;
    state[filter] = event.target.value;
    renderList();
  });

  renderList();
}
