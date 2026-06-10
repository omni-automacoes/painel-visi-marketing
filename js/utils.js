/**
 * utils.js — Funções utilitárias globais do CRM Visi Marketing
 */

/**
 * Formata número como moeda BRL
 * @param {number} value
 * @param {boolean} compact - usar formato abreviado (R$150k)
 */
export function formatCurrency(value, compact = false) {
  if (compact) {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
    return `R$ ${value}`;
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata número com separador de milhar
 * @param {number} value
 */
export function formatNumber(value) {
  return value.toLocaleString('pt-BR');
}

/**
 * Retorna data formatada em português
 * @param {Date|string} date
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Retorna a data atual formatada
 */
export function today() {
  return formatDate(new Date());
}

/**
 * Cria elemento HTML a partir de string
 * @param {string} html
 * @returns {HTMLElement}
 */
export function createElement(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

/**
 * Injeta HTML no container e retorna o container
 * @param {HTMLElement} container
 * @param {string} html
 */
export function render(container, html) {
  container.innerHTML = html;
  return container;
}

/**
 * Dispara animação de entrada nos elementos filhos
 * @param {HTMLElement} parent
 * @param {string} selector
 * @param {number} delayStep - delay incremental em ms
 */
export function staggerAnimation(parent, selector = '.card, .stat-mini-card', delayStep = 60) {
  const els = parent.querySelectorAll(selector);
  els.forEach((el, i) => {
    el.style.animationDelay = `${i * delayStep}ms`;
  });
}
