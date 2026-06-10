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

// ─── Helpers de data ───────────────────────────────────────────────

function _isAtrasada(tarefa) {
  if (tarefa.tarefa_status) return false;           // concluída → não está atrasada
  if (!tarefa.tarefa_vencimento) return false;
  return new Date(tarefa.tarefa_vencimento) < new Date();
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
          <span>${_formatarData(t.tarefa_vencimento)}</span>
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
  const pendentes  = filtradas.filter(t => !t.tarefa_status);
  const concluidas = filtradas.filter(t =>  t.tarefa_status);

  let html = '';

  if (pendentes.length && _filtroAtual !== 'concluidas') {
    html += `
      <div class="tf-group">
        <div class="tf-group-header">
          <span>Pendentes</span>
          <span class="tf-group-count">${pendentes.length}</span>
        </div>
        ${pendentes.map(_htmlTarefaItem).join('')}
      </div>
    `;
  }

  if (concluidas.length && _filtroAtual !== 'pendentes') {
    html += `
      <div class="tf-group">
        <div class="tf-group-header">
          <span>Concluídas</span>
          <span class="tf-group-count">${concluidas.length}</span>
        </div>
        ${concluidas.map(_htmlTarefaItem).join('')}
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
    const btn = document.getElementById('tf-modal-submit');
    if (btn) { btn.disabled = false; btn.textContent = '✔ Criar Tarefa'; }
  };

  btnOpen?.addEventListener('click', openModal);
  document.getElementById('tf-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('tf-modal-cancel')?.addEventListener('click', closeModal);

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
    const vendedorId = UserStore.getUserId();

    const submitBtn = document.getElementById('tf-modal-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando…'; }

    const payload = {
      tarefa_titulo:     titulo,
      tarefa_descricao:  descricao,
      tarefa_vencimento: vencimento ? new Date(vencimento).toISOString() : null,
      tarefa_status:     false,
      vendedor_id:       vendedorId,
      negocio_id:        null,
    };

    const { data, error } = await Tarefas.create(payload);

    if (error) {
      console.error('[Tarefas] Erro ao criar tarefa:', error);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✔ Criar Tarefa'; }
      return;
    }

    // Adiciona ao cache local e atualiza a UI
    if (data) _tarefas.unshift(data);
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
      if (resVends.data) _vendedores = resVends.data;
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
  },
};
