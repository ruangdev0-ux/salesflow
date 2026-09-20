/**
 * Utilitários para montar HTML com segurança.
 *
 * Como o app mostra textos digitados pelo usuário (nome de cliente, produto etc.),
 * inserir esses textos direto em `innerHTML` permitiria injetar HTML/JavaScript (XSS).
 * A função `html` abaixo resolve isso: todo valor interpolado é "escapado"
 * automaticamente, a não ser que ele venha de outro `html` (já é seguro).
 *
 * Exemplo:
 *   const nome = '<img src=x onerror=alert(1)>';
 *   html`<p>${nome}</p>`  // -> <p>&lt;img src=x onerror=alert(1)&gt;</p>
 */

/** Marca uma string como "já segura" para não ser escapada de novo. */
class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Troca os caracteres especiais do HTML por entidades (&lt; &gt; ...). */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** Use com cuidado: insere o texto exatamente como está (sem escapar). */
export function raw(value) {
  return new SafeHtml(String(value));
}

function renderValue(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
}

/** Template tag: junta as partes do template escapando os valores interpolados. */
export function html(strings, ...values) {
  let output = '';
  strings.forEach((part, index) => {
    output += part;
    if (index < values.length) output += renderValue(values[index]);
  });
  return new SafeHtml(output);
}

/**
 * Monta atributos HTML a partir de um objeto, ignorando os vazios.
 * attrs({ min: 0, step: undefined }) -> ' min="0"'
 */
export function attrs(map = {}) {
  const text = Object.entries(map)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== '')
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`))
    .join('');
  return raw(text);
}
