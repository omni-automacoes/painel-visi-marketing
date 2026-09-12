/**
 * agenda.js — Página de Agenda (Google Calendar por usuário)
 *
 * Cada usuário conecta a própria conta do Google em Configurações → Integrações.
 * Administrador pode alternar e ver a agenda de qualquer usuário.
 * Suporta 3 modos de visualização: mês, semana e 3 dias.
 */

import UserStore                                  from '../js/userStore.js';
import { Usuarios }                               from '../js/db.js';
import { getStatus, listarEventos }               from '../js/googleCalendar.js';
import EventoModal                                from '../components/agenda/EventoModal.js';

// ─── Estado local ──────────────────────────────────────────
let _dataRef           = new Date();
let _modoVisualizacao  = 'mes'; // 'mes' | 'semana' | '3dias'
let _diaSelecionado    = _fmtDia(new Date());
let _eventos           = [];
let _conectado         = false;
let _googleEmail       = null;
let _erro              = null;
let _isAdmin           = false;
let _usuarioAlvo       = null;
let _usuarios          = [];

const _eventoModal = new EventoModal();

const MODOS = [
  { valor: 'mes',    label: 'Mês' },
  { valor: 'semana', label: 'Semana' },
  { valor: '3dias',  label: '3 dias' },
];

export default {
  render() {
    const isAdmin = UserStore.isAdmin();
    return `
      <div class="page-header">
        <div class="page-title-block">
          <h1>Agenda</h1>
          <p>Sua agenda do Google Calendar, direto no CRM</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" id="agenda-btn-novo" style="display:none;">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Evento
          </button>
        </div>
      </div>

      <div class="agenda-toolbar">
        <div class="agenda-nav">
          <button class="agenda-nav-btn" id="agenda-prev" title="Período anterior">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="agenda-month-label" id="agenda-month-label"></span>
          <button class="agenda-nav-btn" id="agenda-next" title="Próximo período">
            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button class="btn btn-ghost" id="agenda-hoje">Hoje</button>
        </div>

        <div class="agenda-toolbar-right">
          <div class="agenda-view-switch" id="agenda-view-switch">
            ${MODOS.map(m => `
              <button class="agenda-view-btn${_modoVisualizacao === m.valor ? ' active' : ''}" data-modo="${m.valor}">${m.label}</button>
            `).join('')}
          </div>
          ${isAdmin ? `
          <div class="agenda-user-select-wrap">
            <select class="agenda-user-select" id="agenda-user-select"></select>
          </div>` : ''}
        </div>
      </div>

      <div id="agenda-content">
        <div class="agenda-loading">Carregando agenda…</div>
      </div>
    `;
  },

  async onMount() {
    _isAdmin     = UserStore.isAdmin();
    _usuarioAlvo = UserStore.getUserId();
    if (!_usuarioAlvo) return;

    document.getElementById('agenda-prev')?.addEventListener('click', () => _mudarPeriodo(-1));
    document.getElementById('agenda-next')?.addEventListener('click', () => _mudarPeriodo(1));
    document.getElementById('agenda-hoje')?.addEventListener('click', _irParaHoje);
    document.getElementById('agenda-btn-novo')?.addEventListener('click', _abrirNovoEvento);

    document.getElementById('agenda-view-switch')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.agenda-view-btn');
      if (!btn || btn.classList.contains('active')) return;
      _modoVisualizacao = btn.dataset.modo;
      document.querySelectorAll('.agenda-view-btn').forEach(b => b.classList.toggle('active', b === btn));
      _carregarEventosERenderizar();
    });

    if (_isAdmin) {
      const { data } = await Usuarios.getVendedoresAtivos();
      _usuarios = data || [];
      const select = document.getElementById('agenda-user-select');
      if (select) {
        select.innerHTML = _usuarios
          .map(u => `<option value="${u.user_id}">${_esc(u.user_nome)}</option>`)
          .join('');
        select.value = _usuarioAlvo;
        select.addEventListener('change', () => {
          _usuarioAlvo = select.value;
          _carregarTudo();
        });
      }
    }

    await _carregarTudo();
  },

  onDestroy() {
    _dataRef          = new Date();
    _modoVisualizacao = 'mes';
    _diaSelecionado   = _fmtDia(new Date());
    _eventos          = [];
    _conectado        = false;
    _googleEmail      = null;
    _erro             = null;
    _usuarioAlvo      = null;
    _usuarios         = [];
  },
};

// ─── Carregamento ──────────────────────────────────────────

async function _carregarTudo() {
  _atualizarLabelPeriodo();

  const status = await getStatus(_usuarioAlvo).catch(() => ({ conectado: false }));
  _conectado   = !!status?.conectado;
  _googleEmail = status?.google_email || null;

  const btnNovo = document.getElementById('agenda-btn-novo');
  if (btnNovo) btnNovo.style.display = _conectado ? 'inline-flex' : 'none';

  if (!_conectado) {
    _renderDesconectado();
    return;
  }

  await _carregarEventosERenderizar();
}

async function _carregarEventosERenderizar() {
  _atualizarLabelPeriodo();

  if (!_conectado) {
    _renderDesconectado();
    return;
  }

  const content = document.getElementById('agenda-content');
  if (content) content.innerHTML = `<div class="agenda-loading">Carregando eventos…</div>`;

  const dias   = _calcularDiasVisiveis();
  const inicio = dias[0];
  const fim    = new Date(dias[dias.length - 1]);
  fim.setHours(23, 59, 59, 999);

  try {
    _eventos = await listarEventos(_usuarioAlvo, inicio.toISOString(), fim.toISOString());
    _erro    = null;
  } catch (err) {
    console.error('[Agenda] Erro ao listar eventos:', err);
    _eventos = [];
    _erro    = 'Não foi possível carregar os eventos do Google Calendar. Tente novamente em instantes.';
  }

  _renderGrid(dias);
}

// ─── Navegação de período ───────────────────────────────────

/** Retorna o array de dias visíveis no modo de visualização atual. */
function _calcularDiasVisiveis() {
  const ref = new Date(_dataRef);

  if (_modoVisualizacao === 'semana') {
    const inicioSemana = new Date(ref);
    inicioSemana.setDate(ref.getDate() - ref.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicioSemana);
      d.setDate(inicioSemana.getDate() + i);
      return d;
    });
  }

  if (_modoVisualizacao === '3dias') {
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(ref);
      d.setDate(ref.getDate() + i);
      return d;
    });
  }

  // mês: grade de 42 dias (6 semanas), começando no domingo da semana do dia 1
  const primeiroDia = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const inicioGrid  = new Date(primeiroDia);
  inicioGrid.setDate(inicioGrid.getDate() - inicioGrid.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicioGrid);
    d.setDate(inicioGrid.getDate() + i);
    return d;
  });
}

function _mudarPeriodo(delta) {
  if (_modoVisualizacao === 'mes') {
    _dataRef = new Date(_dataRef.getFullYear(), _dataRef.getMonth() + delta, 1);
  } else if (_modoVisualizacao === 'semana') {
    const d = new Date(_dataRef);
    d.setDate(d.getDate() + delta * 7);
    _dataRef = d;
  } else {
    const d = new Date(_dataRef);
    d.setDate(d.getDate() + delta * 3);
    _dataRef = d;
  }
  _carregarEventosERenderizar();
}

function _irParaHoje() {
  _dataRef        = new Date();
  _diaSelecionado = _fmtDia(_dataRef);
  _carregarEventosERenderizar();
}

function _atualizarLabelPeriodo() {
  const label = document.getElementById('agenda-month-label');
  if (!label) return;

  if (_modoVisualizacao === 'mes') {
    const nome = _dataRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    label.textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
    return;
  }

  const dias      = _calcularDiasVisiveis();
  const primeiro  = dias[0];
  const ultimo    = dias[dias.length - 1];
  const mesmoMes  = primeiro.getMonth() === ultimo.getMonth();

  if (mesmoMes) {
    const nomeMes = ultimo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    label.textContent = `${primeiro.getDate()} – ${ultimo.getDate()} de ${nomeMes}`;
  } else {
    const fmt = (d) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    label.textContent = `${fmt(primeiro)} – ${fmt(ultimo)} de ${ultimo.getFullYear()}`;
  }
}

// ─── Render: desconectado ──────────────────────────────────

function _renderDesconectado() {
  const content = document.getElementById('agenda-content');
  if (!content) return;

  const ehProprioUsuario = _usuarioAlvo === UserStore.getUserId();

  content.innerHTML = `
    <div class="placeholder-page">
      <div class="placeholder-icon">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <h2>Agenda não conectada</h2>
      <p>${ehProprioUsuario
        ? 'Conecte sua conta do Google em Configurações → Integrações para ver e gerenciar seus eventos aqui.'
        : 'Este usuário ainda não conectou a agenda do Google.'}</p>
      ${ehProprioUsuario ? `<a href="#configuracoes/integracoes" class="btn btn-cyan">Ir para Integrações</a>` : ''}
    </div>
  `;
}

// ─── Render: grid (mês / semana / 3 dias) ──────────────────

function _renderGrid(dias) {
  const content = document.getElementById('agenda-content');
  if (!content) return;

  const isMes   = _modoVisualizacao === 'mes';
  const hojeIso = _fmtDia(new Date());
  const mesRef  = _dataRef.getMonth();

  const eventosPorDia = {};
  _eventos.forEach(ev => {
    const key = _diaDeEvento(ev);
    if (!eventosPorDia[key]) eventosPorDia[key] = [];
    eventosPorDia[key].push(ev);
  });

  const weekdaysMes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const colunasStyle = isMes ? '' : ` style="grid-template-columns: repeat(${dias.length}, 1fr);"`;
  const maxPorDia = isMes ? 3 : 8;

  const weekdaysHTML = isMes
    ? weekdaysMes.map(w => `<div class="agenda-weekday">${w}</div>`).join('')
    : dias.map(d => {
        const nome = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        const iso  = _fmtDia(d);
        return `<div class="agenda-weekday${iso === hojeIso ? ' is-today' : ''}">${nome} <strong>${d.getDate()}</strong></div>`;
      }).join('');

  const diasHTML = dias.map(d => {
    const iso        = _fmtDia(d);
    const isOutside  = isMes && d.getMonth() !== mesRef;
    const isToday    = iso === hojeIso;
    const isSelected = iso === _diaSelecionado;
    const eventosDia = (eventosPorDia[iso] || []).slice().sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    const visiveis   = eventosDia.slice(0, maxPorDia);
    const resto      = eventosDia.length - visiveis.length;
    return `
      <div class="agenda-day-cell${isOutside ? ' is-outside' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}" data-dia="${iso}">
        <span class="agenda-day-number">${d.getDate()}</span>
        <div class="agenda-day-events">
          ${visiveis.map(ev => `<span class="agenda-event-pill" data-evento-id="${ev.id}" title="${_esc(ev.titulo)}">${ev.diaInteiro ? '' : `${_horaLabel(ev.inicio)} `}${_esc(ev.titulo)}</span>`).join('')}
          ${resto > 0 ? `<span class="agenda-event-more">+${resto} mais</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const gridHTML = `
    <div class="agenda-layout">
      <div class="agenda-grid">
        <div class="agenda-grid-weekdays"${colunasStyle}>
          ${weekdaysHTML}
        </div>
        <div class="agenda-grid-days${isMes ? '' : ' agenda-grid-days--linha-unica'}"${colunasStyle}>
          ${diasHTML}
        </div>
      </div>
      <div class="agenda-side-panel">
        ${_renderSidePanel(eventosPorDia)}
      </div>
    </div>
  `;

  const erroHTML = _erro ? `
    <div class="config-feedback config-feedback--error" style="margin-bottom:16px;">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>${_erro}</span>
    </div>` : '';

  content.innerHTML = erroHTML + gridHTML;
  _bindGridEvents();
}

function _renderSidePanel(eventosPorDia) {
  const dia         = _diaSelecionado || _fmtDia(new Date());
  const eventosDia  = (eventosPorDia[dia] || []).slice().sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const dataLabel   = new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dataLabelUp = dataLabel.charAt(0).toUpperCase() + dataLabel.slice(1);

  return `
    <h3 class="agenda-side-title">${dataLabelUp}</h3>
    ${eventosDia.length === 0
      ? `<p class="agenda-side-empty">Nenhum evento neste dia.</p>`
      : eventosDia.map(ev => `
        <div class="agenda-side-event" data-evento-id="${ev.id}">
          <span class="agenda-side-event-hora">${ev.diaInteiro ? 'Dia inteiro' : _horaLabel(ev.inicio)}</span>
          <strong class="agenda-side-event-titulo">${_esc(ev.titulo)}</strong>
          ${ev.local ? `<span class="agenda-side-event-local">${_esc(ev.local)}</span>` : ''}
        </div>
      `).join('')}
  `;
}

function _bindGridEvents() {
  document.querySelectorAll('.agenda-day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      _diaSelecionado = cell.dataset.dia;
      _renderGrid(_calcularDiasVisiveis());
    });
  });

  document.querySelectorAll('[data-evento-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const evento = _eventos.find(ev => String(ev.id) === String(el.dataset.eventoId));
      if (evento) _abrirEditarEvento(evento);
    });
  });
}

// ─── Modal de evento ───────────────────────────────────────

function _abrirNovoEvento() {
  _eventoModal.open({
    modo:    'criar',
    userId:  _usuarioAlvo,
    diaBase: _diaSelecionado || _fmtDia(new Date()),
    onSaved: () => _carregarEventosERenderizar(),
  });
}

function _abrirEditarEvento(evento) {
  _eventoModal.open({
    modo:      'editar',
    evento,
    userId:    _usuarioAlvo,
    onSaved:   () => _carregarEventosERenderizar(),
    onDeleted: () => _carregarEventosERenderizar(),
  });
}

// ─── Helpers ───────────────────────────────────────────────

/** Formata um objeto Date local como "YYYY-MM-DD" (sem passar por UTC). */
function _fmtDia(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Dia (Brasília) a que um evento pertence. `ev.inicio` já vem do n8n como
 * "YYYY-MM-DD" (dia inteiro) ou "YYYY-MM-DDTHH:mm:ss-03:00" — em ambos os
 * casos os 10 primeiros caracteres já são o dia local correto.
 */
function _diaDeEvento(ev) {
  return String(ev.inicio).slice(0, 10);
}

function _horaLabel(iso) {
  const s = String(iso);
  return s.length > 10 ? s.slice(11, 16) : '';
}

function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
