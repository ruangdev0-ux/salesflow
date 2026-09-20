/**
 * Tela de Clientes: lista com busca + cadastro, edição e exclusão.
 *
 * Padrão usado em todas as telas ("mount"):
 *  1. desenha a estrutura fixa da página uma única vez;
 *  2. `renderList()` redesenha só a lista quando algo muda (busca, novo cadastro...);
 *  3. um único "ouvinte de clique" no contêiner trata todos os botões (delegação de eventos).
 */
import { html } from '../utils/html.js';
import { emptyState, iconButton, pageHeader } from '../ui/components.js';
import { field } from '../ui/forms.js';
import { confirmDialog, openFormDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';
import { validateClient } from '../services/validators.js';
import { deleteClient } from '../services/deletion.js';
import { clientSummary, filterClients } from '../services/queries.js';
import { formatCurrency, formatPhone } from '../utils/format.js';

export function mountClients(container, { db, toast }) {
  const state = { text: '' };

  container.innerHTML = html`
    ${pageHeader({
      title: 'Clientes',
      subtitle: 'Cadastre e acompanhe as pessoas e empresas que compram de você.',
      actionLabel: 'Novo cliente',
      actionName: 'new',
    })}
    <section class="card">
      <div class="toolbar">
        <div class="field field-grow">
          <label class="sr-only" for="client-search">Buscar clientes</label>
          <div class="input-icon">
            ${icon('search')}
            <input id="client-search" type="search" placeholder="Buscar nome, e-mail ou cidade" autocomplete="off">
          </div>
        </div>
      </div>
      <div data-list></div>
    </section>`.toString();

  const listEl = container.querySelector('[data-list]');

  function renderList() {
    const allClients = db.clients.all();
    const clients = filterClients(allClients, state.text);
    const summary = clientSummary(db.sales.all());

    if (allClients.length === 0) {
      listEl.innerHTML = emptyState({
        title: 'Nenhum cliente cadastrado',
        text: 'Clique em "Novo cliente" para cadastrar o primeiro.',
      }).toString();
      return;
    }
    if (clients.length === 0) {
      listEl.innerHTML = emptyState({
        title: 'Nenhum cliente encontrado',
        text: 'Tente buscar por outro nome, e-mail ou cidade.',
      }).toString();
      return;
    }

    listEl.innerHTML = html`
      <p class="result-count">${clients.length} de ${allClients.length} cliente(s)</p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Cliente</th><th>Telefone</th><th>Cidade</th><th class="num">Compras</th><th class="actions-col"><span class="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            ${clients.map((client) => {
              const purchases = summary.get(client.id);
              return html`
                <tr>
                  <td data-label="Cliente"><div><strong>${client.name}</strong>${client.email ? html`<span class="cell-sub">${client.email}</span>` : ''}</div></td>
                  <td data-label="Telefone">${client.phone ? formatPhone(client.phone) : '—'}</td>
                  <td data-label="Cidade">${client.city || '—'}</td>
                  <td data-label="Compras" class="num">${purchases ? html`${purchases.count} · ${formatCurrency(purchases.totalCents)}` : '—'}</td>
                  <td class="actions-col">
                    ${iconButton({ action: 'edit', id: client.id, label: `Editar ${client.name}`, iconName: 'edit' })}
                    ${iconButton({ action: 'delete', id: client.id, label: `Excluir ${client.name}`, iconName: 'trash', danger: true })}
                  </td>
                </tr>`;
            })}
          </tbody>
        </table>
      </div>`.toString();
  }

  /** Abre o formulário: vazio para cadastrar, preenchido para editar. */
  function openClientForm(client = null) {
    openFormDialog({
      title: client ? 'Editar cliente' : 'Novo cliente',
      submitLabel: client ? 'Salvar alterações' : 'Cadastrar cliente',
      body: html`
        ${field({ label: 'Nome', name: 'name', value: client?.name, required: true, extra: { maxlength: 80, autocomplete: 'off' } })}
        ${field({ label: 'E-mail', name: 'email', type: 'email', value: client?.email, extra: { autocomplete: 'off' } })}
        <div class="field-row">
          ${field({ label: 'Telefone (com DDD)', name: 'phone', type: 'tel', value: client?.phone ? formatPhone(client.phone) : '', extra: { inputmode: 'tel', placeholder: '(16) 99999-0000' } })}
          ${field({ label: 'Cidade', name: 'city', value: client?.city, extra: { maxlength: 60 } })}
        </div>`,
      onSubmit(formData) {
        const result = validateClient(Object.fromEntries(formData), {
          existing: db.clients.all(),
          currentId: client?.id,
        });
        if (!result.ok) return { ok: false, errors: result.errors };

        if (client) db.clients.update(client.id, result.values);
        else db.clients.add(result.values);

        toast.success(client ? 'Cliente atualizado.' : 'Cliente cadastrado.');
        renderList();
        return { ok: true };
      },
    });
  }

  async function removeClient(id) {
    const client = db.clients.get(id);
    if (!client) return;
    const confirmed = await confirmDialog({
      title: 'Excluir cliente',
      message: `Tem certeza de que deseja excluir "${client.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) return;

    try {
      const result = deleteClient(db, id);
      if (result.ok) toast.success('Cliente excluído.');
      else toast.error(result.message);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Não foi possível excluir o cliente.');
    }
    renderList();
  }

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'new') openClientForm();
    if (action === 'edit') openClientForm(db.clients.get(id));
    if (action === 'delete') removeClient(id);
  });

  container.querySelector('#client-search').addEventListener('input', (event) => {
    state.text = event.target.value;
    renderList();
  });

  renderList();
}
