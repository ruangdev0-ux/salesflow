/**
 * Janelas modais usando o elemento nativo <dialog>.
 *
 * O <dialog> já traz: fundo escurecido, foco preso dentro da janela e fechamento
 * com a tecla Esc, sem precisar de biblioteca.
 *
 *  - openFormDialog: janela com formulário. Ao enviar, chama `onSubmit`, que devolve
 *    { ok: false, errors } para mostrar erros ou qualquer outra coisa para fechar.
 *  - openInfoDialog: janela só de leitura, com botões livres (ex.: detalhes da venda).
 *  - confirmDialog: pergunta "tem certeza?" e devolve uma Promise<boolean>.
 */
import { html } from '../utils/html.js';
import { icon } from './icons.js';
import { clearErrors, showErrors, showFormError } from './forms.js';

function buildDialog({ title, body, footer, size }) {
  const dialog = document.createElement('dialog');
  dialog.className = `modal${size === 'lg' ? ' modal-lg' : ''}`;
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.innerHTML = html`
    <form novalidate>
      <header class="modal-header">
        <h2 id="dialog-title">${title}</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Fechar">${icon('close')}</button>
      </header>
      <div class="modal-body">
        <p class="form-error" data-form-error role="alert" hidden></p>
        ${body}
      </div>
      <footer class="modal-footer">${footer}</footer>
    </form>`.toString();

  dialog.addEventListener('click', (event) => {
    // Fecha ao clicar no X/Cancelar ou no fundo escurecido (fora da caixa).
    if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  // Evita que o Enter dentro de um formulário recarregue a página (comportamento padrão).
  dialog.querySelector('form').addEventListener('submit', (event) => event.preventDefault());

  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function openFormDialog({ title, body, submitLabel = 'Salvar', size, onSubmit, onOpen }) {
  const footer = html`
    <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
    <button type="submit" class="btn btn-primary">${submitLabel}</button>`;
  const dialog = buildDialog({ title, body, footer, size });
  const form = dialog.querySelector('form');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors(form);
    try {
      const result = onSubmit(new FormData(form), form);
      if (result && result.ok === false) {
        showErrors(form, result.errors ?? {});
        return;
      }
      dialog.close();
    } catch (error) {
      // Erros inesperados (ex.: armazenamento cheio) viram uma mensagem no formulário.
      console.error(error);
      showFormError(form, error.message || 'Ocorreu um erro inesperado ao salvar.');
    }
  });

  onOpen?.(form, dialog);
  // Foco no primeiro campo editável.
  form.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
  return dialog;
}

export function openInfoDialog({ title, body, footer, size, onOpen }) {
  const dialog = buildDialog({ title, body, footer, size });
  onOpen?.(dialog);
  return dialog;
}

export function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const dialog = buildDialog({
      title,
      body: html`<p class="confirm-text">${message}</p>`,
      footer: html`
        <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${confirmLabel}</button>`,
    });
    let confirmed = false;
    dialog.querySelector('[data-confirm]').addEventListener('click', () => {
      confirmed = true;
      dialog.close();
    });
    dialog.addEventListener('close', () => resolve(confirmed));
    dialog.querySelector('[data-confirm]').focus();
  });
}
