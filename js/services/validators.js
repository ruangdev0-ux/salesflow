/**
 * Validação dos formulários.
 *
 * Cada função recebe os dados "crus" digitados pelo usuário (tudo texto) e devolve:
 *   { ok, values, errors }
 *     ok      -> true se não há nenhum erro
 *     values  -> dados já limpos e convertidos (ex.: preço em centavos, número inteiro)
 *     errors  -> objeto { campo: 'mensagem' } com o que está errado
 *
 * Nada aqui mexe na tela ou no armazenamento; são funções puras, fáceis de testar.
 * A tela só mostra as mensagens de `errors` ao lado de cada campo.
 */
import { SALE_STATUS } from './constants.js';
import { cleanText, isValidISODate, normalizeText, onlyDigits, parseMoneyToCents } from '../utils/format.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_PRICE_CENTS = 100_000_00; // R$ 100.000,00
const MAX_STOCK = 100_000;

function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

/** Converte "12" em 12. Qualquer outra coisa (vazio, "1,5", "abc", "-3") vira null. */
function parseWholeNumber(input) {
  const text = String(input ?? '').trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

/**
 * Cliente: nome obrigatório; e-mail, telefone e cidade opcionais (mas, se
 * preenchidos, precisam ser válidos). O e-mail não pode repetir.
 */
export function validateClient(input, { existing = [], currentId = null } = {}) {
  const values = {
    name: cleanText(input.name),
    email: cleanText(input.email).toLowerCase(),
    phone: cleanText(input.phone),
    city: cleanText(input.city),
  };
  const errors = {};

  if (!values.name) errors.name = 'Informe o nome do cliente.';
  else if (values.name.length < 2) errors.name = 'O nome deve ter pelo menos 2 caracteres.';
  else if (values.name.length > 80) errors.name = 'O nome deve ter no máximo 80 caracteres.';

  if (values.email) {
    if (!EMAIL_PATTERN.test(values.email)) {
      errors.email = 'Informe um e-mail válido (ex.: nome@exemplo.com).';
    } else if (existing.some((c) => c.id !== currentId && (c.email || '').toLowerCase() === values.email)) {
      errors.email = 'Já existe um cliente cadastrado com este e-mail.';
    }
  }

  if (values.phone) {
    const digits = onlyDigits(values.phone);
    if (digits.length < 10 || digits.length > 11) {
      errors.phone = 'Informe o telefone com DDD (10 ou 11 dígitos).';
    } else {
      values.phone = digits; // guardamos só os números; a formatação é feita na exibição
    }
  }

  if (values.city.length > 60) errors.city = 'A cidade deve ter no máximo 60 caracteres.';

  return { ok: !hasErrors(errors), values, errors };
}

/**
 * Produto: nome, categoria, preço (> 0) e estoque (inteiro >= 0).
 * O preço vem como texto ("49,90") e é convertido para centavos.
 */
export function validateProduct(input, { existing = [], currentId = null } = {}) {
  const values = {
    name: cleanText(input.name),
    category: cleanText(input.category),
    priceCents: parseMoneyToCents(input.price),
    stock: parseWholeNumber(input.stock),
  };
  const errors = {};

  if (!values.name) errors.name = 'Informe o nome do produto.';
  else if (values.name.length < 2) errors.name = 'O nome deve ter pelo menos 2 caracteres.';
  else if (values.name.length > 80) errors.name = 'O nome deve ter no máximo 80 caracteres.';
  else if (existing.some((p) => p.id !== currentId && normalizeText(p.name) === normalizeText(values.name))) {
    errors.name = 'Já existe um produto com este nome.';
  }

  if (!values.category) errors.category = 'Informe a categoria do produto.';
  else if (values.category.length > 40) errors.category = 'A categoria deve ter no máximo 40 caracteres.';

  if (values.priceCents === null) errors.price = 'Informe um preço válido (ex.: 49,90).';
  else if (values.priceCents <= 0) errors.price = 'O preço deve ser maior que zero.';
  else if (values.priceCents > MAX_PRICE_CENTS) errors.price = 'O preço máximo permitido é R$ 100.000,00.';

  if (values.stock === null) errors.stock = 'Informe o estoque como número inteiro (0 ou mais).';
  else if (values.stock > MAX_STOCK) errors.stock = `O estoque máximo permitido é ${MAX_STOCK}.`;

  return { ok: !hasErrors(errors), values, errors };
}

/**
 * Venda: cliente existente, data válida e não futura, status inicial permitido
 * e pelo menos um item. Cada item precisa de um produto existente, sem repetição,
 * e quantidade inteira >= 1 que não ultrapasse o estoque.
 *
 * Erros por linha de item ficam em `errors.lines` ({ 0: 'mensagem', 2: '...' }),
 * onde o número é a posição do item na lista.
 */
export function validateSale(input, { clients = [], products = [], today } = {}) {
  const items = (input.items ?? []).map((item) => ({
    productId: String(item.productId ?? ''),
    quantity: parseWholeNumber(item.quantity),
  }));
  const values = {
    clientId: String(input.clientId ?? ''),
    date: String(input.date ?? '').trim(),
    status: input.status || SALE_STATUS.PENDING,
    notes: cleanText(input.notes),
    items,
  };
  const errors = {};

  if (!values.clientId) errors.clientId = 'Selecione o cliente.';
  else if (!clients.some((client) => client.id === values.clientId)) errors.clientId = 'Cliente não encontrado.';

  if (!values.date) errors.date = 'Informe a data da venda.';
  else if (!isValidISODate(values.date)) errors.date = 'Informe uma data válida.';
  else if (today && values.date > today) errors.date = 'A data da venda não pode ser no futuro.';

  if (![SALE_STATUS.PENDING, SALE_STATUS.PAID].includes(values.status)) {
    errors.status = 'Uma venda nova deve começar como pendente ou paga.';
  }

  if (values.notes.length > 200) errors.notes = 'A observação deve ter no máximo 200 caracteres.';

  if (items.length === 0) {
    errors.items = 'Adicione pelo menos um produto à venda.';
  } else {
    const lines = {};
    const seen = new Set();
    items.forEach((item, index) => {
      const product = products.find((p) => p.id === item.productId);
      if (!item.productId) lines[index] = 'Selecione um produto.';
      else if (!product) lines[index] = 'Produto não encontrado.';
      else if (seen.has(item.productId)) lines[index] = 'Este produto já foi adicionado; some as quantidades em uma linha só.';
      else if (item.quantity === null || item.quantity < 1) lines[index] = 'A quantidade deve ser um número inteiro de 1 ou mais.';
      else if (item.quantity > product.stock) {
        lines[index] = product.stock === 0
          ? `"${product.name}" está sem estoque.`
          : `Estoque insuficiente: restam ${product.stock} unidade(s) de "${product.name}".`;
      }
      if (item.productId) seen.add(item.productId);
    });
    if (hasErrors(lines)) errors.lines = lines;
  }

  return { ok: !hasErrors(errors), values, errors };
}
