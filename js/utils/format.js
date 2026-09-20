/**
 * Funções de formatação e conversão (dinheiro, datas, telefone, texto).
 * São funções "puras": recebem um valor e devolvem outro, sem tocar na tela
 * nem no armazenamento. Por isso são fáceis de testar.
 */

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Os valores em dinheiro são guardados em CENTAVOS (número inteiro).
 * Isso evita erros de ponto flutuante do JavaScript (0.1 + 0.2 = 0.30000000000000004).
 * formatCurrency(1990) -> "R$ 19,90"
 */
export function formatCurrency(cents) {
  return currencyFormatter.format((cents || 0) / 100);
}

const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const wholeCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/**
 * Versão curta para espaços pequenos (rótulos do gráfico):
 * 123456 -> "R$ 1,2 mil"; 36980 -> "R$ 370".
 */
export function formatCompactCurrency(cents) {
  const reais = (cents || 0) / 100;
  return Math.abs(reais) < 1000 ? wholeCurrencyFormatter.format(reais) : compactCurrencyFormatter.format(reais);
}

/**
 * Converte o texto digitado pelo usuário em centavos.
 * Aceita "19,90", "1.234,56", "19.9", "R$ 25". Retorna null se for inválido.
 */
export function parseMoneyToCents(input) {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  let text = String(input ?? '').replace(/R\$|\s/g, '');
  if (!text) return null;

  // Formato brasileiro: ponto separa milhar e vírgula separa os centavos.
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');

  // Depois da conversão precisa ser: dígitos + (ponto + 1 ou 2 dígitos) opcional.
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  const [integerPart, decimalPart = ''] = text.split('.');
  return Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'));
}

/** Centavos -> texto para preencher um campo de formulário ("19,90"). */
export function centsToInput(cents) {
  return ((cents || 0) / 100).toFixed(2).replace('.', ',');
}

/** Retorna a data local no formato AAAA-MM-DD (o mesmo do <input type="date">). */
export function todayISO(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Soma (ou subtrai, se negativo) dias a uma data e devolve AAAA-MM-DD. */
export function addDaysISO(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return todayISO(new Date(year, month - 1, day + days));
}

/**
 * "2026-03-05" -> "05/03/2026".
 * Feito "na mão" (sem new Date) para evitar o problema de fuso horário que
 * faria a data aparecer um dia antes.
 */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Confere se o texto é uma data real no formato AAAA-MM-DD (rejeita 2026-02-31). */
export function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** 7 -> "#0007" */
export function formatSaleNumber(number) {
  return `#${String(number).padStart(4, '0')}`;
}

/** Deixa só os dígitos de um texto. */
export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** "16999990001" -> "(16) 99999-0001". Se não tiver 10/11 dígitos, devolve como veio. */
export function formatPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value ?? '';
}

/** Minúsculas e sem acentos: "São Paulo" -> "sao paulo". Usado nas buscas. */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Remove espaços sobrando no começo, no fim e repetidos no meio. */
export function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}
