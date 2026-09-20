/**
 * Campos de formulário e exibição de erros de validação.
 *
 * Cada campo é montado com: rótulo (<label>) + controle + mensagem de erro
 * (inicialmente escondida). Quando a validação falha, `showErrors` preenche
 * a mensagem, marca o campo com aria-invalid e leva o foco ao primeiro erro.
 */
import { attrs, html } from '../utils/html.js';

/** Campo de texto/número/data. `extra` recebe atributos HTML (min, max, inputmode...). */
export function field({ label, name, type = 'text', value = '', required = false, hint = '', extra = {} }) {
  return html`
    <div class="field">
      <label for="f-${name}">${label}${required ? html`<span class="req" aria-hidden="true"> *</span>` : ''}</label>
      <input id="f-${name}" name="${name}" type="${type}" value="${value}"
        ${attrs({ required: required && 'required', 'aria-describedby': `err-${name}`, ...extra })}>
      ${hint ? html`<p class="field-hint">${hint}</p>` : ''}
      <p class="field-error" id="err-${name}" data-error-for="${name}" hidden></p>
    </div>`;
}

/** Lista suspensa. `options` = [{ value, label, disabled }]. */
export function selectField({ label, name, options, value = '', required = false, placeholder = '' }) {
  return html`
    <div class="field">
      <label for="f-${name}">${label}${required ? html`<span class="req" aria-hidden="true"> *</span>` : ''}</label>
      <select id="f-${name}" name="${name}" aria-describedby="err-${name}">
        ${placeholder ? html`<option value="">${placeholder}</option>` : ''}
        ${options.map(
          (option) => html`<option value="${option.value}"${option.value === value ? ' selected' : ''}${option.disabled ? ' disabled' : ''}>${option.label}</option>`,
        )}
      </select>
      <p class="field-error" id="err-${name}" data-error-for="${name}" hidden></p>
    </div>`;
}

/** Limpa as mensagens de erro anteriores do formulário. */
export function clearErrors(form) {
  form.querySelectorAll('[data-error-for], [data-line-error]').forEach((el) => {
    el.textContent = '';
    el.hidden = true;
  });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  const banner = form.querySelector('[data-form-error]');
  if (banner) {
    banner.textContent = '';
    banner.hidden = true;
  }
}

/** Mostra um erro geral (não ligado a um campo) no topo do formulário. */
export function showFormError(form, message) {
  const banner = form.querySelector('[data-form-error]');
  if (!banner) return;
  banner.textContent = message;
  banner.hidden = false;
}

/**
 * Exibe os erros { campo: 'mensagem' } ao lado de cada campo.
 * Erros que não têm campo correspondente vão para o aviso geral.
 */
export function showErrors(form, errors) {
  let firstInvalid = null;

  for (const [name, message] of Object.entries(errors)) {
    const messageEl = form.querySelector(`[data-error-for="${name}"]`);
    if (!messageEl) {
      showFormError(form, message);
      continue;
    }
    messageEl.textContent = message;
    messageEl.hidden = false;
    const control = form.elements[name];
    if (control && typeof control.setAttribute === 'function') {
      control.setAttribute('aria-invalid', 'true');
      firstInvalid ??= control;
    }
  }
  firstInvalid?.focus();
}
