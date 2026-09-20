/**
 * Tela inicial (Dashboard): resumo do negócio.
 *
 * Todos os números vêm de funções em services/queries.js. Esta tela só desenha.
 * Os gráficos são feitos com HTML + CSS puros (barras com altura/largura proporcional),
 * sem biblioteca de gráficos.
 */
import { html } from '../utils/html.js';
import { emptyState, pageHeader, statusBadge } from '../ui/components.js';
import { confirmDialog } from '../ui/dialog.js';
import { clearAllData, resetToDemoData } from '../data/db.js';
import { dashboardStats, filterSales, revenueByMonth, topProducts } from '../services/queries.js';
import { LOW_STOCK_THRESHOLD, SALE_STATUS, STATUS_LABEL } from '../services/constants.js';
import { formatCompactCurrency, formatCurrency, formatDate, formatSaleNumber, todayISO } from '../utils/format.js';

function kpiCard({ label, value, note, tone = '' }) {
  return html`
    <article class="kpi ${tone}">
      <p class="kpi-label">${label}</p>
      <p class="kpi-value">${value}</p>
      <p class="kpi-note">${note}</p>
    </article>`;
}

function monthlyChart(months) {
  const max = Math.max(...months.map((m) => m.totalCents), 0);
  const description = months.map((m) => `${m.label}: ${formatCurrency(m.totalCents)}`).join('; ');

  if (max === 0) {
    return emptyState({ title: 'Sem faturamento no período', text: 'Vendas pagas dos últimos 6 meses aparecerão aqui.' });
  }
  return html`
    <div class="bar-chart" role="img" aria-label="Faturamento por mês. ${description}">
      ${months.map((m) => {
        const height = m.totalCents > 0 ? Math.max((m.totalCents / max) * 100, 3) : 0;
        return html`
          <div class="bar-col">
            <span class="bar-value">${m.totalCents > 0 ? formatCompactCurrency(m.totalCents) : ''}</span>
            <div class="bar-track"><div class="bar" style="height:${height.toFixed(1)}%"></div></div>
            <span class="bar-label">${m.label}</span>
          </div>`;
      })}
    </div>`;
}

function statusBreakdown(stats) {
  return html`
    <ul class="status-list">
      ${Object.values(SALE_STATUS).map((status) => {
        const { count, totalCents } = stats.byStatus[status];
        const share = stats.salesCount ? (count / stats.salesCount) * 100 : 0;
        return html`
          <li>
            <div class="status-row">
              <span>${statusBadge(status)} <span class="muted">${count} venda(s)</span></span>
              <strong>${formatCurrency(totalCents)}</strong>
            </div>
            <div class="progress" aria-hidden="true"><div class="progress-fill progress-${status}" style="width:${share.toFixed(1)}%"></div></div>
          </li>`;
      })}
    </ul>`;
}

export function mountDashboard(container, { db, toast, refresh }) {
  const clients = db.clients.all();
  const products = db.products.all();
  const sales = db.sales.all();
  const stats = dashboardStats({ clients, products, sales });
  const today = todayISO();

  const months = revenueByMonth(sales, today, 6);
  const best = topProducts(sales, 5);
  const recent = filterSales(sales, clients).slice(0, 5);
  const lowStock = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock).slice(0, 5);
  const clientName = (id) => clients.find((c) => c.id === id)?.name ?? 'Cliente removido';

  const paid = stats.byStatus[SALE_STATUS.PAID];
  const pending = stats.byStatus[SALE_STATUS.PENDING];
  const cancelled = stats.byStatus[SALE_STATUS.CANCELLED];

  container.innerHTML = html`
    ${pageHeader({ title: 'Dashboard', subtitle: 'Resumo do seu negócio: vendas, clientes, produtos e faturamento.' })}

    <section class="kpi-grid" aria-label="Indicadores">
      ${kpiCard({
        label: 'Faturamento',
        value: formatCurrency(stats.revenueCents),
        note: `${paid.count} venda(s) paga(s) · ticket médio ${formatCurrency(stats.averageTicketCents)}`,
        tone: 'kpi-primary',
      })}
      ${kpiCard({
        label: 'A receber',
        value: formatCurrency(stats.pendingCents),
        note: `${pending.count} venda(s) pendente(s)`,
      })}
      ${kpiCard({
        label: 'Vendas',
        value: stats.salesCount,
        note: `${paid.count} paga(s) · ${pending.count} pendente(s) · ${cancelled.count} cancelada(s)`,
      })}
      ${kpiCard({ label: 'Clientes', value: stats.clientsCount, note: 'cadastrados' })}
      ${kpiCard({
        label: 'Produtos',
        value: stats.productsCount,
        note: stats.lowStockCount ? `${stats.lowStockCount} com estoque baixo` : 'estoque em dia',
      })}
    </section>

    <div class="grid-2">
      <section class="card">
        <h2 class="card-title">Faturamento nos últimos 6 meses</h2>
        <p class="card-note">Considera apenas vendas pagas.</p>
        ${monthlyChart(months)}
      </section>

      <section class="card">
        <h2 class="card-title">Vendas por status</h2>
        <p class="card-note">Quantidade e valor de cada situação.</p>
        ${stats.salesCount ? statusBreakdown(stats) : emptyState({ title: 'Sem vendas', text: 'Registre vendas para ver a distribuição.' })}
      </section>
    </div>

    <div class="grid-2">
      <section class="card">
        <h2 class="card-title">Últimas vendas</h2>
        ${recent.length
          ? html`<ul class="simple-list">
              ${recent.map((sale) => html`
                <li>
                  <span><strong>${formatSaleNumber(sale.number)}</strong> · ${clientName(sale.clientId)}<span class="cell-sub">${formatDate(sale.date)}</span></span>
                  <span class="list-end">${formatCurrency(sale.totalCents)} ${statusBadge(sale.status)}</span>
                </li>`)}
            </ul>`
          : emptyState({ title: 'Nenhuma venda ainda', text: 'As vendas mais recentes aparecerão aqui.' })}
        <p class="card-link"><a href="#/vendas">Ver todas as vendas</a></p>
      </section>

      <section class="card">
        <h2 class="card-title">Produtos mais vendidos</h2>
        ${best.length
          ? html`<ul class="simple-list">
              ${best.map((item) => html`
                <li>
                  <span><strong>${item.name}</strong></span>
                  <span class="list-end">${item.quantity} un. · ${formatCurrency(item.totalCents)}</span>
                </li>`)}
            </ul>`
          : emptyState({ title: 'Sem dados de vendas', text: 'Os produtos mais vendidos aparecerão aqui.' })}

        <h2 class="card-title card-title-spaced">Estoque baixo</h2>
        ${lowStock.length
          ? html`<ul class="simple-list">
              ${lowStock.map((p) => html`
                <li>
                  <span>${p.name}</span>
                  <span class="list-end"><span class="badge ${p.stock === 0 ? 'badge-out' : 'badge-low'}">${p.stock === 0 ? 'Sem estoque' : `${p.stock} un.`}</span></span>
                </li>`)}
            </ul>`
          : html`<p class="muted">Nenhum produto com estoque baixo.</p>`}
        <p class="card-link"><a href="#/produtos">Ver produtos</a></p>
      </section>
    </div>

    <section class="card data-panel">
      <div>
        <h2 class="card-title">Dados do sistema</h2>
        <p class="card-note">
          Os dados ficam salvos apenas neste navegador (localStorage). Os registros de demonstração são fictícios.
        </p>
      </div>
      <div class="data-actions">
        <button type="button" class="btn btn-secondary" data-action="restore-demo">Restaurar dados de demonstração</button>
        <button type="button" class="btn btn-secondary btn-danger-text" data-action="clear-data">Apagar todos os dados</button>
      </div>
    </section>`.toString();

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    try {
      if (button.dataset.action === 'restore-demo') {
        const ok = await confirmDialog({
          title: 'Restaurar demonstração',
          message: 'Isso substitui todos os clientes, produtos e vendas atuais pelos dados de demonstração. Deseja continuar?',
          confirmLabel: 'Restaurar',
          danger: true,
        });
        if (!ok) return;
        resetToDemoData(db, todayISO());
        toast.success('Dados de demonstração restaurados.');
        refresh();
      }
      if (button.dataset.action === 'clear-data') {
        const ok = await confirmDialog({
          title: 'Apagar todos os dados',
          message: 'Isso apaga todos os clientes, produtos e vendas deste navegador. Esta ação não pode ser desfeita.',
          confirmLabel: 'Apagar tudo',
          danger: true,
        });
        if (!ok) return;
        clearAllData(db);
        toast.success('Todos os dados foram apagados.');
        refresh();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Não foi possível concluir a operação.');
    }
  });
}
