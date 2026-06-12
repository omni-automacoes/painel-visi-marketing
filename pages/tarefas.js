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
let _tarefas      = [];        // cache completo
let _filtroAtual  = 'todas';   // 'todas' | 'pendentes' | 'concluidas'
let _busca        = '';
let _vendedores   = [];
let _membroAtual  = '';   // '' = todos
let _dataAtual    = '';   // yyyy-mm-dd
let _historicoExpandido = false;
let _recentesExpandido  = false;
let _futurasExpandido   = false;

// ─── Helpers de data ───────────────────────────────────────────────

function _isAtrasada(tarefa) {
  if (tarefa.tarefa_status) return false;           // concluída → não está atrasada
  if (!tarefa.tarefa_vencimento) return false;
  return new Date(tarefa.tarefa_vencimento) < new Date();
}

function _isConcluidaRecente(tarefa) {
  if (!tarefa.tarefa_status || !tarefa.data_conclusao) return false;
  const diff = new Date() - new Date(tarefa.data_conclusao);
  return diff < 8 * 24 * 60 * 60 * 1000; // 8 dias em ms
}

function _obterDivisorDataConclusao(dataIso) {
  if (!dataIso) return 'Sem data';
  const dataConclusao = new Date(dataIso);
  const hoje = new Date();
  const dConclusao = new Date(dataConclusao.getFullYear(), dataConclusao.getMonth(), dataConclusao.getDate());
  const dHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diffTime = dHoje - dConclusao;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays > 1 && diffDays < 8) return `Há ${diffDays} dias`;
  return dConclusao.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
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

function _htmlTarefaItem(t) {
  const concluida  = t.tarefa_status;
  const atrasada   = _isAtrasada(t);
  const descricao  = t.tarefa_descricao?.trim() || '';
  const emAndamento = !concluida && !!t.data_inicio;

  // Tempo decorrido: concluída = data_conclusao - data_inicio | em andamento = agora - data_inicio
  let tempoHTML = '';
  if (t.data_inicio) {
    const fim = t.data_conclusao ? new Date(t.data_conclusao) : new Date();
    const ms  = fim - new Date(t.data_inicio);
    const tempo = _formatarTempo(ms);
    if (concluida) {
      tempoHTML = `
        <div class="tf-timing tf-timing--done">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Tempo: <strong>${tempo}</strong>
        </div>`;
    } else {
      tempoHTML = `
        <div class="tf-timing tf-timing--running">
          <span class="tf-timing-dot"></span>
          Em andamento • <strong id="tf-timer-${t.tarefa_id}">${tempo}</strong>
        </div>`;
    }
  }

  // Botão de timing
  let timingBtn = '';
  if (!concluida) {
    if (!t.data_inicio) {
      timingBtn = `
        <button class="tf-btn-timing tf-btn-iniciar" data-tarefa-id="${t.tarefa_id}" title="Iniciar cronometro">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Iniciar
        </button>`;
    } else {
      timingBtn = `
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
          <span class="tf-item-titulo">${t.tarefa_titulo || 'Sem título'}</span>
          ${_badgeStatus(t)}
        </div>
        ${descricao ? `<p class="tf-item-desc">${descricao}</p>` : ''}
        ${tempoHTML}
        <div class="tf-item-meta">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Vencimento: ${_formatarData(t.tarefa_vencimento)}</span>
          ${t.data_conclusao ? `
            <span class="tf-item-negocio-sep">·</span>
            <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Conclusão: ${_formatarData(t.data_conclusao)}</span>
          ` : ''}
          ${t.usuarios?.user_nome ? `
            <span class="tf-item-negocio-sep">·</span>
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Responsável: <strong>${t.usuarios.user_nome}</strong></span>
          ` : ''}
          ${t.negocio_id ? `
            <span class="tf-item-negocio-sep">·</span>
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
      </div>
    </div>
  `;
}

function _htmlGrupoPorData(tarefas) {
  const ordenadas = [...tarefas].sort((a, b) => new Date(b.data_conclusao) - new Date(a.data_conclusao));
  let html = '';
  let ultimoDivisor = '';
  ordenadas.forEach(t => {
    const divisor = _obterDivisorDataConclusao(t.data_conclusao);
    if (divisor !== ultimoDivisor) {
      ultimoDivisor = divisor;
      html += `
        <div class="tf-date-divider" style="margin: 16px 0 10px 4px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">${divisor}</span>
          <div style="flex: 1; height: 1px; background: var(--border-light, #e5e7eb); opacity: 0.6;"></div>
        </div>
      `;
    }
    html += _htmlTarefaItem(t);
  });
  return html;
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

  // Separar por status
  const limiteFuturo = new Date();
  limiteFuturo.setDate(limiteFuturo.getDate() + 7);

  const pendentes  = filtradas.filter(t => !t.tarefa_status);
  const pendentesPrincipais = pendentes.filter(t => !t.tarefa_vencimento || new Date(t.tarefa_vencimento) < limiteFuturo);
  const pendentesFuturas    = pendentes.filter(t => t.tarefa_vencimento && new Date(t.tarefa_vencimento) >= limiteFuturo);

  const concluidas = filtradas.filter(t =>  t.tarefa_status);
  const concluidasRecentes = concluidas.filter(t => _isConcluidaRecente(t));
  const concluidasAntigas  = concluidas.filter(t => !_isConcluidaRecente(t));

  let html = '';

  if (pendentesPrincipais.length && _filtroAtual !== 'concluidas') {
    html += `
      <div class="tf-group">
        <div class="tf-group-header">
          <span>Pendentes</span>
          <span class="tf-group-count">${pendentesPrincipais.length}</span>
        </div>
        ${pendentesPrincipais.map(_htmlTarefaItem).join('')}
      </div>
    `;
  }

  if (pendentesFuturas.length && _filtroAtual !== 'concluidas') {
    html += `
      <div class="tf-group ${!_futurasExpandido ? 'tf-group--collapsed' : ''}" id="tf-group-futuras">
        <div class="tf-group-header tf-group-header--clickable" id="tf-toggle-futuras" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>Tarefas Planejadas (Futuro)</span>
            <span class="tf-group-count">${pendentesFuturas.length}</span>
          </div>
          <svg class="tf-chevron-icon" style="width: 16px; height: 16px; transition: transform 0.2s; transform: ${_futurasExpandido ? 'rotate(90deg)' : 'rotate(0deg)'};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="tf-group-content" style="display: ${_futurasExpandido ? 'block' : 'none'}; padding-top: 10px;">
          ${pendentesFuturas.map(_htmlTarefaItem).join('')}
        </div>
      </div>
    `;
  }

  if (concluidasRecentes.length && _filtroAtual !== 'pendentes') {
    html += `
      <div class="tf-group ${!_recentesExpandido ? 'tf-group--collapsed' : ''}" id="tf-group-recentes">
        <div class="tf-group-header tf-group-header--clickable" id="tf-toggle-recentes" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>Concluídas Recentemente</span>
            <span class="tf-group-count">${concluidasRecentes.length}</span>
          </div>
          <svg class="tf-chevron-icon" style="width: 16px; height: 16px; transition: transform 0.2s; transform: ${_recentesExpandido ? 'rotate(90deg)' : 'rotate(0deg)'};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="tf-group-content" style="display: ${_recentesExpandido ? 'block' : 'none'}; padding-top: 10px;">
          ${_htmlGrupoPorData(concluidasRecentes)}
        </div>
      </div>
    `;
  }

  if (concluidasAntigas.length && _filtroAtual !== 'pendentes') {
    html += `
      <div class="tf-group ${!_historicoExpandido ? 'tf-group--collapsed' : ''}" id="tf-group-historico">
        <div class="tf-group-header tf-group-header--clickable" id="tf-toggle-historico" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>Histórico de Tarefas</span>
            <span class="tf-group-count">${concluidasAntigas.length}</span>
          </div>
          <svg class="tf-chevron-icon" style="width: 16px; height: 16px; transition: transform 0.2s; transform: ${_historicoExpandido ? 'rotate(90deg)' : 'rotate(0deg)'};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="tf-group-content" style="display: ${_historicoExpandido ? 'block' : 'none'}; padding-top: 10px;">
          ${concluidasAntigas.map(_htmlTarefaItem).join('')}
        </div>
      </div>
    `;
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
    // Clique no cabeçalho do histórico (toggle)
    const btnToggle = e.target.closest('#tf-toggle-historico');
    if (btnToggle) {
      const group = document.getElementById('tf-group-historico');
      const content = group?.querySelector('.tf-group-content');
      const chevron = group?.querySelector('.tf-chevron-icon');
      if (group && content && chevron) {
        _historicoExpandido = !_historicoExpandido;
        if (_historicoExpandido) {
          content.style.display = 'block';
          chevron.style.transform = 'rotate(90deg)';
          group.classList.remove('tf-group--collapsed');
        } else {
          content.style.display = 'none';
          chevron.style.transform = 'rotate(0deg)';
          group.classList.add('tf-group--collapsed');
        }
      }
      return;
    }

    // Clique no cabeçalho do recentes (toggle)
    const btnToggleRecentes = e.target.closest('#tf-toggle-recentes');
    if (btnToggleRecentes) {
      const group = document.getElementById('tf-group-recentes');
      const content = group?.querySelector('.tf-group-content');
      const chevron = group?.querySelector('.tf-chevron-icon');
      if (group && content && chevron) {
        _recentesExpandido = !_recentesExpandido;
        if (_recentesExpandido) {
          content.style.display = 'block';
          chevron.style.transform = 'rotate(90deg)';
          group.classList.remove('tf-group--collapsed');
        } else {
          content.style.display = 'none';
          chevron.style.transform = 'rotate(0deg)';
          group.classList.add('tf-group--collapsed');
        }
      }
      return;
    }

    // Clique no cabeçalho do futuras (toggle)
    const btnToggleFuturas = e.target.closest('#tf-toggle-futuras');
    if (btnToggleFuturas) {
      const group = document.getElementById('tf-group-futuras');
      const content = group?.querySelector('.tf-group-content');
      const chevron = group?.querySelector('.tf-chevron-icon');
      if (group && content && chevron) {
        _futurasExpandido = !_futurasExpandido;
        if (_futurasExpandido) {
          content.style.display = 'block';
          chevron.style.transform = 'rotate(90deg)';
          group.classList.remove('tf-group--collapsed');
        } else {
          content.style.display = 'none';
          chevron.style.transform = 'rotate(0deg)';
          group.classList.add('tf-group--collapsed');
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
      const agora = new Date().toISOString();
      if (idx !== -1) _tarefas[idx] = { ..._tarefas[idx], tarefa_status: true, data_conclusao: agora };
      _atualizarKpis();
      _atualizarLista();
      await Tarefas.concluir(id);
      return;
    }

    // Botão "Ver negócio" → abre o painel lateral
    const btnNegocio = e.target.closest('.tf-btn-negocio');
    if (btnNegocio) {
      const negocioId = Number(btnNegocio.dataset.negocioId);
      if (negocioId) _negocioPanel.open(negocioId);
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
    if (idx !== -1) {
      _tarefas[idx] = {
        ..._tarefas[idx],
        tarefa_status:  nova,
        // Ao reabrir: limpa timers localmente
        data_inicio:    nova ? _tarefas[idx].data_inicio : null,
        data_conclusao: nova ? _tarefas[idx].data_conclusao : null,
      };
    }

    _atualizarKpis();
    _atualizarLista();

    // Persiste no Supabase
    const { error } = nova
      ? await Tarefas.concluir(id)
      : await Tarefas.reabrir(id);

    if (error) {
      console.error('[Tarefas] Erro ao atualizar status:', error);
      if (idx !== -1) _tarefas[idx] = { ..._tarefas[idx], tarefa_status: atual };
      _atualizarKpis();
      _atualizarLista();
    }
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
        const ms = new Date() - new Date(t.data_inicio);
        el.textContent = _formatarTempo(ms);
      }
    });
  }, 1000);
}

// ─── Modal de Nova Tarefa ───────────────────────────────────────────

function _bindNewTaskModal() {
  const overlay = document.getElementById('tf-modal-overlay');
  const form    = document.getElementById('tf-modal-form');
  const btnOpen = document.getElementById('tf-btn-nova');

  const openModal = () => {
    overlay.style.display = 'flex';
    document.getElementById('tf-inp-titulo')?.focus();
  };
  const closeModal = () => {
    overlay.style.display = 'none';
    form?.reset();
    const camposRepeticao = document.getElementById('tf-repeticao-campos');
    if (camposRepeticao) camposRepeticao.style.display = 'none';
    const selectTipoRepeticao = document.getElementById('tf-sel-tipo-repeticao');
    if (selectTipoRepeticao) selectTipoRepeticao.value = 'dias';
    const campoIntervalo = document.getElementById('tf-campo-intervalo');
    if (campoIntervalo) campoIntervalo.style.display = 'block';
    const campoDiasSemana = document.getElementById('tf-campo-dias-semana');
    if (campoDiasSemana) campoDiasSemana.style.display = 'none';
    const containerDias = document.getElementById('tf-container-dias-semana');
    if (containerDias) containerDias.style.outline = 'none';
    const btn = document.getElementById('tf-modal-submit');
    if (btn) { btn.disabled = false; btn.textContent = '✔ Criar Tarefa'; }
  };

  btnOpen?.addEventListener('click', openModal);
  document.getElementById('tf-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('tf-modal-cancel')?.addEventListener('click', closeModal);

  const checkboxRepetir = document.getElementById('tf-inp-repetir');
  const camposRepeticao = document.getElementById('tf-repeticao-campos');
  checkboxRepetir?.addEventListener('change', e => {
    camposRepeticao.style.display = e.target.checked ? 'flex' : 'none';
  });

  const selectTipoRepeticao = document.getElementById('tf-sel-tipo-repeticao');
  const campoIntervalo = document.getElementById('tf-campo-intervalo');
  const campoDiasSemana = document.getElementById('tf-campo-dias-semana');
  selectTipoRepeticao?.addEventListener('change', e => {
    if (e.target.value === 'semana') {
      campoIntervalo.style.display = 'none';
      campoDiasSemana.style.display = 'block';
    } else {
      campoIntervalo.style.display = 'block';
      campoDiasSemana.style.display = 'none';
    }
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
      const tipoRepeticao = document.getElementById('tf-sel-tipo-repeticao')?.value || 'dias';
      const vezes = Math.max(1, Math.min(50, Number(document.getElementById('tf-inp-vezes')?.value) || 1));
      const dataBase = vencimento ? new Date(vencimento) : new Date();
      const payloads = [];

      if (tipoRepeticao === 'semana') {
        const diasSemanaSelecionados = Array.from(document.querySelectorAll('.tf-inp-dia-semana:checked')).map(el => Number(el.value));
        if (diasSemanaSelecionados.length === 0) {
          const containerDias = document.getElementById('tf-container-dias-semana');
          if (containerDias) {
            containerDias.style.outline = '1.5px solid #ef4444';
            containerDias.style.borderRadius = '8px';
            containerDias.style.padding = '4px';
          }
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✔ Criar Tarefa'; }
          return;
        } else {
          const containerDias = document.getElementById('tf-container-dias-semana');
          if (containerDias) containerDias.style.outline = 'none';
        }

        let dataAtual = new Date(dataBase);
        let ocorrenciasGeradas = 0;
        
        while (ocorrenciasGeradas < vezes) {
          const diaSemana = dataAtual.getDay(); // 0 (Dom) a 6 (Sáb)
          if (diasSemanaSelecionados.includes(diaSemana)) {
            const dataVenc = new Date(dataAtual);
            payloads.push({
              tarefa_titulo:     titulo,
              tarefa_descricao:  descricao,
              tarefa_vencimento: dataVenc.toISOString(),
              tarefa_status:     false,
              vendedor_id:       vendedorId,
              negocio_id:        null,
            });
            ocorrenciasGeradas++;
          }
          dataAtual.setDate(dataAtual.getDate() + 1);
        }
      } else {
        const intervalo = Math.max(1, Number(document.getElementById('tf-inp-intervalo')?.value) || 1);
        for (let i = 0; i < vezes; i++) {
          const dataVenc = new Date(dataBase);
          dataVenc.setDate(dataVenc.getDate() + (i * intervalo));
          
          payloads.push({
            tarefa_titulo:     titulo,
            tarefa_descricao:  descricao,
            tarefa_vencimento: dataVenc.toISOString(),
            tarefa_status:     false,
            vendedor_id:       vendedorId,
            negocio_id:        null,
          });
        }
      }

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

            <!-- Checkbox de Repetição -->
            <div class="tf-modal-field" style="flex-direction: row; align-items: center; gap: 8px; margin-bottom: 14px; user-select: none;">
              <input id="tf-inp-repetir" type="checkbox" style="width: 16px; height: 16px; cursor: pointer; margin: 0;">
              <label class="tf-modal-label" for="tf-inp-repetir" style="cursor: pointer; margin-bottom: 0; text-transform: none; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Repetir tarefa?</label>
            </div>

            <!-- Campos de personalização da repetição -->
            <div id="tf-repeticao-campos" style="display: none; flex-direction: column; gap: 14px; margin-bottom: 14px;">
              <div class="tf-modal-field" style="margin-bottom: 0;">
                <label class="tf-modal-label" for="tf-sel-tipo-repeticao">Frequência</label>
                <select id="tf-sel-tipo-repeticao" class="tf-modal-input" style="background: var(--bg); color: var(--text-primary); cursor: pointer;">
                  <option value="dias">Por intervalo (dias)</option>
                  <option value="semana">Dias da semana</option>
                </select>
              </div>

              <!-- Frequência: Por Intervalo de Dias -->
              <div class="tf-modal-field" id="tf-campo-intervalo" style="margin-bottom: 0;">
                <label class="tf-modal-label" for="tf-inp-intervalo">Repetir a cada (dias) <span style="color:#ef4444">*</span></label>
                <input id="tf-inp-intervalo" class="tf-modal-input" type="number" min="1" value="1">
              </div>

              <!-- Frequência: Dias da Semana (escondido por padrão) -->
              <div class="tf-modal-field" id="tf-campo-dias-semana" style="display: none; margin-bottom: 0;">
                <label class="tf-modal-label">Selecione os dias <span style="color:#ef4444">*</span></label>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;" id="tf-container-dias-semana">
                  ${[
                    { label: 'Dom', val: 0 },
                    { label: 'Seg', val: 1 },
                    { label: 'Ter', val: 2 },
                    { label: 'Qua', val: 3 },
                    { label: 'Qui', val: 4 },
                    { label: 'Sex', val: 5 },
                    { label: 'Sáb', val: 6 }
                  ].map(d => `
                    <label style="display: inline-flex; align-items: center; gap: 4px; background: var(--bg); border: 1px solid var(--border-light); padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; user-select: none; color: var(--text-secondary);">
                      <input type="checkbox" class="tf-inp-dia-semana" value="${d.val}" style="margin: 0; cursor: pointer;">
                      ${d.label}
                    </label>
                  `).join('')}
                </div>
              </div>

              <div class="tf-modal-field" style="margin-bottom: 0;">
                <label class="tf-modal-label" for="tf-inp-vezes">Quantidade de vezes <span style="color:#ef4444">*</span></label>
                <input id="tf-inp-vezes" class="tf-modal-input" type="number" min="1" max="50" value="5">
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
    _filtroAtual = 'todas';
    _busca       = '';
    _vendedores  = [];
    _membroAtual = '';
    _dataAtual   = '';
    _historicoExpandido = false;
    _recentesExpandido  = false;
    _futurasExpandido   = false;
  },
};
