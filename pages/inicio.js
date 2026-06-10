/**
 * inicio.js — Página "Início" (Dashboard)
 *
 * Lógica de visualização por cargo (user_cargo):
 *   - 'Comercial'     → renderiza a view Comercial diretamente
 *   - 'Operações'     → renderiza a view Operações diretamente
 *   - 'Administrador' → toggle minimalista no header para alternar
 *
 * Exporta: { render(), onMount(), onDestroy() }
 */
import UserStore     from '../js/userStore.js';
import ViewComercial from './views/inicio-comercial.js';
import ViewOperacoes from './views/inicio-operacoes.js';
import { today, staggerAnimation } from '../js/utils.js';
import { DiaFinalizado } from '../js/db.js';

// Persiste a escolha do admin durante a sessão
let _adminViewAtual = sessionStorage.getItem('admin_view') || 'comercial';

// View atualmente montada
let _viewAtiva = null;

// ─── helpers ────────────────────────────────────────────────────

function _resolverView() {
  const cargo = UserStore.getCargo();
  if (cargo === 'Operações')    return ViewOperacoes;
  if (cargo === 'Administrador') return _adminViewAtual === 'operacoes' ? ViewOperacoes : ViewComercial;
  return ViewComercial; // Comercial + fallback
}

function _montarView() {
  const area = document.getElementById('inicio-view-area');
  if (!area) return;

  if (_viewAtiva?.onDestroy) _viewAtiva.onDestroy();

  _viewAtiva = _resolverView();
  area.innerHTML = _viewAtiva.renderContent();

  if (_viewAtiva.onMount) _viewAtiva.onMount();
}

// ─── HTML do toggle Admin (minimalista, no header) ──────────────

function _htmlToggleAdmin() {
  const isOp = _adminViewAtual === 'operacoes';
  return `
    <label class="view-toggle-wrap" title="Alternar visualização">
      <span class="view-toggle-label ${!isOp ? 'active' : ''}">Comercial</span>
      <div class="view-toggle">
        <input type="checkbox" id="view-toggle-input" ${isOp ? 'checked' : ''} />
        <span class="view-toggle-track"></span>
        <span class="view-toggle-thumb"></span>
      </div>
      <span class="view-toggle-label ${isOp ? 'active' : ''}">Operações</span>
    </label>
  `;
}

function _htmlBadgeCargo() {
  const cargo = UserStore.getCargo() || 'Usuário';
  return `
    <div class="view-role-badge">
      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      ${cargo}
    </div>
  `;
}

function _bindToggle() {
  const input = document.getElementById('view-toggle-input');
  if (!input) return;

  input.addEventListener('change', () => {
    _adminViewAtual = input.checked ? 'operacoes' : 'comercial';
    sessionStorage.setItem('admin_view', _adminViewAtual);

    // Atualiza labels ativo/inativo
    const labels = document.querySelectorAll('.view-toggle-wrap .view-toggle-label');
    if (labels.length === 2) {
      labels[0].classList.toggle('active', !input.checked); // Comercial
      labels[1].classList.toggle('active',  input.checked); // Operações
    }

    _montarView();
  });
}

// ─── Modal Finalizar Dia ─────────────────────────────────────────

async function _abrirModalFinalizarDia() {
  // Evita duplicata
  if (document.getElementById('fd-overlay')) return;

  const userId = UserStore.getUserId();

  // Injeta overlay
  const overlay = document.createElement('div');
  overlay.id = 'fd-overlay';
  overlay.className = 'fd-overlay';
  overlay.innerHTML = `
    <div class="fd-modal" id="fd-modal" role="dialog" aria-modal="true" aria-labelledby="fd-title">
      <div class="fd-header">
        <div class="fd-header-icon">
          <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <div>
          <h2 id="fd-title" class="fd-title">Finalizar Dia</h2>
          <p class="fd-subtitle">Registre o resumo da sua jornada de hoje.</p>
        </div>
        <button class="fd-close" id="fd-close" title="Fechar">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="fd-body">
        <div class="fd-field">
          <label class="fd-label">
            Contatos Realizados Hoje
            <span class="fd-label-hint">Preenchido automaticamente</span>
          </label>
          <div class="fd-input-readonly" id="fd-contatos-auto">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span id="fd-contatos-val">Carregando...</span>
          </div>
        </div>

        <div class="fd-field">
          <label class="fd-label" for="fd-prosp-input">
            Contatos na Prospecção Hoje
            <span class="fd-label-hint">Informe a quantidade</span>
          </label>
          <input
            id="fd-prosp-input"
            class="fd-input"
            type="number"
            min="0"
            placeholder="Ex: 10"
            autocomplete="off"
          />
        </div>
      </div>

      <div class="fd-footer">
        <button class="fd-btn-cancel" id="fd-btn-cancel">Cancelar</button>
        <button class="fd-btn-confirm" id="fd-btn-confirm">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Salvar e Finalizar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Anima entrada
  requestAnimationFrame(() => {
    overlay.classList.add('fd-overlay--open');
    document.getElementById('fd-modal')?.classList.add('fd-modal--open');
  });

  // Busca contatos de hoje automaticamente
  const { count } = await DiaFinalizado.contarContatosHoje(userId);
  const valEl = document.getElementById('fd-contatos-val');
  if (valEl) valEl.textContent = count !== undefined ? `${count} contato${count !== 1 ? 's' : ''}` : '—';

  // Fechar modal
  const fechar = () => {
    overlay.classList.remove('fd-overlay--open');
    overlay.classList.add('fd-overlay--closing');
    setTimeout(() => overlay.remove(), 240);
  };

  document.getElementById('fd-close')?.addEventListener('click', fechar);
  document.getElementById('fd-btn-cancel')?.addEventListener('click', fechar);
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

  // Confirmar
  document.getElementById('fd-btn-confirm')?.addEventListener('click', async () => {
    const prosp = parseInt(document.getElementById('fd-prosp-input')?.value, 10);
    if (isNaN(prosp) || prosp < 0) {
      document.getElementById('fd-prosp-input')?.focus();
      document.getElementById('fd-prosp-input')?.classList.add('fd-input--error');
      return;
    }

    const confirmBtn = document.getElementById('fd-btn-confirm');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="fd-saving-dot"></span> Salvando...';

    const { error } = await DiaFinalizado.salvar(userId, count ?? 0, prosp);

    if (error) {
      console.error('[FinalizarDia] Erro ao salvar:', error);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Salvar e Finalizar';
      return;
    }

    // Feedback de sucesso e fecha
    confirmBtn.innerHTML = '✓ Salvo com sucesso!';
    confirmBtn.classList.add('fd-btn-confirm--ok');
    setTimeout(fechar, 900);
  });
}

// ─── Módulo da Página ───────────────────────────────────────────

export default {
  render() {
    const nome    = UserStore.getPrimeiroNome();
    const isAdmin = UserStore.isAdmin();
    const cargo   = UserStore.getCargo();
    const showFinalizarDia = isAdmin || cargo === 'Comercial';

    return `
      <div class="page-header">
        <div class="page-title-block">
          <h1>Bem-vindo(a), <span style="color:var(--cyan)">${nome}.</span></h1>
          <p>${today()}</p>
        </div>
        <div class="header-actions">
          ${showFinalizarDia ? `
            <button id="btn-finalizar-dia" class="btn-finalizar-dia">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Finalizar Dia
            </button>` : ''}
          ${isAdmin ? _htmlToggleAdmin() : _htmlBadgeCargo()}


        </div>
      </div>

      <div id="inicio-view-area" class="role-view-content"></div>
    `;
  },

  onMount() {
    if (UserStore.isAdmin()) _bindToggle();
    _montarView();
    staggerAnimation(document.querySelector('.page-outlet'));

    // Botão Finalizar Dia
    document.getElementById('btn-finalizar-dia')?.addEventListener('click', _abrirModalFinalizarDia);
  },

  onDestroy() {
    if (_viewAtiva?.onDestroy) {
      _viewAtiva.onDestroy();
      _viewAtiva = null;
    }
  },
};
