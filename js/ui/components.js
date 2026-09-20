/**
 * Pequenos blocos de interface reutilizados pelas telas.
 * Cada função devolve HTML (via `html`) e não conhece dados do negócio.
 */
import { html } from '../utils/html.js';
import { icon } from './icons.js';
import { STATUS_LABEL } from '../services/constants.js';

/** Título da página com subtítulo e, opcionalmente, um botão de ação principal. */
export function pageHeader({ title, subtitle, actionLabel, actionName }) {
  return html`
    <header class="page-header">
      <div>
        <h1 id="page-title" tabindex="-1">${title}</h1>
        <p class="page-subtitle">${subtitle}</p>
      </div>
      ${actionLabel
        ? html`<button type="button" class="btn btn-primary" data-action="${actionName}">${icon('plus')} ${actionLabel}</button>`
        : ''}
    </header>`;
}

/** Mensagem exibida quando uma lista está vazia (ou a busca não encontrou nada). */
export function emptyState({ title, text }) {
  return html`
    <div class="empty-state">
      <p class="empty-title">${title}</p>
      <p class="empty-text">${text}</p>
    </div>`;
}

/** Etiqueta colorida do status da venda. */
export function statusBadge(status) {
  return html`<span class="badge badge-${status}">${STATUS_LABEL[status] ?? status}</span>`;
}

/** Botão pequeno só com ícone (com rótulo acessível para leitores de tela). */
export function iconButton({ action, id, label, iconName, danger = false }) {
  return html`
    <button type="button" class="btn btn-ghost btn-icon${danger ? ' btn-danger-text' : ''}"
      data-action="${action}" data-id="${id}" aria-label="${label}" title="${label}">
      ${icon(iconName, 16)}
    </button>`;
}
