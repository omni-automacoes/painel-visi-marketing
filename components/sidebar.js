/**
 * sidebar.js — Componente da barra lateral do CRM Visi Marketing
 *
 * Central de Notificações: puxada da tabela `notificacoes` via Supabase.
 *   Colunas: notificacao_id | notificacao_titulo | notificacao_descricao
 *            notificacao_leitura (boolean) | user_id
 */

import { Notificacoes, Negocios } from '../js/db.js';
import UserStore                  from '../js/userStore.js';

export default class Sidebar {
  /**
   * @param {HTMLElement} container - Elemento <aside> onde a sidebar será renderizada
   * @param {Function}    onNavigate - Callback chamado com o nome da rota ao clicar num link
   */
  constructor(container, onNavigate) {
    this._container  = container;
    this._onNavigate = onNavigate;
    this._activeRoute = 'inicio';

    // Cache local de notificações do Supabase (para filtros de tab)
    this._notificacoes = [];
    // Alertas dinâmicos gerados por lógica client-side (sem salvar no Supabase)
    // Cada item: { _id, notificacao_titulo, notificacao_descricao, notificacao_leitura, _critico }
    this._alertasDinamicos = [];

    // Escuta evento global de atualização de perfil
    window.addEventListener('profile-updated', (e) => {
      this.updateUser(e.detail);
    });
  }

  render() {
    this._container.innerHTML = this._html();
    this._bindEvents();
    // Carrega notificações e alertas assim que a sidebar estiver no DOM
    this._loadNotificacoes();
    this._loadAlertasSemContato();
  }

  /**
   * Atualiza o estado ativo dos links da sidebar
   * @param {string} route
   */
  setActive(route) {
    this._activeRoute = route;
    this._container.querySelectorAll('.nav-link[data-route]').forEach(link => {
      link.classList.toggle('active', link.dataset.route === route);
    });
  }

  _html() {
    const links = [
      { route: 'inicio',   label: 'Início',    badge: null, adminOnly: false,
        icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` },
      { route: 'pipeline', label: 'Funil',     badge: '24', adminOnly: false,
        icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>` },
      { route: 'clientes',   label: 'Clientes',    badge: null, adminOnly: false,
        icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
      { route: 'tarefas',    label: 'Tarefas',     badge: null, adminOnly: false,
        icon: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>` },
      { route: 'projetos',   label: 'Projetos',    badge: null, adminOnly: false,
        icon: `<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="4" rx="1"/><rect x="13" y="11" width="8" height="8" rx="1"/><rect x="3" y="15" width="8" height="4" rx="1"/>` },
      { route: 'email-marketing', label: 'Email Marketing', badge: null, adminOnly: false,
        icon: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>` },
      { route: 'financeiro', label: 'Financeiro', badge: null, adminOnly: true,
        icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
      { route: 'relatorios', label: 'Relatórios',  badge: null, adminOnly: true,
        icon: `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>` },
      { route: 'configuracoes', label: 'Configurações', badge: null, adminOnly: false,
        icon: `<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14M19.07 19.07a10 10 0 0 0 0-14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>` },
    ];

    const linksPermitidos = links.filter(link => {
      if (link.adminOnly) {
        return UserStore.isAdmin();
      }
      return true;
    });

    const linksHTML = linksPermitidos.map(link => `
      <a href="${link.route ? '#' + link.route : '#'}"
         class="nav-link${link.route === this._activeRoute ? ' active' : ''}"
         ${link.route ? `data-route="${link.route}"` : ''}
         id="nav-${link.route || link.label.toLowerCase()}">
        <svg viewBox="0 0 24 24">${link.icon}</svg>
        <span>${link.label}</span>
        ${link.badge ? `<span class="nav-badge">${link.badge}</span>` : ''}
      </a>
    `).join('');

    return `
      <!-- Logo -->
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <img src="assets/logo-visi.png" alt="Visi Marketing Logo" class="sidebar-logo-img" />
        </div>
        <div class="sidebar-logo-text">
          Visi Marketing
          <span>Painel</span>
        </div>
      </div>

      ${linksHTML}

      <div class="sidebar-divider"></div>

      <div class="sidebar-bottom">
        <div class="user-profile" id="user-profile-btn">
          <div class="user-avatar" id="sidebar-user-avatar">···</div>
          <div>
            <div class="user-name" id="sidebar-user-name">Carregando...</div>
            <div class="user-role" id="sidebar-user-role"></div>
          </div>
        </div>

        <!-- Botão Notificações -->
        <button class="sidebar-notif-btn" id="btn-notifications" title="Central de Notificações">
          <div class="sidebar-notif-icon-wrap">
            <svg viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span class="sidebar-notif-badge" id="notif-badge" style="display:none">0</span>
          </div>
          <span>Notificações</span>
        </button>

        <!-- Botão Tema -->
        <button class="sidebar-theme-btn" id="btn-theme" title="Alternar Tema">
          <svg viewBox="0 0 24 24" id="theme-icon-light" style="display:none">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg viewBox="0 0 24 24" id="theme-icon-dark">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <span id="theme-text">Modo Claro</span>
        </button>

        <!-- Botão Logout -->
        <button class="sidebar-logout-btn" id="btn-logout">
          <svg viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sair da conta</span>
        </button>
      </div>

      <!-- Painel Central de Notificações -->
      <div class="notif-panel" id="notif-panel" aria-hidden="true">
        <div class="notif-panel-header">
          <div class="notif-panel-title">
            <svg viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Central de Notificações
          </div>
          <button class="notif-panel-close" id="btn-close-notif" title="Fechar">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="notif-panel-tabs">
          <button class="notif-tab active" data-tab="todas">Todas</button>
          <button class="notif-tab" data-tab="nao-lidas">Não lidas <span class="notif-tab-badge" id="notif-tab-count">0</span></button>
        </div>

        <!-- Estado de carregamento -->
        <div class="notif-list" id="notif-list">
          <div class="notif-loading">
            <svg viewBox="0 0 24 24" class="notif-spinner"><circle cx="12" cy="12" r="10"/></svg>
            Carregando notificações…
          </div>
        </div>

        <div class="notif-panel-footer">
          <button class="notif-mark-all-btn" id="btn-mark-all">Marcar todas como lidas</button>
        </div>
      </div>

      <!-- Overlay -->
      <div class="notif-overlay" id="notif-overlay"></div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────
  //  DATA LOADING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Busca notificações reais da tabela `notificacoes` filtrando pelo user_id logado.
   * Atualiza o badge, a contagem da tab e renderiza os itens no painel.
   */
  async _loadNotificacoes() {
    const userId = UserStore.getUserId();
    if (!userId) return;

    const { data, error } = await Notificacoes.getByUser(userId);

    if (error) {
      console.error('[Sidebar] Erro ao carregar notificações:', error);
      this._renderNotifList([]);
      return;
    }

    this._notificacoes = data || [];
    this._renderCompleto();
    this._updateBadge();
  }

  /**
   * Busca negócios nas etapas 6/7, status "Aberto", do usuário conectado,
   * e gera alertas críticos para aqueles cuja última tarefa foi criada há +48h.
   */
  async _loadAlertasSemContato() {
    const userId = UserStore.getUserId();
    if (!userId) return;

    const { data, error } = await Negocios.getSemContato48h(userId);
    if (error) {
      console.error('[Sidebar] Erro ao carregar alertas sem contato:', error);
      return;
    }

    const agora    = Date.now();
    const MS_48H   = 48 * 60 * 60 * 1000;
    const alertas  = [];

    (data || []).forEach(negocio => {
      const tarefas = negocio.tarefas || [];

      // Sem nenhuma tarefa → considera sem contato desde sempre
      if (!tarefas.length) {
        alertas.push({
          _id:                    `sem-contato-${negocio.negocio_id}`,
          _critico:               true,
          notificacao_leitura:    false,
          notificacao_titulo:     `⚠️ Negócio sem contato — ${this._esc(negocio.negocio_titulo)}`,
          notificacao_descricao:  'Nenhuma tarefa registrada neste negócio. Verificar urgente!',
        });
        return;
      }

      // Encontra a tarefa mais recente pelo criado_em
      const maisRecente = tarefas.reduce((acc, t) => {
        return new Date(t.criado_em) > new Date(acc.criado_em) ? t : acc;
      });

      const diffMs   = agora - new Date(maisRecente.criado_em).getTime();
      const diffHoras = Math.floor(diffMs / (60 * 60 * 1000));

      if (diffMs > MS_48H) {
        alertas.push({
          _id:                    `sem-contato-${negocio.negocio_id}`,
          _critico:               true,
          notificacao_leitura:    false,
          notificacao_titulo:     `⚠️ ${this._esc(negocio.negocio_titulo)}`,
          notificacao_descricao:  `Negócio sem contato há ${diffHoras}h — verificar urgente!`,
        });
      }
    });

    // Preserva estado de "lido local" para alertas já dispensados nesta sessão
    const lidosLocalKey = `alertas_lidos_${userId}`;
    const lidosLocal    = JSON.parse(sessionStorage.getItem(lidosLocalKey) || '[]');
    alertas.forEach(a => {
      if (lidosLocal.includes(a._id)) a.notificacao_leitura = true;
    });

    this._alertasDinamicos = alertas;
    this._renderCompleto();
    this._updateBadge();
  }

  /**
   * Renderiza a lista completa: alertas críticos primeiro, depois notificações do Supabase.
   * Respeita o filtro da tab ativa (Todas / Não lidas).
   */
  _renderCompleto() {
    const activeTab = this._container.querySelector('.notif-tab.active');
    const isUnread  = activeTab && activeTab.dataset.tab === 'nao-lidas';

    let alertasFiltrados = isUnread
      ? this._alertasDinamicos.filter(a => !a.notificacao_leitura)
      : this._alertasDinamicos;

    let notifFiltradas = isUnread
      ? this._notificacoes.filter(n => !n.notificacao_leitura)
      : this._notificacoes;

    this._renderNotifList(alertasFiltrados, notifFiltradas);
  }

  /**
   * Renderiza os itens de notificação no painel.
   * @param {Array} alertas  - Alertas dinâmicos críticos (sem contato +48h)
   * @param {Array} notifics - Notificações do Supabase
   */
  _renderNotifList(alertas = [], notifics = []) {
    const listEl = this._container.querySelector('#notif-list');
    if (!listEl) return;

    if (!alertas.length && !notifics.length) {
      listEl.innerHTML = `
        <div class="notif-empty">
          <div class="notif-empty-icon">
            <svg viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </div>
          <p class="notif-empty-title">Tudo em dia!</p>
          <p class="notif-empty-desc">Você não tem nenhuma notificação por aqui ainda.</p>
        </div>
      `;
      return;
    }

    // ── Alertas críticos (gerados por lógica, sem ID do Supabase) ──
    const alertasHTML = alertas.map(a => `
      <div class="notif-item notif-item-critico${!a.notificacao_leitura ? ' notif-unread' : ''}"
           data-dynamic-id="${a._id}">
        <div class="notif-item-icon notif-icon-critico">
          <svg viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="notif-item-content">
          <span class="notif-critico-badge">CRÍTICO</span>
          <p class="notif-item-title">${a.notificacao_titulo}</p>
          <p class="notif-item-desc">${a.notificacao_descricao}</p>
        </div>
        ${!a.notificacao_leitura ? '<div class="notif-item-dot notif-dot-critico"></div>' : ''}
      </div>
    `).join('');

    // ── Notificações normais do Supabase ──
    const notificsHTML = notifics.map(n => `
      <div class="notif-item${!n.notificacao_leitura ? ' notif-unread' : ''}"
           data-id="${n.notificacao_id}">
        <div class="notif-item-icon notif-icon-alert">
          <svg viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div class="notif-item-content">
          <p class="notif-item-title">${this._esc(n.notificacao_titulo)}</p>
          <p class="notif-item-desc">${this._esc(n.notificacao_descricao)}</p>
        </div>
        ${!n.notificacao_leitura ? '<div class="notif-item-dot"></div>' : ''}
      </div>
    `).join('');

    // Separador visual se houver os dois tipos
    const separador = (alertas.length > 0 && notifics.length > 0)
      ? `<div class="notif-separador"><span>Notificações</span></div>`
      : '';

    listEl.innerHTML = alertasHTML + separador + notificsHTML;

    // Bind click em alertas dinâmicos → "marcar como lido" apenas localmente
    listEl.querySelectorAll('.notif-item-critico').forEach(item => {
      item.addEventListener('click', () => this._marcarAlertaComoLido(item));
    });

    // Bind click em notificações do Supabase → persiste no banco
    listEl.querySelectorAll('.notif-item:not(.notif-item-critico)').forEach(item => {
      item.addEventListener('click', () => this._marcarComoLida(item));
    });
  }

  /**
   * Atualiza o badge do botão de notificações e a contagem da aba "Não lidas".
   * Considera tanto notificações do Supabase quanto alertas dinâmicos críticos.
   */
  _updateBadge() {
    const naoLidasSupabase = this._notificacoes.filter(n => !n.notificacao_leitura).length;
    const naoLidasCriticos = this._alertasDinamicos.filter(a => !a.notificacao_leitura).length;
    const totalNaoLidas    = naoLidasSupabase + naoLidasCriticos;

    const badge    = this._container.querySelector('#notif-badge');
    const tabCount = this._container.querySelector('#notif-tab-count');

    if (badge) {
      badge.textContent   = totalNaoLidas;
      badge.style.display = totalNaoLidas > 0 ? 'flex' : 'none';
      // Badge vermelho se houver alertas críticos não lidos
      badge.classList.toggle('notif-badge-critico', naoLidasCriticos > 0);
    }
    if (tabCount) {
      tabCount.textContent = totalNaoLidas;
    }
  }

  /**
   * Marca um alerta dinâmico (client-side) como lido nesta sessão.
   * Salva o ID no sessionStorage para persistir enquanto a aba estiver aberta.
   * @param {HTMLElement} itemEl
   */
  _marcarAlertaComoLido(itemEl) {
    const dynamicId = itemEl.dataset.dynamicId;
    if (!dynamicId || !itemEl.classList.contains('notif-unread')) return;

    // Atualiza UI
    itemEl.classList.remove('notif-unread');
    const dot = itemEl.querySelector('.notif-item-dot');
    if (dot) dot.remove();

    // Atualiza cache local
    const alerta = this._alertasDinamicos.find(a => a._id === dynamicId);
    if (alerta) alerta.notificacao_leitura = true;

    // Persiste no sessionStorage
    const userId       = UserStore.getUserId();
    const lidosLocalKey = `alertas_lidos_${userId}`;
    const lidosLocal   = JSON.parse(sessionStorage.getItem(lidosLocalKey) || '[]');
    if (!lidosLocal.includes(dynamicId)) lidosLocal.push(dynamicId);
    sessionStorage.setItem(lidosLocalKey, JSON.stringify(lidosLocal));

    this._updateBadge();
  }

  /**
   * Marca um item do Supabase como lido — atualiza UI e persiste no banco.
   * @param {HTMLElement} itemEl
   */
  async _marcarComoLida(itemEl) {
    const id = parseInt(itemEl.dataset.id, 10);
    if (!id || !itemEl.classList.contains('notif-unread')) return;

    // Atualiza UI imediatamente (optimistic update)
    itemEl.classList.remove('notif-unread');
    const dot = itemEl.querySelector('.notif-item-dot');
    if (dot) dot.remove();

    // Atualiza cache local
    const notif = this._notificacoes.find(n => n.notificacao_id === id);
    if (notif) notif.notificacao_leitura = true;

    this._updateBadge();

    // Persiste no Supabase
    const { error } = await Notificacoes.marcarComoLida(id);
    if (error) console.error('[Sidebar] Erro ao marcar notificação como lida:', error);
  }

  /**
   * Marca todas as notificações como lidas:
   * - Alertas dinâmicos → persiste IDs no sessionStorage
   * - Notificações do Supabase → persiste no banco
   */
  async _marcarTodasComoLidas() {
    const userId = UserStore.getUserId();
    if (!userId) return;

    // Atualiza UI
    this._container.querySelectorAll('.notif-item.notif-unread').forEach(item => {
      item.classList.remove('notif-unread');
      const dot = item.querySelector('.notif-item-dot');
      if (dot) dot.remove();
    });

    // Marca alertas dinâmicos como lidos localmente
    const lidosLocalKey = `alertas_lidos_${userId}`;
    const lidosLocal    = JSON.parse(sessionStorage.getItem(lidosLocalKey) || '[]');
    this._alertasDinamicos.forEach(a => {
      a.notificacao_leitura = true;
      if (!lidosLocal.includes(a._id)) lidosLocal.push(a._id);
    });
    sessionStorage.setItem(lidosLocalKey, JSON.stringify(lidosLocal));

    // Atualiza cache local de notificações do Supabase
    this._notificacoes.forEach(n => { n.notificacao_leitura = true; });
    this._updateBadge();

    // Persiste notificações do Supabase no banco
    const { error } = await Notificacoes.marcarTodasComoLidas(userId);
    if (error) console.error('[Sidebar] Erro ao marcar todas como lidas:', error);
  }

  // ─────────────────────────────────────────────────────────────────
  //  UTILITÁRIO
  // ─────────────────────────────────────────────────────────────────

  /** Escapa HTML para evitar XSS nas strings vindas do banco. */
  _esc(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─────────────────────────────────────────────────────────────────
  //  USER PROFILE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Preenche o perfil do usuário na sidebar com dados reais do Supabase.
   * @param {{ user_nome: string, user_cargo: string, user_avatar: string }} user
   */
  updateUser(user) {
    const avatarEl = document.getElementById('sidebar-user-avatar');
    const nameEl   = document.getElementById('sidebar-user-name');
    const roleEl   = document.getElementById('sidebar-user-role');

    if (!avatarEl || !nameEl || !roleEl) return;

    // Nome
    const nomeCompleto  = user.user_nome  || 'Usuário';
    const cargo         = user.user_cargo || '';
    // Exibe apenas primeiro + último sobrenome na sidebar
    const partes        = nomeCompleto.trim().split(' ');
    const nomeExibido   = partes.length > 1
      ? `${partes[0]} ${partes[partes.length - 1]}`
      : partes[0];

    nameEl.textContent = nomeExibido;
    roleEl.textContent = cargo;

    // Avatar: foto real ou iniciais como fallback
    if (user.user_avatar) {
      avatarEl.innerHTML = '';
      avatarEl.style.padding    = '0';
      avatarEl.style.background = 'transparent';
      const img = document.createElement('img');
      img.src   = user.user_avatar;
      img.alt   = nomeCompleto;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
      avatarEl.appendChild(img);
    } else {
      // Iniciais: primeira letra do primeiro e do último nome
      const iniciais = partes.length > 1
        ? `${partes[0][0]}${partes[partes.length - 1][0]}`
        : partes[0].substring(0, 2);
      avatarEl.textContent = iniciais.toUpperCase();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  EVENT BINDING
  // ─────────────────────────────────────────────────────────────────

  _bindEvents() {
    // Navegação
    this._container.querySelectorAll('.nav-link[data-route]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.dataset.route;
        if (this._onNavigate) this._onNavigate(route);
      });
    });

    // Logout
    const logoutBtn = this._container.querySelector('#btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this._handleLogout());
    }

    // ── Tema ────────────────────────────────────────────────────────
    const themeBtn = this._container.querySelector('#btn-theme');
    const iconLight = this._container.querySelector('#theme-icon-light');
    const iconDark = this._container.querySelector('#theme-icon-dark');
    const themeText = this._container.querySelector('#theme-text');

    const updateThemeUI = (theme) => {
      if (!iconLight || !iconDark || !themeText) return;
      if (theme === 'dark') {
        iconLight.style.display = 'block';
        iconDark.style.display = 'none';
        themeText.textContent = 'Modo Claro';
      } else {
        iconLight.style.display = 'none';
        iconDark.style.display = 'block';
        themeText.textContent = 'Modo Escuro';
      }
    };

    // Inicializa botão com base no tema atual (setado via script no index.html)
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    updateThemeUI(currentTheme);

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('visi_theme', newTheme);
        updateThemeUI(newTheme);
      });
    }

    // ── Painel de Notificações ──────────────────────────────────────
    const notifBtn   = this._container.querySelector('#btn-notifications');
    const notifPanel = this._container.querySelector('#notif-panel');
    const overlay    = this._container.querySelector('#notif-overlay');
    const closeBtn   = this._container.querySelector('#btn-close-notif');

    const openPanel = () => {
      notifPanel.classList.add('open');
      overlay.classList.add('active');
      notifPanel.setAttribute('aria-hidden', 'false');
      // Recarrega ao abrir para garantir dados frescos
      this._loadNotificacoes();
    };

    const closePanel = () => {
      notifPanel.classList.remove('open');
      overlay.classList.remove('active');
      notifPanel.setAttribute('aria-hidden', 'true');
    };

    if (notifBtn)  notifBtn.addEventListener('click', openPanel);
    if (closeBtn)  closeBtn.addEventListener('click', closePanel);
    if (overlay)   overlay.addEventListener('click', closePanel);

    // ── Tabs (Todas / Não lidas) ────────────────────────────────────
    this._container.querySelectorAll('.notif-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._container.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderCompleto();
      });
    });

    // ── Marcar todas como lidas ─────────────────────────────────────
    const markAllBtn = this._container.querySelector('#btn-mark-all');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => this._marcarTodasComoLidas());
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  LOGOUT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Encerra a sessão do usuário:
   * limpa storage, cookies de sessão e redireciona para login.
   */
  _handleLogout() {
    localStorage.clear();
    sessionStorage.clear();

    document.cookie.split(';').forEach(c => {
      document.cookie = c.trim().split('=')[0] +
        '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
    });

    window.location.href = 'login.html';
  }
}
