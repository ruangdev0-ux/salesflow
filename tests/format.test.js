import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysISO,
  formatCurrency,
  formatDate,
  formatPhone,
  isValidISODate,
  normalizeText,
  parseMoneyToCents,
} from '../js/utils/format.js';
import { html } from '../js/utils/html.js';

test('parseMoneyToCents converte formatos brasileiros para centavos', () => {
  assert.equal(parseMoneyToCents('19,90'), 1990);
  assert.equal(parseMoneyToCents('1.234,56'), 123456);
  assert.equal(parseMoneyToCents('R$ 25'), 2500);
  assert.equal(parseMoneyToCents('19.9'), 1990);
  assert.equal(parseMoneyToCents('0,05'), 5);
});

test('parseMoneyToCents rejeita valores inválidos ou ambíguos', () => {
  for (const value of ['', 'abc', '-5', '1,234', '10,5,5', '1.234', null, undefined]) {
    assert.equal(parseMoneyToCents(value), null, `deveria rejeitar ${JSON.stringify(value)}`);
  }
});

test('formatCurrency mostra reais no padrão brasileiro', () => {
  // O Intl usa espaço "não separável" entre R$ e o número; normalizamos para comparar.
  assert.equal(formatCurrency(123456).replace(/\s/g, ' '), 'R$ 1.234,56');
  assert.equal(formatCurrency(0).replace(/\s/g, ' '), 'R$ 0,00');
});

test('formatDate e addDaysISO não sofrem com fuso horário', () => {
  assert.equal(formatDate('2026-03-05'), '05/03/2026');
  assert.equal(addDaysISO('2026-03-01', -1), '2026-02-28');
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01');
});

test('isValidISODate rejeita datas inexistentes', () => {
  assert.equal(isValidISODate('2026-02-28'), true);
  assert.equal(isValidISODate('2026-02-31'), false);
  assert.equal(isValidISODate('31/02/2026'), false);
  assert.equal(isValidISODate(''), false);
});

test('formatPhone e normalizeText', () => {
  assert.equal(formatPhone('16999990001'), '(16) 99999-0001');
  assert.equal(formatPhone('1633330003'), '(16) 3333-0003');
  assert.equal(normalizeText('  São Paulo '), 'sao paulo');
});

test('html escapa valores interpolados (proteção contra XSS)', () => {
  const malicious = '<img src=x onerror=alert(1)>';
  assert.equal(String(html`<p>${malicious}</p>`), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
});

test('html não escapa de novo trechos que já são html e aceita listas', () => {
  const items = ['a', 'b'].map((x) => html`<li>${x}</li>`);
  assert.equal(String(html`<ul>${items}</ul>`), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(String(html`<p>${false}${null}${undefined}</p>`), '<p></p>');
});
