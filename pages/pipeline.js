/**
 * pipeline.js — Página "Funil" (Kanban / Lista)
 * Exporta: { render(), onMount(), onDestroy() }
 */
import KanbanBoard  from '../components/kanban/KanbanBoard.js';
import ListView     from '../components/kanban/ListView.js';
import NewOppModal  from '../components/kanban/NewOppModal.js';
import NegocioPanel from '../components/kanban/NegocioPanel.js';
import { Pipelines, Usuarios, Negocios } from '../js/db.js';
import UserStore    from '../js/userStore.js';
import { rotuloFiltro, calcularContagens, hojeKey } from '../components/kanban/recontato.js';

// ── Estado ────────────────────────────────────────────────────
let _funis           = [];
let _funilAtivo      = null;
let _board           = null;
let _listView        = null;
let _viewMode        = sessionStorage.getItem('pipeline_view') || 'kanban';
let _statusFilter    = 'Aberto';
let _vendedorFilter  = null;
let _origemFilter    = null;
let _recontadoFilter = null;   // null | { tipo, de?, ate? } (ver recontato.js)
let _calMes          = null;   // { y, m } mês exibido no calendário de recontato
let _calStaged       = null;   // seleção do calendário ainda não aplicada
let _calAnchor       = false;  // true = 1º dia escolhido, aguardando o 2º (intervalo)
let _vendedores      = [];
let _origensDisp     = [];
let _searchQuery     = '';
let _searchDebounce  = null;
let _filterBarOpen   = false;
let _openPillId      = null;
let _negocioPanel    = new NegocioPanel(); // pill dropdown aberto

// ── Seletor de Funil ──────────────────────────────────────────

function _htmlFunilSelector() {
  if (!_funis.length) return `<h1 class="funil-title-loading">Carregando funil…</h1>`;
  const nome    = _funilAtivo?.pipeline_nome ?? '—';
  const options = _funis.map(f => `
    <li class="funil-option${f.pipeline_id === _funilAtivo?.pipeline_id ? ' funil-option--active' : ''}"
        data-pipeline-id="${f.pipeline_id}" role="option">
      <span class="funil-option-name">${f.pipeline_nome}</span>
    </li>`).join('');
  return `
    <div class="funil-selector" id="funil-selector">
      <button class="funil-selector-trigger" id="funil-selector-btn"
              aria-haspopup="listbox" aria-expanded="false">
        <h1 class="funil-title">${nome}</h1>
        <svg class="funil-selector-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <ul class="funil-dropdown" id="funil-dropdown" role="listbox">${options}</ul>
    </div>`;
}

function _renderSelector() {
  const area = document.getElementById('funil-title-area');
  if (area) area.innerHTML = _htmlFunilSelector();
}

function _closeDropdown() {
  const btn = document.getElementById('funil-selector-btn');
  const dd  = document.getElementById('funil-dropdown');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (dd)  dd.classList.remove('funil-dropdown--open');
}

function _bindSelectorEvents() {
  const btn = document.getElementById('funil-selector-btn');
  const dd  = document.getElementById('funil-dropdown');
  if (!btn || !dd) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    _closeAllPills();
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    dd.classList.toggle('funil-dropdown--open', !open);
  });

  dd.querySelectorAll('.funil-option').forEach(li => {
    li.addEventListener('click', async () => {
      const id    = parseInt(li.dataset.pipelineId, 10);
      const funil = _funis.find(f => f.pipeline_id === id);
      if (!funil || funil.pipeline_id === _funilAtivo?.pipeline_id) { _closeDropdown(); return; }
      _funilAtivo = funil;
      sessionStorage.setItem('funil_ativo_id', String(id));
      _renderSelector();
      _bindSelectorEvents();
      // Recarrega origens para o novo funil
      await _loadOrigens();
      _refreshFilterBar();
      await _reloadActiveView(id);
    });
  });
}

// ── Filter Bar (pill-dropdowns) ───────────────────────────────

function _activeFilterCount() {
  let count = 0;
  if (_statusFilter   !== 'Aberto') count++;
  if (_vendedorFilter !== null)      count++;
  if (_origemFilter   !== null)      count++;
  if (_recontadoFilter !== null)     count++;
  return count;
}

function _updateFilterBtn() {
  const btn   = document.getElementById('btn-kanban-filter');
  if (!btn) return;
  const count = _activeFilterCount();
  const badge = btn.querySelector('.filter-count-badge');
  btn.classList.toggle('btn-ghost--filtered', _filterBarOpen || count > 0);
  if (count > 0) {
    if (!badge) btn.insertAdjacentHTML('beforeend', `<span class="filter-count-badge">${count}</span>`);
    else        badge.textContent = count;
  } else {
    badge?.remove();
  }
}

function _pillLabel(id) {
  switch (id) {
    case 'status':
      return _statusFilter !== 'Aberto' ? _statusFilter : null;
    case 'responsavel': {
      if (_vendedorFilter === null) return null;
      const v = _vendedores.find(u => u.user_id === _vendedorFilter);
      return v ? v.user_nome.split(' ')[0] : null;
    }
    case 'origem':
      return _origemFilter;
    case 'recontado':
      return rotuloFiltro(_recontadoFilter);
  }
  return null;
}

function _pillHTML(id, label) {
  const active = _pillLabel(id);
  const isActive = active !== null;
  return `
    <div class="fpill${isActive ? ' fpill--active' : ''}" id="fpill-${id}">
      <button class="fpill-btn" data-pill="${id}">
        <span class="fpill-label">${label}</span>
        ${isActive ? `<span class="fpill-value">${active}</span>` : ''}
        <svg class="fpill-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="fpill-dropdown${id === 'recontado' ? ' fpill-dropdown--recontato' : ''}" id="fpd-${id}" style="display:none;"></div>
    </div>`;
}

function _renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const isAdmin = UserStore.isAdmin();

  bar.innerHTML = `
    <div class="filter-bar-inner">
      <div class="filter-pills-row">
        ${_pillHTML('status',      'Status')}
        ${isAdmin ? _pillHTML('responsavel', 'Responsável') : ''}
        ${_pillHTML('origem',      'Origem')}
        ${_pillHTML('recontado',   'Recontato')}
      </div>
      <button class="filter-bar-clear${_activeFilterCount() > 0 ? '' : ' filter-bar-clear--hidden'}" id="btn-filter-clear">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Limpar
      </button>
    </div>`;

  _bindFilterBarEvents();
}

function _refreshFilterBar() {
  // A barra de filtros é sempre visível: re-renderiza para atualizar os rótulos
  _renderFilterBar();
}

// ── Recontato: popover com calendário ────────────────────────

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function _contagensRecontato() {
  return _board?.getRecontadoCounts?.() ?? calcularContagens([]);
}

function _calSelecionado(key) {
  const s = _calStaged;
  if (!s) return '';
  if (s.tipo === 'dia')       return key === s.de ? 'sel' : '';
  if (s.tipo === 'intervalo') {
    if (key === s.de || key === s.ate) return 'sel';
    return key > s.de && key < s.ate ? 'range' : '';
  }
  return '';
}

function _recontatoPopoverHTML() {
  const c     = _contagensRecontato();
  const hoje  = hojeKey();
  const atual = _recontadoFilter;
  const { y, m } = _calMes;

  const opt = (tipo, label, n, cor = '') => `
    <button type="button" class="rc-opt${(atual?.tipo ?? '') === tipo ? ' rc-opt--active' : ''}" data-rc-tipo="${tipo}">
      <span>${label}</span>
      ${n != null ? `<span class="rc-opt-n${cor ? ` rc-opt-n--${cor}` : ''}">${n}</span>` : ''}
    </button>`;

  // Calendário
  const primeiroDow = new Date(Date.UTC(y, m, 1, 12)).getUTCDay();
  const diasNoMes   = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
  const mm = String(m + 1).padStart(2, '0');
  let celulas = '';
  for (let i = 0; i < primeiroDow; i++) celulas += '<span class="rc-day rc-day--vazio"></span>';
  for (let d = 1; d <= diasNoMes; d++) {
    const key  = `${y}-${mm}-${String(d).padStart(2, '0')}`;
    const info = c.porDia[key];
    const sel  = _calSelecionado(key);
    const marks = info
      ? `${info.atras ? `<i class="rc-mark rc-mark--atras">${info.atras}</i>` : ''}${info.pend ? `<i class="rc-mark rc-mark--pend">${info.pend}</i>` : ''}${info.feito ? `<i class="rc-mark rc-mark--feito">${info.feito}</i>` : ''}`
      : '';
    celulas += `
      <button type="button" class="rc-day${key === hoje ? ' rc-day--hoje' : ''}${sel ? ` rc-day--${sel}` : ''}${info ? ' rc-day--tem' : ''}" data-dia="${key}">
        <span class="rc-day-n">${d}</span>
        <span class="rc-day-marks">${marks}</span>
      </button>`;
  }

  return `
    <div class="rc-pop">
      <div class="rc-side">
        <div class="rc-side-title">Recontato agendado</div>
        ${opt('', 'Qualquer data', null)}
        ${opt('hoje', 'Hoje', c.hoje)}
        ${opt('amanha', 'Amanhã', c.amanha)}
        ${opt('semana', 'Esta semana', c.semana)}
        ${opt('mes', 'Este mês', c.mes)}
        ${opt('atrasados', 'Atrasados', c.atrasados, 'red')}
        ${opt('concluidos', 'Concluídos', c.concluidos, 'green')}
      </div>
      <div class="rc-cal">
        <div class="rc-cal-head">
          <span class="rc-cal-title">${MESES_PT[m]} ${y}</span>
          <span class="rc-cal-nav">
            <button type="button" class="rc-nav-btn" data-rc-nav="-1" title="Mês anterior">‹</button>
            <button type="button" class="rc-nav-btn" data-rc-nav="1" title="Próximo mês">›</button>
          </span>
        </div>
        <div class="rc-grid rc-grid--dow">${['D','S','T','Q','Q','S','S'].map(l => `<span>${l}</span>`).join('')}</div>
        <div class="rc-grid">${celulas}</div>
        <div class="rc-cal-foot">
          <span class="rc-legenda">
            <span class="rc-leg"><i class="rc-dot rc-dot--pend"></i>Agendado</span>
            <span class="rc-leg"><i class="rc-dot rc-dot--atras"></i>Atrasado</span>
            <span class="rc-leg"><i class="rc-dot rc-dot--feito"></i>Concluído</span>
          </span>
          <span class="rc-acoes">
            <button type="button" class="rc-btn" data-rc-limpar>Limpar</button>
            <button type="button" class="rc-btn rc-btn--primary" data-rc-aplicar ${_calStaged ? '' : 'disabled'}>Aplicar</button>
          </span>
        </div>
        <div class="rc-dica">Clique em um dia — ou em dois dias para escolher um período.</div>
      </div>
    </div>`;
}

function _renderRecontatoPopover() {
  const dd = document.getElementById('fpd-recontado');
  if (dd && _calMes) dd.innerHTML = _recontatoPopoverHTML();
}

function _initRecontatoPopover(dd) {
  const a = _recontadoFilter;
  _calStaged = (a && (a.tipo === 'dia' || a.tipo === 'intervalo')) ? { ...a } : null;
  _calAnchor = false;
  const ref  = _calStaged?.de ?? hojeKey();
  _calMes    = { y: Number(ref.slice(0, 4)), m: Number(ref.slice(5, 7)) - 1 };

  dd.innerHTML = _recontatoPopoverHTML();
  dd.style.display = '';

  // Em janelas estreitas o popover não pode vazar para fora da tela
  const caber = () => {
    if (dd.style.display === 'none' || !window.innerWidth) return;
    dd.style.left = '';
    const vaza = dd.getBoundingClientRect().right - (window.innerWidth - 12);
    if (vaza > 0) dd.style.left = `${-vaza}px`;
  };
  caber();
  setTimeout(caber, 300);   // a barra de filtros ainda pode estar animando na abertura

  // Um único handler delegado (reatribuído a cada abertura); os re-renders
  // internos não devem fechar o popover.
  dd.onclick = (e) => {
    e.stopPropagation();

    const optBtn = e.target.closest('[data-rc-tipo]');
    if (optBtn) {
      const tipo = optBtn.dataset.rcTipo;
      _applyPillFilter('recontado', tipo ? { tipo } : null);
      return;
    }

    const nav = e.target.closest('[data-rc-nav]');
    if (nav) {
      const delta = Number(nav.dataset.rcNav);
      const d = new Date(Date.UTC(_calMes.y, _calMes.m + delta, 1, 12));
      _calMes = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
      _renderRecontatoPopover();
      return;
    }

    const diaBtn = e.target.closest('[data-dia]');
    if (diaBtn) {
      const key = diaBtn.dataset.dia;
      if (_calAnchor && _calStaged?.tipo === 'dia' && key !== _calStaged.de) {
        const [de, ate] = [_calStaged.de, key].sort();
        _calStaged = { tipo: 'intervalo', de, ate };
        _calAnchor = false;
      } else {
        _calStaged = { tipo: 'dia', de: key };
        _calAnchor = true;
      }
      _renderRecontatoPopover();
      return;
    }

    if (e.target.closest('[data-rc-limpar]')) { _applyPillFilter('recontado', null); return; }
    if (e.target.closest('[data-rc-aplicar]') && _calStaged) { _applyPillFilter('recontado', _calStaged); }
  };
}

function _aplicarPatchRecontato(negocioId, patch) {
  if (!negocioId || !patch) return;
  _board?.patchNegocio(negocioId, patch);
  _listView?.patchNegocio(negocioId, patch);
  if (_openPillId === 'recontado') _renderRecontatoPopover();
}

function _onRecontatoMudou(e) {
  const { negocioId, patch } = e.detail || {};
  _aplicarPatchRecontato(negocioId, patch);
}

async function _marcarRecontatoFeitoRapido(negocioId, btn) {
  if (btn) btn.disabled = true;
  const { error } = await Negocios.marcarRecontatoFeito(negocioId, true);
  if (error) {
    console.error('[Funil] Erro ao marcar recontato como feito:', error);
    if (btn) btn.disabled = false;
    return;
  }
  _aplicarPatchRecontato(negocioId, { recontado_feito_em: new Date().toISOString() });
}

function _openPillDropdown(pillId) {
  if (_openPillId === pillId) { _closeAllPills(); return; }
  _closeAllPills();
  _openPillId = pillId;

  const dd = document.getElementById(`fpd-${pillId}`);
  if (!dd) return;

  if (pillId === 'recontado') { _initRecontatoPopover(dd); return; }

  dd.innerHTML = _pillDropdownHTML(pillId);
  dd.style.display = '';

  // Bind option clicks
  dd.querySelectorAll('.fpill-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.dataset.value || null;
      _applyPillFilter(pillId, val);
    });
  });
}

function _closeAllPills() {
  _openPillId = null;
  document.querySelectorAll('.fpill-dropdown').forEach(d => d.style.setProperty('display', 'none'));
}

function _pillDropdownHTML(pillId) {
  const isAdmin = UserStore.isAdmin();
  let opts = [];

  switch (pillId) {
    case 'status':
      opts = [
        { value: '',        label: 'Todos' },
        { value: 'Aberto',  label: '🟢 Aberto'  },
        { value: 'Perdido', label: '❌ Perdido' },
        { value: 'Ganho',   label: '🏆 Ganho'   },
      ];
      break;
    case 'responsavel':
      if (!isAdmin) return '';
      opts = [
        { value: '', label: '👥 Todos' },
        ..._vendedores.map(v => ({ value: v.user_id, label: v.user_nome })),
      ];
      break;
    case 'origem':
      opts = [
        { value: '', label: 'Todas' },
        ..._origensDisp.map(o => ({ value: o, label: o })),
      ];
      break;
  }

  const currentVal = pillId === 'status'
    ? (_statusFilter === 'Todos' ? '' : _statusFilter)
    : pillId === 'responsavel' ? (_vendedorFilter ?? '')
    : (_origemFilter ?? '');

  return opts.map(o => `
    <button class="fpill-opt${o.value === currentVal ? ' fpill-opt--active' : ''}"
            data-value="${o.value}">${o.label}</button>`).join('');
}

function _applyPillFilter(pillId, value) {
  switch (pillId) {
    case 'status':
      _statusFilter = value || 'Aberto';
      if (_board)    _board.applyStatusFilter(_statusFilter);
      if (_listView) _listView.applyStatusFilter(_statusFilter);
      break;
    case 'responsavel':
      _vendedorFilter = value || null;
      if (_board)    _board.applyVendedorFilter(_vendedorFilter);
      if (_listView) _listView.applyVendedorFilter(_vendedorFilter);
      break;
    case 'origem':
      _origemFilter = value || null;
      if (_board)    _board.applyOrigemFilter(_origemFilter);
      if (_listView) _listView.applyOrigemFilter(_origemFilter);
      break;
    case 'recontado':
      _recontadoFilter = value || null;
      if (_board)    _board.applyRecontadoFilter(_recontadoFilter);
      if (_listView) _listView.applyRecontadoFilter(_recontadoFilter);
      break;
  }
  _closeAllPills();
  _refreshFilterBar();
  _updateFilterBtn();
}

function _resetAllFilters() {
  _statusFilter    = 'Aberto';
  _vendedorFilter  = null;
  _origemFilter    = null;
  _recontadoFilter = null;
  if (_board) {
    _board.applyStatusFilter('Aberto');
    _board.applyVendedorFilter(null);
    _board.applyOrigemFilter(null);
    _board.applyRecontadoFilter(null);
  }
  if (_listView) {
    _listView.applyStatusFilter('Aberto');
    _listView.applyVendedorFilter(null);
    _listView.applyOrigemFilter(null);
    _listView.applyRecontadoFilter(null);
  }
  _refreshFilterBar();
  _updateFilterBtn();
}

function _bindFilterBarEvents() {
  document.querySelectorAll('.fpill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _closeDropdown();
      _openPillDropdown(btn.dataset.pill);
    });
  });

  document.getElementById('btn-filter-clear')?.addEventListener('click', _resetAllFilters);
}

function _toggleFilterBar() {
  _filterBarOpen = !_filterBarOpen;
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  if (_filterBarOpen) {
    _renderFilterBar();
    bar.classList.add('filter-bar--open');
  } else {
    _closeAllPills();
    bar.classList.remove('filter-bar--open');
  }
  _updateFilterBtn();
}

function _closeAll(e) {
  const sel = document.getElementById('funil-selector');
  if (sel && !sel.contains(e.target)) _closeDropdown();

  const bar = document.getElementById('filter-bar');
  if (bar && !bar.contains(e.target) && e.target.id !== 'btn-kanban-filter')
    _closeAllPills();
}

// ── Origens disponíveis ───────────────────────────────────────

async function _loadOrigens() {
  if (!_funilAtivo) return;
  const isAdmin    = UserStore.isAdmin();
  const vendedorId = isAdmin ? null : _vendedorFilter;
  const { data }   = await Negocios.getOrigensDisponiveis(_funilAtivo.pipeline_id, vendedorId);
  if (data) {
    const set = new Set(data.map(r => r.negocio_origem).filter(Boolean));
    _origensDisp = [...set].sort();
  }
}

// ── Troca de view (Kanban ↔ Lista) ───────────────────────────

/** Aplica à lista recém-criada os filtros já ativos no Funil (origem, recontato, busca) */
function _syncListFilters() {
  _listView?.setFilters({ origem: _origemFilter, recontado: _recontadoFilter, search: _searchQuery });
}

async function _switchView(mode) {
  if (_viewMode === mode) return;
  _viewMode = mode;
  sessionStorage.setItem('pipeline_view', mode);

  const kanbanWrap = document.getElementById('kanban-scroll');
  const listWrap   = document.getElementById('pipeline-list-container');
  const btnKanban  = document.getElementById('btn-view-kanban');
  const btnLista   = document.getElementById('btn-view-lista');

  if (mode === 'kanban') {
    listWrap  ?.style.setProperty('display', 'none');
    kanbanWrap?.style.removeProperty('display');
    btnKanban?.classList.add('view-mode-btn--active');
    btnLista ?.classList.remove('view-mode-btn--active');
    if (_board) _board.refresh();
    _listView = null;
  } else {
    kanbanWrap?.style.setProperty('display', 'none');
    listWrap  ?.style.removeProperty('display');
    btnKanban?.classList.remove('view-mode-btn--active');
    btnLista ?.classList.add('view-mode-btn--active');

    _listView = new ListView('pipeline-list-container');
    _syncListFilters();
    const cached = _board?.getData();
    if (cached?.allNegocios?.length || cached?.etapas?.length) {
      _listView.setData(cached);
      _listView.render(_statusFilter, _vendedorFilter);
    } else if (_funilAtivo) {
      await _listView.fetchData(_funilAtivo.pipeline_id);
      _listView.render(_statusFilter, _vendedorFilter);
    }
  }
}

async function _reloadActiveView(pipelineId) {
  if (_viewMode === 'kanban') {
    if (_board) await _board.setFilter(pipelineId);
  } else {
    _listView = new ListView('pipeline-list-container');
    _syncListFilters();
    await _listView.fetchData(pipelineId);
    _listView.render(_statusFilter, _vendedorFilter);
    if (_board) _board.render(pipelineId, _statusFilter, _vendedorFilter);
  }
}

// ── Módulo da Página ──────────────────────────────────────────

export default {
  render() {
    const isKanban = _viewMode === 'kanban';
    return `
      <div class="page-header">
        <div class="page-title-block">
          <div id="funil-title-area"><h1 class="funil-title-loading">Carregando funil…</h1></div>
        </div>
        <div class="header-actions">
          <div class="view-mode-toggle">
            <button class="view-mode-btn${isKanban ? ' view-mode-btn--active' : ''}" id="btn-view-kanban" title="Kanban">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
            <button class="view-mode-btn${!isKanban ? ' view-mode-btn--active' : ''}" id="btn-view-lista" title="Lista">
              <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
          <button class="btn btn-primary" id="btn-new-opp">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Oportunidade
          </button>
        </div>
      </div>

      <!-- Filter Bar (sempre visível) -->
      <div class="filter-bar filter-bar--open" id="filter-bar"></div>

      <!-- Summary Bar -->
      <div class="pipeline-summary">
        <div class="pipeline-stat">
          <div class="pipeline-stat-label" id="kpi-total-label">Total em aberto</div>
          <div class="pipeline-stat-value" id="kpi-total-valor">—</div>
        </div>
        <div class="pipeline-divider"></div>
        <div class="pipeline-stat">
          <div class="pipeline-stat-label">Total Vendido</div>
          <div class="pipeline-stat-value" id="kpi-fechado-valor">—</div>
        </div>
        <div class="pipeline-divider"></div>
        <div class="pipeline-stat">
          <div class="pipeline-stat-label">Negócios</div>
          <div class="pipeline-stat-value">
            <span id="kpi-opp-count">—</span><span> negociações</span>
          </div>
        </div>
        <!-- Busca (extrema direita) -->
        <div class="pipeline-search-wrap" style="margin-left:auto;">
          <div class="pipeline-search" id="pipeline-search-box">
            <svg class="pipeline-search-icon" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input class="pipeline-search-input" id="pipeline-search-input"
                   type="text" placeholder="Buscar por nome ou telefone…" autocomplete="off">
            <button class="pipeline-search-clear" id="pipeline-search-clear" title="Limpar">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Kanban -->
      <div class="kanban-scroll" id="kanban-scroll" ${!isKanban ? 'style="display:none"' : ''}>
        <div class="kanban-board" id="kanban-board"></div>
      </div>

      <!-- Lista -->
      <div id="pipeline-list-container" ${isKanban ? 'style="display:none"' : ''}></div>
    `;
  },

  async onMount() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.add('no-vertical-scroll');
    }

    const isAdmin = UserStore.isAdmin();
    const userId  = UserStore.getUserId();
    if (!isAdmin) _vendedorFilter = userId;
    if (isAdmin) {
      const { data: vends } = await Usuarios.getVendedoresAtivos();
      _vendedores = vends ?? [];
    }

    // Funis
    const { data, error } = await Pipelines.getAtivos();
    if (!error && data?.length) {
      _funis = data;
      const savedId = parseInt(sessionStorage.getItem('funil_ativo_id'), 10);
      _funilAtivo   = _funis.find(f => f.pipeline_id === savedId) ?? _funis[0];
      _renderSelector();
      _bindSelectorEvents();
    }

    // Origens (para filtro)
    await _loadOrigens();

    // Toggle de view
    document.getElementById('btn-view-kanban')?.addEventListener('click', () => _switchView('kanban'));
    document.getElementById('btn-view-lista') ?.addEventListener('click', () => _switchView('lista'));

    // Filter bar sempre visivel
    _renderFilterBar();

    // Busca
    const searchInput = document.getElementById('pipeline-search-input');
    const searchClear = document.getElementById('pipeline-search-clear');
    searchInput?.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => {
        _searchQuery = searchInput.value.trim();
        searchClear?.classList.toggle('pipeline-search-clear--visible', _searchQuery.length > 0);
        if (_board)    _board.applySearch(_searchQuery);
        if (_listView) _listView.applySearch(_searchQuery);
      }, 250);
    });
    searchClear?.addEventListener('click', () => {
      _searchQuery      = '';
      searchInput.value = '';
      searchClear.classList.remove('pipeline-search-clear--visible');
      if (_board)    _board.applySearch('');
      if (_listView) _listView.applySearch('');
      searchInput.focus();
    });

    // Nova Oportunidade
    document.getElementById('btn-new-opp')?.addEventListener('click', () => {
      const modal = new NewOppModal();
      modal.open({
        etapas:     _board?.getData()?.etapas ?? [],
        pipelineId: _funilAtivo?.pipeline_id,
        vendedorId: UserStore.getUserId(),
        onCreated:  async () => {
          if (_funilAtivo) {
            await _board.render(_funilAtivo.pipeline_id, _statusFilter, _vendedorFilter);
            if (_viewMode === 'lista' && _listView) {
              await _listView.fetchData(_funilAtivo.pipeline_id);
              _listView.render(_statusFilter, _vendedorFilter);
            }
            await _loadOrigens();
            _refreshFilterBar();
          }
        },
      });
    });

    document.addEventListener('click', _closeAll);
    window.addEventListener('negocio:recontato', _onRecontatoMudou);

    // Click em card do Kanban → abre painel (ou marca recontato como feito pelo ✓)
    document.getElementById('kanban-board')?.addEventListener('click', (e) => {
      const okBtn = e.target.closest('.opp-recontado-ok');
      if (okBtn) {
        e.stopPropagation();
        _marcarRecontatoFeitoRapido(parseInt(okBtn.dataset.negocioId, 10), okBtn);
        return;
      }
      const card = e.target.closest('.opp-card');
      if (!card) return;
      const id = parseInt(card.id.replace('opp-', ''), 10);
      if (id) {
        window.history.pushState(null, null, `#pipeline/${id}`);
        _negocioPanel.open(id);
      }
    });

    // Click em linha da Lista → abre painel
    document.getElementById('pipeline-list-container')?.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-negocio-id]');
      if (!row) return;
      const id = parseInt(row.dataset.negocioId, 10);
      if (id) {
        window.history.pushState(null, null, `#pipeline/${id}`);
        _negocioPanel.open(id);
      }
    });

    // Board
    _board = new KanbanBoard('kanban-board');
    if (_funilAtivo) {
      if (_viewMode === 'kanban') {
        await _board.render(_funilAtivo.pipeline_id, _statusFilter, _vendedorFilter);
      } else {
        _listView = new ListView('pipeline-list-container');
        _syncListFilters();
        await Promise.all([
          _board.render(_funilAtivo.pipeline_id, _statusFilter, _vendedorFilter),
          _listView.fetchData(_funilAtivo.pipeline_id),
        ]);
        _listView.render(_statusFilter, _vendedorFilter);
      }
    }

    // Verifica se a URL contém um ID para abrir o painel automaticamente
    const hash = window.location.hash.replace('#', '').trim();
    const param = hash.split('/')[1];
    if (param) {
      const negId = parseInt(param, 10);
      if (negId) {
        _negocioPanel.open(negId);
      }
    }
  },

  onDestroy() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('no-vertical-scroll');
    }

    document.removeEventListener('click', _closeAll);
    window.removeEventListener('negocio:recontato', _onRecontatoMudou);
    _calMes          = null;
    _calStaged       = null;
    _calAnchor       = false;
    _funis           = [];
    _funilAtivo      = null;
    _board           = null;
    _listView        = null;
    _statusFilter    = 'Aberto';
    _vendedorFilter  = null;
    _origemFilter    = null;
    _recontadoFilter = null;
    _origensDisp     = [];
    _vendedores      = [];
    _searchQuery     = '';
    _filterBarOpen   = false;
    _openPillId      = null;
    clearTimeout(_searchDebounce);
  },
};
