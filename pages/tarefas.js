/**
 * tarefas.js — Página "Tarefas"
 *
 * Exibe todas as tarefas vinculadas ao usuário logado.
 * Funcionalidades:
 *   - KPI cards: Total / Pendentes / Concluídas / Atrasadas
 *   - Filtros: Todas | Pendentes | Concluídas
 *   - Pesquisa por título
 *   - Marcar como concluída / reabrir
 *   - Indicação visual de tarefas atrasadas
 */

import UserStore    from '../js/userStore.js';
import { Tarefas, Usuarios }  from '../js/db.js';
import NegocioPanel from '../components/kanban/NegocioPanel.js';

// Singleton do painel de negócio (reutilizado ao longo da sessão)
const _negocioPanel = new NegocioPanel();

// ─── Estado local ──────────────────────────────────────────────────
let _tarefas      = [];           // cache completo
let _filtroAtual  = 'pendentes';  // 'todas' | 'pendentes' | 'concluidas' — padrão: pendentes
let _busca        = '';
let _vendedores   = [];
let _membroAtual  = '';   // '' = todos
let _dataAtual    = '';   // yyyy-mm-dd

// Ordem de prioridade (menor índice = mais urgente)
const PRIORIDADE_ORDEM = { 'Urgente': 0, 'Alta': 1, 'Normal': 2, 'Baixa': 3 };
const PRIORIDADE_OPCOES = ['Urgente', 'Alta', 'Normal', 'Baixa'];

// Estado de expansão das seções (persistido entre re-renders)
let _sectionExpanded = {
  'pend-hoje':    true,   // Pendentes · Hoje (aberto por padrão)
  'pend-3dias':   false,
  'pend-7dias':   false,
  'pend-30dias':  false,
  'conc-hoje':    false,  // Concluídas · Hoje
  'conc-7dias':   false,
  'conc-15dias':  false,
  'conc-30dias':  false,
  'conc-resto':   false,
};

// ─── Helpers de data ───────────────────────────────────────────────

function _isAtrasada(tarefa) {
  if (tarefa.tarefa_status) return false;           // concluída → não está atrasada
  if (!tarefa.tarefa_vencimento) return false;
  return new Date(tarefa.tarefa_vencimento) < new Date();
}

// Classifica tarefa PENDENTE pela proximidade do vencimento
function _classifyPendente(t) {
  if (!t.tarefa_vencimento) return 'hoje'; // sem data → Hoje
  const venc  = new Date(t.tarefa_vencimento);
  const hoje  = new Date();
  const dVenc = new Date(venc.getFullYear(),  venc.getMonth(),  venc.getDate());
  const dHoje = new Date(hoje.getFullYear(),  hoje.getMonth(),  hoje.getDate());
  const diff  = Math.round((dVenc - dHoje) / 86400000);
  if (diff <= 0) return 'hoje';    // hoje ou atrasada
  if (diff <= 3) return '3dias';
  if (diff <= 7) return '7dias';
  return '30dias';                  // 8+ dias
}

// Classifica tarefa CONCLUÍDA pela distância da data de conclusão
function _classifyConcluida(t) {
  if (!t.data_conclusao) return 'resto';
  const conc  = new Date(t.data_conclusao);
  const hoje  = new Date();
  const dConc = new Date(conc.getFullYear(), conc.getMonth(), conc.getDate());
  const dHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diff  = Math.round((dHoje - dConc) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff <= 7)  return '7dias';
  if (diff <= 15) return '15dias';
  if (diff <= 30) return '30dias';
  return 'resto';
}

// Renderiza um grupo colapsável genérico
function _htmlSection(id, label, tarefas, sortMode) {
  if (!tarefas.length) return '';
  const expanded = _sectionExpanded[id] ?? false;

  let sorted = [...tarefas];
  if (sortMode === 'venc-asc') {
    sorted.sort((a, b) => {
      // Primeiro por prioridade, depois por vencimento
      const pa = PRIORIDADE_ORDEM[a.tarefa_prioridade] ?? 2;
      const pb = PRIORIDADE_ORDEM[b.tarefa_prioridade] ?? 2;
      if (pa !== pb) return pa - pb;
      if (!a.tarefa_vencimento && !b.tarefa_vencimento) return 0;
      if (!a.tarefa_vencimento) return 1;
      if (!b.tarefa_vencimento) return -1;
      return new Date(a.tarefa_vencimento) - new Date(b.tarefa_vencimento);
    });
  } else {
    sorted.sort((a, b) => {
      if (!a.data_conclusao && !b.data_conclusao) return 0;
      if (!a.data_conclusao) return 1;
      if (!b.data_conclusao) return -1;
      return new Date(b.data_conclusao) - new Date(a.data_conclusao);
    });
  }

  return `
    <div class="tf-group" id="tf-group-${id}">
      <div class="tf-group-header tf-group-header--clickable tf-section-toggle"
           data-section-id="${id}"
           style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${label}</span>
          <span class="tf-group-count">${tarefas.length}</span>
        </div>
        <svg class="tf-chevron-icon"
             style="width: 16px; height: 16px; transition: transform 0.2s; transform: ${expanded ? 'rotate(90deg)' : 'rotate(0deg)'};"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
      <div class="tf-group-content" style="display: ${expanded ? 'block' : 'none'}; padding-top: 10px;">
        ${sorted.map(_htmlTarefaItem).join('')}
      </div>
    </div>
  `;
}

function _formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
    hour:  '2-digit',
    minute:'2-digit',
  });
}

function _diasRestantes(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  return Math.ceil(diff / 86400000); // ms → dias
}

function _formatarTempo(ms) {
  if (!ms || ms < 0) return '0s';
  const totalSeg = Math.floor(ms / 1000);
  const h   = Math.floor(totalSeg / 3600);
  const min = Math.floor((totalSeg % 3600) / 60);
  const seg = totalSeg % 60;
  if (h > 0)   return `${h}h ${min}min ${seg}s`;
  if (min > 0) return `${min}min ${seg}s`;
  return `${seg}s`;
}

// ─── Filtragem ─────────────────────────────────────────────────────

function _tarefasFiltradas() {
  return _tarefas.filter(t => {
    // filtro de status
    if (_filtroAtual === 'pendentes'  && t.tarefa_status)  return false;
    if (_filtroAtual === 'concluidas' && !t.tarefa_status) return false;

    // filtro de membro
    if (_membroAtual && t.vendedor_id !== _membroAtual) return false;

    // filtro de data conclusao
    if (_dataAtual) {
      if (!t.data_conclusao) return false;
      const d = t.data_conclusao.substring(0, 10); // 'YYYY-MM-DD'
      if (d !== _dataAtual) return false;
    }

    // pesquisa
    if (_busca) {
      const q = _busca.toLowerCase();
      const match = (t.tarefa_titulo   || '').toLowerCase().includes(q)
                 || (t.tarefa_descricao || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });
}

// ─── Render helpers ────────────────────────────────────────────────

function _htmlKpis() {
  const total       = _tarefas.length;
  const pendentes   = _tarefas.filter(t => !t.tarefa_status).length;
  const concluidas  = _tarefas.filter(t =>  t.tarefa_status).length;
  const atrasadas   = _tarefas.filter(_isAtrasada).length;

  const pct = total ? Math.round((concluidas / total) * 100) : 0;

  return `
    <div class="tf-kpi-grid">
      <div class="tf-kpi-card">
        <div class="tf-kpi-icon tf-kpi-icon--all">
          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <div class="tf-kpi-body">
          <span class="tf-kpi-value">${total}</span>
          <span class="tf-kpi-label">Total</span>
        </div>
      </div>

      <div class="tf-kpi-card">
        <div class="tf-kpi-icon tf-kpi-icon--pending">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="tf-kpi-body">
          <span class="tf-kpi-value">${pendentes}</span>
          <span class="tf-kpi-label">Pendentes</span>
        </div>
      </div>

      <div class="tf-kpi-card">
        <div class="tf-kpi-icon tf-kpi-icon--done">
          <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="tf-kpi-body">
          <span class="tf-kpi-value">${concluidas}</span>
          <span class="tf-kpi-label">Concluídas</span>
        </div>
        <div class="tf-kpi-progress">
          <div class="tf-kpi-progress-bar" style="width:${pct}%"></div>
        </div>
        <span class="tf-kpi-pct">${pct}%</span>
      </div>

      <div class="tf-kpi-card ${atrasadas ? 'tf-kpi-card--alert' : ''}">
        <div class="tf-kpi-icon tf-kpi-icon--late">
          <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="tf-kpi-body">
          <span class="tf-kpi-value">${atrasadas}</span>
          <span class="tf-kpi-label">Atrasadas</span>
        </div>
      </div>
    </div>
  `;
}

function _htmlFilters() {
  const opts = [
    { key: 'todas',      label: 'Todas'      },
    { key: 'pendentes',  label: 'Pendentes'  },
    { key: 'concluidas', label: 'Concluídas' },
  ];
  const pills = opts.map(o => `
    <button class="tf-filter-pill ${_filtroAtual === o.key ? 'active' : ''}"
            data-filter="${o.key}">
      ${o.label}
    </button>
  `).join('');

  let adminFilters = '';
  if (UserStore.isAdmin()) {
    const vopts = _vendedores.map(v => `
      <option value="${v.user_id}" ${_membroAtual === v.user_id ? 'selected' : ''}>${v.user_nome}</option>
    `).join('');
    
    adminFilters = `
      <div class="tf-admin-filters">
        <select id="tf-membro-filter" class="tf-select">
          <option value="">Todos os Membros</option>
          ${vopts}
        </select>
        <div class="tf-date-wrap">
          <label for="tf-data-filter" class="tf-date-label">Conclusão:</label>
          <input type="date" id="tf-data-filter" class="tf-input-date" value="${_dataAtual}">
        </div>
      </div>
    `;
  }

  return `
    <div class="tf-toolbar">
      <div class="tf-filter-pills">${pills}</div>
      ${adminFilters}
      <div class="tf-search-wrap">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="tf-search" class="tf-search" type="text"
               placeholder="Pesquisar tarefa…"
               value="${_busca}">
      </div>
    </div>
  `;
}

function _badgeStatus(tarefa) {
  if (tarefa.tarefa_status) {
    return `<span class="tf-badge tf-badge--done">Concluída</span>`;
  }
  if (_isAtrasada(tarefa)) {
    return `<span class="tf-badge tf-badge--late">Atrasada</span>`;
  }
  const dias = _diasRestantes(tarefa.tarefa_vencimento);
  if (dias === 0) return `<span class="tf-badge tf-badge--today">Hoje</span>`;
  if (dias === 1) return `<span class="tf-badge tf-badge--soon">Amanhã</span>`;
  return `<span class="tf-badge tf-badge--open">Pendente</span>`;
}

function _badgePrioridade(t) {
  const p = t.tarefa_prioridade || 'Normal';
  const classes = {
    'Urgente': 'tf-prior--urgente',
    'Alta':    'tf-prior--alta',
    'Normal':  'tf-prior--normal',
    'Baixa':   'tf-prior--baixa',
  };
  const icons = {
    'Urgente': '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'Alta':    '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>',
    'Normal':  '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    'Baixa':   '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>',
  };
  const cls = classes[p] || classes['Normal'];
  const icon = icons[p] || icons['Normal'];
  const opts = PRIORIDADE_OPCOES.map(op =>
    `<button class="tf-prior-opt ${op === p ? 'active' : ''}" data-prior="${op}" data-tarefa-id="${t.tarefa_id}">${op}</button>`
  ).join('');
  return `
    <div class="tf-prior-wrap">
      <span class="tf-prior-badge ${cls}" data-tarefa-id="${t.tarefa_id}" title="Alterar prioridade">
        ${icon}${p}
        <svg class="tf-prior-caret" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </span>
      <div class="tf-prior-dropdown" data-tarefa-id="${t.tarefa_id}">
        ${opts}
      </div>
    </div>
  `;
}

function _htmlTarefaItem(t) {
  const concluida  = t.tarefa_status;
  const atrasada   = _isAtrasada(t);
  const descricao  = t.tarefa_descricao?.trim() || '';
  const emAndamento = !concluida && !!t.data_inicio;

  const acumulado = Number(t.tempo_acumulado_ms) || 0;

  // Tempo decorrido
  let tempoHTML = '';
  if (concluida) {
    let ms = acumulado;
    // Fallback para tarefas legadas
    if (ms === 0 && t.data_inicio && t.data_conclusao) {
      ms = new Date(t.data_conclusao) - new Date(t.data_inicio);
    }
    if (ms > 0) {
      tempoHTML = `
        <div class="tf-timing tf-timing--done">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Tempo: <strong>${_formatarTempo(ms)}</strong>
        </div>`;
    }
  } else {
    if (t.data_inicio) {
      // Rodando
      const ms = acumulado + (new Date() - new Date(t.data_inicio));
      tempoHTML = `
        <div class="tf-timing tf-timing--running">
          <span class="tf-timing-dot"></span>
          Em andamento ▸ <strong id="tf-timer-${t.tarefa_id}">${_formatarTempo(ms)}</strong>
        </div>`;
    } else if (acumulado > 0) {
      // Pausado
      tempoHTML = `
        <div class="tf-timing tf-timing--paused">
          <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          Pausado ▸ <strong>${_formatarTempo(acumulado)}</strong>
        </div>`;
    }
  }

  // Botão de timing
  let timingBtn = '';
  if (!concluida) {
    if (!t.data_inicio) {
      const label = (acumulado > 0) ? 'Retomar' : 'Iniciar';
      timingBtn = `
        <button class="tf-btn-timing tf-btn-iniciar" data-tarefa-id="${t.tarefa_id}" title="${label} cronômetro">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ${label}
        </button>`;
    } else {
      timingBtn = `
        <button class="tf-btn-timing tf-btn-pausar" data-tarefa-id="${t.tarefa_id}" title="Pausar tarefa">
          <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          Pausar
        </button>
        <button class="tf-btn-timing tf-btn-finalizar" data-tarefa-id="${t.tarefa_id}" title="Finalizar e concluir tarefa">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          Finalizar
        </button>`;
    }
  }

  return `
    <div class="tf-item ${concluida ? 'tf-item--done' : ''} ${atrasada ? 'tf-item--late' : ''} ${emAndamento ? 'tf-item--running' : ''}"
         data-id="${t.tarefa_id}">

      <button class="tf-check ${concluida ? 'checked' : ''}"
              data-tarefa-id="${t.tarefa_id}"
              data-status="${concluida}"
              title="${concluida ? 'Reabrir tarefa' : 'Marcar como concluída'}">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </button>

      <div class="tf-item-body">
        <div class="tf-item-header">
          <span class="tf-item-titulo tf-titulo-editavel"
                data-tarefa-id="${t.tarefa_id}"
                title="Clique para editar o título">${t.tarefa_titulo || 'Sem título'}</span>
          ${_badgeStatus(t)}
          ${!concluida ? _badgePrioridade(t) : ''}
        </div>
        ${descricao ? `<p class="tf-item-desc">${descricao}</p>` : ''}
        ${tempoHTML}
        <div class="tf-item-meta">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Vencimento: ${_formatarData(t.tarefa_vencimento)}</span>
          ${t.data_conclusao ? `
            <span class="tf-item-negocio-sep">•</span>
            <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Conclusão: ${_formatarData(t.data_conclusao)}</span>
          ` : ''}
          ${t.usuarios?.user_nome ? `
            <span class="tf-item-negocio-sep">•</span>
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Responsável: <strong>${t.usuarios.user_nome}</strong></span>
          ` : ''}
          ${t.negocio_id ? `
            <span class="tf-item-negocio-sep">•</span>
            <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <span>Negócio #${t.negocio_id}</span>
          ` : ''}
        </div>
      </div>

      <div class="tf-item-actions">
        ${timingBtn}
        ${t.negocio_id ? `
          <button class="tf-btn-negocio"
                  data-negocio-id="${t.negocio_id}"
                  title="Ver negócio">
            <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Ver negócio
          </button>
        ` : ''}
        <button class="tf-btn-excluir"
                data-tarefa-id="${t.tarefa_id}"
                title="Excluir tarefa">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Excluir
        </button>
      </div>
    </div>
  `;
}

function _htmlLista() {
  const filtradas = _tarefasFiltradas();

  if (!filtradas.length) {
    const msgs = {
      todas:      ['Nenhuma tarefa encontrada', 'Você não possui tarefas cadastradas ainda.'],
      pendentes:  ['Sem tarefas pendentes', 'Ótimo trabalho! Todas as suas tarefas estão concluídas.'],
      concluidas: ['Nenhuma tarefa concluída', 'Conclua suas tarefas e elas aparecerão aqui.'],
    };
    const [titulo, sub] = msgs[_filtroAtual] || msgs.todas;
    return `
      <div class="tf-empty">
        <div class="tf-empty-icon">
          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <h3>${titulo}</h3>
        <p>${sub}</p>
      </div>
    `;
  }

  const pendentes  = filtradas.filter(t => !t.tarefa_status);
  const concluidas = filtradas.filter(t =>  t.tarefa_status);

  let html = '';

  // ── Seções de PENDENTES — agrupadas por prazo de vencimento ────────
  if (_filtroAtual !== 'concluidas' && pendentes.length) {
    const grupos = {
      hoje:     pendentes.filter(t => _classifyPendente(t) === 'hoje'),
      '3dias':  pendentes.filter(t => _classifyPendente(t) === '3dias'),
      '7dias':  pendentes.filter(t => _classifyPendente(t) === '7dias'),
      '30dias': pendentes.filter(t => _classifyPendente(t) === '30dias'),
    };

    html += _htmlSection('pend-hoje',   'Hoje',             grupos.hoje,     'venc-asc');
    html += _htmlSection('pend-3dias',  'Próximos 3 Dias',  grupos['3dias'], 'venc-asc');
    html += _htmlSection('pend-7dias',  'Próximos 7 Dias',  grupos['7dias'], 'venc-asc');
    html += _htmlSection('pend-30dias', 'Próximos 30 Dias', grupos['30dias'],'venc-asc');
  }

  // ── Seções de CONCLUÍDAS — Histórico agrupado por data de conclusão
  if (_filtroAtual !== 'pendentes' && concluidas.length) {
    const grupos = {
      hoje:     concluidas.filter(t => _classifyConcluida(t) === 'hoje'),
      '7dias':  concluidas.filter(t => _classifyConcluida(t) === '7dias'),
      '15dias': concluidas.filter(t => _classifyConcluida(t) === '15dias'),
      '30dias': concluidas.filter(t => _classifyConcluida(t) === '30dias'),
      resto:    concluidas.filter(t => _classifyConcluida(t) === 'resto'),
    };

    // Cabeçalho do bloco Histórico (separador visual, sem toggle próprio)
    html += `
      <div class="tf-group-header" style="margin-top: ${_filtroAtual === 'todas' && pendentes.length ? '12px' : '0'};">
        <span>Histórico de Tarefas</span>
        <span class="tf-group-count">${concluidas.length}</span>
      </div>
    `;

    html += _htmlSection('conc-hoje',   'Hoje',             grupos.hoje,     'conc-desc');
    html += _htmlSection('conc-7dias',  'Últimos 7 Dias',   grupos['7dias'], 'conc-desc');
    html += _htmlSection('conc-15dias', 'Últimos 15 Dias',  grupos['15dias'],'conc-desc');
    html += _htmlSection('conc-30dias', 'Últimos 30 Dias',  grupos['30dias'],'conc-desc');
    html += _htmlSection('conc-resto',  'Anteriores',       grupos.resto,    'conc-desc');
  }

  return `<div class="tf-list">${html}</div>`;
}

function _htmlSkeleton() {
  return `
    <div class="tf-kpi-grid">
      ${Array(4).fill('<div class="tf-kpi-card tf-skeleton" style="min-height:90px"></div>').join('')}
    </div>
    <div class="tf-toolbar tf-skeleton" style="height:44px;border-radius:12px"></div>
    <div class="tf-list">
      ${Array(5).fill('<div class="tf-skeleton" style="height:72px;border-radius:14px;margin-bottom:10px"></div>').join('')}
    </div>
  `;
}

// ─── Re-render parcial da lista ────────────────────────────────────

function _atualizarLista() {
  const el = document.getElementById('tf-list-area');
  if (el) el.innerHTML = _htmlLista();
}

function _atualizarKpis() {
  const el = document.getElementById('tf-kpi-area');
  if (el) el.innerHTML = _htmlKpis();
}

// ─── Eventos ───────────────────────────────────────────────────────

function _bindEvents() {
  // Filtros de status
  document.querySelectorAll('.tf-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      _filtroAtual = btn.dataset.filter;
      document.querySelectorAll('.tf-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _atualizarLista();
    });
  });

  // Admin filters
  const membroSelect = document.getElementById('tf-membro-filter');
  if (membroSelect) {
    membroSelect.addEventListener('change', e => {
      _membroAtual = e.target.value;
      _atualizarLista();
    });
  }

  const dataInput = document.getElementById('tf-data-filter');
  if (dataInput) {
    dataInput.addEventListener('change', e => {
      _dataAtual = e.target.value;
      _atualizarLista();
    });
  }

  // Pesquisa
  const searchEl = document.getElementById('tf-search');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      _busca = e.target.value.trim();
      _atualizarLista();
    });
  }

  // Toggle check + timing (delegação)
  document.getElementById('tf-list-area')?.addEventListener('click', async e => {
    // Toggle genérico para todas as seções colapsáveis via atributo data-section-id
    const toggleEl = e.target.closest('.tf-section-toggle');
    if (toggleEl) {
      const id = toggleEl.dataset.sectionId;
      if (id) {
        const group   = document.getElementById(`tf-group-${id}`);
        const content = group?.querySelector('.tf-group-content');
        const chevron = group?.querySelector('.tf-chevron-icon');
        if (group && content && chevron) {
          _sectionExpanded[id] = !(_sectionExpanded[id] ?? false);
          const open = _sectionExpanded[id];
          content.style.display = open ? 'block' : 'none';
          chevron.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
        }
      }
      return;
    }

    // Botão Iniciar → grava data_inicio
    const btnIniciar = e.target.closest('.tf-btn-iniciar');
    if (btnIniciar) {
      const id  = Number(btnIniciar.dataset.tarefaId);
      const idx = _tarefas.findIndex(t => t.tarefa_id === id);
      const agora = new Date().toISOString();
      if (idx !== -1) _tarefas[idx] = { ..._tarefas[idx], data_inicio: agora };
      _atualizarLista();
      _iniciarTicker();
      await Tarefas.iniciar(id);
      return;
    }

    // Botão Finalizar → concluir com data_conclusao
    const btnFinalizar = e.target.closest('.tf-btn-finalizar');
    if (btnFinalizar) {
      const id  = Number(btnFinalizar.dataset.tarefaId);
      const idx = _tarefas.findIndex(t => t.tarefa_id === id);
      if (idx !== -1) {
        const t = _tarefas[idx];
        const agora = new Date().toISOString();
        const acumulado = Number(t.tempo_acumulado_ms) || 0;
        let novoTempo = acumulado;
        if (t.data_inicio) {
          novoTempo += new Date() - new Date(t.data_inicio);
        }
        _tarefas[idx] = { 
          ...t, 
          tarefa_status: true, 
          data_conclusao: agora,
          data_inicio: null,
          tempo_acumulado_ms: novoTempo
        };
        _atualizarKpis();
        _atualizarLista();
        await Tarefas.concluir(id, novoTempo);
      }
      return;
    }

    // Botão Pausar → pausa o cronômetro
    const btnPausar = e.target.closest('.tf-btn-pausar');
    if (btnPausar) {
      const id  = Number(btnPausar.dataset.tarefaId);
      const idx = _tarefas.findIndex(t => t.tarefa_id === id);
      if (idx !== -1) {
        const t = _tarefas[idx];
        if (t.data_inicio) {
          const acumulado = Number(t.tempo_acumulado_ms) || 0;
          const novoTempo = acumulado + (new Date() - new Date(t.data_inicio));
          
          _tarefas[idx] = {
            ...t,
            data_inicio: null,
            tempo_acumulado_ms: novoTempo
          };
          _atualizarLista();
          await Tarefas.pausar(id, novoTempo);
        }
      }
      return;
    }

    // Botão "Ver negócio" → abre o painel lateral
    const btnNegocio = e.target.closest('.tf-btn-negocio');
    if (btnNegocio) {
      const negocioId = Number(btnNegocio.dataset.negocioId);
      if (negocioId) _negocioPanel.open(negocioId);
      return;
    }

    // Botão Excluir → remove da lista e do banco
    const btnExcluir = e.target.closest('.tf-btn-excluir');
    if (btnExcluir) {
      const id  = Number(btnExcluir.dataset.tarefaId);
      const idx = _tarefas.findIndex(t => t.tarefa_id === id);
      if (idx === -1) return;

      // Feedback visual imediato: marca o item como "removendo"
      const itemEl = document.querySelector(`.tf-item[data-id="${id}"]`);
      if (itemEl) {
        itemEl.style.transition = 'opacity 0.2s, transform 0.2s';
        itemEl.style.opacity    = '0.4';
        itemEl.style.transform  = 'translateX(8px)';
        itemEl.style.pointerEvents = 'none';
      }

      // Remove do cache local e atualiza UI
      const [removida] = _tarefas.splice(idx, 1);
      setTimeout(() => {
        _atualizarKpis();
        _atualizarLista();
      }, 180); // espera a animação

      // Persiste no Supabase
      const { error } = await Tarefas.excluir(id);
      if (error) {
        console.error('[Tarefas] Erro ao excluir:', error);
        // Reverte: reinsere a tarefa na posição original
        _tarefas.splice(idx, 0, removida);
        _atualizarKpis();
        _atualizarLista();
      }
      return;
    }

    // Checkbox de concluir / reabrir
    const btn = e.target.closest('.tf-check');
    if (!btn) return;

    const id      = Number(btn.dataset.tarefaId);
    const atual   = btn.dataset.status === 'true';
    const nova    = !atual;

    // Atualiza UI otimistamente
    const idx = _tarefas.findIndex(t => t.tarefa_id === id);
    let novoTempoConcluir = 0;

    if (idx !== -1) {
      const t = _tarefas[idx];
      if (nova) {
        // Concluindo
        const acumulado = Number(t.tempo_acumulado_ms) || 0;
        novoTempoConcluir = acumulado;
        if (t.data_inicio) {
          novoTempoConcluir += new Date() - new Date(t.data_inicio);
        }
        _tarefas[idx] = {
          ...t,
          tarefa_status: true,
          data_inicio: null,
          data_conclusao: new Date().toISOString(),
          tempo_acumulado_ms: novoTempoConcluir
        };
      } else {
        // Reabrindo
        _tarefas[idx] = {
          ...t,
          tarefa_status: false,
          data_inicio: null,
          data_conclusao: null,
          // mantém tempo_acumulado_ms para que não perca o trabalho já feito
        };
      }
    }

    _atualizarKpis();
    _atualizarLista();

    // Persiste no Supabase
    const { error } = nova
      ? await Tarefas.concluir(id, novoTempoConcluir)
      : await Tarefas.reabrir(id);

    if (error) {
      console.error('[Tarefas] Erro ao atualizar status:', error);
      if (idx !== -1) _tarefas[idx] = { ..._tarefas[idx], tarefa_status: atual };
      _atualizarKpis();
      _atualizarLista();
    }
  });

  // ─ Edição de Prioridade ─
  document.getElementById('tf-list-area')?.addEventListener('click', async e => {
    // Clique no badge de prioridade → abre/fecha dropdown
    const badgeEl = e.target.closest('.tf-prior-badge');
    if (badgeEl) {
      e.stopPropagation();
      const tarefaId = badgeEl.dataset.tarefaId;
      const dropdown = document.querySelector(`.tf-prior-dropdown[data-tarefa-id="${tarefaId}"]`);
      // Fecha outros dropdowns abertos
      document.querySelectorAll('.tf-prior-dropdown.open').forEach(d => {
        if (d !== dropdown) {
          d.classList.remove('open');
          const pItem = d.closest('.tf-item');
          if (pItem) pItem.style.zIndex = '';
        }
      });
      const isOpen = dropdown?.classList.toggle('open');
      const itemEl = dropdown?.closest('.tf-item');
      if (itemEl) {
        itemEl.style.zIndex = isOpen ? '999' : '';
        itemEl.style.position = isOpen ? 'relative' : '';
      }
      return;
    }

    // Clique em uma opção de prioridade
    const optEl = e.target.closest('.tf-prior-opt');
    if (optEl) {
      e.stopPropagation();
      const novaPrioridade = optEl.dataset.prior;
      const tarefaId = Number(optEl.dataset.tarefaId);
      const idx = _tarefas.findIndex(t => t.tarefa_id === tarefaId);
      if (idx !== -1) {
        _tarefas[idx] = { ..._tarefas[idx], tarefa_prioridade: novaPrioridade };
        _atualizarLista();
        await Tarefas.atualizarPrioridade(tarefaId, novaPrioridade);
      }
      return;
    }
  }, true); // capture phase para garantir ordem

  // Fecha dropdowns ao clicar fora
  document.addEventListener('click', () => {
    document.querySelectorAll('.tf-prior-dropdown.open').forEach(d => {
      d.classList.remove('open');
      const itemEl = d.closest('.tf-item');
      if (itemEl) itemEl.style.zIndex = '';
    });
  });

  // ─ Edição inline do Título ─
  document.getElementById('tf-list-area')?.addEventListener('click', e => {
    const tituloEl = e.target.closest('.tf-titulo-editavel');
    if (!tituloEl) return;
    if (tituloEl.querySelector('input')) return; // já está editando

    const tarefaId = Number(tituloEl.dataset.tarefaId);
    const tituloAtual = tituloEl.textContent.trim();

    const input = document.createElement('input');
    input.type = 'text';
    input.value = tituloAtual;
    input.className = 'tf-titulo-input';

    tituloEl.textContent = '';
    tituloEl.appendChild(input);
    input.focus();
    input.select();

    const salvar = async () => {
      const novoTitulo = input.value.trim();
      if (!novoTitulo || novoTitulo === tituloAtual) {
        tituloEl.textContent = tituloAtual;
        return;
      }
      const idx = _tarefas.findIndex(t => t.tarefa_id === tarefaId);
      if (idx !== -1) {
        _tarefas[idx] = { ..._tarefas[idx], tarefa_titulo: novoTitulo };
        tituloEl.textContent = novoTitulo;
        await Tarefas.atualizarTitulo(tarefaId, novoTitulo);
      }
    };

    input.addEventListener('keydown', async e => {
      if (e.key === 'Enter') { e.preventDefault(); await salvar(); }
      if (e.key === 'Escape') { tituloEl.textContent = tituloAtual; }
    });
    input.addEventListener('blur', salvar);
  });
}

function _bindEventsList() {
  // Listeners adicionados por delegação em _bindEvents
}

// Ticker ao vivo — atualiza timers das tarefas em andamento a cada segundo
let _tickerInterval = null;
function _iniciarTicker() {
  if (_tickerInterval) return; // já rodando
  _tickerInterval = setInterval(() => {
    const emAndamento = _tarefas.filter(t => !t.tarefa_status && t.data_inicio);
    if (!emAndamento.length) {
      clearInterval(_tickerInterval);
      _tickerInterval = null;
      return;
    }
    emAndamento.forEach(t => {
      const el = document.getElementById(`tf-timer-${t.tarefa_id}`);
      if (el) {
        const acumulado = Number(t.tempo_acumulado_ms) || 0;
        const ms = acumulado + (new Date() - new Date(t.data_inicio));
        el.textContent = _formatarTempo(ms);
      }
    });
  }, 1000);
}

// ─── Calendário de multi-seleção de datas ─────────────────────────

let _datasRepetir = [];   // datas selecionadas no calendário (array de 'YYYY-MM-DD')
let _calMesAtual  = (() => { const d = new Date(); d.setDate(1); return d; })();

function _atualizarContadorDatas() {
  const el = document.getElementById('tf-cal-contador');
  if (!el) return;
  const n = _datasRepetir.length;
  if (n === 0) {
    el.textContent = 'Nenhuma data selecionada';
    el.style.color = 'var(--text-muted)';
  } else {
    el.textContent = `${n} data${n > 1 ? 's' : ''} selecionada${n > 1 ? 's' : ''} — ${n} tarefa${n > 1 ? 's' : ''} serão criadas`;
    el.style.color = '#3B82F6';
  }
  // Remove erro visual do grid se tiver datas
  if (n > 0) {
    const calGrid = document.getElementById('tf-cal-grid');
    if (calGrid) calGrid.style.outline = 'none';
  }
}

function _renderCalendario() {
  const tituloEl = document.getElementById('tf-cal-titulo');
  const gridEl   = document.getElementById('tf-cal-grid');
  if (!tituloEl || !gridEl) return;

  const ano  = _calMesAtual.getFullYear();
  const mes  = _calMesAtual.getMonth(); // 0-based
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  tituloEl.textContent = `${meses[mes]} ${ano}`;

  const primeiroDia    = new Date(ano, mes, 1).getDay(); // 0=Dom
  const diasNoMes      = new Date(ano, mes + 1, 0).getDate();
  const hoje           = new Date();
  const dHoje          = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  let html = '';

  // Células vazias antes do dia 1
  for (let i = 0; i < primeiroDia; i++) {
    html += `<div class="tf-cal-day tf-cal-day--empty"></div>`;
  }

  for (let d = 1; d <= diasNoMes; d++) {
    const data  = new Date(ano, mes, d);
    const iso   = `${ano}-${String(mes + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const past  = data < dHoje;
    const isHoje = data.getTime() === dHoje.getTime();
    const sel   = _datasRepetir.includes(iso);

    let cls = 'tf-cal-day';
    if (past)   cls += ' tf-cal-day--past';
    if (isHoje) cls += ' tf-cal-day--hoje';
    if (sel)    cls += ' tf-cal-day--selected';

    html += `<div class="${cls}" data-date="${iso}">${d}</div>`;
  }

  gridEl.innerHTML = html;
  _atualizarContadorDatas();
}

// ─── Modal de Nova Tarefa ───────────────────────────────────────────

function _bindNewTaskModal() {
  const overlay = document.getElementById('tf-modal-overlay');
  const form    = document.getElementById('tf-modal-form');
  const btnOpen = document.getElementById('tf-btn-nova');

  const openModal = () => {
    overlay.style.display = 'flex';
    document.getElementById('tf-inp-titulo')?.focus();
    _renderCalendario(); // garante calendário atualizado ao abrir
  };
  const closeModal = () => {
    overlay.style.display = 'none';
    form?.reset();
    _datasRepetir = [];
    _calMesAtual = new Date();
    _calMesAtual.setDate(1);
    const camposRepeticao = document.getElementById('tf-repeticao-campos');
    if (camposRepeticao) camposRepeticao.style.display = 'none';
    const btn = document.getElementById('tf-modal-submit');
    if (btn) { btn.disabled = false; btn.textContent = '✔ Criar Tarefa'; }
  };

  btnOpen?.addEventListener('click', openModal);
  document.getElementById('tf-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('tf-modal-cancel')?.addEventListener('click', closeModal);

  const checkboxRepetir = document.getElementById('tf-inp-repetir');
  const camposRepeticao = document.getElementById('tf-repeticao-campos');
  checkboxRepetir?.addEventListener('change', e => {
    const mostrar = e.target.checked;
    camposRepeticao.style.display = mostrar ? 'block' : 'none';
    if (mostrar) _renderCalendario();
  });

  // ── Calendário de multi-seleção ────────────────────────────────
  document.getElementById('tf-cal-prev')?.addEventListener('click', () => {
    _calMesAtual.setMonth(_calMesAtual.getMonth() - 1);
    _renderCalendario();
  });
  document.getElementById('tf-cal-next')?.addEventListener('click', () => {
    _calMesAtual.setMonth(_calMesAtual.getMonth() + 1);
    _renderCalendario();
  });
  document.getElementById('tf-cal-grid')?.addEventListener('click', e => {
    const cell = e.target.closest('.tf-cal-day');
    if (!cell || cell.classList.contains('tf-cal-day--empty') || cell.classList.contains('tf-cal-day--past')) return;
    const iso = cell.dataset.date;
    const idx = _datasRepetir.indexOf(iso);
    if (idx === -1) {
      _datasRepetir.push(iso);
      cell.classList.add('tf-cal-day--selected');
    } else {
      _datasRepetir.splice(idx, 1);
      cell.classList.remove('tf-cal-day--selected');
    }
    _atualizarContadorDatas();
  });

  // Fechar ao clicar fora do modal
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // ESC fecha
  document.addEventListener('keydown', function _escClose(e) {
    if (e.key === 'Escape' && overlay.style.display !== 'none') closeModal();
  });

  // Submit
  form?.addEventListener('submit', async e => {
    e.preventDefault();

    const titulo = document.getElementById('tf-inp-titulo')?.value.trim();
    if (!titulo) {
      document.getElementById('tf-inp-titulo')?.focus();
      document.getElementById('tf-inp-titulo')?.style.setProperty('border-color', '#ef4444');
      return;
    }

    const descricao  = document.getElementById('tf-inp-desc')?.value.trim() || null;
    const vencimento = document.getElementById('tf-inp-venc')?.value || null;
    const prioridade = document.getElementById('tf-inp-prioridade')?.value || 'Normal';
    
    let vendedorId = UserStore.getUserId();
    if (UserStore.isAdmin()) {
      const selectResp = document.getElementById('tf-inp-responsavel');
      if (selectResp && selectResp.value) {
        vendedorId = selectResp.value;
      } else if (selectResp) {
        selectResp.focus();
        selectResp.style.setProperty('border-color', '#ef4444');
        return;
      }
    }

    const repetir = document.getElementById('tf-inp-repetir')?.checked || false;
    const submitBtn = document.getElementById('tf-modal-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando…'; }

    let resData, resError;

    if (repetir) {
      // Valida se há datas selecionadas no calendário
      if (!_datasRepetir.length) {
        const calGrid = document.getElementById('tf-cal-grid');
        if (calGrid) {
          calGrid.style.outline = '1.5px solid #ef4444';
          calGrid.style.borderRadius = '10px';
        }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '\u2714 Criar Tarefa'; }
        return;
      }

      // Cria uma tarefa para cada data selecionada no calendário
      const payloads = _datasRepetir.map(iso => ({
        tarefa_titulo:     titulo,
        tarefa_descricao:  descricao,
        tarefa_vencimento: new Date(iso + 'T12:00:00').toISOString(),
        tarefa_status:     false,
        vendedor_id:       vendedorId,
        tarefa_prioridade: prioridade,
        negocio_id:        null,
      }));

      const { data, error } = await Tarefas.createBulk(payloads);
      resData = data;
      resError = error;
    } else {
      const payload = {
        tarefa_titulo:     titulo,
        tarefa_descricao:  descricao,
        tarefa_vencimento: vencimento ? new Date(vencimento).toISOString() : null,
        tarefa_status:     false,
        vendedor_id:       vendedorId,
        tarefa_prioridade: prioridade,
        negocio_id:        null,
      };

      const { data, error } = await Tarefas.create(payload);
      resData = data ? [data] : [];
      resError = error;
    }

    if (resError) {
      console.error('[Tarefas] Erro ao criar tarefas:', resError);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✔ Criar Tarefa'; }
      return;
    }

    // Adiciona ao cache local e atualiza a UI
    if (resData && resData.length) {
      _tarefas.unshift(...resData);
      _tarefas.sort((a, b) => {
        if (!a.tarefa_vencimento) return 1;
        if (!b.tarefa_vencimento) return -1;
        return new Date(a.tarefa_vencimento) - new Date(b.tarefa_vencimento);
      });
    }
    
    _atualizarKpis();
    _atualizarLista();
    closeModal();
  });
}

// ─── Módulo da página ──────────────────────────────────────────────

export default {
  render() {
    const nome = UserStore.getPrimeiroNome();
    return `
      <style>
        .tf-new-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #06B6D4, #3B82F6);
          color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: opacity .18s, transform .15s; white-space: nowrap;
        }
        .tf-new-btn:hover { opacity: .88; transform: translateY(-1px); }
        .tf-new-btn svg { width: 15px; height: 15px; stroke: #fff; stroke-width: 2.5; fill: none; }

        /* Modal overlay */
        .tf-modal-overlay {
          position: fixed; inset: 0; z-index: 9000;
          background: rgba(0,0,0,.45); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          animation: tf-fade-in .18s ease;
        }
        @keyframes tf-fade-in { from { opacity:0 } to { opacity:1 } }
        .tf-modal {
          background: var(--card-bg, #fff); border-radius: 18px;
          box-shadow: 0 24px 60px rgba(0,0,0,.22);
          width: 100%; max-width: 480px; padding: 28px 28px 24px;
          animation: tf-slide-up .22s ease;
          max-height: 90vh; overflow-y: auto;
        }
        @keyframes tf-slide-up { from { transform: translateY(20px); opacity:0 } to { transform: translateY(0); opacity:1 } }
        .tf-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .tf-modal-title {
          font-size: 16px; font-weight: 800; color: var(--text-primary, #111);
        }
        .tf-modal-close {
          width: 30px; height: 30px; border-radius: 8px; border: none;
          background: var(--bg, #f3f4f6); cursor: pointer; display: flex;
          align-items: center; justify-content: center; color: var(--text-muted);
          transition: background .15s;
        }
        .tf-modal-close:hover { background: #fee2e2; color: #dc2626; }
        .tf-modal-close svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2.5; fill: none; }
        .tf-modal-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .tf-modal-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: var(--text-muted);
        }
        .tf-modal-input, .tf-modal-textarea {
          width: 100%; border: 1.5px solid var(--border-light, #e5e7eb);
          border-radius: 9px; padding: 9px 12px; font-size: 13px;
          font-family: inherit; color: var(--text-primary, #111);
          background: var(--bg, #f9fafb); transition: border-color .15s;
          box-sizing: border-box;
        }
        .tf-modal-input:focus, .tf-modal-textarea:focus {
          outline: none; border-color: #3B82F6;
        }
        .tf-modal-textarea { min-height: 80px; resize: vertical; }
        .tf-modal-footer {
          display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;
        }
        .tf-modal-cancel {
          padding: 9px 18px; border-radius: 9px; border: 1.5px solid var(--border-light);
          background: transparent; font-size: 13px; font-weight: 600;
          cursor: pointer; color: var(--text-muted); font-family: inherit;
          transition: background .15s;
        }
        .tf-modal-cancel:hover { background: var(--bg); }
        .tf-modal-submit {
          padding: 9px 20px; border-radius: 9px; border: none;
          background: linear-gradient(135deg, #06B6D4, #3B82F6);
          color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: opacity .15s;
        }
        .tf-modal-submit:disabled { opacity: .6; cursor: not-allowed; }
        .tf-modal-submit:not(:disabled):hover { opacity: .88; }

        /* ── Timing buttons ── */
        .tf-item-actions {
          display: flex; flex-direction: column; align-items: flex-end;
          gap: 6px; flex-shrink: 0; margin-left: auto; padding-left: 12px;
        }
        .tf-btn-timing {
          display: inline-flex; align-items: center; gap: 6px;
          border: none; border-radius: 8px; padding: 6px 12px;
          font-size: 12px; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: opacity .15s, transform .12s;
          white-space: nowrap;
        }
        .tf-btn-timing svg {
          width: 12px; height: 12px; fill: currentColor; stroke: none;
        }
        .tf-btn-timing:hover { opacity: .85; transform: translateY(-1px); }
        .tf-btn-iniciar {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
        }
        .tf-btn-finalizar {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #fff;
        }
        .tf-btn-pausar {
          background: linear-gradient(135deg, #64748b, #475569);
          color: #fff;
        }
        /* Timing display */
        .tf-timing {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11.5px; font-weight: 500; margin-top: 4px;
          padding: 3px 8px; border-radius: 6px;
        }
        .tf-timing svg {
          width: 12px; height: 12px; stroke: currentColor;
          stroke-width: 2; fill: none; flex-shrink: 0;
        }
        .tf-timing--running {
          background: rgba(245,158,11,.12); color: #d97706;
        }
        .tf-timing--done {
          background: rgba(16,185,129,.1); color: #059669;
        }
        .tf-timing--paused {
          background: rgba(100,116,139,.12); color: #475569;
        }
        .tf-timing-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #f59e0b; flex-shrink: 0;
          animation: tf-pulse 1.2s ease-in-out infinite;
        }
        @keyframes tf-pulse {
          0%,100% { opacity:1; transform: scale(1); }
          50%      { opacity:.4; transform: scale(.7); }
        }
        .tf-item--running {
          border-left: 3px solid #f59e0b !important;
        }
        [data-theme="dark"] .tf-timing--running {
          background: rgba(245,158,11,.15); color: #fbbf24;
        }
        [data-theme="dark"] .tf-timing--done {
          background: rgba(16,185,129,.15); color: #34d399;
        }
        [data-theme="dark"] .tf-timing--paused {
          background: rgba(100,116,139,.15); color: #94a3b8;
        }

        /* ─ Prioridade ─ */
        .tf-prior-wrap {
          position: relative; display: inline-flex; align-items: center;
        }
        .tf-prior-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px 3px 6px; border-radius: 20px;
          font-size: 11px; font-weight: 700; cursor: pointer;
          border: 1.5px solid transparent; transition: opacity .15s, transform .1s;
          white-space: nowrap; user-select: none;
        }
        .tf-prior-badge:hover { opacity: .85; transform: scale(1.04); }
        .tf-prior-badge svg { width: 11px; height: 11px; stroke: currentColor; stroke-width: 2.5; fill: none; flex-shrink: 0; }
        .tf-prior-caret { margin-left: 2px; transition: transform .15s; }
        .tf-prior--urgente { background: rgba(239,68,68,.12); color: #dc2626; border-color: rgba(239,68,68,.3); }
        .tf-prior--alta    { background: rgba(245,158,11,.12); color: #d97706; border-color: rgba(245,158,11,.3); }
        .tf-prior--normal  { background: rgba(59,130,246,.10); color: #3B82F6; border-color: rgba(59,130,246,.25); }
        .tf-prior--baixa   { background: rgba(100,116,139,.1); color: #64748b; border-color: rgba(100,116,139,.25); }
        .tf-prior-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 500;
          background: var(--card-bg, #fff); border: 1.5px solid var(--border-light);
          border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.14);
          padding: 6px; display: none; flex-direction: column; gap: 3px; min-width: 120px;
          animation: tf-fade-in .14s ease;
        }
        .tf-prior-dropdown.open { display: flex; }
        .tf-prior-opt {
          padding: 7px 12px; border-radius: 8px; border: none;
          font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;
          background: transparent; font-family: inherit; color: var(--text-primary);
          transition: background .12s;
        }
        .tf-prior-opt:hover { background: var(--bg, #f3f4f6); }
        .tf-prior-opt.active { background: linear-gradient(135deg, #06B6D4, #3B82F6); color: #fff; }
        [data-theme="dark"] .tf-prior-dropdown {
          background: #1e2433; border-color: #334155;
          box-shadow: 0 8px 24px rgba(0,0,0,.4);
        }
        [data-theme="dark"] .tf-prior-opt:hover { background: #2d3548; }
        [data-theme="dark"] .tf-prior--urgente { background: rgba(239,68,68,.15); color: #f87171; }
        [data-theme="dark"] .tf-prior--alta    { background: rgba(245,158,11,.15); color: #fbbf24; }
        [data-theme="dark"] .tf-prior--normal  { background: rgba(59,130,246,.15); color: #60a5fa; }
        [data-theme="dark"] .tf-prior--baixa   { background: rgba(100,116,139,.15); color: #94a3b8; }

        /* ─ Edição inline de título ─ */
        .tf-titulo-editavel {
          cursor: text; border-radius: 6px; padding: 1px 4px; margin-left: -4px;
          transition: background .15s;
        }
        .tf-titulo-editavel:hover { background: rgba(59,130,246,.08); }
        .tf-titulo-input {
          border: 1.5px solid #3B82F6; border-radius: 7px;
          padding: 2px 8px; font-size: 14px; font-weight: 600;
          font-family: inherit; color: var(--text-primary);
          background: var(--card-bg, #fff); outline: none;
          width: 100%; min-width: 180px; max-width: 340px;
          box-shadow: 0 0 0 3px rgba(59,130,246,.15);
        }
        [data-theme="dark"] .tf-titulo-input {
          background: #141824; color: #f1f5f9; border-color: #3B82F6;
        }


        /* ── Dark mode ── */
        [data-theme="dark"] .tf-modal {
          background: #1e2433;
          box-shadow: 0 24px 60px rgba(0,0,0,.55);
        }
        [data-theme="dark"] .tf-modal-title {
          color: #f1f5f9;
        }
        [data-theme="dark"] .tf-modal-close {
          background: #2d3548;
          color: #94a3b8;
        }
        [data-theme="dark"] .tf-modal-close:hover {
          background: #3d1f1f;
          color: #f87171;
        }
        [data-theme="dark"] .tf-modal-label {
          color: #94a3b8;
        }
        [data-theme="dark"] .tf-modal-input,
        [data-theme="dark"] .tf-modal-textarea {
          background: #141824;
          border-color: #334155;
          color: #f1f5f9;
        }
        [data-theme="dark"] .tf-modal-input:focus,
        [data-theme="dark"] .tf-modal-textarea:focus {
          border-color: #3B82F6;
          background: #1a2035;
        }
        [data-theme="dark"] .tf-modal-input::placeholder,
        [data-theme="dark"] .tf-modal-textarea::placeholder {
          color: #475569;
        }
        [data-theme="dark"] .tf-modal-cancel {
          border-color: #334155;
          color: #94a3b8;
        }
        [data-theme="dark"] .tf-modal-cancel:hover {
          background: #2d3548;
          color: #f1f5f9;
        }

        /* ── Calendário de multi-seleção ── */
        .tf-cal-wrap {
          border: 1px solid var(--border-light); border-radius: 14px;
          padding: 14px; background: var(--bg);
        }
        .tf-cal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px;
        }
        .tf-cal-titulo {
          font-size: 13px; font-weight: 700; color: var(--text-primary);
        }
        .tf-cal-nav {
          width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--border-light);
          background: var(--white); cursor: pointer; display: flex;
          align-items: center; justify-content: center; transition: background .15s;
          flex-shrink: 0;
        }
        .tf-cal-nav svg {
          width: 14px; height: 14px; stroke: var(--text-secondary);
          stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round;
        }
        .tf-cal-nav:hover { background: var(--black); }
        .tf-cal-nav:hover svg { stroke: var(--white); }
        .tf-cal-weekdays {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 2px; margin-bottom: 4px;
        }
        .tf-cal-weekdays span {
          text-align: center; font-size: 10px; font-weight: 700;
          color: var(--text-muted); text-transform: uppercase; padding: 4px 0;
        }
        .tf-cal-grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 3px;
        }
        .tf-cal-day {
          aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; font-size: 12px; font-weight: 500;
          color: var(--text-primary); cursor: pointer;
          transition: background .12s, color .12s, transform .1s;
          user-select: none;
        }
        .tf-cal-day:hover:not(.tf-cal-day--past):not(.tf-cal-day--empty) {
          background: rgba(59,130,246,.12); color: #2563eb;
          transform: scale(1.08);
        }
        .tf-cal-day--empty { cursor: default; }
        .tf-cal-day--past  { color: var(--text-muted); cursor: not-allowed; opacity: .45; }
        .tf-cal-day--hoje  {
          font-weight: 800; color: #3B82F6;
          outline: 2px solid #3B82F6; outline-offset: -2px; border-radius: 8px;
        }
        .tf-cal-day--selected {
          background: linear-gradient(135deg, #06B6D4, #3B82F6) !important;
          color: #fff !important; font-weight: 700; transform: scale(1.05);
        }
        .tf-cal-contador {
          margin-top: 10px; text-align: center; font-size: 12px;
          font-weight: 600; color: var(--text-muted);
          padding: 6px; border-radius: 8px; background: var(--white);
          border: 1px solid var(--border-light);
        }
        [data-theme="dark"] .tf-cal-wrap { background: #141824; border-color: #334155; }
        [data-theme="dark"] .tf-cal-nav  { background: #2d3548; border-color: #334155; }
        [data-theme="dark"] .tf-cal-nav:hover { background: #3B82F6; }
        [data-theme="dark"] .tf-cal-day  { color: #e2e8f0; }
        [data-theme="dark"] .tf-cal-contador { background: #1e2433; border-color: #334155; }
      </style>

      <div class="page-header">
        <div class="page-title-block">
          <h1>Tarefas</h1>
          <p>Suas atividades e follow-ups, ${nome}</p>
        </div>
        <button class="tf-new-btn" id="tf-btn-nova">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova Tarefa
        </button>
      </div>

      <div id="tf-page-content">
        ${_htmlSkeleton()}
      </div>

      <!-- Modal nova tarefa -->
      <div id="tf-modal-overlay" class="tf-modal-overlay" style="display:none" role="dialog" aria-modal="true">
        <div class="tf-modal" id="tf-modal">
          <div class="tf-modal-header">
            <span class="tf-modal-title">✅ Nova Tarefa</span>
            <button class="tf-modal-close" id="tf-modal-close" title="Fechar">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form id="tf-modal-form" novalidate>
            <div class="tf-modal-field">
              <label class="tf-modal-label" for="tf-inp-titulo">Título <span style="color:#ef4444">*</span></label>
              <input id="tf-inp-titulo" class="tf-modal-input" type="text" placeholder="Ex: Ligar para cliente, Enviar proposta…" required>
            </div>
            <div class="tf-modal-field">
              <label class="tf-modal-label" for="tf-inp-desc">Descrição <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
              <textarea id="tf-inp-desc" class="tf-modal-textarea" placeholder="Detalhes sobre a tarefa…"></textarea>
            </div>
            <div class="tf-modal-field">
              <label class="tf-modal-label" for="tf-inp-venc">Data de Vencimento <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
              <input id="tf-inp-venc" class="tf-modal-input" type="datetime-local">
            </div>


            <!-- Campo de Prioridade -->
            <div class="tf-modal-field">
              <label class="tf-modal-label" for="tf-inp-prioridade">Prioridade</label>
              <select id="tf-inp-prioridade" class="tf-modal-input">
                <option value="Normal" selected>Normal</option>
                <option value="Urgente">Urgente</option>
                <option value="Alta">Alta</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>
            <!-- Checkbox de Repetição -->
            <div class="tf-modal-field" style="flex-direction: row; align-items: center; gap: 8px; margin-bottom: 14px; user-select: none;">
              <input id="tf-inp-repetir" type="checkbox" style="width: 16px; height: 16px; cursor: pointer; margin: 0;">
              <label class="tf-modal-label" for="tf-inp-repetir" style="cursor: pointer; margin-bottom: 0; text-transform: none; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Repetir tarefa?</label>
            </div>

            <!-- Calendário de multi-seleção de datas -->
            <div id="tf-repeticao-campos" style="display: none; margin-bottom: 14px;">
              <div class="tf-cal-wrap">
                <div class="tf-cal-header">
                  <button type="button" id="tf-cal-prev" class="tf-cal-nav" title="Mês anterior">
                    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span id="tf-cal-titulo" class="tf-cal-titulo"></span>
                  <button type="button" id="tf-cal-next" class="tf-cal-nav" title="Próximo mês">
                    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
                <div class="tf-cal-weekdays">
                  ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d =>
                    `<span>${d}</span>`
                  ).join('')}
                </div>
                <div id="tf-cal-grid" class="tf-cal-grid"></div>
                <div id="tf-cal-contador" class="tf-cal-contador">
                  Nenhuma data selecionada
                </div>
              </div>
            </div>
            ${UserStore.isAdmin() ? `
            <div class="tf-modal-field" id="tf-responsavel-field" style="display:none">
              <label class="tf-modal-label" for="tf-inp-responsavel">Responsável <span style="color:#ef4444">*</span></label>
              <select id="tf-inp-responsavel" class="tf-modal-input" required>
                <option value="">Selecione o responsável...</option>
              </select>
            </div>
            ` : ''}
            <div class="tf-modal-footer">
              <button type="button" class="tf-modal-cancel" id="tf-modal-cancel">Cancelar</button>
              <button type="submit" class="tf-modal-submit" id="tf-modal-submit">✔ Criar Tarefa</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async onMount() {
    const isAdmin = UserStore.isAdmin();
    const vendedorId = UserStore.getUserId();
    if (!vendedorId) return;

    let data, error;

    if (isAdmin) {
      const resVends = await Usuarios.getVendedoresAtivos();
      if (resVends.data) {
        _vendedores = resVends.data;
        const select = document.getElementById('tf-inp-responsavel');
        const field = document.getElementById('tf-responsavel-field');
        if (select && field) {
          const vopts = _vendedores.map(v => `<option value="${v.user_id}">${v.user_nome}</option>`).join('');
          select.innerHTML = `
            <option value="">Selecione o responsável...</option>
            ${vopts}
          `;
          field.style.display = 'flex';
        }
      }
      const resTar = await Tarefas.getAllAdmin();
      data = resTar.data;
      error = resTar.error;
    } else {
      const resTar = await Tarefas.getAllPorVendedor(vendedorId);
      data = resTar.data;
      error = resTar.error;
    }

    const container = document.getElementById('tf-page-content');
    if (!container) return;

    if (error) {
      container.innerHTML = `
        <div class="tf-empty">
          <div class="tf-empty-icon tf-empty-icon--error">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3>Erro ao carregar tarefas</h3>
          <p>${error.message}</p>
        </div>
      `;
      return;
    }

    _tarefas = data || [];

    container.innerHTML = `
      <div id="tf-kpi-area">${_htmlKpis()}</div>
      ${_htmlFilters()}
      <div id="tf-list-area">${_htmlLista()}</div>
    `;

    _bindEvents();
    _bindNewTaskModal();
  },

  onDestroy() {
    _tarefas     = [];
    _filtroAtual = 'pendentes';
    _busca       = '';
    _vendedores  = [];
    _membroAtual = '';
    _dataAtual   = '';
    _datasRepetir = [];
    _calMesAtual  = new Date(); _calMesAtual.setDate(1);
    _sectionExpanded = {
      'pend-hoje':    true,
      'pend-3dias':   false,
      'pend-7dias':   false,
      'pend-30dias':  false,
      'conc-hoje':    false,
      'conc-7dias':   false,
      'conc-15dias':  false,
      'conc-30dias':  false,
      'conc-resto':   false,
    };
  },
};

