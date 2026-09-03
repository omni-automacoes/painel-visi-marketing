/**
 * relatorios.js — Página "Relatórios"
 *
 * Visível apenas para Administradores.
 * Dividida em 3 setores (tabs):
 *   1. Setor Comercial (Vendas)
 *   2. Setor Operacional
 *   3. Setor Master (Gestão Executiva / ADM)
 */

import UserStore from '../js/userStore.js';
import { supabase } from '../js/supabase.js';
import { DiaFinalizado, Usuarios } from '../js/db.js';

// ─── Estado local ───────────────────────────────────────────
let _tabAtual              = 'comercial'; // 'comercial' | 'operacoes' | 'master'
let _dataInicio            = '';          // 'YYYY-MM-DD'
let _dataFim               = '';          // 'YYYY-MM-DD'
let _periodLabel           = '';          // texto exibido no badge
let _investimentoMarketing = 0;           // numeric salvo em usuarios.investimento_marketing

// ─── Helpers de data ────────────────────────────────────────

function _hoje() {
  return new Date().toISOString().substring(0, 10);
}

function _primeiroDiaMes(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString().substring(0, 10);
}

function _ultimoDiaMes(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString().substring(0, 10);
}

function _subDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().substring(0, 10);
}

function _formatarExibicao(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Helpers de moeda (BRL) ──────────────────────────────────

/**
 * Converte um número (float) para string no formato BRL: "1.500,00"
 */
function _formatarBRL(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte uma string BRL ("1.500,00") de volta para float (1500.00)
 */
function _parseBRL(str) {
  if (!str) return 0;
  // Remove pontos de milhar, troca vírgula decimal por ponto
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

/**
 * Máscara de moeda BRL aplicada em tempo real.
 * Opera sobre dígitos puros e reconstrói o valor formatado.
 */
function _maskBRL(inputEl) {
  const digits = inputEl.value.replace(/\D/g, '');
  if (!digits) { inputEl.value = ''; return; }
  const num = parseInt(digits, 10) / 100;
  inputEl.value = num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Define o período padrão: mês atual
function _initPeriodo() {
  _dataInicio  = _primeiroDiaMes();
  _dataFim     = _ultimoDiaMes();
  _periodLabel = 'Mês atual';
}

// ─── Helpers ────────────────────────────────────────────────

function _trendIcon(dir) {
  if (dir === 'up') {
    return `<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
  }
  if (dir === 'down') {
    return `<svg viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}

function _kpiCard({
  id = '',
  icon,
  iconColor = 'cyan',
  accentColor = 'cyan',
  value,
  label,
  sub = '',
  trend = '',       // 'up' | 'down' | 'neu'
  trendLabel = '',
  wide = false,
  full = false,
  valueMd = false,
}) {
  const wideClass = wide ? ' rel-kpi-card--wide' : '';
  const fullClass = full ? ' rel-kpi-card--full' : '';
  const valueClass = valueMd ? ' rel-kpi-value--md' : '';

  const trendHtml = trend
    ? `<span class="rel-kpi-trend rel-kpi-trend--${trend}">
         ${_trendIcon(trend)}
         ${trendLabel}
       </span>`
    : '';

  return `
    <div class="rel-kpi-card rel-kpi-card--${accentColor}${wideClass}${fullClass}" ${id ? `id="${id}"` : ''}>
      <div class="rel-kpi-top">
        <div class="rel-kpi-icon rel-kpi-icon--${iconColor}">
          ${icon}
        </div>
        ${trendHtml}
      </div>
      <div class="rel-kpi-value${valueClass}">${value}</div>
      <div class="rel-kpi-label">
        ${label}${sub ? `<span class="rel-kpi-info-icon" title="${sub}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></span>` : ''}
      </div>
      ${sub ? `<div class="rel-kpi-sub">${sub}</div>` : ''}
    </div>
  `;
}

function _miniBar(pct, color = 'cyan', label = null) {
  const displayLabel = label !== null ? label : `${pct}%`;
  return `
    <div class="rel-mini-bar-wrap">
      <div class="rel-mini-bar">
        <div class="rel-mini-bar-fill rel-mini-bar-fill--${color}" style="width:${pct}%"></div>
      </div>
      <span class="rel-mini-bar-pct">${displayLabel}</span>
    </div>
  `;
}

// ─── Cache de Detalhamento Analítico para Hover Cards ────────
const _kpiBreakdowns = {};
let _popoverEl = null;
let _popoverHideTimeout = null;

function _initFloatingPopover() {
  if (document.getElementById('rel-floating-popover')) {
    _popoverEl = document.getElementById('rel-floating-popover');
    return;
  }
  _popoverEl = document.createElement('div');
  _popoverEl.id = 'rel-floating-popover';
  _popoverEl.className = 'rel-floating-popover';
  document.body.appendChild(_popoverEl);

  _popoverEl.addEventListener('mouseenter', () => {
    if (_popoverHideTimeout) clearTimeout(_popoverHideTimeout);
  });

  _popoverEl.addEventListener('mouseleave', () => {
    _hideKpiPopover();
  });
}

function _showKpiPopover(cardEl, data) {
  if (!_popoverEl) _initFloatingPopover();
  if (_popoverHideTimeout) clearTimeout(_popoverHideTimeout);
  if (!data) return;

  const { title, badge, items, formula, footer } = data;

  const itemsHtml = (items && items.length > 0)
    ? items.map(it => `
        <div class="rel-popover-item">
          <div class="rel-popover-item-main">
            <span class="rel-popover-item-name" title="${it.name}">${it.name}</span>
            ${it.sub ? `<span class="rel-popover-item-sub">${it.sub}</span>` : ''}
          </div>
          ${it.val ? `<span class="rel-popover-item-val">${it.val}</span>` : ''}
        </div>
      `).join('')
    : `<div class="rel-popover-empty">Nenhum registro individual encontrado no período.</div>`;

  _popoverEl.innerHTML = `
    <div class="rel-popover-header">
      <div class="rel-popover-title">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--cyan)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        ${title || 'Detalhamento'}
      </div>
      ${badge ? `<span class="rel-popover-badge">${badge}</span>` : ''}
    </div>
    <div class="rel-popover-body">
      <div class="rel-popover-list">
        ${itemsHtml}
      </div>
    </div>
    ${(formula || footer) ? `
      <div class="rel-popover-footer">
        ${footer ? `<div>${footer}</div>` : ''}
        ${formula ? `<span class="rel-popover-formula">${formula}</span>` : ''}
      </div>
    ` : ''}
  `;

  // Posicionamento inteligente (viewport bounds)
  const rect = cardEl.getBoundingClientRect();
  const popoverWidth = 320;
  
  let left = rect.left + (rect.width / 2) - (popoverWidth / 2);
  if (left < 16) left = 16;
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }

  let top = rect.bottom + 8;
  if (top + 280 > window.innerHeight && rect.top > 280) {
    top = rect.top - 280;
  }

  _popoverEl.style.left = `${left}px`;
  _popoverEl.style.top = `${top}px`;
  _popoverEl.classList.add('visible');
}

function _hideKpiPopover() {
  if (_popoverHideTimeout) clearTimeout(_popoverHideTimeout);
  _popoverHideTimeout = setTimeout(() => {
    if (_popoverEl) {
      _popoverEl.classList.remove('visible');
    }
  }, 120);
}

function _bindKpiHover(cardId, dataProvider) {
  const cardEl = document.getElementById(cardId);
  if (!cardEl) return;

  cardEl.onmouseenter = () => {
    const data = typeof dataProvider === 'function' ? dataProvider() : _kpiBreakdowns[cardId];
    if (data) _showKpiPopover(cardEl, data);
  };

  cardEl.onmouseleave = () => {
    _hideKpiPopover();
  };
}

// ─── Seção Acesso Negado ─────────────────────────────────────

function _htmlAccessDenied() {
  return `
    <div class="rel-access-denied">
      <div class="rel-access-icon">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h2>Acesso Restrito</h2>
      <p>Esta página está disponível apenas para usuários com perfil <strong>Administrador</strong>.</p>
    </div>
  `;
}

// ─── Tabs de Setor ───────────────────────────────────────────

function _htmlTabs() {
  const tabs = [
    {
      key: 'comercial',
      label: 'Setor Comercial',
      icon: `<svg viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-10 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>`,
    },
    {
      key: 'operacoes',
      label: 'Setor Operacional',
      icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M1 12h2M21 12h2M12 1v2M12 21v2"/></svg>`,
    },
    {
      key: 'master',
      label: 'Master / ADM',
      icon: `<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    },
  ];

  return `
    <div class="rel-tabs" id="rel-tabs">
      ${tabs.map(t => `
        <button
          class="rel-tab tab--${t.key} ${_tabAtual === t.key ? 'active' : ''}"
          data-tab="${t.key}"
          id="rel-tab-${t.key}"
        >
          ${t.icon}
          ${t.label}
        </button>
      `).join('')}
    </div>
  `;
}

// ============================================================
// SETOR COMERCIAL — 12 métricas
// ============================================================

function _htmlSectionComercial() {
  // ── Row 1: 4 KPIs principais de custo e conversão ──────────
  const row1 = `
    <div class="rel-kpi-row rel-kpi-row--4">

      ${_kpiCard({
        id: 'rel-cac',
        icon: `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>`,
        iconColor: 'cyan',
        accentColor: 'cyan',
        value: 'R$ —',
        label: 'CAC — Custo de Aquisição de Clientes',
        sub: 'Fórmula: Total Investido em Marketing & Vendas ÷ Total de Novos Clientes conquistados no período. Investimento vem de usuarios.investimento_marketing; novos clientes contam registros de clientes.criado_em dentro do período selecionado.',
        trend: 'neu',
        trendLabel: 'Período atual',
      })}

      ${_kpiCard({
        id: 'rel-ltv-cac',
        icon: `<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
        iconColor: 'green',
        accentColor: 'green',
        value: '—× ',
        label: 'LTV / CAC Ratio',
        sub: 'Saudável acima de 3×',
        trend: 'neu',
        trendLabel: 'Meta: 3×',
      })}

      ${_kpiCard({
        id: 'rel-cpq',
        icon: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        iconColor: 'blue',
        accentColor: 'blue',
        value: 'R$ —',
        label: 'CPQ — Custo por Lead Qualificado',
        sub: 'Fórmula: Total Investido em Marketing & Vendas ÷ Total de SQLs (negócios com reunião realizada no período). Investimento vem de usuarios.investimento_marketing; SQLs contam negocios com reuniao_realizada = TRUE e criado_em dentro do período selecionado.',
        trend: 'neu',
        trendLabel: 'Período atual',
      })}

      ${_kpiCard({
        id: 'rel-ticket-medio',
        icon: `<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        iconColor: 'amber',
        accentColor: 'amber',
        value: 'R$ —',
        label: 'Ticket Médio de Novos Contratos',
        sub: 'Fórmula: Soma do Valor dos Negócios Ganhos ÷ Total de Contratos Ganhos no período. Filtra negocios com negocio_status = Ganho e data_fechamento dentro do período selecionado; soma negocio_valor (numeric) e divide pela quantidade.',
        trend: 'neu',
        trendLabel: 'Período atual',
      })}

    </div>
  `;

  // ── Row 2: 4 KPIs de conversão e eficiência ──────────────
  const row2 = `
    <div class="rel-kpi-row rel-kpi-row--4">

      ${_kpiCard({
        id: 'rel-taxa-conversao',
        icon: `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        iconColor: 'green',
        accentColor: 'green',
        value: '—%',
        label: 'Taxa de Conversão',
        sub: 'Fórmula: (Total de Negócios Ganhos ÷ SQLs) × 100. Ganhos = negocios com negocio_status = Ganho e data_fechamento no período. SQLs = negocios com reuniao_realizada = TRUE e criado_em no período.',
        trend: 'neu',
        trendLabel: 'Período atual',
      })}

      ${_kpiCard({
        id: 'rel-mql-sql',
        icon: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        iconColor: 'purple',
        accentColor: 'purple',
        value: '—%',
        label: 'MQL para SQL Ratio',
        sub: 'Fórmula: (SQLs ÷ MQLs) × 100. MQL = total de negócios criados no período (criado_em). SQL = negócios com reuniao_realizada = TRUE criados no período. Mede quantos leads que entraram avançaram até a etapa de reunião de qualificação.',
        trend: 'neu',
        trendLabel: 'Meta: 30%',
      })}

      ${_kpiCard({
        id: 'rel-noshow',
        icon: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
        iconColor: 'red',
        accentColor: 'red',
        value: '—%',
        label: 'Taxa de No-Show em Reuniões',
        sub: 'Fórmula: (No-Shows ÷ Total de Reuniões) × 100. Reuniões = negócios com reuniao_realizada = TRUE no período. No-Show = desses, os com negocio_noshow = TRUE.',
        trend: 'neu',
        trendLabel: 'Meta: < 15%',
      })}

      ${_kpiCard({
        id: 'rel-churn-comercial',
        icon: `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        iconColor: 'red',
        accentColor: 'red',
        value: '—%',
        label: 'Taxa de Churn Comercial',
        sub: 'Fórmula: (Clientes que cancelaram ÷ Novos Clientes do período) × 100. Filtra clientes com cliente_churn = TRUE cuja data_churn ≤ fim do período e criado_em dentro do período, refletindo clientes que cancelaram antes mesmo de completar o ciclo.',
        trend: 'neu',
        trendLabel: 'Meta: < 5%',
      })}

    </div>
  `;

  // ── Row 3: Ciclo médio de vendas + Receita em Aberto ────
  const row3 = `
    <div class="rel-kpi-row rel-kpi-row--2">

      ${_kpiCard({
        id: 'rel-ciclo-vendas',
        icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        iconColor: 'cyan',
        accentColor: 'cyan',
        value: '— dias',
        label: 'Ciclo Médio de Vendas',
        sub: 'Fórmula: Média de (data_fechamento − criado_em) em dias. Filtra apenas negócios com negocio_status = Ganho e data_fechamento dentro do período selecionado. Mede o tempo médio desde o 1º contato até o fechamento.',
        trend: 'neu',
        trendLabel: 'Período atual',
      })}

      ${_kpiCard({
        id: 'rel-receita-aberto',
        icon: `<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
        iconColor: 'amber',
        accentColor: 'amber',
        value: 'R$ —',
        label: 'Receita em Aberto',
        sub: 'Fórmula: SUM(negocio_valor) de todos os negócios com negocio_status = Aberto. Snapshot atual do pipeline — não filtrado por período. Mede o potencial financeiro total das propostas ativas.',
        wide: false,
        trend: 'neu',
        trendLabel: 'Pipeline ativo',
      })}

    </div>
  `;

  // ── Cards de detalhe: Performance por Vendedor + Motivo de Perda ──
  const detailRow = `
    <div class="rel-detail-row rel-detail-row--21">

      <!-- Performance por Vendedor -->
      <div class="rel-detail-card" id="rel-performance-vendedor">
        <div class="rel-detail-card-header">
          <div class="rel-detail-card-title">
            <div class="rel-kpi-icon rel-kpi-icon--cyan">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <h3>Performance por Vendedor</h3>
              <p>Ranking de conversão da equipe comercial</p>
            </div>
          </div>
          <span class="rel-pill rel-pill--cyan">Equipe</span>
        </div>

        <table class="rel-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Vendedor</th>
              <th>Negócios</th>
              <th>Convertidos</th>
              <th>Taxa</th>
              <th>Receita</th>
            </tr>
          </thead>
          <tbody id="rel-vendedor-tbody">
            <tr><td colspan="6" style="text-align:center;padding:1.5rem;opacity:.5">Carregando…</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Motivo de Perda Campeão -->
      <div class="rel-detail-card" id="rel-motivo-perda">
        <div class="rel-detail-card-header">
          <div class="rel-detail-card-title">
            <div class="rel-kpi-icon rel-kpi-icon--red">
              <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <h3>Motivo de Perda Campeão</h3>
              <p>Principal razão de negócios perdidos</p>
            </div>
          </div>
          <span class="rel-pill rel-pill--red">Perda</span>
        </div>

        <div class="rel-motivo-loss" id="rel-motivos-lista">
          <!-- Preenchido dinamicamente por _carregarMotivosPerda() -->
          <div class="rel-motivo-empty">Carregando…</div>
        </div>
      </div>

    </div>
  `;

  // ── Card: Investimento em Marketing & Vendas ───────────────
  const investimentoCard = `
    <div class="rel-investimento-card" id="rel-investimento-card">
      <div class="rel-investimento-card-left">
        <div class="rel-kpi-icon rel-kpi-icon--cyan">
          <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="rel-investimento-card-info">
          <span class="rel-investimento-card-title">Investimento em Marketing & Vendas</span>
          <span class="rel-investimento-card-sub">Valor total investido no período</span>
        </div>
      </div>
      <div class="rel-investimento-card-right">

        <!-- Valor exibido (modo visualização) -->
        <span class="rel-investimento-val-display" id="rel-investimento-val-display" style="display:none"></span>

        <!-- Input (modo edição) -->
        <div class="rel-investimento-input-wrap" id="rel-investimento-wrap">
          <span class="rel-investimento-prefix">R$</span>
          <input
            type="text"
            inputmode="numeric"
            id="rel-investimento-input"
            class="rel-investimento-input"
            placeholder="0,00"
            autocomplete="off"
            value="${_formatarBRL(_investimentoMarketing)}"
          />
        </div>

        <!-- Botão Salvar (modo edição) -->
        <button class="rel-investimento-btn" id="rel-investimento-save">
          <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>

        <!-- Botão Editar (modo visualização) -->
        <button class="rel-investimento-btn rel-investimento-btn--outline" id="rel-investimento-edit" style="display:none">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>

        <span class="rel-investimento-status" id="rel-investimento-status"></span>
      </div>
    </div>
  `;

  return `
    <div class="rel-section active" id="rel-section-comercial">

      <!-- Cabeçalho da seção -->
      <div class="rel-section-header">
        <div class="rel-section-icon rel-section-icon--comercial">
          <svg viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-10 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
        </div>
        <div class="rel-section-title">
          <h2>Setor Comercial</h2>
          <p>Métricas de vendas, conversão e crescimento de receita</p>
        </div>
        <span class="rel-section-badge rel-section-badge--comercial">12 métricas</span>
      </div>

      <!-- Card: Investimento em Marketing & Vendas -->
      ${investimentoCard}

      <!-- Grupo: Custos & CAC -->
      <div class="rel-metric-group-label">Custos & Aquisição</div>
      ${row1}

      <!-- Grupo: Conversão & Eficiência -->
      <div class="rel-metric-group-label">Conversão & Eficiência</div>
      ${row2}

      <!-- Grupo: Pipeline & Tempo -->
      <div class="rel-metric-group-label">Pipeline & Tempo de Ciclo</div>
      ${row3}

      <!-- Grupo: Atividade (Equipe) -->
      <div class="rel-metric-group-label">Atividade Diária (Equipe)</div>
      <div class="card card-light" id="rel-atividade-card" style="margin-bottom: 20px;">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="card-title" style="font-size:14px; font-weight:700;">Métricas de Contato</div>
            <div class="card-subtitle" style="font-size:12px; color:var(--text-secondary);">Acompanhamento por membro</div>
          </div>
          <div style="display:flex; gap:10px;">
            <select class="form-input form-select" id="rel-atividade-vendedor" style="width:140px; height:32px; padding:0 8px; font-size:12px; background-color: var(--bg); border: 1px solid var(--border-light);">
              <option value="">Carregando...</option>
            </select>
            <input type="date" class="form-input" id="rel-atividade-inicio" value="${_hoje()}" style="width:115px; height:32px; padding:0 8px; font-size:12px; background-color: var(--bg); border: 1px solid var(--border-light);">
            <input type="date" class="form-input" id="rel-atividade-fim" value="${_hoje()}" style="width:115px; height:32px; padding:0 8px; font-size:12px; background-color: var(--bg); border: 1px solid var(--border-light);">
          </div>
        </div>
        <div style="display:flex; gap: 30px; align-items:center; justify-content:center; padding: 24px 0;">
          <div style="text-align:center;">
            <div style="font-size:36px; font-weight:900; color:var(--cyan); letter-spacing:-1.5px; line-height:1;" id="rel-atividade-contatos">0</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:6px; font-weight:500;">Contatos Realizados</div>
          </div>
          <div style="width:1px; background:var(--border-light); height:50px;"></div>
          <div style="text-align:center;">
            <div style="font-size:36px; font-weight:900; color:var(--cyan); letter-spacing:-1.5px; line-height:1;" id="rel-atividade-prospecao">0</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:6px; font-weight:500;">Prospecções</div>
          </div>
        </div>
      </div>

      <!-- Grupo: Análise Detalhada -->
      <div class="rel-metric-group-label">Análise Detalhada</div>
      ${detailRow}

    </div>
  `;
}

// ============================================================
// SETOR OPERACIONAL — Parte 2 — 9 métricas
// ============================================================

function _htmlSectionOperacoes() {

  // ── Grupo 1: Tempo & Capacidade — 2 KPI cards ──────────────
  const rowTempo = `
    <div class="rel-kpi-row rel-kpi-row--2">

      ${_kpiCard({
        id: 'rel-setup-medio',
        icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        iconColor: 'purple',
        accentColor: 'purple',
        value: '— min',
        label: 'Tempo Médio de Setup',
        sub: 'Por usuário ativado — da contratação ao 1º uso',
        trend: 'neu',
        trendLabel: 'vs. mês ant.',
      })}

      ${_kpiCard({
        id: 'rel-capacity',
        icon: `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
        iconColor: 'blue',
        accentColor: 'blue',
        value: '—%',
        label: 'Capacity Operacional',
        sub: 'Capacidade utilizada vs. disponível da equipe',
        trend: 'neu',
        trendLabel: 'Meta: 80%',
      })}

    </div>
  `;

  // ── Grupo 2: Saúde & Qualidade — 3 KPI cards ──────────────
  const rowSaude = `
    <div class="rel-kpi-row rel-kpi-row--3">

      ${_kpiCard({
        id: 'rel-health-score',
        icon: `<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
        iconColor: 'green',
        accentColor: 'green',
        value: '—',
        label: 'Health Score Médio da Carteira',
        sub: 'Fórmula: Média da coluna cliente_satisfacao convertida em pontos (Muito Insatisfeito = 0 a Muito Satisfeito = 100) onde cliente_status = "Ativado".',
        trend: 'neu',
        trendLabel: 'Meta: ≥ 75',
      })}

      ${_kpiCard({
        id: 'rel-nps',
        icon: `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        iconColor: 'purple',
        accentColor: 'purple',
        value: '—',
        label: 'NPS / Satisfação por Gestor',
        sub: 'Fórmula: Média das colunas (nota_comunicacao + nota_entrega + nota_performance) de clientes Ativados. Valores de 0 a 10.',
        trend: 'neu',
        trendLabel: 'Meta: ≥ 8,0',
      })}

      ${_kpiCard({
        id: 'rel-silencio',
        icon: `<svg viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
        iconColor: 'red',
        accentColor: 'red',
        value: '—%',
        label: 'Índice de Silêncio',
        sub: 'Fórmula: (Clientes com gap > 7 dias desde a última tarefa concluída ÷ Total de clientes Ativados) × 100.',
        trend: 'neu',
        trendLabel: 'Meta: < 10%',
      })}

    </div>
  `;

  // ── Grupo 3: Eficiência — 2 KPI cards + 1 detalhe ─────────
  const rowEficiencia = `
    <div class="rel-kpi-row rel-kpi-row--2">

      ${_kpiCard({
        id: 'rel-campanhas-sem-saldo',
        icon: `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        iconColor: 'amber',
        accentColor: 'amber',
        value: '—%',
        label: 'Taxa de Campanhas sem Saldo',
        sub: 'Fórmula: (Clientes "Sem Saldo" ÷ Total de clientes Ativados) × 100.',
        trend: 'neu',
        trendLabel: 'Meta: < 5%',
      })}

      ${_kpiCard({
        id: 'rel-otimizacoes',
        icon: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        iconColor: 'cyan',
        accentColor: 'cyan',
        value: '—',
        label: 'Volume de Otimizações Realizadas',
        sub: 'Fórmula: Contagem de clientes Ativados com cliente_otimizacao = TRUE.',
        trend: 'neu',
        trendLabel: 'vs. mês ant.',
      })}

    </div>
  `;

  // ── Card Detalhado: Taxa de Conclusão por Usuário ──────────
  const detailAtividades = `
    <div class="rel-detail-row rel-detail-row--2">

      <!-- Taxa de Conclusão de Atividades Diárias por Usuário -->
      <div class="rel-detail-card" id="rel-conclusao-atividades">
        <div class="rel-detail-card-header">
          <div class="rel-detail-card-title">
            <div class="rel-kpi-icon rel-kpi-icon--purple">
              <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div>
              <h3>Taxa de Conclusão de Atividades Diárias</h3>
              <p>Performance individual da equipe operacional</p>
            </div>
          </div>
          <span class="rel-pill rel-pill--cyan">Por usuário</span>
        </div>

        <table class="rel-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Colaborador</th>
              <th>Previstas</th>
              <th>Concluídas</th>
              <th>Taxa</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="rel-atividades-tbody">
            <tr>
              <td class="rel-rank">1</td>
              <td>
                <div class="rel-avatar-cell">
                  <div class="rel-table-avatar">—</div>
                  <div>
                    <div class="rel-table-name">Carregando…</div>
                    <div class="rel-table-sub">Operacional</div>
                  </div>
                </div>
              </td>
              <td>—</td>
              <td>—</td>
              <td>${_miniBar(0, 'purple')}</td>
              <td><span class="rel-pill rel-pill--amber">—</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- NPS detalhado por Gestor -->
      <div class="rel-detail-card" id="rel-nps-gestor">
        <div class="rel-detail-card-header">
          <div class="rel-detail-card-title">
            <div class="rel-kpi-icon rel-kpi-icon--purple">
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <h3>NPS / Satisfação por Gestor</h3>
              <p>Score de satisfação segmentado por responsável</p>
            </div>
          </div>
          <span class="rel-pill rel-pill--cyan">Por gestor</span>
        </div>

        <div class="rel-motivo-loss" id="rel-nps-lista">
          <div style="text-align:center; padding: 24px;">Carregando NPS detalhado...</div>
        </div>
      </div>

    </div>
  `;

  return `
    <div class="rel-section" id="rel-section-operacoes">

      <!-- Cabeçalho da seção -->
      <div class="rel-section-header">
        <div class="rel-section-icon rel-section-icon--operacoes">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M1 12h2M21 12h2M12 1v2M12 21v2"/></svg>
        </div>
        <div class="rel-section-title">
          <h2>Setor Operacional</h2>
          <p>Eficiência da equipe, saúde da carteira e qualidade do atendimento</p>
        </div>
        <span class="rel-section-badge rel-section-badge--operacoes">9 métricas</span>
      </div>

      <!-- Grupo: Tempo & Capacidade -->
      <div class="rel-metric-group-label">Tempo & Capacidade</div>
      ${rowTempo}

      <!-- Grupo: Saúde & Qualidade -->
      <div class="rel-metric-group-label">Saúde & Qualidade</div>
      ${rowSaude}

      <!-- Grupo: Eficiência Operacional -->
      <div class="rel-metric-group-label">Eficiência Operacional</div>
      ${rowEficiencia}

      <!-- Grupo: Análise por Colaborador -->
      <div class="rel-metric-group-label">Análise por Colaborador</div>
      ${detailAtividades}

    </div>
  `;
}

// ============================================================
// SETOR MASTER — Parte 3 — 14 métricas
// ============================================================

function _htmlSectionMaster() {

  // ── Grupo 1: Receita Recorrente — 4 KPI cards ──────────────
  const rowMrr = `
    <div class="rel-kpi-row rel-kpi-row--4">

      ${_kpiCard({
        id: 'rel-mrr',
        icon: `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        iconColor: 'amber',
        accentColor: 'amber',
        value: 'R$ —',
        label: 'MRR — Receita Recorrente Mensal',
        sub: 'Soma de todas as mensalidades ativas',
        trend: 'neu',
        trendLabel: 'vs. mês ant.',
      })}

      ${_kpiCard({
        id: 'rel-ltv-total',
        icon: `<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
        iconColor: 'green',
        accentColor: 'green',
        value: 'R$ —',
        label: 'LTV Total da Carteira',
        sub: 'Fórmula: LTV Médio × Total de Clientes Ativos. Representa o valor patrimonial estimado de toda a carteira de contratos ativos.',
        trend: 'neu',
        trendLabel: 'Carteira ativa',
      })}

      ${_kpiCard({
        id: 'rel-ltv-medio',
        icon: `<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
        iconColor: 'cyan',
        accentColor: 'cyan',
        value: 'R$ —',
        label: 'LTV Médio',
        sub: 'Fórmula: Média histórica de negocio_valor de todos os negócios Ganhos. Representa o valor médio que cada cliente traz para a Visi.',
        trend: 'neu',
        trendLabel: 'Média histórica',
      })}

      ${_kpiCard({
        id: 'rel-receita-cliente',
        icon: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        iconColor: 'blue',
        accentColor: 'blue',
        value: 'R$ —',
        label: 'Receita Total por Cliente',
        sub: 'Receita média gerada por cliente ativo',
        trend: 'neu',
        trendLabel: 'vs. mês ant.',
      })}

    </div>
  `;

  // ── Grupo 2: Saúde Financeira — 4 KPI cards ────────────────
  const rowFinanceiro = `
    <div class="rel-kpi-row rel-kpi-row--4">

      ${_kpiCard({
        id: 'rel-ebitda',
        icon: `<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
        iconColor: 'amber',
        accentColor: 'amber',
        value: 'R$ —',
        label: 'EBITDA',
        sub: 'Lucro antes de juros, impostos, depreciação e amortização',
        trend: 'neu',
        trendLabel: 'vs. mês ant.',
      })}

      ${_kpiCard({
        id: 'rel-quick-ratio',
        icon: `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        iconColor: 'green',
        accentColor: 'green',
        value: '—×',
        label: 'Quick Ratio da Agência',
        sub: 'Crescimento de receita vs. perda de churn',
        trend: 'neu',
        trendLabel: 'Meta: > 4×',
      })}

      ${_kpiCard({
        id: 'rel-fat-colaborador',
        icon: `<svg viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="2"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/></svg>`,
        iconColor: 'purple',
        accentColor: 'purple',
        value: 'R$ —',
        label: 'Faturamento por Colaborador',
        sub: 'Receita gerada por pessoa da equipe',
        trend: 'neu',
        trendLabel: 'vs. mês ant.',
      })}

      ${_kpiCard({
        id: 'rel-revenue-churn',
        icon: `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        iconColor: 'red',
        accentColor: 'red',
        value: 'R$ —',
        label: 'Revenue Churn (Financial)',
        sub: 'Receita perdida por cancelamentos no período',
        trend: 'neu',
        trendLabel: 'Meta: mínimo',
      })}

    </div>
  `;

  // ── Grupo 3: Crescimento & Retenção — 4 KPI cards ──────────
  const rowCrescimento = `
    <div class="rel-kpi-row rel-kpi-row--4">

      ${_kpiCard({
        id: 'rel-expansao-base',
        icon: `<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
        iconColor: 'green',
        accentColor: 'green',
        value: '—%',
        label: 'Taxa de Expansão de Base (Upsell)',
        sub: 'Clientes que aumentaram plano ou mensalidade',
        trend: 'neu',
        trendLabel: 'Meta: > 15%',
      })}

      ${_kpiCard({
        id: 'rel-cac-payback',
        icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        iconColor: 'cyan',
        accentColor: 'cyan',
        value: '— meses',
        label: 'CAC Payback Period',
        sub: 'Tempo para recuperar o custo de aquisição',
        trend: 'neu',
        trendLabel: 'Meta: < 12 meses',
      })}

      ${_kpiCard({
        id: 'rel-churn-clientes',
        icon: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
        iconColor: 'red',
        accentColor: 'red',
        value: '—%',
        label: 'Taxa de Churn de Clientes',
        sub: 'Percentual de clientes cancelados no período',
        trend: 'neu',
        trendLabel: 'Meta: < 3%',
      })}

      ${_kpiCard({
        id: 'rel-inadimplencia',
        icon: `<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
        iconColor: 'red',
        accentColor: 'red',
        value: '—%',
        label: 'Taxa de Inadimplência',
        sub: 'Clientes com pagamento em atraso',
        trend: 'neu',
        trendLabel: 'Meta: < 5%',
      })}

    </div>
  `;

  // ── Grupo 4: Análise Executiva — 2 cards detalhados ────────
  const rowExecutivo = `
    <div class="rel-detail-row rel-detail-row--2">

      <!-- Avanço na Meta Mensal -->
      <div class="rel-detail-card" id="rel-avanco-meta">
        <div class="rel-detail-card-header">
          <div class="rel-detail-card-title">
            <div class="rel-kpi-icon rel-kpi-icon--amber">
              <svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            </div>
            <div>
              <h3>Avanço na Meta Mensal</h3>
              <p>Progresso do faturamento vs. meta estabelecida</p>
            </div>
          </div>
          <span class="rel-pill rel-pill--amber">Mês atual</span>
        </div>

        <!-- Barra de meta principal -->
        <div class="rel-meta-wrap">
          <div class="rel-meta-header">
            <span class="rel-meta-label">Realizado</span>
            <span class="rel-meta-values">
              <span class="rel-meta-current" id="rel-meta-current">R$ —</span>
              <span class="rel-meta-sep">de</span>
              <span class="rel-meta-goal" id="rel-meta-goal">R$ —</span>
            </span>
          </div>
          <div class="rel-meta-bar-outer">
            <div class="rel-meta-bar-fill" id="rel-meta-bar" style="width:0%"></div>
            <span class="rel-meta-bar-label" id="rel-meta-pct">0%</span>
          </div>
          <div class="rel-meta-sub-row">
            <span class="rel-meta-note" id="rel-meta-restante">Restam R$ — para atingir a meta</span>
            <span class="rel-pill rel-pill--amber" id="rel-meta-status">Em andamento</span>
          </div>
        </div>

        <!-- Mini KPIs abaixo -->
        <div class="rel-meta-kpis">
          <div class="rel-meta-kpi-item">
            <span class="rel-meta-kpi-value" id="rel-meta-dias-uteis">—</span>
            <span class="rel-meta-kpi-label">Dias úteis restantes</span>
          </div>
          <div class="rel-meta-kpi-divider"></div>
          <div class="rel-meta-kpi-item">
            <span class="rel-meta-kpi-value" id="rel-meta-ritmo">R$ —</span>
            <span class="rel-meta-kpi-label">Necessário por dia</span>
          </div>
          <div class="rel-meta-kpi-divider"></div>
          <div class="rel-meta-kpi-item">
            <span class="rel-meta-kpi-value" id="rel-meta-projecao">—%</span>
            <span class="rel-meta-kpi-label">Projeção de atingimento</span>
          </div>
        </div>
      </div>

      <!-- Valor Vendido vs. Valor que Entrou no Caixa -->
      <div class="rel-detail-card" id="rel-vendido-vs-caixa">
        <div class="rel-detail-card-header">
          <div class="rel-detail-card-title">
            <div class="rel-kpi-icon rel-kpi-icon--cyan">
              <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <h3>Vendido vs. Caixa</h3>
              <p>Comparativo entre valor contratado e valor recebido</p>
            </div>
          </div>
          <span class="rel-pill rel-pill--cyan">Período atual</span>
        </div>

        <!-- Comparativo visual -->
        <div class="rel-vsbox">

          <div class="rel-vsbox-item rel-vsbox-item--vendido">
            <div class="rel-vsbox-icon">
              <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div class="rel-vsbox-body">
              <span class="rel-vsbox-value" id="rel-val-vendido">R$ —</span>
              <span class="rel-vsbox-label">Valor Vendido (Contratos)</span>
              <span class="rel-vsbox-sub">Soma dos contratos fechados no período</span>
            </div>
          </div>

          <div class="rel-vsbox-separator">
            <div class="rel-vsbox-sep-line"></div>
            <span class="rel-vsbox-sep-icon">vs</span>
            <div class="rel-vsbox-sep-line"></div>
          </div>

          <div class="rel-vsbox-item rel-vsbox-item--caixa">
            <div class="rel-vsbox-icon">
              <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div class="rel-vsbox-body">
              <span class="rel-vsbox-value" id="rel-val-caixa">R$ —</span>
              <span class="rel-vsbox-label">Valor no Caixa (Recebido)</span>
              <span class="rel-vsbox-sub">Pagamentos efetivamente recebidos</span>
            </div>
          </div>

        </div>

        <!-- Diferença -->
        <div class="rel-vsbox-diff">
          <span class="rel-vsbox-diff-label">Diferença (Pendente / Inadimplência)</span>
          <span class="rel-vsbox-diff-value" id="rel-val-diff">R$ —</span>
        </div>

        <!-- Mini barra de recebimento -->
        <div style="margin-top:14px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;color:var(--text-muted);font-weight:600;">Taxa de Recebimento</span>
            <span style="font-size:11px;font-weight:700;color:var(--black);" id="rel-taxa-recebimento">—%</span>
          </div>
          ${_miniBar(0, 'green')}
        </div>
      </div>

    </div>
  `;

  return `
    <div class="rel-section" id="rel-section-master">

      <!-- Cabeçalho da seção -->
      <div class="rel-section-header">
        <div class="rel-section-icon rel-section-icon--master">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="rel-section-title">
          <h2>Setor Master — Gestão Executiva</h2>
          <p>Financeiro, MRR, LTV, EBITDA e visão estratégica da agência</p>
        </div>
        <span class="rel-section-badge rel-section-badge--master">14 métricas</span>
      </div>

      <!-- Grupo: Receita Recorrente -->
      <div class="rel-metric-group-label">Receita Recorrente & LTV</div>
      ${rowMrr}

      <!-- Grupo: Saúde Financeira -->
      <div class="rel-metric-group-label">Saúde Financeira</div>
      ${rowFinanceiro}

      <!-- Grupo: Crescimento & Retenção -->
      <div class="rel-metric-group-label">Crescimento & Retenção</div>
      ${rowCrescimento}

      <!-- Grupo: Análise Executiva -->
      <div class="rel-metric-group-label">Análise Executiva</div>
      ${rowExecutivo}

    </div>
  `;
}

// ─── Seletor de Período ──────────────────────────────────────

function _htmlPeriodPicker() {
  return `
    <div class="rel-period-picker" id="rel-period-picker">

      <!-- Atalhos rápidos -->
      <div class="rel-period-shortcuts" id="rel-period-shortcuts">
        <button class="rel-shortcut" data-shortcut="mes-atual">Este mês</button>
        <button class="rel-shortcut" data-shortcut="mes-anterior">Mês anterior</button>
        <button class="rel-shortcut" data-shortcut="30d">Últimos 30 dias</button>
        <button class="rel-shortcut" data-shortcut="90d">Últimos 90 dias</button>
        <button class="rel-shortcut" data-shortcut="ano-atual">Este ano</button>
      </div>

      <!-- Divisor -->
      <div class="rel-period-divider"></div>

      <!-- Inputs de data -->
      <div class="rel-period-inputs">
        <div class="rel-period-field">
          <label class="rel-period-field-label">Data inicial</label>
          <input
            type="date"
            id="rel-data-inicio"
            class="rel-period-input"
            value="${_dataInicio}"
          />
        </div>
        <div class="rel-period-range-sep">
          <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
        <div class="rel-period-field">
          <label class="rel-period-field-label">Data final</label>
          <input
            type="date"
            id="rel-data-fim"
            class="rel-period-input"
            value="${_dataFim}"
          />
        </div>
        <button class="rel-period-apply" id="rel-period-apply">
          <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Aplicar
        </button>
      </div>

    </div>
  `;
}

// ─── Render principal ────────────────────────────────────────

function _htmlPage() {
  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1>Relatórios</h1>
        <p>Painel executivo de métricas por setor</p>
      </div>
      <div class="rel-header-actions">

        <!-- Badge clicável que abre o picker -->
        <button class="rel-period-badge" id="rel-period-badge-btn" title="Alterar período">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span id="rel-period-badge-text">${_periodLabel}</span>
          <svg class="rel-period-badge-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <!-- Wrapper do picker (fechado por padrão) -->
        <div class="rel-period-wrapper" id="rel-period-wrapper">
          ${_htmlPeriodPicker()}
        </div>

      </div>
    </div>

    ${_htmlTabs()}

    <div id="rel-sections-container">
      ${_htmlSectionComercial()}
      ${_htmlSectionOperacoes()}
      ${_htmlSectionMaster()}
    </div>
  `;
}

// ─── Investimento em Marketing & Vendas ──────────────────────

/** Alterna para o modo visualização (exibe valor + botão Editar) */
function _modoViewInvestimento() {
  const wrap    = document.getElementById('rel-investimento-wrap');
  const btnSave = document.getElementById('rel-investimento-save');
  const btnEdit = document.getElementById('rel-investimento-edit');
  const display = document.getElementById('rel-investimento-val-display');

  if (wrap)    wrap.style.display    = 'none';
  if (btnSave) btnSave.style.display = 'none';
  if (btnEdit) btnEdit.style.display = 'inline-flex';
  if (display) {
    display.textContent  = `R$ ${_formatarBRL(_investimentoMarketing)}`;
    display.style.display = 'inline-flex';
  }
}

/** Alterna para o modo edição (exibe input + botão Salvar) */
function _modoEditInvestimento() {
  const wrap    = document.getElementById('rel-investimento-wrap');
  const btnSave = document.getElementById('rel-investimento-save');
  const btnEdit = document.getElementById('rel-investimento-edit');
  const display = document.getElementById('rel-investimento-val-display');
  const inputEl = document.getElementById('rel-investimento-input');

  if (display) display.style.display = 'none';
  if (btnEdit) btnEdit.style.display  = 'none';
  if (wrap)    wrap.style.display     = 'flex';
  if (btnSave) btnSave.style.display  = 'inline-flex';

  if (inputEl) {
    inputEl.value = _formatarBRL(_investimentoMarketing);
    inputEl.focus();
    // Posiciona cursor no final
    const len = inputEl.value.length;
    inputEl.setSelectionRange(len, len);
  }
}

/**
 * Carrega o investimento_marketing para o período selecionado
 * com busca prioritária na tabela `relatorios_investimentos` e fallback em `usuarios`.
 */
async function _carregarInvestimento() {
  const userId = UserStore.getUserId();
  const periodoKey = _dataInicio ? _dataInicio.substring(0, 7) : 'padrao';
  let valor = 0;

  try {
    const { data: invData, error: invError } = await supabase
      .from('relatorios_investimentos')
      .select('valor')
      .eq('periodo', periodoKey)
      .maybeSingle();

    if (!invError && invData?.valor !== undefined && invData?.valor !== null) {
      valor = Number(invData.valor);
    } else if (userId) {
      const { data: uData } = await supabase
        .from('usuarios')
        .select('investimento_marketing')
        .eq('user_id', userId)
        .single();
      valor = Number(uData?.investimento_marketing ?? 0);
    }
  } catch (err) {
    console.warn('[Relatórios] Erro ao carregar investimento:', err);
  }

  _investimentoMarketing = valor;

  if (valor > 0) {
    _modoViewInvestimento();
  } else {
    const inputEl = document.getElementById('rel-investimento-input');
    if (inputEl) inputEl.value = '';
    _modoEditInvestimento();
  }
}

/**
 * Salva o investimento_marketing digitado para o período atual na tabela
 * `relatorios_investimentos` e sincroniza com `usuarios`.
 */
async function _salvarInvestimento() {
  const userId = UserStore.getUserId();
  const periodoKey = _dataInicio ? _dataInicio.substring(0, 7) : 'padrao';

  const input  = document.getElementById('rel-investimento-input');
  const status = document.getElementById('rel-investimento-status');
  const btn    = document.getElementById('rel-investimento-save');

  const valor = _parseBRL(input?.value);

  if (btn)    btn.disabled = true;
  if (status) { status.textContent = 'Salvando…'; status.className = 'rel-investimento-status rel-investimento-status--saving'; }

  try {
    // 1. Salva na tabela dedicada por período
    const { error: invErr } = await supabase
      .from('relatorios_investimentos')
      .upsert({
        periodo: periodoKey,
        valor: valor,
        atualizado_em: new Date().toISOString()
      });

    if (invErr) throw invErr;

    // 2. Sincroniza em usuarios (fallback de compatibilidade)
    if (userId) {
      await supabase
        .from('usuarios')
        .update({ investimento_marketing: valor })
        .eq('user_id', userId);
    }

    _investimentoMarketing = valor;

    if (status) { status.textContent = 'Salvo!'; status.className = 'rel-investimento-status rel-investimento-status--ok'; }
    _modoViewInvestimento();

    setTimeout(() => {
      if (status) { status.textContent = ''; status.className = 'rel-investimento-status'; }
    }, 2000);

    if (btn) btn.disabled = false;

    // Recalcula imediatamente as métricas que dependem do investimento
    _carregarCAC(_dataInicio, _dataFim);
    _carregarCPQ(_dataInicio, _dataFim);
    _carregarLtvMetrics(_dataInicio, _dataFim);

  } catch (error) {
    console.error('[Relatórios] Erro ao salvar investimento:', error.message);
    if (status) { status.textContent = 'Erro ao salvar'; status.className = 'rel-investimento-status rel-investimento-status--error'; }
    if (btn) btn.disabled = false;
  }
}

function _bindInvestimentoEvents() {
  const inputEl = document.getElementById('rel-investimento-input');

  // Máscara BRL em tempo real
  inputEl?.addEventListener('input', () => _maskBRL(inputEl));

  // Salvar via botão
  document.getElementById('rel-investimento-save')?.addEventListener('click', _salvarInvestimento);

  // Editar: volta ao modo edição
  document.getElementById('rel-investimento-edit')?.addEventListener('click', _modoEditInvestimento);

  // Salvar com Enter
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _salvarInvestimento();
  });
}

// ─── CAC — Custo de Aquisição de Clientes ────────────────────

/**
 * Calcula e exibe o CAC no período selecionado.
 *
 * Fórmula:
 *   CAC = investimento_marketing (usuarios) ÷ novos clientes (clientes.criado_em no período)
 *
 * @param {string} inicio  'YYYY-MM-DD'
 * @param {string} fim     'YYYY-MM-DD'
 */
async function _carregarMRR() {
  const cardEl = document.getElementById('rel-mrr');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');

  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('cliente_mensalidade')
      .eq('cliente_status', 'Ativado');

    if (error) throw error;

    let totalMrr = 0;
    const qtdAtivos = clientes ? clientes.length : 0;
    
    if (clientes && qtdAtivos > 0) {
      totalMrr = clientes.reduce((acc, c) => acc + Number(c.cliente_mensalidade || 0), 0);
    }

    if (valueEl) {
      valueEl.textContent = `R$ ${_formatarBRL(totalMrr)}`;
    }
    if (subEl) {
      subEl.textContent = `Soma de ${qtdAtivos} mensalidade${qtdAtivos !== 1 ? 's' : ''} ativa${qtdAtivos !== 1 ? 's' : ''}`;
    }
    if (trendEl) {
      trendEl.textContent = 'Tempo real';
      trendEl.className = 'rel-kpi-trend rel-kpi-trend--neu';
    }
  } catch (err) {
    console.error('[Relatórios] Erro ao carregar MRR:', err);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Receita Total por Cliente ────────────────────────────────────────────────
/**
 * Fórmula: MRR ÷ total de clientes com cliente_status = 'Ativado'
 */
async function _carregarReceitaCliente() {
  const cardEl  = document.getElementById('rel-receita-cliente');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');
  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('cliente_mensalidade')
      .eq('cliente_status', 'Ativado');

    if (error) throw error;

    const qtd = clientes?.length ?? 0;
    const mrr = clientes?.reduce((acc, c) => acc + Number(c.cliente_mensalidade || 0), 0) ?? 0;
    const media = qtd > 0 ? mrr / qtd : 0;

    if (valueEl) valueEl.textContent = `R$ ${_formatarBRL(media)}`;
    if (subEl)   subEl.textContent   = `MRR R$ ${_formatarBRL(mrr)} ÷ ${qtd} cliente${qtd !== 1 ? 's' : ''} ativo${qtd !== 1 ? 's' : ''}`;
    if (trendEl) { trendEl.textContent = `${qtd} ativos`; trendEl.className = 'rel-kpi-trend rel-kpi-trend--neu'; }
  } catch (err) {
    console.error('[Relatórios] Erro ao carregar Receita por Cliente:', err);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Revenue Churn (Financial) ────────────────────────────────────────────────
/**
 * Fórmula: Soma de receita_perdida dos clientes que deram churn no período
 * (data_churn BETWEEN inicio AND fim)
 */
async function _carregarRevenueChurn(inicio, fim) {
  const cardEl  = document.getElementById('rel-revenue-churn');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');
  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    const { data: churns, error } = await supabase
      .from('clientes')
      .select('receita_perdida')
      .eq('cliente_churn', true)
      .gte('data_churn', inicioISO)
      .lte('data_churn', fimISO);

    if (error) throw error;

    const qtdChurn = churns?.length ?? 0;
    const totalPerdido = churns?.reduce((acc, c) => acc + Number(c.receita_perdida || 0), 0) ?? 0;

    if (valueEl) valueEl.textContent = `R$ ${_formatarBRL(totalPerdido)}`;
    if (subEl)   subEl.textContent   = `${qtdChurn} cancelamento${qtdChurn !== 1 ? 's' : ''} no período`;
    if (trendEl) {
      trendEl.textContent  = totalPerdido > 0 ? 'Atenção' : 'Nenhum churn';
      trendEl.className    = `rel-kpi-trend rel-kpi-trend--${totalPerdido > 0 ? 'down' : 'up'}`;
    }
  } catch (err) {
    console.error('[Relatórios] Erro ao carregar Revenue Churn:', err);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Quick Ratio ─────────────────────────────────────────────────────────────
/**
 * Fórmula: MRR de novos clientes do período ÷ receita_perdida do período
 * Mede: cada R$1 perdido em churn, quantos R$ novos entraram
 * Meta: > 4×
 */
async function _carregarQuickRatio(inicio, fim) {
  const cardEl  = document.getElementById('rel-quick-ratio');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');
  if (valueEl) valueEl.textContent = '…×';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // Novos clientes no período → soma de mensalidade
    const { data: novos, error: novosErr } = await supabase
      .from('clientes')
      .select('cliente_mensalidade')
      .gte('criado_em', inicioISO)
      .lte('criado_em', fimISO);

    if (novosErr) throw novosErr;

    // Churns no período → soma de receita_perdida
    const { data: churns, error: churnsErr } = await supabase
      .from('clientes')
      .select('receita_perdida')
      .eq('cliente_churn', true)
      .gte('data_churn', inicioISO)
      .lte('data_churn', fimISO);

    if (churnsErr) throw churnsErr;

    const mrrNovos    = novos?.reduce((acc, c) => acc + Number(c.cliente_mensalidade || 0), 0) ?? 0;
    const perdaChurn  = churns?.reduce((acc, c) => acc + Number(c.receita_perdida || 0), 0) ?? 0;

    if (perdaChurn === 0) {
      if (valueEl) valueEl.textContent = mrrNovos > 0 ? '∞×' : '—×';
      if (subEl)   subEl.textContent   = mrrNovos > 0
        ? `R$ ${_formatarBRL(mrrNovos)} novos · Sem churn no período`
        : 'Sem novos clientes nem churn no período';
      if (trendEl) { trendEl.textContent = 'Sem churn'; trendEl.className = 'rel-kpi-trend rel-kpi-trend--up'; }
    } else {
      const ratio = mrrNovos / perdaChurn;
      const ratioStr = ratio.toFixed(1).replace('.', ',');
      if (valueEl) valueEl.textContent = `${ratioStr}×`;
      if (subEl)   subEl.textContent   = `R$ ${_formatarBRL(mrrNovos)} novo ÷ R$ ${_formatarBRL(perdaChurn)} perdido`;
      const ok = ratio >= 4;
      if (trendEl) {
        trendEl.textContent = ok ? '✅ Meta atingida (>4×)' : '⚠️ Abaixo da meta';
        trendEl.className   = `rel-kpi-trend rel-kpi-trend--${ok ? 'up' : 'down'}`;
      }
    }
  } catch (err) {
    console.error('[Relatórios] Erro ao carregar Quick Ratio:', err);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Faturamento por Colaborador ──────────────────────────────────────────────
/**
 * Fórmula: MRR ÷ número de usuários cadastrados no sistema
 */
async function _carregarFaturamentoColaborador() {
  const cardEl  = document.getElementById('rel-fat-colaborador');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');
  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    // MRR total
    const { data: clientes, error: cliErr } = await supabase
      .from('clientes')
      .select('cliente_mensalidade')
      .eq('cliente_status', 'Ativado');

    if (cliErr) throw cliErr;

    // Total de colaboradores (usuários cadastrados)
    const { count: totalUsuarios, error: usuErr } = await supabase
      .from('usuarios')
      .select('user_id', { count: 'exact', head: true });

    if (usuErr) throw usuErr;

    const mrr  = clientes?.reduce((acc, c) => acc + Number(c.cliente_mensalidade || 0), 0) ?? 0;
    const qtd  = totalUsuarios ?? 0;
    const fat  = qtd > 0 ? mrr / qtd : 0;

    if (valueEl) valueEl.textContent = `R$ ${_formatarBRL(fat)}`;
    if (subEl)   subEl.textContent   = `MRR R$ ${_formatarBRL(mrr)} ÷ ${qtd} colaborador${qtd !== 1 ? 'es' : ''}`;
    if (trendEl) { trendEl.textContent = `${qtd} colaborador${qtd !== 1 ? 'es' : ''}`; trendEl.className = 'rel-kpi-trend rel-kpi-trend--neu'; }
  } catch (err) {
    console.error('[Relatórios] Erro ao carregar Faturamento por Colaborador:', err);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── EBITDA Aproximado ────────────────────────────────────────────────────────
/**
 * Fórmula: MRR − Σ investimento_midia de todos os clientes ativos
 * (Aproximação: receita recorrente menos o total investido em mídia dos clientes)
 */
async function _carregarEbitda() {
  const cardEl  = document.getElementById('rel-ebitda');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');
  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('cliente_mensalidade, investimento_midia')
      .eq('cliente_status', 'Ativado');

    if (error) throw error;

    const mrr              = clientes?.reduce((acc, c) => acc + Number(c.cliente_mensalidade || 0), 0) ?? 0;
    const totalInvestMidia = clientes?.reduce((acc, c) => acc + Number(c.investimento_midia  || 0), 0) ?? 0;
    const ebitda           = mrr - totalInvestMidia;
    const margem           = mrr > 0 ? ((ebitda / mrr) * 100).toFixed(1).replace('.', ',') : '0,0';

    if (valueEl) valueEl.textContent = `R$ ${_formatarBRL(ebitda)}`;
    if (subEl)   subEl.textContent   = `MRR R$ ${_formatarBRL(mrr)} − Mídia R$ ${_formatarBRL(totalInvestMidia)} · Margem ${margem}%`;
    if (trendEl) {
      trendEl.textContent = ebitda >= 0 ? `${margem}% margem` : 'Negativo';
      trendEl.className   = `rel-kpi-trend rel-kpi-trend--${ebitda >= 0 ? 'up' : 'down'}`;
    }
  } catch (err) {
    console.error('[Relatórios] Erro ao carregar EBITDA:', err);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Taxa de Churn de Clientes ────────────────────────────────────────────────
/**
 * Fórmula: (clientes com data_churn no período ÷ base de clientes no início do período) × 100
 */
async function _carregarChurnClientes(inicio, fim) {
  const cardEl  = document.getElementById('rel-churn-clientes');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');
  if (valueEl) valueEl.textContent = '…%';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // Churns no período
    const { count: qtdChurn, error: churnErr } = await supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact', head: true })
      .eq('cliente_churn', true)
      .gte('data_churn', inicioISO)
      .lte('data_churn', fimISO);

    if (churnErr) throw churnErr;

    // Base de clientes no início do período (criado_em <= inicio)
    const { count: baseInicio, error: baseErr } = await supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact', head: true })
      .lte('criado_em', inicioISO);

    if (baseErr) throw baseErr;

    const churns = qtdChurn ?? 0;
    const base   = baseInicio ?? 0;
    const taxa   = base > 0 ? ((churns / base) * 100) : 0;
    const taxaStr = taxa.toFixed(1).replace('.', ',');

    if (valueEl) valueEl.textContent = `${taxaStr}%`;
    if (subEl)   subEl.textContent   = `${churns} cancelamento${churns !== 1 ? 's' : ''} ÷ ${base} clientes na base inicial`;
    if (trendEl) {
      const ok = taxa < 3;
      trendEl.textContent = ok ? '✅ Abaixo de 3%' : taxa < 5 ? '⚠️ Atenção' : '🔴 Crítico';
      trendEl.className   = `rel-kpi-trend rel-kpi-trend--${ok ? 'up' : 'down'}`;
    }
  } catch (err) {
    console.error('[Relatórios] Erro ao carregar Churn de Clientes:', err);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── CAC Payback Period ───────────────────────────────────────────────────────
/**
 * Fórmula: CAC ÷ (MRR médio por cliente)
 * = investimento_marketing ÷ novos_clientes ÷ (mrr_total ÷ ativos)
 * Resultado em meses
 */
async function _carregarCacPayback(inicio, fim) {
  const cardEl  = document.getElementById('rel-cac-payback');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');
  if (valueEl) valueEl.textContent = '…';

  try {
    const userId = UserStore.getUserId();

    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // Investimento marketing
    let investimento = 0;
    if (userId) {
      const { data: uData } = await supabase
        .from('usuarios')
        .select('investimento_marketing')
        .eq('user_id', userId)
        .single();
      investimento = Number(uData?.investimento_marketing ?? 0);
    }

    // Novos clientes no período
    const { count: novos, error: novosErr } = await supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact', head: true })
      .gte('criado_em', inicioISO)
      .lte('criado_em', fimISO);

    if (novosErr) throw novosErr;

    // MRR médio
    const { data: ativos, error: ativosErr } = await supabase
      .from('clientes')
      .select('cliente_mensalidade')
      .eq('cliente_status', 'Ativado');

    if (ativosErr) throw ativosErr;

    const qtdAtivos = ativos?.length ?? 0;
    const mrr       = ativos?.reduce((acc, c) => acc + Number(c.cliente_mensalidade || 0), 0) ?? 0;
    const mrrMedio  = qtdAtivos > 0 ? mrr / qtdAtivos : 0;
    const qtdNovos  = novos ?? 0;
    const cac       = qtdNovos > 0 && investimento > 0 ? investimento / qtdNovos : 0;
    const payback   = mrrMedio > 0 && cac > 0 ? cac / mrrMedio : null;

    if (payback === null) {
      if (valueEl) valueEl.textContent = '— meses';
      if (subEl)   subEl.textContent   = investimento === 0
        ? 'Registre o Investimento em Marketing para calcular'
        : qtdNovos === 0
          ? 'Sem novos clientes no período'
          : 'MRR médio zerado';
      if (trendEl) { trendEl.textContent = 'Dados insuficientes'; trendEl.className = 'rel-kpi-trend rel-kpi-trend--neu'; }
    } else {
      const paybackStr = payback.toFixed(1).replace('.', ',');
      if (valueEl) valueEl.textContent = `${paybackStr} meses`;
      if (subEl)   subEl.textContent   = `CAC R$ ${_formatarBRL(cac)} ÷ MRR médio R$ ${_formatarBRL(mrrMedio)}`;
      const ok = payback < 12;
      if (trendEl) {
        trendEl.textContent = ok ? '✅ Abaixo de 12 meses' : '⚠️ Acima da meta';
        trendEl.className   = `rel-kpi-trend rel-kpi-trend--${ok ? 'up' : 'down'}`;
      }
    }
  } catch (err) {
    console.error('[Relatórios] Erro ao carregar CAC Payback:', err);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

async function _carregarCAC(inicio, fim) {
  const cardEl = document.getElementById('rel-cac');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    const userId = UserStore.getUserId();
    const periodoKey = inicio.substring(0, 7);

    // 1. Busca investimento para o período na tabela relatorios_investimentos ou usuarios
    let investimento = 0;
    const { data: invData } = await supabase
      .from('relatorios_investimentos')
      .select('valor')
      .eq('periodo', periodoKey)
      .maybeSingle();

    if (invData?.valor !== undefined && invData?.valor !== null) {
      investimento = Number(invData.valor);
    } else if (userId) {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('investimento_marketing')
        .eq('user_id', userId)
        .single();
      investimento = Number(userData?.investimento_marketing ?? 0);
    }

    _investimentoMarketing = investimento;

    // 2. Busca todos os novos clientes conquistados no período
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    const { data: clientes, error: clientError } = await supabase
      .from('clientes')
      .select('cliente_id, cliente_nome, cliente_mensalidade, criado_em, cliente_status')
      .gte('criado_em', inicioISO)
      .lte('criado_em', fimISO)
      .order('criado_em', { ascending: false });

    if (clientError) throw clientError;

    const novosClientes = clientes?.length ?? 0;

    // 3. Calcula o CAC
    let cac = 0;
    let cacFormatado = 'R$ —';
    let subInfo = '';

    if (novosClientes === 0) {
      cacFormatado = 'R$ —';
      subInfo = investimento > 0
        ? `Investimento: R$ ${_formatarBRL(investimento)} · Sem novos clientes no período`
        : 'Nenhum investimento ou cliente no período';
    } else if (investimento === 0) {
      cacFormatado = 'R$ 0,00';
      subInfo = `${novosClientes} novo${novosClientes > 1 ? 's' : ''} cliente${novosClientes > 1 ? 's' : ''} · Investimento: R$ 0,00`;
    } else {
      cac = investimento / novosClientes;
      cacFormatado = `R$ ${_formatarBRL(cac)}`;
      subInfo = `Investimento: R$ ${_formatarBRL(investimento)} ÷ ${novosClientes} cliente${novosClientes > 1 ? 's' : ''}`;
    }

    if (valueEl) valueEl.textContent = cacFormatado;

    const subEl = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver o detalhamento analítico`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${novosClientes} novo${novosClientes !== 1 ? 's' : ''} cliente${novosClientes !== 1 ? 's' : ''}`;
    }

    // 4. Popula o Hover Card do CAC
    _kpiBreakdowns['rel-cac'] = {
      title: 'Custo de Aquisição de Clientes (CAC)',
      badge: `${novosClientes} Novo${novosClientes !== 1 ? 's' : ''}`,
      items: (clientes ?? []).map(c => ({
        name: c.cliente_nome || 'Cliente sem nome',
        sub: `Cadastrado em ${_formatarExibicao(c.criado_em?.substring(0, 10))} · Status: ${c.cliente_status || 'Ativo'}`,
        val: c.cliente_mensalidade ? `R$ ${_formatarBRL(c.cliente_mensalidade)}/mês` : '—'
      })),
      footer: `Investimento: <b>R$ ${_formatarBRL(investimento)}</b> ÷ <b>${novosClientes}</b> novos clientes conquistados`,
      formula: `CAC = R$ ${_formatarBRL(cac)} por cliente`
    };
    _bindKpiHover('rel-cac');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular CAC:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── CPQ — Custo por Lead Qualificado (SQL) ───────────────────

/**
 * Calcula e exibe o CPQ no período selecionado.
 *
 * Fórmula:
 *   CPQ = investimento_marketing ÷ SQLs (negócios com reunião realizada no período)
 */
async function _carregarCPQ(inicio, fim) {
  const cardEl  = document.getElementById('rel-cpq');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    const userId = UserStore.getUserId();
    const periodoKey = inicio.substring(0, 7);

    // 1. Busca investimento
    let investimento = _investimentoMarketing || 0;
    if (!investimento) {
      const { data: invData } = await supabase
        .from('relatorios_investimentos')
        .select('valor')
        .eq('periodo', periodoKey)
        .maybeSingle();

      if (invData?.valor !== undefined && invData?.valor !== null) {
        investimento = Number(invData.valor);
      } else if (userId) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('investimento_marketing')
          .eq('user_id', userId)
          .single();
        investimento = Number(userData?.investimento_marketing ?? 0);
      }
    }

    // 2. Busca negócios com reuniao_realizada = TRUE no período com join de vendedor
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    const { data: sqls, error: negError } = await supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, criado_em, vendedor_id, usuarios(user_nome)')
      .eq('reuniao_realizada', true)
      .gte('criado_em', inicioISO)
      .lte('criado_em', fimISO)
      .order('criado_em', { ascending: false });

    if (negError) throw negError;

    const totalSQLs = sqls?.length ?? 0;

    // 3. Calcula o CPQ
    let cpq = 0;
    let cpqFormatado;
    let subInfo;

    if (totalSQLs === 0 && investimento === 0) {
      cpqFormatado = 'R$ 0,00';
      subInfo = 'Nenhum investimento ou SQL registrado no período';
    } else if (totalSQLs === 0 && investimento > 0) {
      cpqFormatado = `R$ ${_formatarBRL(investimento)}`;
      subInfo = `Investimento: R$ ${_formatarBRL(investimento)} · 0 SQLs — custo sem retorno`;
    } else if (investimento === 0) {
      cpqFormatado = 'R$ 0,00';
      subInfo = `${totalSQLs} SQL${totalSQLs > 1 ? 's' : ''} · Investimento: R$ 0,00`;
    } else {
      cpq = investimento / totalSQLs;
      cpqFormatado = `R$ ${_formatarBRL(cpq)}`;
      subInfo = `Investimento: R$ ${_formatarBRL(investimento)} ÷ ${totalSQLs} SQL${totalSQLs > 1 ? 's' : ''}`;
    }

    if (valueEl) valueEl.textContent = cpqFormatado;

    const subEl    = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver os leads qualificados`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${totalSQLs} SQL${totalSQLs !== 1 ? 's' : ''} no período`;
    }

    // 4. Popula o Hover Card do CPQ
    _kpiBreakdowns['rel-cpq'] = {
      title: 'Custo por Lead Qualificado (CPQ)',
      badge: `${totalSQLs} SQL${totalSQLs !== 1 ? 's' : ''}`,
      items: (sqls ?? []).map(s => ({
        name: s.negocio_titulo || 'Oportunidade',
        sub: `Vendedor: ${s.usuarios?.user_nome || 'Equipe'} · Reunião em ${_formatarExibicao(s.criado_em?.substring(0, 10))}`,
        val: 'Qualificado 🎯'
      })),
      footer: `Investimento: <b>R$ ${_formatarBRL(investimento)}</b> ÷ <b>${totalSQLs}</b> reuniões realizadas`,
      formula: `CPQ = R$ ${_formatarBRL(cpq)} por SQL`
    };
    _bindKpiHover('rel-cpq');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular CPQ:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Ticket Médio de Novos Contratos ─────────────────────────

/**
 * Calcula e exibe o Ticket Médio de Novos Contratos no período.
 *
 * Fórmula:
 *   Ticket Médio = Σ negocio_valor (negocios Ganhos) ÷ total de contratos Ganhos
 */
async function _carregarTicketMedio(inicio, fim) {
  const cardEl  = document.getElementById('rel-ticket-medio');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // Busca negócios Ganhos com dados completos para o Hover Card
    const { data: negocios, error } = await supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, negocio_valor, data_fechamento, criado_em')
      .eq('negocio_status', 'Ganho')
      .gte('data_fechamento', inicioISO)
      .lte('data_fechamento', fimISO)
      .order('data_fechamento', { ascending: false });

    if (error) throw error;

    const total = negocios?.length ?? 0;
    const somaValor = (negocios ?? []).reduce((acc, n) => acc + Number(n.negocio_valor ?? 0), 0);
    const ticket    = total > 0 ? somaValor / total : 0;

    let ticketFormatado = total === 0 ? 'R$ 0,00' : `R$ ${_formatarBRL(ticket)}`;
    let subInfo = total === 0
      ? 'Nenhum contrato ganho no período'
      : `Soma: R$ ${_formatarBRL(somaValor)} ÷ ${total} contrato${total > 1 ? 's' : ''} ganho${total > 1 ? 's' : ''}`;

    if (valueEl) valueEl.textContent = ticketFormatado;

    const subEl    = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver a lista de contratos e valores`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${total} contrato${total !== 1 ? 's' : ''} ganho${total !== 1 ? 's' : ''}`;
    }

    // Popula o Hover Card do Ticket Médio com lista de clientes e valores
    _kpiBreakdowns['rel-ticket-medio'] = {
      title: 'Ticket Médio de Novos Contratos',
      badge: `${total} Contrato${total !== 1 ? 's' : ''}`,
      items: (negocios ?? []).map(n => ({
        name: n.negocio_titulo || 'Contrato Ganho',
        sub: `Fechado em ${_formatarExibicao(n.data_fechamento?.substring(0, 10))}`,
        val: `R$ ${_formatarBRL(n.negocio_valor)}`
      })),
      footer: `Soma Total: <b>R$ ${_formatarBRL(somaValor)}</b> ÷ <b>${total}</b> contratos ganhos`,
      formula: `Ticket Médio = R$ ${_formatarBRL(ticket)}`
    };
    _bindKpiHover('rel-ticket-medio');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Ticket Médio:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Taxa de Conversão ────────────────────────────────────

/**
 * Calcula e exibe a Taxa de Conversão no período (Win Rate de Fechamentos).
 *
 * Fórmula:
 *   Taxa de Conversão = (Negócios Ganhos ÷ Total de Negócios Decididos) × 100
 *   onde Decididos = Ganhos + Perdidos no período selecionado
 */
async function _carregarTaxaConversao(inicio, fim) {
  const cardEl  = document.getElementById('rel-taxa-conversao');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…%';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // 1. Busca negócios fechados (Ganho ou Perdido) no período
    const { data: fechados, error: fechadosError } = await supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, negocio_status, negocio_valor, data_fechamento')
      .in('negocio_status', ['Ganho', 'Perdido'])
      .gte('data_fechamento', inicioISO)
      .lte('data_fechamento', fimISO)
      .order('data_fechamento', { ascending: false });

    if (fechadosError) throw fechadosError;

    const lista = fechados ?? [];
    const ganhos = lista.filter(n => n.negocio_status === 'Ganho');
    const perdidos = lista.filter(n => n.negocio_status === 'Perdido');
    const totalDecididos = lista.length;

    // 2. Calcula a taxa de vitória real (Win Rate)
    const taxa = totalDecididos > 0 ? (ganhos.length / totalDecididos) * 100 : 0;
    const taxaFormatada = `${taxa.toFixed(1).replace('.', ',')}%`;
    const subInfo = totalDecididos === 0
      ? 'Nenhum fechamento (ganho ou perdido) no período'
      : `${ganhos.length} ganho${ganhos.length !== 1 ? 's' : ''} de ${totalDecididos} decidido${totalDecididos !== 1 ? 's' : ''} (${perdidos.length} perdido${perdidos.length !== 1 ? 's' : ''})`;

    if (valueEl) valueEl.textContent = taxaFormatada;

    const subEl    = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver o funil de decisões`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${ganhos.length} ganhos / ${totalDecididos} fechados`;
    }

    // 3. Popula o Hover Card da Taxa de Conversão
    _kpiBreakdowns['rel-taxa-conversao'] = {
      title: 'Taxa de Conversão (Win Rate)',
      badge: taxaFormatada,
      items: lista.slice(0, 15).map(n => ({
        name: n.negocio_titulo || 'Oportunidade',
        sub: `${n.negocio_status === 'Ganho' ? '✅ Ganho' : '❌ Perdido'} · ${_formatarExibicao(n.data_fechamento?.substring(0, 10))}`,
        val: n.negocio_status === 'Ganho' ? `R$ ${_formatarBRL(n.negocio_valor)}` : 'Perdido'
      })),
      footer: `<b>${ganhos.length}</b> Ganhos ÷ <b>${totalDecididos}</b> Negócios Fechados (${perdidos.length} Perdidos)`,
      formula: `Taxa de Conversão = ${taxaFormatada}`
    };
    _bindKpiHover('rel-taxa-conversao');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Taxa de Conversão:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── MQL para SQL Ratio ────────────────────────────────────

/**
 * Calcula e exibe o MQL → SQL Ratio no período.
 *
 * Fórmula:
 *   Ratio = (SQLs ÷ MQLs) × 100
 *
 *   MQL = total de oportunidades/leads criados no período (criado_em)
 *   SQL = negócios com reunião realizada criados no mesmo período
 */
async function _carregarMqlSql(inicio, fim) {
  const cardEl  = document.getElementById('rel-mql-sql');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…%';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // 1. Busca todos os negócios criados no período
    const { data: leads, error: mqlError } = await supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, reuniao_realizada, criado_em, negocio_origem')
      .gte('criado_em', inicioISO)
      .lte('criado_em', fimISO)
      .order('criado_em', { ascending: false });

    if (mqlError) throw mqlError;

    const lista = leads ?? [];
    const totalMQL = lista.length;
    const sqls = lista.filter(l => l.reuniao_realizada === true);
    const totalSQL = sqls.length;

    // 2. Calcula o ratio
    const ratio = totalMQL > 0 ? (totalSQL / totalMQL) * 100 : 0;
    const ratioFormatado = `${ratio.toFixed(1).replace('.', ',')}%`;
    const subInfo = totalMQL === 0
      ? 'Nenhum MQL (lead) registrado no período'
      : `${totalSQL} SQL${totalSQL !== 1 ? 's' : ''} ÷ ${totalMQL} MQL${totalMQL !== 1 ? 's' : ''}`;

    if (valueEl) valueEl.textContent = ratioFormatado;

    const subEl    = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver a eficiência de qualificação`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${totalSQL} SQLs / ${totalMQL} MQLs`;
    }

    // 3. Popula o Hover Card de MQL para SQL
    _kpiBreakdowns['rel-mql-sql'] = {
      title: 'MQL para SQL Ratio (Qualificação)',
      badge: ratioFormatado,
      items: (sqls.length > 0 ? sqls : lista).slice(0, 15).map(l => ({
        name: l.negocio_titulo || 'Lead',
        sub: l.reuniao_realizada
          ? `🎯 Reunião de Qualificação Realizada · ${_formatarExibicao(l.criado_em?.substring(0, 10))}`
          : `Lead Criado no Período · Origem: ${l.negocio_origem || 'Não informada'}`,
        val: l.reuniao_realizada ? 'SQL ✅' : 'MQL'
      })),
      footer: `<b>${totalSQL}</b> SQLs qualificados ÷ <b>${totalMQL}</b> MQLs que entraram no período`,
      formula: `Eficiência de Qualificação = ${ratioFormatado}`
    };
    _bindKpiHover('rel-mql-sql');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular MQL→SQL Ratio:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Taxa de Churn Comercial ────────────────────────────────

/**
 * Calcula e exibe a Taxa de Churn Comercial no período.
 *
 * Fórmula:
 *   (Clientes Cancelados no período ÷ Novos Clientes do período) × 100
 */
async function _carregarChurnComercial(inicio, fim) {
  const cardEl  = document.getElementById('rel-churn-comercial');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…%';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // 1. Busca clientes cancelados no período
    const { data: cancelados, error: cancelError } = await supabase
      .from('clientes')
      .select('cliente_id, cliente_nome, criado_em, cliente_churn, data_churn, cliente_mensalidade')
      .eq('cliente_churn', true)
      .gte('data_churn', inicioISO)
      .lte('data_churn', fimISO)
      .order('data_churn', { ascending: false });

    if (cancelError) throw cancelError;

    // 2. Busca novos clientes do período para referência comparativa
    const { count: novosCount, error: novosErr } = await supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact', head: true })
      .gte('criado_em', inicioISO)
      .lte('criado_em', fimISO);

    if (novosErr) throw novosErr;

    const churns = cancelados?.length ?? 0;
    const novosClientes = novosCount ?? 0;

    const taxa = novosClientes > 0 ? (churns / novosClientes) * 100 : 0;
    const taxaFormatada = `${taxa.toFixed(1).replace('.', ',')}%`;
    const subInfo = churns === 0
      ? 'Nenhum cancelamento registrado no período'
      : `${churns} cancelamento${churns !== 1 ? 's' : ''} no período (${novosClientes} novo${novosClientes !== 1 ? 's' : ''} cliente${novosClientes !== 1 ? 's' : ''})`;

    if (valueEl) valueEl.textContent = taxaFormatada;

    const subEl    = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver os cancelamentos`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${churns} churn${churns !== 1 ? 's' : ''} de ${novosClientes} cliente${novosClientes !== 1 ? 's' : ''}`;
    }

    // 3. Popula o Hover Card do Churn Comercial
    _kpiBreakdowns['rel-churn-comercial'] = {
      title: 'Churn Comercial (Cancelamentos)',
      badge: `${churns} Cancelamento${churns !== 1 ? 's' : ''}`,
      items: (cancelados ?? []).map(c => ({
        name: c.cliente_nome || 'Cliente',
        sub: `Cancelou em ${_formatarExibicao(c.data_churn?.substring(0, 10))}`,
        val: c.cliente_mensalidade ? `- R$ ${_formatarBRL(c.cliente_mensalidade)}` : 'Cancelado ⚠️'
      })),
      footer: `<b>${churns}</b> cancelamento${churns !== 1 ? 's' : ''} ÷ <b>${novosClientes}</b> novos clientes conquistados no período`,
      formula: `Taxa de Churn = ${taxaFormatada}`
    };
    _bindKpiHover('rel-churn-comercial');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Churn Comercial:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Ciclo Médio de Vendas ───────────────────────────────────

/**
 * Calcula e exibe o Ciclo Médio de Vendas no período.
 *
 * Fórmula:
 *   Ciclo Médio = Média de (data_fechamento − criado_em) em dias
 */
async function _carregarCicloVendas(inicio, fim) {
  const cardEl  = document.getElementById('rel-ciclo-vendas');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '… dias';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // Busca negócios Ganhos no período com dados completos para o breakdown
    const { data, error } = await supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, negocio_valor, criado_em, data_fechamento')
      .eq('negocio_status', 'Ganho')
      .gte('data_fechamento', inicioISO)
      .lte('data_fechamento', fimISO)
      .not('data_fechamento', 'is', null)
      .not('criado_em', 'is', null);

    if (error) throw error;

    const MS_POR_DIA = 1000 * 60 * 60 * 24;
    const validos = (data ?? []).map(n => {
      const diffMs = new Date(n.data_fechamento).getTime() - new Date(n.criado_em).getTime();
      const dias = Math.max(1, Math.round(diffMs / MS_POR_DIA));
      return { ...n, dias };
    }).sort((a, b) => a.dias - b.dias);

    const total = validos.length;
    const somaDias = validos.reduce((acc, n) => acc + n.dias, 0);
    const mediaDias = total > 0 ? somaDias / total : 0;
    const diasStr = Math.round(mediaDias).toString();

    const cicloFormatado = total === 0 ? '0 dias' : `${diasStr} dias`;
    const subInfo = total === 0
      ? 'Nenhum negócio ganho no período'
      : `Média de ${total} contrato${total !== 1 ? 's' : ''} ganho${total !== 1 ? 's' : ''}`;

    if (valueEl) valueEl.textContent = cicloFormatado;

    const subEl    = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver os tempos individuais de fechamento`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${total} negócio${total !== 1 ? 's' : ''} analisado${total !== 1 ? 's' : ''}`;
    }

    // Popula o Hover Card do Ciclo de Vendas
    _kpiBreakdowns['rel-ciclo-vendas'] = {
      title: 'Ciclo Médio de Vendas (Dias)',
      badge: `${diasStr} Dias Média`,
      items: validos.map(n => ({
        name: n.negocio_titulo || 'Contrato Ganho',
        sub: `Criado: ${_formatarExibicao(n.criado_em?.substring(0, 10))} → Fechado: ${_formatarExibicao(n.data_fechamento?.substring(0, 10))}`,
        val: `${n.dias} dia${n.dias !== 1 ? 's' : ''}`
      })),
      footer: `Soma: <b>${somaDias}</b> dias totais ÷ <b>${total}</b> contratos ganhos`,
      formula: `Ciclo Médio = ${diasStr} dias por fechamento`
    };
    _bindKpiHover('rel-ciclo-vendas');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Ciclo Médio de Vendas:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Receita em Aberto (Snapshot do Pipeline) ────────────────

/**
 * Calcula e exibe a Receita em Aberto (snapshot atual do pipeline).
 *
 * Fórmula:
 *   SUM(negocio_valor) de todos os negócios com negocio_status = 'Aberto'
 */
async function _carregarReceitaAberto() {
  const cardEl  = document.getElementById('rel-receita-aberto');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = 'R$ …';

  try {
    const { data, error } = await supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, negocio_valor, criado_em, usuarios(user_nome)')
      .eq('negocio_status', 'Aberto')
      .order('negocio_valor', { ascending: false });

    if (error) throw error;

    const negocios = data ?? [];
    const total    = negocios.length;
    const soma = negocios.reduce((acc, n) => acc + Number(n.negocio_valor ?? 0), 0);

    if (valueEl) valueEl.textContent = `R$ ${_formatarBRL(soma)}`;

    const subEl    = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    const subInfo  = total === 0
      ? 'Nenhum negócio aberto no momento'
      : `${total} negócio${total !== 1 ? 's' : ''} aberto${total !== 1 ? 's' : ''} no pipeline`;

    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver as principais propostas em aberto`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${total} negócio${total !== 1 ? 's' : ''} ativo${total !== 1 ? 's' : ''}`;
    }

    // Popula o Hover Card da Receita em Aberto com as maiores propostas
    _kpiBreakdowns['rel-receita-aberto'] = {
      title: 'Receita em Aberto (Pipeline)',
      badge: `${total} Proposta${total !== 1 ? 's' : ''}`,
      items: negocios.slice(0, 15).map(n => ({
        name: n.negocio_titulo || 'Proposta Ativa',
        sub: `Responsável: ${n.usuarios?.user_nome || 'Equipe'} · Criado em ${_formatarExibicao(n.criado_em?.substring(0, 10))}`,
        val: `R$ ${_formatarBRL(n.negocio_valor)}`
      })),
      footer: `Potencial total em negociação no pipeline ativo hoje`,
      formula: `Soma Total = R$ ${_formatarBRL(soma)}`
    };
    _bindKpiHover('rel-receita-aberto');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Receita em Aberto:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Motivo de Perda Campão ──────────────────────────────────

/**
 * Carrega e renderiza o ranking de Motivos de Perda no período.
 *
 * Fonte de dados:
 *   negocios (negocio_status = 'Perdido', data_fechamento no período, motivo_perda preenchido)
 *   motivos_perda (motivo_descricao)
 *
 * O campo negocios.motivo_perda guarda o ID (FK para motivos_perda).
 *
 * @param {string} inicio  'YYYY-MM-DD'
 * @param {string} fim     'YYYY-MM-DD'
 */
async function _carregarMotivosPerda(inicio, fim) {
  const listaEl = document.getElementById('rel-motivos-lista');
  if (!listaEl) return;

  listaEl.innerHTML = '<div class="rel-motivo-empty">Carregando…</div>';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // 1. Negócios Perdidos no período com dados completos para o breakdown
    const { data: perdidos, error: perdidoError } = await supabase
      .from('negocios')
      .select('motivo_perda, negocio_titulo, negocio_valor, data_fechamento')
      .eq('negocio_status', 'Perdido')
      .not('motivo_perda', 'is', null)
      .gte('data_fechamento', inicioISO)
      .lte('data_fechamento', fimISO)
      .order('data_fechamento', { ascending: false });

    if (perdidoError) throw perdidoError;

    if (!perdidos || perdidos.length === 0) {
      listaEl.innerHTML = '<div class="rel-motivo-empty">Nenhum negócio perdido com motivo registrado no período</div>';
      return;
    }

    // 2. Agrupa por motivo_perda (ID) e associa os negócios
    const contagem = {};
    const negociosPorMotivo = {};
    for (const n of perdidos) {
      const id = String(n.motivo_perda);
      contagem[id] = (contagem[id] ?? 0) + 1;
      if (!negociosPorMotivo[id]) negociosPorMotivo[id] = [];
      negociosPorMotivo[id].push(n);
    }

    const ids = Object.keys(contagem);

    // 3. Busca os nomes na tabela motivos_perda
    const { data: motivos, error: motivoError } = await supabase
      .from('motivos_perda')
      .select('motivo_id, motivo_descricao')
      .in('motivo_id', ids.map(Number));

    if (motivoError) throw motivoError;

    const nomeMap = {};
    for (const m of (motivos ?? [])) {
      nomeMap[String(m.motivo_id)] = m.motivo_descricao;
    }

    const ranking = ids
      .map(id => ({
        id,
        label: nomeMap[id] ?? `Motivo #${id}`,
        count: contagem[id],
        negocios: negociosPorMotivo[id] || []
      }))
      .sort((a, b) => b.count - a.count);

    const total  = perdidos.length;
    const maxCnt = ranking[0]?.count ?? 1;

    // 5. Renderiza
    listaEl.innerHTML = ranking.map((m, idx) => {
      const pct     = Math.round((m.count / total) * 100);
      const barPct  = Math.round((m.count / maxCnt) * 100);
      const campeao = idx === 0 ? ' rel-motivo-item--campeao' : '';
      return `
        <div class="rel-motivo-item${campeao}" data-motivo-idx="${idx}" style="cursor: pointer;">
          <span class="rel-motivo-label">${m.label}</span>
          <div class="rel-mini-bar-wrap">
            <div class="rel-mini-bar">
              <div class="rel-mini-bar-fill rel-mini-bar-fill--red" style="width:${barPct}%"></div>
            </div>
            <span class="rel-mini-bar-pct">${pct}%</span>
          </div>
          <span class="rel-motivo-count">${m.count} caso${m.count !== 1 ? 's' : ''}</span>
        </div>
      `;
    }).join('');

    // Atacha Hover Cards nos itens de motivo de perda
    listaEl.querySelectorAll('.rel-motivo-item').forEach(el => {
      const idx = parseInt(el.dataset.motivoIdx, 10);
      const m = ranking[idx];
      if (!m) return;

      el.addEventListener('mouseenter', () => {
        _showKpiPopover(el, {
          title: `Perdas: ${m.label}`,
          badge: `${m.count} Ocorrência${m.count !== 1 ? 's' : ''}`,
          items: m.negocios.slice(0, 10).map(n => ({
            name: n.negocio_titulo || 'Oportunidade Perdida',
            sub: `Fechado em ${_formatarExibicao(n.data_fechamento?.substring(0, 10))}`,
            val: n.negocio_valor ? `R$ ${_formatarBRL(n.negocio_valor)}` : 'Perdido ❌'
          })),
          footer: `Representa <b>${Math.round((m.count / total) * 100)}%</b> de todas as perdas do período (${total} casos no total)`,
          formula: `Motivo: ${m.label}`
        });
      });

      el.addEventListener('mouseleave', _hideKpiPopover);
    });

  } catch (err) {
    console.error('[Relatórios] Erro ao carregar Motivos de Perda:', err.message);
    listaEl.innerHTML = '<div class="rel-motivo-empty">Erro ao carregar dados</div>';
  }
}

// ─── Performance por Vendedor ───────────────────────────────

/**
 * Carrega e renderiza o ranking de Performance por Vendedor no período.
 */
async function _carregarPerformanceVendedor(inicio, fim) {
  const tbody = document.getElementById('rel-vendedor-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;opacity:.5">Carregando…</td></tr>';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // Busca negócios fechados (Ganho ou Perdido) no período com join de usuários
    const { data, error } = await supabase
      .from('negocios')
      .select('vendedor_id, negocio_titulo, negocio_status, negocio_valor, data_fechamento, usuarios(user_nome, user_avatar)')
      .in('negocio_status', ['Ganho', 'Perdido'])
      .gte('data_fechamento', inicioISO)
      .lte('data_fechamento', fimISO)
      .order('data_fechamento', { ascending: false });

    if (error) throw error;

    const negocios = data ?? [];

    if (negocios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;opacity:.5">Nenhum negócio fechado no período</td></tr>';
      return;
    }

    // Agrupa por vendedor_id
    const vendedores = {};
    for (const n of negocios) {
      const vid = n.vendedor_id || 'sem_vendedor';
      if (!vendedores[vid]) {
        vendedores[vid] = {
          nome:   n.usuarios?.user_nome   ?? 'Não atribuído',
          avatar: n.usuarios?.user_avatar ?? null,
          ganhos: 0,
          total:  0,
          receita: 0,
          contratos: []
        };
      }
      vendedores[vid].total++;
      if (n.negocio_status === 'Ganho') {
        vendedores[vid].ganhos++;
        vendedores[vid].receita += Number(n.negocio_valor ?? 0);
        vendedores[vid].contratos.push(n);
      }
    }

    // Ordena por receita (decrescente)
    const ranking = Object.values(vendedores)
      .sort((a, b) => b.receita - a.receita);

    const maxReceita = ranking[0]?.receita ?? 1;

    tbody.innerHTML = ranking.map((v, idx) => {
      const taxa    = v.total > 0 ? Math.round((v.ganhos / v.total) * 100) : 0;
      const barPct  = maxReceita > 0 ? Math.round((v.receita / maxReceita) * 100) : 0;
      const iniciais = v.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
      const avatarHtml = v.avatar
        ? `<img src="${v.avatar}" class="rel-table-avatar-img" alt="${v.nome}">`
        : `<div class="rel-table-avatar">${iniciais}</div>`;

      return `
        <tr data-vendedor-idx="${idx}" style="cursor: pointer;">
          <td class="rel-rank">${idx + 1}</td>
          <td>
            <div class="rel-avatar-cell">
              <div class="rel-avatar-wrap">${avatarHtml}</div>
              <div>
                <div class="rel-table-name">${v.nome}</div>
                <div class="rel-table-sub">${v.ganhos} fechamento${v.ganhos !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </td>
          <td>${v.total}</td>
          <td>${v.ganhos}</td>
          <td>
            <div class="rel-mini-bar-wrap">
              <div class="rel-mini-bar">
                <div class="rel-mini-bar-fill rel-mini-bar-fill--cyan" style="width:${barPct}%"></div>
              </div>
              <span class="rel-mini-bar-pct">${taxa}%</span>
            </div>
          </td>
          <td class="rel-receita-col">R$ ${_formatarBRL(v.receita)}</td>
        </tr>
      `;
    }).join('');

    // Atacha Hover Cards nas linhas dos vendedores
    tbody.querySelectorAll('tr').forEach(row => {
      const idx = parseInt(row.dataset.vendedorIdx, 10);
      const v = ranking[idx];
      if (!v) return;

      row.addEventListener('mouseenter', () => {
        const taxa = v.total > 0 ? Math.round((v.ganhos / v.total) * 100) : 0;
        _showKpiPopover(row, {
          title: `Vendedor: ${v.nome}`,
          badge: `${v.ganhos} Ganhos / ${v.total} Total`,
          items: v.contratos.length > 0
            ? v.contratos.slice(0, 10).map(c => ({
                name: c.negocio_titulo || 'Contrato Ganho',
                sub: `Fechado em ${_formatarExibicao(c.data_fechamento?.substring(0, 10))}`,
                val: `R$ ${_formatarBRL(c.negocio_valor)}`
              }))
            : [{ name: 'Sem contratos ganhos', sub: 'Apenas oportunidades perdidas ou em aberto', val: '—' }],
          footer: `Receita gerada: <b>R$ ${_formatarBRL(v.receita)}</b> · Taxa de conversão: <b>${taxa}%</b>`,
          formula: `Ticket médio individual: R$ ${_formatarBRL(v.ganhos > 0 ? v.receita / v.ganhos : 0)}`
        });
      });

      row.addEventListener('mouseleave', _hideKpiPopover);
    });

  } catch (err) {
    console.error('[Relatórios] Erro ao carregar Performance por Vendedor:', err.message);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--danger)">Erro ao carregar dados</td></tr>';
  }
}

// ─── Taxa de No-Show em Reuniões ─────────────────────────────

/**
 * Calcula e exibe a Taxa de No-Show em Reuniões no período.
 *
 * Fórmula:
 *   Taxa = (No-Shows ÷ Total de Reuniões Agendadas) × 100
 *   onde Reuniões Agendadas = reuniao_realizada = true OU negocio_noshow = true
 */
async function _carregarNoShow(inicio, fim) {
  const cardEl  = document.getElementById('rel-noshow');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…%';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // 1. Busca todas as reuniões (realizadas ou com no-show) no período
    const { data, error } = await supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, negocio_noshow, reuniao_realizada, criado_em, usuarios(user_nome)')
      .or('reuniao_realizada.eq.true,negocio_noshow.eq.true')
      .gte('criado_em', inicioISO)
      .lte('criado_em', fimISO)
      .order('criado_em', { ascending: false });

    if (error) throw error;

    const lista = data ?? [];
    const totalReunioes = lista.length;
    const noShows = lista.filter(n => n.negocio_noshow === true);
    const totalNoShows = noShows.length;

    // 2. Calcula a taxa
    const taxa = totalReunioes > 0 ? (totalNoShows / totalReunioes) * 100 : 0;
    const taxaFormatada = `${taxa.toFixed(1).replace('.', ',')}%`;
    const subInfo = totalReunioes === 0
      ? 'Nenhuma reunião agendada no período'
      : `${totalNoShows} falta${totalNoShows !== 1 ? 's' : ''} de ${totalReunioes} reunião${totalReunioes !== 1 ? 'es' : ''} agendada${totalReunioes !== 1 ? 's' : ''}`;

    if (valueEl) valueEl.textContent = taxaFormatada;

    const subEl    = cardEl?.querySelector('.rel-kpi-sub');
    const infoSpan = cardEl?.querySelector('.rel-kpi-info-icon');
    if (subEl)    subEl.textContent = subInfo;
    if (infoSpan) infoSpan.title   = `Passe o mouse para ver os leads faltantes`;

    if (trendEl) {
      trendEl.lastChild.textContent = `${totalNoShows} no-show / ${totalReunioes} reuniões`;
    }

    // 3. Popula o Hover Card do No-Show
    _kpiBreakdowns['rel-noshow'] = {
      title: 'Taxa de No-Show em Reuniões',
      badge: `${totalNoShows} Ausência${totalNoShows !== 1 ? 's' : ''}`,
      items: totalNoShows > 0
        ? noShows.map(n => ({
            name: n.negocio_titulo || 'Lead',
            sub: `Vendedor: ${n.usuarios?.user_nome || 'Equipe'} · Reunião em ${_formatarExibicao(n.criado_em?.substring(0, 10))}`,
            val: 'Faltou ❌'
          }))
        : lista.slice(0, 8).map(n => ({
            name: n.negocio_titulo || 'Lead',
            sub: `Vendedor: ${n.usuarios?.user_nome || 'Equipe'} · ${_formatarExibicao(n.criado_em?.substring(0, 10))}`,
            val: 'Presente ✅'
          })),
      footer: `<b>${totalNoShows}</b> faltas ÷ <b>${totalReunioes}</b> reuniões agendadas no período`,
      formula: `Taxa de No-Show = ${taxaFormatada}`
    };
    _bindKpiHover('rel-noshow');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular No-Show:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── LTV Métrics: LTV Total, LTV Médio e LTV/CAC Ratio ─────────────

/**
 * Calcula e exibe LTV Total da Carteira, LTV Médio e LTV/CAC Ratio.
 */
async function _carregarLtvMetrics(inicio, fim) {
  const ltvTotalEl  = document.getElementById('rel-ltv-total');
  const ltvMedioEl  = document.getElementById('rel-ltv-medio');
  const ltvCacEl    = document.getElementById('rel-ltv-cac');

  const setValue = (cardEl, txt) => {
    const el = cardEl?.querySelector('.rel-kpi-value');
    if (el) el.textContent = txt;
  };
  const setSub = (cardEl, txt) => {
    const el = cardEl?.querySelector('.rel-kpi-sub');
    if (el) el.textContent = txt;
  };
  const setTrend = (cardEl, txt) => {
    const el = cardEl?.querySelector('.rel-kpi-trend');
    if (el && el.lastChild) el.lastChild.textContent = txt;
  };

  setValue(ltvTotalEl, 'R$ …');
  setValue(ltvMedioEl, 'R$ …');
  setValue(ltvCacEl,   '…×');

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // 1. LTV Médio: média histórica de todos os contratos Ganhos
    const { data: ganhos, error: ganhosErr } = await supabase
      .from('negocios')
      .select('negocio_valor')
      .eq('negocio_status', 'Ganho');

    if (ganhosErr) throw ganhosErr;

    const totalGanhos = (ganhos ?? []).length;
    const somaGanhos  = (ganhos ?? []).reduce((s, n) => s + Number(n.negocio_valor ?? 0), 0);
    const ltvMedio    = totalGanhos > 0 ? somaGanhos / totalGanhos : 0;

    // 2. Clientes ativos na carteira (sem churn)
    const { count: clientesAtivos, error: clientesErr } = await supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact', head: true })
      .eq('cliente_churn', false);

    if (clientesErr) throw clientesErr;

    const nAtivos  = clientesAtivos ?? 0;
    const ltvTotal = ltvMedio * nAtivos;

    // 3. CAC do período: investimento / novos clientes
    const periodoKey = inicio.substring(0, 7);
    let investimento = _investimentoMarketing || 0;
    if (!investimento) {
      const { data: invData } = await supabase
        .from('relatorios_investimentos')
        .select('valor')
        .eq('periodo', periodoKey)
        .maybeSingle();

      if (invData?.valor !== undefined && invData?.valor !== null) {
        investimento = Number(invData.valor);
      }
    }

    const { count: novosClientes } = await supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact', head: true })
      .gte('criado_em', inicioISO)
      .lte('criado_em', fimISO);

    const novosClientesCount = novosClientes ?? 0;
    const cac = novosClientesCount > 0 && investimento > 0 ? investimento / novosClientesCount : 0;

    // 4. LTV/CAC Ratio
    const ratio = cac > 0 ? ltvMedio / cac : null;

    // 5. Atualiza DOM
    setValue(ltvMedioEl, `R$ ${_formatarBRL(ltvMedio)}`);
    setSub(ltvMedioEl, `Média de ${totalGanhos} contrato${totalGanhos !== 1 ? 's' : ''} ganho${totalGanhos !== 1 ? 's' : ''} (histórico)`);
    setTrend(ltvMedioEl, `${totalGanhos} contratos`);

    setValue(ltvTotalEl, `R$ ${_formatarBRL(ltvTotal)}`);
    setSub(ltvTotalEl, `LTV Médio × ${nAtivos} cliente${nAtivos !== 1 ? 's' : ''} ativo${nAtivos !== 1 ? 's' : ''}`);
    setTrend(ltvTotalEl, `${nAtivos} cliente${nAtivos !== 1 ? 's' : ''} ativos`);

    if (ratio === null) {
      setValue(ltvCacEl, '—×');
      let motivo = investimento === 0
        ? 'Registre o Investimento em Marketing para calcular o CAC'
        : novosClientesCount === 0
          ? `Investimento: R$ ${_formatarBRL(investimento)} · Sem novos clientes no período`
          : 'CAC = 0 — verifique os dados';
      setSub(ltvCacEl, motivo);
      setTrend(ltvCacEl, 'LTV Médio disponível');
    } else {
      const ratioStr = ratio.toFixed(1).replace('.', ',');
      setValue(ltvCacEl, `${ratioStr}×`);
      const status = ratio >= 3 ? '✅ Saudável (> 3×)' : ratio >= 1 ? '⚠️ Abaixo do ideal' : '🔴 Crítico (< 1×)';
      setSub(ltvCacEl, `R$ ${_formatarBRL(ltvMedio)} (LTV) ÷ R$ ${_formatarBRL(cac)} (CAC) · ${status}`);
      setTrend(ltvCacEl, ratio >= 3 ? 'Meta atingida' : 'Abaixo da meta');
    }

    // 6. Popula Hover Card do LTV/CAC Ratio
    _kpiBreakdowns['rel-ltv-cac'] = {
      title: 'LTV / CAC Ratio (Retorno sobre Aquisição)',
      badge: ratio !== null ? `${ratio.toFixed(1).replace('.', ',')}×` : '—×',
      items: [
        { name: 'LTV Médio da Carteira', sub: `Média de ${totalGanhos} contratos fechados`, val: `R$ ${_formatarBRL(ltvMedio)}` },
        { name: 'CAC do Período', sub: `Custo médio para conquistar 1 cliente`, val: cac > 0 ? `R$ ${_formatarBRL(cac)}` : 'R$ —' },
        { name: 'Clientes Ativos na Carteira', sub: 'Base atual de clientes ativos', val: `${nAtivos} clientes` },
        { name: 'Valor Total da Carteira (LTV Total)', sub: 'LTV Médio × Clientes Ativos', val: `R$ ${_formatarBRL(ltvTotal)}` }
      ],
      footer: ratio !== null && ratio >= 3
        ? `✅ <b>Saudável</b>: Para cada R$ 1 investido em aquisição, o cliente retorna R$ ${ratio.toFixed(1).replace('.', ',')} de LTV.`
        : `⚠️ <b>Atenção</b>: O ideal de mercado para agências e SaaS é ter LTV/CAC acima de 3×.`,
      formula: `LTV ÷ CAC = ${ratio !== null ? ratio.toFixed(1).replace('.', ',') : '—'}×`
    };
    _bindKpiHover('rel-ltv-cac');

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular LTV Métrics:', err.message);
    setValue(ltvTotalEl, 'Erro');
    setValue(ltvMedioEl, 'Erro');
    setValue(ltvCacEl,   'Erro');
  }
}

// ─── Tempo Médio de Setup (Setor Operacional) ─────────────────────────

/**
 * Calcula o Tempo Médio de Setup no período.
 *
 * Fórmula:
 *   Média de (data_conclusao da tarefa − clientes.criado_em) em dias
 *
 * Fonte:
 *   tarefas WHERE tarefa_titulo = 'Estruturar campanha / Solicitar saldo'
 *          AND data_conclusao BETWEEN inicio AND fim
 *   JOIN clientes ON clientes.negocio_id = tarefas.negocio_id
 *
 * A tarefa 'Estruturar campanha / Solicitar saldo' é a última etapa de
 * onboarding. Sua conclusão marca o fim do setup. O tempo de setup é
 * medido desde a criação do cliente até essa data.
 *
 * @param {string} inicio  'YYYY-MM-DD'
 * @param {string} fim     'YYYY-MM-DD'
 */
async function _carregarSetupMedio(inicio, fim) {
  const cardEl  = document.getElementById('rel-setup-medio');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '… dias';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // ── Query 1: tarefas de onboarding concluídas no período ──
    // Não há FK direta entre tarefas e clientes → join client-side via negocio_id
    const { data: tarefas, error: tarefasErr } = await supabase
      .from('tarefas')
      .select('negocio_id, data_conclusao')
      .eq('tarefa_titulo', 'Estruturar campanha / Solicitar saldo')
      .eq('tarefa_status', true)
      .gte('data_conclusao', inicioISO)
      .lte('data_conclusao', fimISO);

    if (tarefasErr) throw tarefasErr;

    const tarefasValidas = (tarefas ?? []).filter(t => t.negocio_id && t.data_conclusao);

    if (tarefasValidas.length === 0) {
      if (valueEl) valueEl.textContent = '— dias';
      if (subEl)   subEl.textContent   = 'Nenhum onboarding concluído no período';
      if (trendEl) trendEl.lastChild.textContent = 'Sem dados';
      return;
    }

    const negocioIds = tarefasValidas.map(t => t.negocio_id);

    // ── Query 2: clientes com os negocio_ids encontrados ──
    const { data: clientes, error: clientesErr } = await supabase
      .from('clientes')
      .select('negocio_id, criado_em')
      .in('negocio_id', negocioIds);

    if (clientesErr) throw clientesErr;

    // Monta mapa negocio_id → criado_em para join client-side
    const clienteMap = {};
    for (const c of (clientes ?? [])) {
      clienteMap[c.negocio_id] = c.criado_em;
    }

    // Calcula diff em dias para cada tarefa (filtra diffs inválidos ≤ 0)
    const logsDebug = [];
    const diffs = tarefasValidas
      .map(t => {
        const criadoEm = clienteMap[t.negocio_id];
        if (!criadoEm) {
          logsDebug.push({ negocio_id: t.negocio_id, erro: 'Cliente não encontrado' });
          return null;
        }
        const conclusao = new Date(t.data_conclusao).getTime();
        const criacao   = new Date(criadoEm).getTime();
        const diffDias  = (conclusao - criacao) / (1000 * 60 * 60 * 24);
        
        logsDebug.push({
          negocio_id: t.negocio_id,
          cliente_criado_em: criadoEm,
          tarefa_data_conclusao: t.data_conclusao,
          diff_dias: diffDias
        });

        return diffDias;
      })
      .filter(d => d !== null && d > 0);

    console.groupCollapsed('[Relatórios] Debug: Tempo Médio de Setup');
    console.log('Média final sendo calculada com base nesses registros:');
    console.table(logsDebug);
    console.log('Valores finais válidos (> 0 dias):', diffs);
    if (diffs.length > 0) {
      console.log('Soma total de dias:', diffs.reduce((s, d) => s + d, 0));
      console.log('Dividido por', diffs.length, 'onboardings');
    }
    console.groupEnd();

    if (diffs.length === 0) {
      if (valueEl) valueEl.textContent = '— dias';
      if (subEl)   subEl.textContent   = 'Datas inválidas nos registros do período';
      return;
    }

    const mediaDias = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    const mediaDiasFormatada = mediaDias.toFixed(1).replace('.', ',');

    if (valueEl) valueEl.textContent = `${mediaDiasFormatada} dias`;
    if (subEl)   subEl.textContent   = `Base: ${diffs.length} onboarding${diffs.length !== 1 ? 's' : ''} concluído${diffs.length !== 1 ? 's' : ''} no período`;
    if (trendEl) trendEl.lastChild.textContent = `${diffs.length} setup${diffs.length !== 1 ? 's' : ''} no período`;

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Tempo Médio de Setup:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Health Score Médio (Setor Operacional) ───────────────────────

/**
 * Calcula o Health Score Médio da Carteira.
 *
 * Filtra clientes com cliente_status = 'Ativado'.
 * Mapeia cliente_satisfacao (ENUM) para uma escala de 0 a 100:
 *   Muito Insatisfeito = 0
 *   Insatisfeito = 25
 *   Razoável = 50
 *   Satisfeito = 75
 *   Muito Satisfeito = 100
 * Retorna a média.
 */
async function _carregarHealthScore() {
  const cardEl  = document.getElementById('rel-health-score');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…';

  try {
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('cliente_satisfacao')
      .eq('cliente_status', 'Ativado');

    if (error) throw error;

    const mapaValores = {
      'Muito Insatisfeito': 0,
      'Insatisfeito': 25,
      'Razoável': 50,
      'Satisfeito': 75,
      'Muito Satisfeito': 100
    };

    const validos = (clientes ?? []).filter(c => c.cliente_satisfacao && mapaValores[c.cliente_satisfacao] !== undefined);

    if (validos.length === 0) {
      if (valueEl) valueEl.textContent = '—';
      if (subEl)   subEl.textContent   = 'Nenhum cliente ativado com satisfação registrada';
      if (trendEl) trendEl.lastChild.textContent = 'Sem dados';
      return;
    }

    const soma = validos.reduce((s, c) => s + mapaValores[c.cliente_satisfacao], 0);
    const media = soma / validos.length;

    if (valueEl) valueEl.textContent = media.toFixed(1).replace('.', ',');
    if (subEl)   subEl.textContent   = `Baseado em ${validos.length} cliente${validos.length !== 1 ? 's' : ''} ativado${validos.length !== 1 ? 's' : ''} com avaliação`;
    if (trendEl) trendEl.lastChild.textContent = media >= 75 ? 'Meta atingida (≥ 75)' : 'Abaixo da meta (< 75)';

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Health Score:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── NPS / Satisfação por Gestor (Setor Operacional) ───────────────────────

/**
 * Calcula a média geral do NPS / Satisfação no período.
 * Puxa os clientes ativos e extrai a média aritmética das 3 notas
 * (nota_comunicacao, nota_entrega, nota_performance) que vão de 0 a 10.
 * O filtro de data é aplicado sobre a coluna 'data_envio_nps'.
 *
 * @param {string} inicio  'YYYY-MM-DD'
 * @param {string} fim     'YYYY-MM-DD'
 */
async function _carregarNPS(inicio, fim) {
  const cardEl  = document.getElementById('rel-nps');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('nota_comunicacao, nota_entrega, nota_performance')
      .eq('cliente_status', 'Ativado')
      .gte('data_envio_nps', inicioISO)
      .lte('data_envio_nps', fimISO);

    if (error) throw error;

    // Filtra clientes que possuem pelo menos uma nota preenchida
    const validos = (clientes ?? []).filter(c => 
      c.nota_comunicacao != null || c.nota_entrega != null || c.nota_performance != null
    );

    if (validos.length === 0) {
      if (valueEl) valueEl.textContent = '—';
      if (subEl)   subEl.textContent   = 'Nenhuma avaliação de NPS registrada para clientes ativos';
      if (trendEl) trendEl.lastChild.textContent = 'Sem dados';
      return;
    }

    // Calcula a média de cada cliente (somente considerando as notas preenchidas dele) e soma tudo
    const somaGeral = validos.reduce((soma, c) => {
      const notasDoCliente = [];
      if (c.nota_comunicacao != null) notasDoCliente.push(Number(c.nota_comunicacao));
      if (c.nota_entrega != null)     notasDoCliente.push(Number(c.nota_entrega));
      if (c.nota_performance != null) notasDoCliente.push(Number(c.nota_performance));
      
      const mediaDoCliente = notasDoCliente.reduce((a, b) => a + b, 0) / notasDoCliente.length;
      return soma + mediaDoCliente;
    }, 0);

    const mediaGlobal = somaGeral / validos.length;

    if (valueEl) valueEl.textContent = `${mediaGlobal.toFixed(1).replace('.', ',')} / 10`;
    if (subEl)   subEl.textContent   = `Média consolidada. Baseado em ${validos.length} cliente${validos.length !== 1 ? 's' : ''} avaliado${validos.length !== 1 ? 's' : ''}`;
    if (trendEl) trendEl.lastChild.textContent = mediaGlobal >= 8 ? 'Meta atingida (≥ 8)' : 'Abaixo da meta (< 8)';

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular NPS:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Índice de Silêncio (Setor Operacional) ──────────────────────────

/**
 * Calcula o Índice de Silêncio da carteira.
 * (Snapshot, não depende de data).
 *
 * Fórmula:
 *   Verifica todos os clientes com cliente_status = 'Ativado'.
 *   Para cada um, cruza pelo negocio_id com a tabela de tarefas (onde tarefa_status = true).
 *   Pega a 'data_conclusao' mais recente.
 *   Calcula a diferença em dias de hoje até a última data_conclusao.
 *   Se > 7 dias (ou se nunca teve tarefa concluída), o cliente é considerado silencioso.
 *   % = (Silenciosos / Total Ativos) * 100.
 */
async function _carregarIndiceSilencio() {
  const cardEl  = document.getElementById('rel-silencio');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…%';

  try {
    // 1. Puxa todos os clientes Ativados
    const { data: clientes, error: cliErr } = await supabase
      .from('clientes')
      .select('negocio_id')
      .eq('cliente_status', 'Ativado');

    if (cliErr) throw cliErr;

    const ativos = (clientes ?? []).filter(c => c.negocio_id);
    const totalAtivos = ativos.length;

    if (totalAtivos === 0) {
      if (valueEl) valueEl.textContent = '0%';
      if (subEl)   subEl.textContent   = 'Nenhum cliente ativo na base';
      if (trendEl) trendEl.lastChild.textContent = 'Sem dados';
      return;
    }

    const negocioIds = ativos.map(c => c.negocio_id);

    // 2. Busca todas as tarefas CONCLUÍDAS vinculadas a esses negócios
    const { data: tarefas, error: tarErr } = await supabase
      .from('tarefas')
      .select('negocio_id, data_conclusao')
      .eq('tarefa_status', true)
      .in('negocio_id', negocioIds);

    if (tarErr) throw tarErr;

    // 3. Agrupa para encontrar a última data de conclusão de cada negócio
    const ultimaInteracao = {};
    for (const t of (tarefas ?? [])) {
      if (!t.data_conclusao) continue;
      const ts = new Date(t.data_conclusao).getTime();
      if (!ultimaInteracao[t.negocio_id] || ts > ultimaInteracao[t.negocio_id]) {
        ultimaInteracao[t.negocio_id] = ts;
      }
    }

    // 4. Calcula quem está silencioso (> 7 dias)
    const agora = Date.now();
    let silenciosos = 0;

    for (const id of negocioIds) {
      const ultima = ultimaInteracao[id];
      if (!ultima) {
        // Se nunca teve tarefa concluída, está em silêncio
        silenciosos++;
      } else {
        const diffDias = (agora - ultima) / (1000 * 60 * 60 * 24);
        if (diffDias > 7) {
          silenciosos++;
        }
      }
    }

    const pct = (silenciosos / totalAtivos) * 100;

    if (valueEl) valueEl.textContent = `${pct.toFixed(1).replace('.', ',')}%`;
    if (subEl)   subEl.textContent   = `Silenciosos: ${silenciosos} de ${totalAtivos} clientes ativados (sem tarefas concluídas há > 7 dias).`;
    if (trendEl) trendEl.lastChild.textContent = pct < 10 ? 'Meta atingida (< 10%)' : 'Abaixo da meta (≥ 10%)';

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Índice de Silêncio:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Taxa de Campanhas sem Saldo (Setor Operacional) ──────────────────

/**
 * Calcula a porcentagem de clientes ativados que estão com a campanha "Sem Saldo".
 * (Snapshot, não depende de data).
 */
async function _carregarCampanhasSemSaldo() {
  const cardEl  = document.getElementById('rel-campanhas-sem-saldo');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…%';

  try {
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('cliente_campanha_status')
      .eq('cliente_status', 'Ativado');

    if (error) throw error;

    const totalAtivos = (clientes ?? []).length;

    if (totalAtivos === 0) {
      if (valueEl) valueEl.textContent = '0%';
      if (subEl)   subEl.textContent   = 'Nenhum cliente ativo na base';
      if (trendEl) trendEl.lastChild.textContent = 'Sem dados';
      return;
    }

    const semSaldoCount = (clientes ?? []).filter(c => c.cliente_campanha_status === 'Sem Saldo').length;
    const pct = (semSaldoCount / totalAtivos) * 100;

    if (valueEl) valueEl.textContent = `${pct.toFixed(1).replace('.', ',')}%`;
    if (subEl)   subEl.textContent   = `Sem saldo: ${semSaldoCount} de ${totalAtivos} clientes ativados.`;
    if (trendEl) trendEl.lastChild.textContent = pct <= 5 ? 'Meta atingida (≤ 5%)' : 'Abaixo da meta (> 5%)';

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Campanhas sem Saldo:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Volume de Otimizações Realizadas (Setor Operacional) ─────────────

/**
 * Calcula o volume de otimizações.
 * (Snapshot, não depende de data).
 * Conta todos os clientes ativos que estão com cliente_otimizacao = true.
 */
async function _carregarOtimizacoesRealizadas() {
  const cardEl  = document.getElementById('rel-otimizacoes');
  const valueEl = cardEl?.querySelector('.rel-kpi-value');
  const subEl   = cardEl?.querySelector('.rel-kpi-sub');
  const trendEl = cardEl?.querySelector('.rel-kpi-trend');

  if (valueEl) valueEl.textContent = '…';

  try {
    const { count, error } = await supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact', head: true })
      .eq('cliente_status', 'Ativado')
      .eq('cliente_otimizacao', true);

    if (error) throw error;

    const volume = count || 0;

    if (valueEl) valueEl.textContent = `${volume}`;
    if (subEl)   subEl.textContent   = `Total de clientes Ativados com flag de otimização marcada.`;
    if (trendEl) trendEl.lastChild.textContent = volume > 0 ? 'Otimizações registradas' : 'Nenhuma otimização no momento';

  } catch (err) {
    console.error('[Relatórios] Erro ao calcular Otimizações Realizadas:', err.message);
    if (valueEl) valueEl.textContent = 'Erro';
  }
}

// ─── Taxa de Conclusão de Atividades por Usuário (Setor Operacional) ──

/**
 * Calcula a taxa de conclusão de tarefas no período, agrupadas por usuário.
 * Filtra tarefas pela data de vencimento dentro do período selecionado.
 * Taxa = (Concluídas / Previstas) * 100.
 *
 * @param {string} inicio  'YYYY-MM-DD'
 * @param {string} fim     'YYYY-MM-DD'
 */
async function _carregarConclusaoAtividades(inicio, fim) {
  const tbody = document.getElementById('rel-atividades-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px;">Carregando...</td></tr>`;

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    // 1. Busca todas as tarefas que tinham vencimento no período
    const { data: tarefas, error: tarErr } = await supabase
      .from('tarefas')
      .select('vendedor_id, tarefa_status')
      .gte('tarefa_vencimento', inicioISO)
      .lte('tarefa_vencimento', fimISO);

    if (tarErr) throw tarErr;

    const validas = (tarefas ?? []).filter(t => t.vendedor_id);

    if (validas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px;">Nenhuma tarefa prevista no período</td></tr>`;
      return;
    }

    // 2. Busca os usuários para mostrar o nome e avatar
    const { data: usuarios, error: usuErr } = await supabase
      .from('usuarios')
      .select('user_id, user_nome, user_avatar');
      
    if (usuErr) throw usuErr;
    
    const userMap = {};
    for (const u of (usuarios ?? [])) {
      userMap[u.user_id] = u;
    }

    // 3. Agrupa as tarefas por usuário
    const stats = {};
    for (const t of validas) {
      const vid = t.vendedor_id;
      if (!stats[vid]) {
        stats[vid] = { id: vid, previstas: 0, concluidas: 0 };
      }
      stats[vid].previstas++;
      if (t.tarefa_status === true) {
        stats[vid].concluidas++;
      }
    }

    // 4. Converte para array e calcula a taxa
    const ranking = Object.values(stats).map(s => {
      s.taxa = s.previstas > 0 ? (s.concluidas / s.previstas) * 100 : 0;
      return s;
    });

    // Ordena por maior taxa e depois maior número de previstas/concluídas
    ranking.sort((a, b) => b.taxa - a.taxa || b.concluidas - a.concluidas);

    // 5. Renderiza a tabela
    tbody.innerHTML = '';
    
    ranking.forEach((row, index) => {
      const user = userMap[row.id] || { user_nome: 'Usuário Desconhecido', user_avatar: null };
      
      const avatarHtml = user.user_avatar 
        ? `<img src="${user.user_avatar}" alt="" class="rel-table-avatar" style="object-fit:cover; border-radius:50%;">`
        : `<div class="rel-table-avatar">${user.user_nome.charAt(0).toUpperCase()}</div>`;
        
      const taxaInt = Math.round(row.taxa);
      
      let pillClass = 'rel-pill--red';
      let pillText = 'Baixa';
      let barColor = 'red';
      
      if (row.taxa >= 80) {
        pillClass = 'rel-pill--green';
        pillText = 'Excelente';
        barColor = 'green';
      } else if (row.taxa >= 50) {
        pillClass = 'rel-pill--amber';
        pillText = 'Razoável';
        barColor = 'amber';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rel-rank">${index + 1}</td>
        <td>
          <div class="rel-avatar-cell">
            ${avatarHtml}
            <div>
              <div class="rel-table-name">${user.user_nome}</div>
              <div class="rel-table-sub">Atendimento</div>
            </div>
          </div>
        </td>
        <td>${row.previstas}</td>
        <td>${row.concluidas}</td>
        <td style="width: 140px;">
          ${_miniBar(taxaInt, barColor)}
        </td>
        <td><span class="rel-pill ${pillClass}">${pillText}</span></td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('[Relatórios] Erro ao carregar Taxa de Conclusão:', err.message);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--red); padding: 24px;">Erro ao carregar dados</td></tr>`;
  }
}

// ─── NPS / Satisfação Detalhado por Gestor ─────────────────────────────

/**
 * Calcula as médias de NPS (Comunicação, Entrega, Performance) por gestor.
 * Filtro de data sobre data_envio_nps.
 */
async function _carregarNPSDetalhado(inicio, fim) {
  const listaEl = document.getElementById('rel-nps-lista');
  if (!listaEl) return;

  listaEl.innerHTML = '<div style="text-align:center; padding: 24px;">Carregando...</div>';

  try {
    const [iniY, iniM, iniD] = inicio.split('-').map(Number);
    const [fimY, fimM, fimD] = fim.split('-').map(Number);
    const inicioISO = new Date(Date.UTC(iniY, iniM - 1, iniD, 0, 0, 0, 0)).toISOString();
    const fimISO    = new Date(Date.UTC(fimY, fimM - 1, fimD, 23, 59, 59, 999)).toISOString();

    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('user_id, nota_comunicacao, nota_entrega, nota_performance')
      .eq('cliente_status', 'Ativado')
      .gte('data_envio_nps', inicioISO)
      .lte('data_envio_nps', fimISO);

    if (error) throw error;

    const validos = (clientes ?? []).filter(c => 
      c.user_id && (c.nota_comunicacao != null || c.nota_entrega != null || c.nota_performance != null)
    );

    if (validos.length === 0) {
      listaEl.innerHTML = '<div style="text-align:center; padding: 24px;">Nenhuma avaliação de NPS no período selecionado.</div>';
      return;
    }

    const userIds = [...new Set(validos.map(c => c.user_id))];

    const { data: usuarios, error: usuErr } = await supabase
      .from('usuarios')
      .select('user_id, user_nome, user_avatar')
      .in('user_id', userIds);

    if (usuErr) throw usuErr;
    
    const userMap = {};
    for (const u of (usuarios ?? [])) {
      userMap[u.user_id] = u;
    }

    // Agrupa e calcula
    const stats = {};
    for (const c of validos) {
      const uid = c.user_id;
      if (!stats[uid]) {
        stats[uid] = { 
          id: uid, 
          countCom: 0, sumCom: 0,
          countEnt: 0, sumEnt: 0,
          countPerf: 0, sumPerf: 0
        };
      }
      if (c.nota_comunicacao != null) { stats[uid].countCom++; stats[uid].sumCom += Number(c.nota_comunicacao); }
      if (c.nota_entrega != null) { stats[uid].countEnt++; stats[uid].sumEnt += Number(c.nota_entrega); }
      if (c.nota_performance != null) { stats[uid].countPerf++; stats[uid].sumPerf += Number(c.nota_performance); }
    }

    const ranking = Object.values(stats).map(s => {
      s.avgCom = s.countCom > 0 ? s.sumCom / s.countCom : 0;
      s.avgEnt = s.countEnt > 0 ? s.sumEnt / s.countEnt : 0;
      s.avgPerf = s.countPerf > 0 ? s.sumPerf / s.countPerf : 0;
      
      let sumGeral = 0;
      let countGeral = 0;
      if (s.countCom > 0) { sumGeral += s.avgCom; countGeral++; }
      if (s.countEnt > 0) { sumGeral += s.avgEnt; countGeral++; }
      if (s.countPerf > 0) { sumGeral += s.avgPerf; countGeral++; }
      
      s.mediaGeral = countGeral > 0 ? sumGeral / countGeral : 0;
      return s;
    });

    ranking.sort((a, b) => b.mediaGeral - a.mediaGeral);

    listaEl.innerHTML = '';

    ranking.forEach(row => {
      const user = userMap[row.id] || { user_nome: 'Desconhecido', user_avatar: null };
      
      const avatarHtml = user.user_avatar 
        ? `<img src="${user.user_avatar}" style="width:24px;height:24px;object-fit:cover;border-radius:50%;margin-right:8px;vertical-align:middle;">`
        : `<div class="rel-table-avatar" style="display:inline-flex;width:24px;height:24px;font-size:11px;border-radius:50%;margin-right:8px;vertical-align:middle;justify-content:center;align-items:center;background:var(--card-bg-hover);color:var(--text-color);">${user.user_nome.charAt(0).toUpperCase()}</div>`;

      // Cada nota de 0 a 10 vira 0 a 100 para o miniBar
      const pctCom = Math.round(row.avgCom * 10);
      const pctEnt = Math.round(row.avgEnt * 10);
      const pctPerf = Math.round(row.avgPerf * 10);
      
      const el = document.createElement('div');
      el.className = 'rel-motivo-item';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'stretch';
      el.style.padding = '12px 16px';
      el.style.gap = '8px';
      el.style.borderBottom = '1px solid var(--border)';
      
      el.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; font-weight: 500;">
            ${avatarHtml}
            ${user.user_nome}
          </div>
          <div style="font-weight: 600; font-size: 14px;">Média Geral: ${row.mediaGeral.toFixed(1)}</div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 8px;">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Comunicação</div>
            ${_miniBar(pctCom, 'purple', row.avgCom.toFixed(1))}
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Entrega</div>
            ${_miniBar(pctEnt, 'cyan', row.avgEnt.toFixed(1))}
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Performance</div>
            ${_miniBar(pctPerf, 'blue', row.avgPerf.toFixed(1))}
          </div>
        </div>
      `;
      listaEl.appendChild(el);
    });

  } catch (err) {
    console.error('[Relatórios] Erro ao carregar NPS Detalhado:', err.message);
    listaEl.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--red);">Erro ao carregar dados</div>';
  }
}

// ─── Aplicar período ─────────────────────────────────────────

/**
 * Chamada sempre que o período muda.
 * Atualiza o badge, fecha o picker e recarrega as métricas do período.
 */
function _aplicarPeriodo(inicio, fim, label = null) {
  _dataInicio = inicio;
  _dataFim    = fim;
  _periodLabel = label ||
    `${_formatarExibicao(inicio)} – ${_formatarExibicao(fim)}`;

  // Atualiza badge
  const badge = document.getElementById('rel-period-badge-text');
  if (badge) badge.textContent = _periodLabel;

  // Fecha picker
  _fecharPicker();

  // Atualiza os inputs caso tenham sido alterados via atalho
  const inputInicio = document.getElementById('rel-data-inicio');
  const inputFim    = document.getElementById('rel-data-fim');
  if (inputInicio) inputInicio.value = _dataInicio;
  if (inputFim)    inputFim.value    = _dataFim;

  console.log('[Relatórios] Período aplicado:', _dataInicio, '→', _dataFim);

  // ── Métricas filtradas por período ──
  _carregarMRR();
  _carregarReceitaCliente();
  _carregarEbitda();
  _carregarFaturamentoColaborador();
  _carregarRevenueChurn(_dataInicio, _dataFim);
  _carregarQuickRatio(_dataInicio, _dataFim);
  _carregarChurnClientes(_dataInicio, _dataFim);
  _carregarCacPayback(_dataInicio, _dataFim);
  _carregarCAC(_dataInicio, _dataFim);
  _carregarCPQ(_dataInicio, _dataFim);
  _carregarTicketMedio(_dataInicio, _dataFim);
  _carregarTaxaConversao(_dataInicio, _dataFim);
  _carregarMqlSql(_dataInicio, _dataFim);
  _carregarChurnComercial(_dataInicio, _dataFim);
  _carregarCicloVendas(_dataInicio, _dataFim);
  _carregarMotivosPerda(_dataInicio, _dataFim);
  _carregarPerformanceVendedor(_dataInicio, _dataFim);
  _carregarNoShow(_dataInicio, _dataFim);
  _carregarLtvMetrics(_dataInicio, _dataFim);
  _carregarSetupMedio(_dataInicio, _dataFim);
  _carregarNPS(_dataInicio, _dataFim);
  _carregarConclusaoAtividades(_dataInicio, _dataFim);
  _carregarNPSDetalhado(_dataInicio, _dataFim);
  // Snapshot: não depende de período, mas atualiza junto para consistência
  _carregarReceitaAberto();
  _carregarHealthScore();
  _carregarIndiceSilencio();
  _carregarCampanhasSemSaldo();
  _carregarOtimizacoesRealizadas();
}

// ─── Abrir / Fechar picker ───────────────────────────────────

function _abrirPicker() {
  const wrapper = document.getElementById('rel-period-wrapper');
  const btn     = document.getElementById('rel-period-badge-btn');
  if (!wrapper) return;
  wrapper.classList.add('open');
  btn?.classList.add('active');
}

function _fecharPicker() {
  const wrapper = document.getElementById('rel-period-wrapper');
  const btn     = document.getElementById('rel-period-badge-btn');
  if (!wrapper) return;
  wrapper.classList.remove('open');
  btn?.classList.remove('active');
}

// ─── Bind de eventos ─────────────────────────────────────────

function _bindTabEvents() {
  document.querySelectorAll('.rel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === _tabAtual) return;
      _tabAtual = tab;

      document.querySelectorAll('.rel-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.rel-section').forEach(s => s.classList.remove('active'));
      const secao = document.getElementById(`rel-section-${tab}`);
      if (secao) secao.classList.add('active');
    });
  });
}

function _bindPeriodEvents() {
  // Toggle do picker ao clicar no badge
  document.getElementById('rel-period-badge-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const wrapper = document.getElementById('rel-period-wrapper');
    wrapper?.classList.contains('open') ? _fecharPicker() : _abrirPicker();
  });

  // Fechar ao clicar fora
  document.addEventListener('click', _handleClickFora);

  // Atalhos rápidos
  document.querySelectorAll('.rel-shortcut').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.shortcut;
      let ini, fim, label;

      if (s === 'mes-atual') {
        ini   = _primeiroDiaMes();
        fim   = _ultimoDiaMes();
        label = 'Este mês';
      } else if (s === 'mes-anterior') {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        ini   = _primeiroDiaMes(d);
        fim   = _ultimoDiaMes(d);
        label = 'Mês anterior';
      } else if (s === '30d') {
        ini   = _subDias(29);
        fim   = _hoje();
        label = 'Últimos 30 dias';
      } else if (s === '90d') {
        ini   = _subDias(89);
        fim   = _hoje();
        label = 'Últimos 90 dias';
      } else if (s === 'ano-atual') {
        const ano = new Date().getFullYear();
        ini   = `${ano}-01-01`;
        fim   = `${ano}-12-31`;
        label = `Ano ${ano}`;
      }

      // Marca atalho ativo
      document.querySelectorAll('.rel-shortcut').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      _aplicarPeriodo(ini, fim, label);
    });
  });

  // Botão Aplicar (inputs manuais)
  document.getElementById('rel-period-apply')?.addEventListener('click', () => {
    const ini = document.getElementById('rel-data-inicio')?.value;
    const fim = document.getElementById('rel-data-fim')?.value;
    if (!ini || !fim) return;
    if (ini > fim) {
      alert('A data inicial não pode ser maior que a data final.');
      return;
    }
    // Remove atalho ativo pois é seleção manual
    document.querySelectorAll('.rel-shortcut').forEach(b => b.classList.remove('active'));
    _aplicarPeriodo(ini, fim);
  });

  // Ao mudar os inputs, remove o atalho ativo
  ['rel-data-inicio', 'rel-data-fim'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      document.querySelectorAll('.rel-shortcut').forEach(b => b.classList.remove('active'));
    });
  });

  // Marca o atalho correspondente ao período inicial
  _marcarAtalhoAtivo();
}

function _marcarAtalhoAtivo() {
  const ini = _dataInicio;
  const fim = _dataFim;
  let ativo = null;

  if (ini === _primeiroDiaMes() && fim === _ultimoDiaMes()) {
    ativo = 'mes-atual';
  } else if (ini === _subDias(29) && fim === _hoje()) {
    ativo = '30d';
  } else if (ini === _subDias(89) && fim === _hoje()) {
    ativo = '90d';
  } else {
    const ano = new Date().getFullYear();
    if (ini === `${ano}-01-01` && fim === `${ano}-12-31`) {
      ativo = 'ano-atual';
    }
  }

  if (ativo) {
    document.querySelector(`.rel-shortcut[data-shortcut="${ativo}"]`)?.classList.add('active');
  }
}

function _handleClickFora(e) {
  const wrapper = document.getElementById('rel-period-wrapper');
  const btn     = document.getElementById('rel-period-badge-btn');
  if (!wrapper) return;
  if (!wrapper.contains(e.target) && !btn?.contains(e.target)) {
    _fecharPicker();
  }
}

async function _carregarAtividadeAdmin(vendedorId, dataInicio, dataFim) {
  const elContatos = document.getElementById('rel-atividade-contatos');
  const elProps    = document.getElementById('rel-atividade-prospecao');

  if (!vendedorId || !dataInicio || !dataFim) {
    if (elContatos) elContatos.textContent = '—';
    if (elProps)    elProps.textContent    = '—';
    return;
  }

  const res = await DiaFinalizado.getEstatisticasCustom(vendedorId, dataInicio, dataFim);
  if (res && !res.error) {
    if (elContatos) elContatos.textContent = res.contatos || 0;
    if (elProps)    elProps.textContent    = res.prospeccoes || 0;
  }
}

function _bindAtividadeAdminEvents() {
  const selVendedor = document.getElementById('rel-atividade-vendedor');
  const inputInicio = document.getElementById('rel-atividade-inicio');
  const inputFim    = document.getElementById('rel-atividade-fim');

  if (!selVendedor || !inputInicio || !inputFim) return;

  const update = () => _carregarAtividadeAdmin(selVendedor.value, inputInicio.value, inputFim.value);
  
  selVendedor.addEventListener('change', update);
  inputInicio.addEventListener('change', update);
  inputFim.addEventListener('change', update);

  Usuarios.getVendedoresAtivos().then(res => {
    if (res.error || !res.data) return;
    selVendedor.innerHTML = res.data.map(v => `<option value="${v.user_id}">${v.user_nome}</option>`).join('');
    if (res.data.length > 0) {
      update();
    }
  });
}

// ─── Módulo da página ────────────────────────────────────────

export default {
  render() {
    if (!UserStore.isAdmin()) {
      return _htmlAccessDenied();
    }
    _initPeriodo();
    return _htmlPage();
  },

  async onMount() {
    if (!UserStore.isAdmin()) return;
    _bindTabEvents();
    _bindPeriodEvents();
    _bindInvestimentoEvents();
    _bindAtividadeAdminEvents();
    // Carregar valor de investimento salvo primeiro
    await _carregarInvestimento();
    // Aplicar período padrão ao montar (dispara _carregarCAC e demais métricas)
    _aplicarPeriodo(_dataInicio, _dataFim, _periodLabel);
  },

  onDestroy() {
    _tabAtual = 'comercial';
    document.removeEventListener('click', _handleClickFora);
    if (_popoverEl) {
      _popoverEl.remove();
      _popoverEl = null;
    }
  },
};
