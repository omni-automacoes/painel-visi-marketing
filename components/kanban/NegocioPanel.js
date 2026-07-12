/**
 * NegocioPanel.js — Slide-over panel com detalhes do negócio
 *
 * Uso:
 *   import NegocioPanel from './NegocioPanel.js';
 *   const panel = new NegocioPanel();
 *   panel.open(negocioId);
 */
import { Negocios, Tarefas, Anotacoes, Documentos, Clientes, Notificacoes, ContatoTentativas, MotivosPerdas, KanbanCards } from '../../js/db.js';
import UserStore from '../../js/userStore.js';
import GanhoModal from './GanhoModal.js';

export default class NegocioPanel {
  constructor() {
    this._escHandler = null;
    this._negocioId = null;
    this._negocioData = null; // cache dos dados do negócio
    this._ganhoModal = new GanhoModal();
  }

  // ── API pública ───────────────────────────────────────────────

  open(negocioId) {
    this._negocioId = negocioId;
    this._mount();
    this._loadData(negocioId);
  }

  close(fromHashChange = false) {
    const overlay = document.getElementById('np-overlay');
    if (!overlay) return;
    overlay.classList.add('np-overlay--closing');
    setTimeout(() => overlay.remove(), 280);

    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    if (this._hashHandler) window.removeEventListener('hashchange', this._hashHandler);

    if (!fromHashChange) {
      const hash = window.location.hash;
      if (hash.startsWith('#pipeline/')) {
        window.history.pushState(null, null, '#pipeline');
      }
    }
  }

  // ── Mount ─────────────────────────────────────────────────────

  _mount() {
    document.getElementById('np-overlay')?.remove();

    document.body.insertAdjacentHTML('beforeend', `
      <div class="np-overlay" id="np-overlay">
        <div class="np-panel" id="np-panel">
          <div class="np-loading-state" id="np-content">
            <div class="np-spinner"></div>
          </div>
        </div>
      </div>`);

    document.getElementById('np-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'np-overlay') this.close();
    });

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    this._hashHandler = () => {
      const hash = window.location.hash;
      if (!hash.includes(`/${this._negocioId}`)) {
        this.close(true); // pass true to avoid updating URL again
      }
    };
    window.addEventListener('hashchange', this._hashHandler);

    requestAnimationFrame(() =>
      document.getElementById('np-panel')?.classList.add('np-panel--open')
    );
  }

  // ── Data ──────────────────────────────────────────────────────

  async _loadData(negocioId) {
    const [negRes, tarefasRes, anotacoesRes, docsRes, tentativasRes] = await Promise.all([
      Negocios.getById(negocioId),
      Tarefas.getByNegocio(negocioId),
      Anotacoes.getByNegocio(negocioId),
      Documentos.getByNegocio(negocioId),
      ContatoTentativas.getByNegocio(negocioId),
    ]);

    if (negRes.error) { this._renderError(); return; }
    this._negocioData = negRes.data; // cache para uso no GanhoModal
    this._renderContent(negRes.data, tarefasRes.data ?? [], anotacoesRes.data ?? [], docsRes.data ?? [], tentativasRes.data ?? []);
  }

  // ── Render ────────────────────────────────────────────────────

  _renderContent(neg, tarefas, anotacoes, docs = [], tentativas = []) {
    const el = document.getElementById('np-content');
    if (!el) return;

    const etapaNome = neg.etapas_pipeline?.etapa_nome ?? '—';
    const funilNome = neg.pipelines?.pipeline_nome ?? '—';
    const vendedor = neg.usuarios;
    const avatarUrl = vendedor?.user_avatar;
    const vendedorNome = vendedor?.user_nome ?? 'Sem responsável';

    const STATUS_MAP = {
      Aberto: { cls: 'np-badge--open', label: '● Aberto' },
      Ganho: { cls: 'np-badge--won', label: '✓ Ganho' },
      Perdido: { cls: 'np-badge--lost', label: '✕ Perdido' },
    };
    const status = STATUS_MAP[neg.negocio_status] ?? STATUS_MAP.Aberto;

    const valor = neg.negocio_valor
      ? Number(neg.negocio_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—';

    const pendentes = tarefas.filter(t => !t.tarefa_status);

    // Recontato
    const recontadoBadgeHTML = this._recontadoBadgePanel(neg.data_recontado);
    const recontadoInputVal = neg.data_recontado
      ? (() => {
          const d = new Date(neg.data_recontado);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        })()
      : '';

    el.className = 'np-body';
    el.innerHTML = `

      <!-- HEADER -->
      <div class="np-header">
        <button class="np-close-btn" id="np-close-btn" title="Fechar">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="np-header-main">
          <span class="np-badge ${status.cls}">${status.label}</span>
          <h2 class="np-title">${neg.negocio_titulo || '(sem título)'}</h2>
          <div class="np-valor-wrap">
            ${neg.negocio_valor
              ? `<span class="np-valor" id="np-valor-display">${valor}</span>`
              : `<button class="np-valor-empty" id="np-valor-display" title="Adicionar valor do negócio">
                  <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  Adicionar valor
                </button>`
            }
            <button class="np-valor-edit-btn" id="np-valor-edit-btn" title="Editar valor" ${neg.negocio_valor ? '' : 'style="display:none"'}>
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          <div class="np-valor-field" id="np-valor-field" style="display:none">
            <input type="number" id="np-valor-input" class="np-valor-input" placeholder="0,00" min="0" step="0.01" value="${neg.negocio_valor ?? ''}" />
            <button class="np-valor-save-btn" id="np-valor-save-btn" title="Salvar">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button class="np-valor-cancel-btn" id="np-valor-cancel-btn" title="Cancelar">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="np-header-meta">
          <div class="np-meta-pill">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            ${funilNome}
          </div>
          <div class="np-meta-pill">
            <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            ${etapaNome}
          </div>
        </div>
      </div>

      <!-- BODY LAYOUT: sidebar esquerda + área principal direita -->
      <div class="np-body-layout">

        <!-- ── SIDEBAR ── -->
        <aside class="np-sidebar">

          <!-- Contato -->
          <div class="np-sb-section">
            <div class="np-sb-title">
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Contato
            </div>
            ${neg.negocio_telefone ? `
            <div class="np-sb-item">
              <span class="np-sb-label">Telefone</span>
              <span class="np-sb-value">${neg.negocio_telefone}</span>
            </div>` : ''}
            ${neg.negocio_email ? `
            <div class="np-sb-item">
              <span class="np-sb-label">E-mail</span>
              <span class="np-sb-value">${neg.negocio_email}</span>
            </div>` : ''}
            ${neg.negocio_origem ? `
            <div class="np-sb-item">
              <span class="np-sb-label">Origem</span>
              <span class="np-sb-value">${neg.negocio_origem}</span>
            </div>` : ''}
            ${neg.negocio_segmento ? `
            <div class="np-sb-item">
              <span class="np-sb-label">Segmento</span>
              <span class="np-sb-value">${neg.negocio_segmento}</span>
            </div>` : ''}
            ${!neg.negocio_telefone && !neg.negocio_email && !neg.negocio_origem && !neg.negocio_segmento
              ? '<p class="np-sb-empty">Sem informações de contato.</p>' : ''}
          </div>

          <!-- Faturamento -->
          <div class="np-sb-section np-sb-section--faturamento">
            <div class="np-sb-title">
              <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Faturamento
            </div>
            <div class="np-sb-item">
              <span class="np-sb-label">Faturamento mensal</span>
              <span class="np-sb-value" id="np-faturamento-valor">${
                neg.negocio_faturamento != null
                  ? Number(neg.negocio_faturamento).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : '—'
              }</span>
            </div>
            <div class="np-sb-actions-row" id="np-faturamento-actions" style="${neg.negocio_faturamento != null ? '' : 'display:none;'}">
              <button id="np-faturamento-edit" class="np-sb-edit-btn">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
              <button id="np-faturamento-clear" class="np-faturamento-clear">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Limpar
              </button>
            </div>
            <div class="np-faturamento-field" id="np-faturamento-field" style="${neg.negocio_faturamento != null ? 'display:none; margin-top:6px;' : 'display:flex;'}">
              <input type="number" id="np-faturamento-input" class="np-faturamento-input" placeholder="Ex: 50000" min="0" step="0.01" value="${neg.negocio_faturamento ?? ''}">
              <button id="np-faturamento-save" class="np-faturamento-save" title="Salvar faturamento">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Salvar
              </button>
            </div>
          </div>

          <!-- Recontato -->
          <div class="np-sb-section np-sb-section--recontato">
            <div class="np-sb-title">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Recontato
            </div>
            ${recontadoBadgeHTML}
            <div class="np-sb-actions-row" id="np-recontado-actions" style="${recontadoInputVal ? '' : 'display:none;'}">
              <button id="np-recontado-edit" class="np-sb-edit-btn">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
              <button id="np-recontado-clear" class="np-recontado-clear">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Limpar
              </button>
            </div>
            <div class="np-recontado-field" id="np-recontado-field" style="${recontadoInputVal ? 'display:none; margin-top:6px;' : 'display:flex;'}">
              <input type="date" id="np-recontado-input" class="np-recontado-input" value="${recontadoInputVal}">
              <button id="np-recontado-save" class="np-recontado-save" title="Salvar data de recontato">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Salvar
              </button>
            </div>
          </div>

          <!-- Datas -->
          <div class="np-sb-section">
            <div class="np-sb-title">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Datas
            </div>
            <div class="np-sb-item">
              <span class="np-sb-label">Criado em</span>
              <span class="np-sb-value">${this._fmtDate(neg.criado_em) ?? '—'}</span>
            </div>
            <div class="np-sb-item">
              <span class="np-sb-label">Último Contato</span>
              <span class="np-sb-value" id="np-ultimo-contato-val">
                ${tentativas[0]
                  ? `${this._fmtDate(tentativas[0].tentativa_data)} <span class="np-sb-contato-tipo">(${tentativas[0].tentativa_tipo})</span>`
                  : '<span class="np-sb-empty-inline">—</span>'}
              </span>
            </div>
            ${neg.data_fechamento ? `
            <div class="np-sb-item">
              <span class="np-sb-label">Fechamento</span>
              <span class="np-sb-value">${this._fmtDate(neg.data_fechamento)}</span>
            </div>` : ''}
            ${neg.motivo_perda ? `
            <div class="np-sb-item">
              <span class="np-sb-label">Motivo perda</span>
              <span class="np-sb-value np-sb-value--alert">${neg.motivos_perda?.motivo_descricao ?? neg.motivo_perda}</span>
            </div>` : ''}
          </div>

          <!-- Responsável -->
          <div class="np-sb-section">
            <div class="np-sb-title">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Responsável
            </div>
            <div class="np-vendedor-row">
              ${avatarUrl
                ? `<img class="np-avatar" src="${avatarUrl}" alt="${vendedorNome}">`
                : `<div class="np-avatar np-avatar--initials">${vendedorNome.charAt(0).toUpperCase()}</div>`
              }
              <span class="np-vendedor-nome">${vendedorNome}</span>
            </div>
          </div>

        </aside>

        <!-- ── ÁREA PRINCIPAL ── -->
        <main class="np-main">

          <!-- Ações: toggles + status -->
          <div class="np-actions-container">
            <div class="np-toggles-row">
              <button
                class="np-reuniao-toggle${neg.reuniao_realizada ? ' np-reuniao-toggle--done' : ''}"
                id="np-reuniao-toggle"
                data-negocio-id="${neg.negocio_id}"
                data-realizada="${neg.reuniao_realizada ? 'true' : 'false'}"
                title="${neg.reuniao_realizada ? 'Reunião marcada — clique para desmarcar' : 'Marcar reunião'}"
              >
                <svg class="np-toggle-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                <span class="np-reuniao-label">${neg.reuniao_realizada ? 'Reunião Marcada' : 'Marcar Reunião'}</span>
              </button>
              <button
                class="np-noshow-toggle${neg.negocio_noshow ? ' np-noshow-toggle--done' : ''}"
                id="np-noshow-toggle"
                data-negocio-id="${neg.negocio_id}"
                data-noshow="${neg.negocio_noshow ? 'true' : 'false'}"
                title="${neg.negocio_noshow ? 'No-Show marcado — clique para desmarcar' : 'Marcar No-Show'}"
                style="display: ${neg.reuniao_realizada ? 'flex' : 'none'};"
              >
                <svg class="np-toggle-svg" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                <span class="np-noshow-label">No-Show</span>
              </button>
            </div>

            <div class="np-status-actions" id="np-status-actions">
              ${neg.negocio_status !== 'Ganho' ? `
              <button class="np-status-btn np-status-btn--ganho" id="np-btn-ganho"
                      data-negocio-id="${neg.negocio_id}"
                      title="Marcar negócio como Ganho">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Ganhar
              </button>` : `
              <button class="np-status-btn np-status-btn--ganho np-status-btn--active" disabled>
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Ganho
              </button>`}
              ${neg.negocio_status !== 'Perdido' ? `
              <button class="np-status-btn np-status-btn--perdido" id="np-btn-perdido"
                      data-negocio-id="${neg.negocio_id}"
                      title="Marcar negócio como Perdido">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Perder
              </button>` : `
              <button class="np-status-btn np-status-btn--perdido np-status-btn--active" disabled>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Perdido
              </button>`}
              ${neg.negocio_status !== 'Aberto' ? `
              <button class="np-status-btn np-status-btn--aberto" id="np-btn-aberto"
                      data-negocio-id="${neg.negocio_id}"
                      title="Reabrir negócio">
                <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Reabrir
              </button>` : ''}
            </div>
          </div>

          <!-- Tabs: Contatos | Tarefas | Anotações | Arquivos -->
          <div class="np-tabs-wrapper">
            <div class="np-tabs" role="tablist">
              <button class="np-tab np-tab--active" data-tab="contatos" role="tab">
                <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.27 6.27l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Contatos
                <span class="np-tab-badge" id="np-contato-count">${tentativas.length > 0 ? tentativas.length : ''}</span>
              </button>
              <button class="np-tab" data-tab="tarefas" role="tab">
                <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Tarefas
                <span class="np-tab-badge" id="np-task-pending-count">${pendentes.length > 0 ? pendentes.length : ''}</span>
              </button>
              <button class="np-tab" data-tab="anotacoes" role="tab">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
                Anotações
                <span class="np-tab-badge" id="np-nota-count">${anotacoes.length > 0 ? anotacoes.length : ''}</span>
              </button>
              <button class="np-tab" data-tab="arquivos" role="tab">
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Arquivos
                <span class="np-tab-badge" id="np-doc-count">${docs.length > 0 ? docs.length : ''}</span>
              </button>
            </div>

            <!-- PANEL: CONTATOS -->
            <div class="np-tab-panel np-tab-panel--active" id="np-panel-contatos" role="tabpanel">
              <!-- Botões rápidos de registro -->
              <div class="np-contato-quick-btns">
                <button class="np-contato-btn np-contato-btn--ligacao" data-tipo="Ligação" id="np-contato-ligacao">
                  <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.27 6.27l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Ligação
                </button>
                <button class="np-contato-btn np-contato-btn--whatsapp" data-tipo="WhatsApp" id="np-contato-whatsapp">
                  <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  WhatsApp
                </button>
                <button class="np-contato-btn np-contato-btn--email" data-tipo="Email" id="np-contato-email">
                  <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Email
                </button>
              </div>
              <!-- Lista de tentativas -->
              <div class="np-contato-list" id="np-contato-list">
                ${tentativas.length === 0
                  ? `<p class="np-empty-contatos">Nenhum contato registrado.</p>`
                  : tentativas.map(t => this._tentativaHTML(t)).join('')
                }
              </div>
            </div>

            <!-- PANEL: TAREFAS -->
            <div class="np-tab-panel" id="np-panel-tarefas" role="tabpanel">
              <div class="np-task-form">
                <div class="np-task-form-row">
                  <input type="text" id="np-task-input" class="np-task-input" placeholder="Título da tarefa...">
                  <input type="date" id="np-task-date" class="np-task-date">
                  <button id="np-task-submit" class="np-task-submit" title="Adicionar tarefa">
                    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
                <textarea id="np-task-desc-input" class="np-task-desc-input" placeholder="Descrição (opcional)..." rows="2"></textarea>
              </div>
              <div class="np-task-list" id="np-task-list">
                ${pendentes.length === 0
                  ? `<p class="np-empty-tasks">Nenhuma tarefa pendente.</p>`
                  : pendentes.map(t => this._taskHTML(t)).join('')
                }
              </div>
            </div>

            <!-- PANEL: ANOTAÇÕES -->
            <div class="np-tab-panel" id="np-panel-anotacoes" role="tabpanel">
              <div class="np-nota-form">
                <textarea class="np-nota-textarea" id="np-nota-input"
                  placeholder="Escreva uma anotação sobre este negócio…" rows="3"></textarea>
                <button class="np-nota-submit" id="np-nota-submit">
                  <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Salvar
                </button>
              </div>
              <div class="np-nota-list" id="np-nota-list">
                ${anotacoes.length === 0
                  ? `<p class="np-empty-notas">Nenhuma anotação ainda.</p>`
                  : anotacoes.map(a => this._notaHTML(a)).join('')
                }
              </div>
            </div>

            <!-- PANEL: ARQUIVOS -->
            <div class="np-tab-panel" id="np-panel-arquivos" role="tabpanel">
              <label class="np-doc-upload-btn" for="np-file-input">
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Anexar arquivo
              </label>
              <input type="file" id="np-file-input" class="np-file-input" multiple>
              <div class="np-upload-feedback" id="np-upload-feedback" style="display:none">
                <div class="np-upload-spinner"></div>
                <span id="np-upload-status">Enviando…</span>
              </div>
              <div class="np-doc-list" id="np-doc-list">
                ${docs.length === 0
                  ? `<p class="np-empty-docs">Nenhum arquivo anexado.</p>`
                  : docs.map(d => this._docHTML(d)).join('')
                }
              </div>
            </div>

          </div><!-- /np-tabs-wrapper -->

        </main><!-- /np-main -->

      </div><!-- /np-body-layout -->
    `;

    document.getElementById('np-close-btn')?.addEventListener('click', () => this.close());
    this._bindTabEvents();
    this._bindContatosTab();
    this._bindReuniaoToggle();
    this._bindNoShowToggle();
    this._bindStatusActions(neg);
    this._bindNotesEvents();
    this._bindTaskEvents();
    this._bindTaskForm();
    this._bindDocEvents();
    this._bindRecontadoForm(neg.negocio_id);
    this._bindFaturamentoField(neg.negocio_id);
    this._bindValorField(neg.negocio_id);
  }

  // ── Ações de Status ──────────────────────────────────────

  _bindStatusActions(neg) {
    const btnGanho = document.getElementById('np-btn-ganho');
    const btnPerdido = document.getElementById('np-btn-perdido');
    const btnAberto = document.getElementById('np-btn-aberto');

    // Botão GANHO → abre o GanhoModal
    btnGanho?.addEventListener('click', () => {
      const negData = this._negocioData || neg;
      this._ganhoModal.open(
        negData,
        // onConfirm: bifurca por tipo_cliente
        async (dados) => {

          // ── OUTROS: cria kanban_card, não cria cliente nem tarefas ──
          if (dados.tipo_cliente === 'Outros') {
            const cardPayload = {
              card_titulo:    dados.nome_cliente || '',
              card_descricao: dados.outros_descricao || '',
              tipo_kanban:    'Projetos',
              coluna_id:      39,
            };
            const [cardRes, statusRes] = await Promise.all([
              KanbanCards.create(cardPayload),
              Negocios.updateStatus(neg.negocio_id, 'Ganho'),
            ]);
            if (cardRes.error)
              console.error('[NegocioPanel] Erro ao criar kanban_card (Outros):', cardRes.error);
            if (statusRes.error)
              console.error('[NegocioPanel] Erro ao marcar como Ganho:', statusRes.error);

            this._atualizarBadgeStatus('Ganho');
            this._atualizarBotoesStatus('Ganho', neg.negocio_id);
            setTimeout(() => window.location.reload(), 800);
            return;
          }

          // ── ASSESSORIA: fluxo original ────────────────────────────
          // Converte investimento do formato BR "1.500,00" → número
          const invStr = (dados.investimento_midia || '').replace(/\./g, '').replace(',', '.');
          const investimento = parseFloat(invStr) || null;

          const mensStr = (dados.mensalidade || '').replace(/\./g, '').replace(',', '.');
          const mensalidade = parseFloat(mensStr) || null;

          const clientePayload = {
            cliente_nome:      dados.nome_cliente || '',
            cliente_telefone:  dados.telefone_cliente || null,
            cliente_email:     dados.email_cliente || null,
            investimento_midia: investimento,
            cliente_mensalidade: mensalidade,
            cliente_contrato:  dados.cliente_contrato || false,
            contrato_duracao:  dados.contrato_duracao ?? null,
            segmento:          dados.segmento || null,
            cliente_origem:    dados.origem_cliente || null,
            contexto_geral:    dados.contexto_geral || null,
            descricao_empresa: dados.descricao_empresa || null,
            cliente_status:    'Novo Cliente',
            user_id:           dados.responsavel_id ?? null,
            negocio_id:        neg.negocio_id ?? null,
          };

          const tarefasOnboarding = [
            'Pegar Acessos',
            'Configurações BM e Páginas',
            'Token do Dashboard',
            'Desenvolvimento de Criativos',
            'Estruturar Campanha e Solicitar Saldo',
          ].map(titulo => ({
            tarefa_titulo: titulo,
            tarefa_status: false,
            negocio_id:   neg.negocio_id ?? null,
            vendedor_id:  dados.responsavel_id ?? null,
          }));

          const [clienteRes, statusRes, , tarefasRes] = await Promise.all([
            Clientes.create(clientePayload),
            Negocios.updateStatus(neg.negocio_id, 'Ganho'),
            Notificacoes.criar(
              dados.responsavel_id,
              '🎉 Chegou Novo Cliente',
              `O cliente "${dados.nome_cliente}" chegou e foi atribuído a você. Acesse a área de clientes para gerenciá-lo.`
            ),
            Tarefas.createBulk(tarefasOnboarding),
          ]);

          if (clienteRes.error)
            console.error('[NegocioPanel] Erro ao criar cliente:', clienteRes.error);
          if (statusRes.error)
            console.error('[NegocioPanel] Erro ao marcar como Ganho:', statusRes.error);
          if (tarefasRes?.error)
            console.error('[NegocioPanel] Erro ao criar tarefas:', tarefasRes.error);

          // Atualiza a UI do painel e recarrega a página
          this._atualizarBadgeStatus('Ganho');
          this._atualizarBotoesStatus('Ganho', neg.negocio_id);
          setTimeout(() => window.location.reload(), 800);
        },
        // onCancel: não faz nada
        () => { }
      );
    });

    // Botão PERDIDO → abre modal de motivo
    btnPerdido?.addEventListener('click', () => {
      const negId = parseInt(btnPerdido.dataset.negocioId, 10);
      if (!negId) return;
      this._openPerdaModal(negId);
    });

    // Botão REABRIR
    btnAberto?.addEventListener('click', async () => {
      const negId = parseInt(btnAberto.dataset.negocioId, 10);
      if (!negId) return;
      this._setStatusBtnsDisabled(true);
      const { error } = await Negocios.updateStatus(negId, 'Aberto');
      this._setStatusBtnsDisabled(false);
      if (error) {
        console.error('[NegocioPanel] Erro ao reabrir negócio:', error);
        return;
      }
      this._atualizarBadgeStatus('Aberto');
      this._atualizarBotoesStatus('Aberto', negId);

      // Remove o item de motivo de perda da sidebar
      const motivoItem = document.querySelector('.np-sb-value--alert')?.closest('.np-sb-item');
      if (motivoItem) motivoItem.remove();
    });
  }

  _setStatusBtnsDisabled(disabled) {
    ['np-btn-ganho', 'np-btn-perdido', 'np-btn-aberto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
  }

  _atualizarBadgeStatus(novoStatus) {
    const STATUS_MAP = {
      Aberto: { cls: 'np-badge--open', label: '● Aberto' },
      Ganho: { cls: 'np-badge--won', label: '✓ Ganho' },
      Perdido: { cls: 'np-badge--lost', label: '✕ Perdido' },
    };
    const badge = document.querySelector('.np-badge');
    if (!badge) return;
    badge.className = 'np-badge ' + (STATUS_MAP[novoStatus]?.cls ?? 'np-badge--open');
    badge.textContent = STATUS_MAP[novoStatus]?.label ?? novoStatus;
  }

  _atualizarBotoesStatus(novoStatus, negId) {
    const container = document.getElementById('np-status-actions');
    if (!container) return;
    container.innerHTML = `
      ${novoStatus !== 'Ganho' ? `
      <button class="np-status-btn np-status-btn--ganho" id="np-btn-ganho"
              data-negocio-id="${negId}"
              title="Marcar negócio como Ganho">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        Ganhar
      </button>` : `
      <button class="np-status-btn np-status-btn--ganho np-status-btn--active" disabled>
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        Ganho
      </button>`}
      ${novoStatus !== 'Perdido' ? `
      <button class="np-status-btn np-status-btn--perdido" id="np-btn-perdido"
              data-negocio-id="${negId}"
              title="Marcar negócio como Perdido">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Perder
      </button>` : `
      <button class="np-status-btn np-status-btn--perdido np-status-btn--active" disabled>
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Perdido
      </button>`}
      ${novoStatus !== 'Aberto' ? `
      <button class="np-status-btn np-status-btn--aberto" id="np-btn-aberto"
              data-negocio-id="${negId}"
              title="Reabrir negócio">
        <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Reabrir
      </button>` : ''}
    `;
    // Rebind novos botões
    const negDataCache = this._negocioData || {};
    this._bindStatusActions({ ...negDataCache, negocio_id: negId, negocio_status: novoStatus });
  }

  // ── Modal Motivo de Perda ──────────────────────────────────────

  async _openPerdaModal(negId) {
    // Remove qualquer modal anterior
    document.getElementById('np-perda-overlay')?.remove();

    // Monta overlay de loading
    document.body.insertAdjacentHTML('beforeend', `
      <div class="np-perda-overlay" id="np-perda-overlay">
        <div class="np-perda-modal" id="np-perda-modal" role="dialog" aria-modal="true" aria-label="Motivo da perda">
          <div class="np-perda-loading">
            <div class="np-spinner" style="width:24px;height:24px;border-width:2.5px"></div>
          </div>
        </div>
      </div>`);

    requestAnimationFrame(() =>
      document.getElementById('np-perda-modal')?.classList.add('np-perda-modal--open')
    );

    // Fechar ao clicar fora
    document.getElementById('np-perda-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'np-perda-overlay') this._closePerdaModal();
    });

    // Fechar com Escape
    this._perdaEscHandler = (e) => { if (e.key === 'Escape') this._closePerdaModal(); };
    document.addEventListener('keydown', this._perdaEscHandler);

    // Carrega motivos
    const { data: motivos, error } = await MotivosPerdas.getAll();
    const modal = document.getElementById('np-perda-modal');
    if (!modal) return;

    if (error) {
      modal.innerHTML = `<p style="padding:24px;color:#EF4444;font-size:13px;">Erro ao carregar motivos.</p>`;
      return;
    }

    this._renderPerdaModal(modal, negId, motivos ?? []);
  }

  _renderPerdaModal(modal, negId, motivos) {
    modal.innerHTML = `
      <div class="np-perda-header">
        <div class="np-perda-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div>
          <h3 class="np-perda-title">Motivo da Perda</h3>
          <p class="np-perda-subtitle">Selecione ou adicione o motivo para registrar esta perda.</p>
        </div>
        <button class="np-perda-close" id="np-perda-close-btn" title="Fechar">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="np-perda-body">
        <div class="np-perda-list" id="np-perda-list">
          ${motivos.length === 0
            ? `<p class="np-perda-empty">Nenhum motivo cadastrado ainda.</p>`
            : motivos.map(m => `
              <button class="np-perda-option" data-motivo-id="${m.motivo_id}" data-motivo-desc="${m.motivo_descricao.replace(/"/g, '&quot;')}">
                <span class="np-perda-option-radio"></span>
                <span class="np-perda-option-label">${m.motivo_descricao}</span>
              </button>`).join('')}
        </div>

        <!-- Adicionar novo motivo -->
        <div class="np-perda-new-section">
          <button class="np-perda-new-toggle" id="np-perda-new-toggle">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar novo motivo
          </button>
          <div class="np-perda-new-form" id="np-perda-new-form" style="display:none;">
            <input type="text" id="np-perda-new-input" class="np-perda-new-input" placeholder="Descreva o motivo..." maxlength="120">
            <button class="np-perda-new-save" id="np-perda-new-save">Salvar</button>
          </div>
        </div>
      </div>

      <div class="np-perda-footer">
        <button class="np-perda-cancel-btn" id="np-perda-cancel-btn">Cancelar</button>
        <button class="np-perda-confirm-btn" id="np-perda-confirm-btn" disabled>
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Confirmar Perda
        </button>
      </div>`;

    this._bindPerdaModal(negId);
  }

  _bindPerdaModal(negId) {
    let selectedMotivo = null; // { id, desc }

    // Fechar
    document.getElementById('np-perda-close-btn')?.addEventListener('click', () => this._closePerdaModal());
    document.getElementById('np-perda-cancel-btn')?.addEventListener('click', () => this._closePerdaModal());

    const confirmBtn = document.getElementById('np-perda-confirm-btn');

    // Selecionar motivo existente
    document.getElementById('np-perda-list')?.addEventListener('click', (e) => {
      const opt = e.target.closest('.np-perda-option');
      if (!opt) return;

      // Deselect todos
      document.querySelectorAll('.np-perda-option').forEach(el => el.classList.remove('np-perda-option--selected'));
      opt.classList.add('np-perda-option--selected');

      selectedMotivo = { id: opt.dataset.motivoId, desc: opt.dataset.motivoDesc };
      if (confirmBtn) confirmBtn.disabled = false;
    });

    // Toggle "Adicionar novo"
    const newToggle = document.getElementById('np-perda-new-toggle');
    const newForm   = document.getElementById('np-perda-new-form');
    const newInput  = document.getElementById('np-perda-new-input');
    const newSave   = document.getElementById('np-perda-new-save');

    newToggle?.addEventListener('click', () => {
      const isOpen = newForm.style.display !== 'none';
      newForm.style.display = isOpen ? 'none' : 'flex';
      newToggle.classList.toggle('np-perda-new-toggle--open', !isOpen);
      if (!isOpen) setTimeout(() => newInput?.focus(), 50);
    });

    // Salvar novo motivo
    const saveNewMotivo = async () => {
      const desc = newInput?.value.trim();
      if (!desc) { newInput?.focus(); return; }

      newSave.disabled = true;
      newSave.textContent = 'Salvando…';

      const { data, error } = await MotivosPerdas.create(desc);

      newSave.disabled = false;
      newSave.textContent = 'Salvar';

      if (error) {
        console.error('[NegocioPanel] Erro ao criar motivo:', error);
        newInput.style.borderColor = '#EF4444';
        setTimeout(() => { newInput.style.borderColor = ''; }, 2000);
        return;
      }

      // Adiciona na lista e seleciona automaticamente
      const list = document.getElementById('np-perda-list');
      const empty = list?.querySelector('.np-perda-empty');
      if (empty) empty.remove();

      const newOpt = document.createElement('button');
      newOpt.className = 'np-perda-option np-perda-option--selected';
      newOpt.dataset.motivoId   = data.motivo_id;
      newOpt.dataset.motivoDesc = data.motivo_descricao;
      newOpt.innerHTML = `<span class="np-perda-option-radio"></span><span class="np-perda-option-label">${data.motivo_descricao}</span>`;

      // Deselect outros e adiciona o novo
      document.querySelectorAll('.np-perda-option').forEach(el => el.classList.remove('np-perda-option--selected'));
      list?.appendChild(newOpt);

      // Bind click no novo botão
      newOpt.addEventListener('click', () => {
        document.querySelectorAll('.np-perda-option').forEach(el => el.classList.remove('np-perda-option--selected'));
        newOpt.classList.add('np-perda-option--selected');
        selectedMotivo = { id: newOpt.dataset.motivoId, desc: newOpt.dataset.motivoDesc };
        if (confirmBtn) confirmBtn.disabled = false;
      });

      selectedMotivo = { id: data.motivo_id, desc: data.motivo_descricao };
      if (confirmBtn) confirmBtn.disabled = false;

      // Fecha o form
      newInput.value = '';
      newForm.style.display = 'none';
      newToggle.classList.remove('np-perda-new-toggle--open');
    };

    newSave?.addEventListener('click', saveNewMotivo);
    newInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNewMotivo(); });

    // Confirmar perda
    confirmBtn?.addEventListener('click', async () => {
      if (!selectedMotivo) return;

      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;animation:spin 0.7s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Registrando…`;

      const { error } = await Negocios.updatePerdido(negId, selectedMotivo.id);

      if (error) {
        console.error('[NegocioPanel] Erro ao marcar como Perdido:', error);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Confirmar Perda`;
        return;
      }

      this._closePerdaModal();
      this._atualizarBadgeStatus('Perdido');
      this._atualizarBotoesStatus('Perdido', negId);

      // Atualiza motivo_perda na seção Datas da sidebar
      const motivoEl = document.querySelector('.np-sb-value--alert');
      if (motivoEl) {
        motivoEl.textContent = selectedMotivo.desc;
      } else {
        // Insere o item se ainda não existe
        const datasSection = document.querySelector('.np-sb-section:has(.np-sb-title svg circle)');
        if (datasSection) {
          datasSection.insertAdjacentHTML('beforeend', `
            <div class="np-sb-item">
              <span class="np-sb-label">Motivo perda</span>
              <span class="np-sb-value np-sb-value--alert">${selectedMotivo.desc}</span>
            </div>`);
        }
      }
    });
  }

  _closePerdaModal() {
    const overlay = document.getElementById('np-perda-overlay');
    if (!overlay) return;
    overlay.classList.add('np-perda-overlay--closing');
    setTimeout(() => overlay.remove(), 240);
    if (this._perdaEscHandler) document.removeEventListener('keydown', this._perdaEscHandler);
  }

  // ── Reunião Realizada ─────────────────────────────────────

  _bindReuniaoToggle() {
    const btn = document.getElementById('np-reuniao-toggle');
    const noshowBtn = document.getElementById('np-noshow-toggle');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const atual = btn.dataset.realizada === 'true';
      const novo = !atual;
      const negId = parseInt(btn.dataset.negocioId, 10);

      // Feedback imediato (optimistic UI)
      btn.classList.toggle('np-reuniao-toggle--done', novo);
      btn.dataset.realizada = String(novo);
      btn.title = novo ? 'Reunião marcada — clique para desmarcar' : 'Marcar reunião';
      btn.querySelector('.np-reuniao-label').textContent = novo ? 'Reunião Marcada' : 'Marcar Reunião';
      btn.disabled = true;
      
      // Mostrar/Esconder No-Show
      if (noshowBtn) {
        noshowBtn.style.display = novo ? 'flex' : 'none';
        if (!novo && noshowBtn.dataset.noshow === 'true') {
          // Reset No-Show se desmarcar reunião
          noshowBtn.classList.remove('np-noshow-toggle--done');
          noshowBtn.dataset.noshow = 'false';
          Negocios.updateNoShow(negId, false);
        }
      }

      const { error } = await Negocios.updateReuniaoRealizada(negId, novo);
      btn.disabled = false;

      if (error) {
        console.error('[NegocioPanel] Erro ao atualizar reunião:', error);
        // Reverte
        btn.classList.toggle('np-reuniao-toggle--done', atual);
        btn.dataset.realizada = String(atual);
        btn.querySelector('.np-reuniao-label').textContent = atual ? 'Reunião Marcada' : 'Marcar Reunião';
        if (noshowBtn) noshowBtn.style.display = atual ? 'flex' : 'none';
      }
    });
  }

  _bindNoShowToggle() {
    const btn = document.getElementById('np-noshow-toggle');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const atual = btn.dataset.noshow === 'true';
      const novo = !atual;
      const negId = parseInt(btn.dataset.negocioId, 10);

      // Feedback imediato
      btn.classList.toggle('np-noshow-toggle--done', novo);
      btn.dataset.noshow = String(novo);
      btn.title = novo ? 'No-Show marcado — clique para desmarcar' : 'Marcar No-Show';
      btn.disabled = true;

      const { error } = await Negocios.updateNoShow(negId, novo);
      btn.disabled = false;

      if (error) {
        console.error('[NegocioPanel] Erro ao atualizar no-show:', error);
        // Reverte
        btn.classList.toggle('np-noshow-toggle--done', atual);
        btn.dataset.noshow = String(atual);
      }
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────

  _bindTabEvents() {
    document.querySelector('.np-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.np-tab');
      if (!tab) return;
      const tabId = tab.dataset.tab;

      document.querySelectorAll('.np-tab').forEach(t => t.classList.remove('np-tab--active'));
      tab.classList.add('np-tab--active');

      document.querySelectorAll('.np-tab-panel').forEach(p => p.classList.remove('np-tab-panel--active'));
      document.getElementById(`np-panel-${tabId}`)?.classList.add('np-tab-panel--active');
    });
  }

  // ── Tarefas ───────────────────────────────────────────────────

  _bindTaskEvents() {
    document.getElementById('np-task-list')?.addEventListener('click', async (e) => {
      const check = e.target.closest('.np-task-check--pending');
      if (!check) return;
      const tarefaId = parseInt(check.dataset.tarefaId, 10);
      const titulo = check.dataset.tarefaTitulo || 'tarefa';
      if (tarefaId) await this._concluirTarefa(tarefaId, titulo, check);
    });
  }

  async _concluirTarefa(tarefaId, titulo, checkEl) {
    checkEl.classList.remove('np-task-check--pending');
    checkEl.style.opacity = '0.5';

    const [updateRes, notaRes] = await Promise.all([
      Tarefas.concluir(tarefaId),
      Anotacoes.create(this._negocioId, `✓ Tarefa concluída: "${titulo}"`),
    ]);

    if (updateRes.error) {
      console.error('[NegocioPanel] Erro ao concluir tarefa:', updateRes.error);
      checkEl.classList.add('np-task-check--pending');
      checkEl.style.opacity = '';
      return;
    }

    // Remove o card da tarefa com animação
    const taskEl = document.getElementById(`np-task-${tarefaId}`);
    if (taskEl) {
      taskEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      taskEl.style.opacity = '0';
      taskEl.style.transform = 'translateX(20px)';
      setTimeout(() => {
        taskEl.remove();
        const list = document.getElementById('np-task-list');
        if (list && !list.querySelector('.np-task')) {
          list.innerHTML = `<p class="np-empty-tasks">Nenhuma tarefa pendente.</p>`;
        }
      }, 250);
    }

    this._updateTaskCount(-1);

    // Nota automática
    if (!notaRes.error && notaRes.data) {
      const list = document.getElementById('np-nota-list');
      const empty = list?.querySelector('.np-empty-notas');
      if (empty) empty.remove();
      list?.insertAdjacentHTML('afterbegin', this._notaHTML(notaRes.data));
      this._updateNotaCount(1);
    }
  }

  _bindTaskForm() {
    document.getElementById('np-task-submit')?.addEventListener('click', () => this._criarTarefa());
    document.getElementById('np-task-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._criarTarefa(); }
    });
  }

  async _criarTarefa() {
    const input = document.getElementById('np-task-input');
    const dateInput = document.getElementById('np-task-date');
    const descInput = document.getElementById('np-task-desc-input');
    const submitBtn = document.getElementById('np-task-submit');
    const titulo = input?.value.trim();
    if (!titulo) { input?.focus(); return; }

    if (submitBtn) submitBtn.disabled = true;

    const payload = {
      tarefa_titulo: titulo,
      negocio_id: this._negocioId,
      tarefa_status: false,
      vendedor_id: UserStore.getUserId(),
    };
    const desc = descInput?.value.trim();
    if (desc) payload.tarefa_descricao = desc;

    if (dateInput?.value) {
      const [y, m, d] = dateInput.value.split('-').map(Number);
      payload.tarefa_vencimento = new Date(y, m - 1, d, 12, 0, 0).toISOString();
    }

    const { data, error } = await Tarefas.criar(payload);
    if (submitBtn) submitBtn.disabled = false;

    if (error) {
      console.error('[NegocioPanel] Erro ao criar tarefa:', error);
      return;
    }

    input.value = '';
    if (dateInput) dateInput.value = '';
    if (descInput) descInput.value = '';

    const list = document.getElementById('np-task-list');
    const empty = list?.querySelector('.np-empty-tasks');
    if (empty) empty.remove();
    list?.insertAdjacentHTML('beforeend', this._taskHTML(data));
    this._updateTaskCount(1);
  }

  _updateTaskCount(delta) {
    const badge = document.getElementById('np-task-pending-count');
    if (!badge) return;
    const next = (parseInt(badge.textContent || '0', 10)) + delta;
    badge.textContent = next > 0 ? String(next) : '';
  }

  // ── Contatos (Tentativas) ─────────────────────────────────────

  _bindContatosTab() {
    const list = document.getElementById('np-contato-list');

    // Botões rápidos: Ligação, WhatsApp, Email
    ['np-contato-ligacao', 'np-contato-whatsapp', 'np-contato-email'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const tipo = btn.dataset.tipo;
        await this._addTentativa(tipo, btn);
      });
    });

    // Exclusão via delegação no list
    list?.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.np-contato-del');
      if (delBtn) {
        const tentId = parseInt(delBtn.dataset.tentativaId, 10);
        if (tentId) this._deleteTentativa(tentId);
        return;
      }

      // Botões de status (Atendido / Não Atendido)
      const statusBtn = e.target.closest('.np-contato-status-btn');
      if (statusBtn) {
        const tentId = parseInt(statusBtn.dataset.tentativaId, 10);
        const novoStatus = statusBtn.dataset.status; // 'Atendido' ou 'Não Atendido'
        if (!tentId) return;

        statusBtn.disabled = true;
        const { error } = await ContatoTentativas.updateStatusContato(tentId, novoStatus);
        statusBtn.disabled = false;

        if (error) {
          console.error('[NegocioPanel] Erro ao atualizar status contato:', error);
          return;
        }

        // Atualiza visual: marca o selecionado, desmarca o outro
        // e troca texto para só ícone (status agora está definido)
        const card = list.querySelector(`#np-contato-${tentId}`);
        if (card) {
          card.querySelectorAll('.np-contato-status-btn').forEach(b => {
            const isActive = b.dataset.status === novoStatus;
            b.classList.toggle('np-contato-status-btn--active', isActive);
            b.classList.toggle('np-contato-status-btn--inactive', !isActive);
            // Reduz para só ícone agora que há status definido
            b.textContent = b.dataset.status === 'Atendido' ? '✓' : '✗';
          });
        }
      }
    });
  }

  async _addTentativa(tipo, btn) {
    // Feedback imediato — desabilita o botão
    if (btn) { btn.disabled = true; btn.classList.add('np-contato-btn--loading'); }

    const { data, error } = await ContatoTentativas.create(this._negocioId, tipo);

    if (btn) { btn.disabled = false; btn.classList.remove('np-contato-btn--loading'); }

    if (error) {
      console.error('[NegocioPanel] Erro ao registrar tentativa:', error);
      return;
    }

    const list = document.getElementById('np-contato-list');
    const empty = list?.querySelector('.np-empty-contatos');
    if (empty) empty.remove();
    list?.insertAdjacentHTML('afterbegin', this._tentativaHTML(data));
    this._updateContatoCount(1);

    // Atualiza "Último Contato" na sidebar
    this._updateUltimoContatoSidebar(data);

    // Pisca o botão com cor de confirmação
    if (btn) {
      btn.classList.add('np-contato-btn--ok');
      setTimeout(() => btn.classList.remove('np-contato-btn--ok'), 1400);
    }
  }

  async _deleteTentativa(tentativaId) {
    const item = document.getElementById(`np-contato-${tentativaId}`);
    if (!item) return;
    item.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    item.style.opacity = '0';
    item.style.transform = 'translateX(20px)';

    const { error } = await ContatoTentativas.delete(tentativaId);
    if (error) {
      console.error('[NegocioPanel] Erro ao excluir tentativa:', error);
      item.style.opacity = '';
      item.style.transform = '';
      return;
    }

    setTimeout(() => {
      item.remove();
      const list = document.getElementById('np-contato-list');
      if (list && !list.querySelector('.np-contato-item')) {
        list.innerHTML = `<p class="np-empty-contatos">Nenhum contato registrado.</p>`;
      }
    }, 220);
    this._updateContatoCount(-1);
  }

  _tentativaHTML(t) {
    const TIPO_CFG = {
      'Ligação':  { cls: 'ligacao',  icon: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.27 6.27l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>` },
      'WhatsApp': { cls: 'whatsapp', icon: `<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>` },
      'Email':    { cls: 'email',    icon: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>` },
    };
    const cfg = TIPO_CFG[t.tentativa_tipo] ?? TIPO_CFG['Ligação'];
    const dateFmt = this._fmtNoteDate(t.tentativa_data);
    const dateAbs = t.tentativa_data
      ? new Date(t.tentativa_data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';

    const isLigacao = t.tentativa_tipo === 'Ligação';
    const sc = t.status_contato;
    // Se ainda sem status → mostra texto; se já definido → só ícone
    const statusBtns = isLigacao ? `
      <button class="np-contato-status-btn np-contato-status-btn--atendido ${sc === 'Atendido' ? 'np-contato-status-btn--active' : (sc ? 'np-contato-status-btn--inactive' : '')}"
        data-tentativa-id="${t.tentativa_id}" data-status="Atendido" title="Atendido">${sc ? '✓' : '✓ Atendido'}</button>
      <button class="np-contato-status-btn np-contato-status-btn--nao-atendido ${sc === 'Não Atendido' ? 'np-contato-status-btn--active' : (sc ? 'np-contato-status-btn--inactive' : '')}"
        data-tentativa-id="${t.tentativa_id}" data-status="Não Atendido" title="Não Atendido">${sc ? '✗' : '✗ Não At.'}</button>` : '';

    return `
      <div class="np-contato-item np-contato-item--${cfg.cls}" id="np-contato-${t.tentativa_id}">
        <div class="np-contato-icon">
          <svg viewBox="0 0 24 24">${cfg.icon}</svg>
        </div>
        <div class="np-contato-info">
          <div class="np-contato-tipo-row">
            <span class="np-contato-tipo">${t.tentativa_tipo}</span>
          </div>
          <time class="np-contato-data" title="${dateAbs}">${dateFmt ?? dateAbs}</time>
        </div>
        <div class="np-contato-actions">
          ${statusBtns}
          <button class="np-contato-del" data-tentativa-id="${t.tentativa_id}" title="Remover tentativa">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>`;
  }

  _updateContatoCount(delta) {
    const badge = document.getElementById('np-contato-count');
    if (!badge) return;
    const next = (parseInt(badge.textContent || '0', 10)) + delta;
    badge.textContent = next > 0 ? String(next) : '';
  }

  _updateUltimoContatoSidebar(tentativa) {
    const el = document.getElementById('np-ultimo-contato-val');
    if (!el || !tentativa) return;
    el.innerHTML = `${this._fmtDate(tentativa.tentativa_data)} <span class="np-sb-contato-tipo">(${tentativa.tentativa_tipo})</span>`;
  }

  // ── Anotações ─────────────────────────────────────────────────

  _bindNotesEvents() {
    const submitBtn = document.getElementById('np-nota-submit');
    const input = document.getElementById('np-nota-input');

    submitBtn?.addEventListener('click', () => this._addNota());

    input?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this._addNota();
      }
    });

    document.getElementById('np-nota-list')?.addEventListener('click', (e) => {
      // Expandir / recolher
      const expandBtn = e.target.closest('.np-nota-expand-btn');
      if (expandBtn) {
        const item = expandBtn.closest('.np-nota-item');
        if (item) {
          const expanded = item.classList.toggle('np-nota-item--expanded');
          expandBtn.textContent = expanded ? 'Ver menos ↑' : 'Ver mais ↓';
        }
        return;
      }
      // Editar
      const editBtn = e.target.closest('.np-nota-edit-btn');
      if (editBtn) {
        const item = editBtn.closest('.np-nota-item');
        if (item) this._editNota(item);
      }
    });
  }

  async _addNota() {
    const input = document.getElementById('np-nota-input');
    const submitBtn = document.getElementById('np-nota-submit');
    const nota = input?.value.trim();
    if (!nota) { input?.focus(); return; }

    // Estado de loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando…';

    const { data, error } = await Anotacoes.create(this._negocioId, nota);

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Salvar`;

    if (error) {
      console.error('[NegocioPanel] Erro ao salvar nota:', error);
      return;
    }

    // Limpa o campo
    input.value = '';

    // Insere a nota no topo da lista (sem re-render)
    const list = document.getElementById('np-nota-list');
    const empty = list?.querySelector('.np-empty-notas');
    if (empty) empty.remove();
    list?.insertAdjacentHTML('afterbegin', this._notaHTML(data));

    // Atualiza contador
    this._updateNotaCount(1);
  }

  async _deleteNota(notacaoId) {
    const item = document.getElementById(`np-nota-${notacaoId}`);
    if (!item) return;
    item.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    item.style.opacity = '0';
    item.style.transform = 'translateX(20px)';
    const { error } = await Anotacoes.delete(notacaoId);
    if (error) {
      console.error('[NegocioPanel] Erro ao excluir nota:', error);
      item.style.opacity = '';
      item.style.transform = '';
      return;
    }
    setTimeout(() => {
      item.remove();
      const list = document.getElementById('np-nota-list');
      if (list && !list.querySelector('.np-nota-item')) {
        list.innerHTML = `<p class="np-empty-notas">Nenhuma anotação ainda.</p>`;
      }
    }, 200);
    this._updateNotaCount(-1);
  }

  _editNota(item) {
    if (item.classList.contains('np-nota-item--editing')) return;
    const notaId = parseInt(item.dataset.notaId, 10);
    const notaText = item.dataset.notaText || '';

    const textoEl = item.querySelector('.np-nota-texto');
    const editBtn = item.querySelector('.np-nota-edit-btn');
    const expandBtn = item.querySelector('.np-nota-expand-btn');

    if (textoEl) textoEl.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    if (expandBtn) expandBtn.style.display = 'none';

    item.classList.remove('np-nota-item--collapsible', 'np-nota-item--expanded');
    item.classList.add('np-nota-item--editing');

    item.insertAdjacentHTML('afterbegin', `
      <textarea class="np-nota-edit-area" id="np-nota-edit-${notaId}">${notaText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <div class="np-nota-edit-actions">
        <button class="np-nota-cancel-btn">Cancelar</button>
        <button class="np-nota-save-btn">Salvar</button>
      </div>`);

    setTimeout(() => document.getElementById(`np-nota-edit-${notaId}`)?.focus(), 0);

    item.querySelector('.np-nota-save-btn')?.addEventListener('click', async () => {
      const newText = document.getElementById(`np-nota-edit-${notaId}`)?.value.trim();
      if (!newText) return;
      await this._saveNotaEdit(notaId, newText, item);
    });
    item.querySelector('.np-nota-cancel-btn')?.addEventListener('click', () => {
      this._cancelNotaEdit(item);
    });
  }

  async _saveNotaEdit(notaId, newText, item) {
    const saveBtn = item.querySelector('.np-nota-save-btn');
    if (saveBtn) saveBtn.disabled = true;

    const { error } = await Anotacoes.update(notaId, newText);
    if (error) {
      console.error('[NegocioPanel] Erro ao editar nota:', error);
      if (saveBtn) saveBtn.disabled = false;
      return;
    }

    // Atualiza o data-text
    item.dataset.notaText = newText;

    // Remove UI de edição
    item.querySelector('.np-nota-edit-area')?.remove();
    item.querySelector('.np-nota-edit-actions')?.remove();
    item.classList.remove('np-nota-item--editing');

    // Atualiza o texto exibido
    const texto = newText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const isLong = newText.length > 200;
    const textoEl = item.querySelector('.np-nota-texto');
    const editBtn = item.querySelector('.np-nota-edit-btn');
    const expandBtn = item.querySelector('.np-nota-expand-btn');

    if (textoEl) { textoEl.innerHTML = texto; textoEl.style.display = ''; }
    if (editBtn) editBtn.style.display = '';

    if (isLong) {
      item.classList.add('np-nota-item--collapsible');
      if (!expandBtn) {
        editBtn?.insertAdjacentHTML('beforebegin',
          `<button class="np-nota-expand-btn">Ver mais ↓</button>`);
      } else {
        expandBtn.style.display = '';
        expandBtn.textContent = 'Ver mais ↓';
      }
    } else {
      expandBtn?.remove();
    }
  }

  _cancelNotaEdit(item) {
    item.querySelector('.np-nota-edit-area')?.remove();
    item.querySelector('.np-nota-edit-actions')?.remove();
    item.classList.remove('np-nota-item--editing');

    const notaText = item.dataset.notaText || '';
    ['np-nota-texto', 'np-nota-edit-btn', 'np-nota-expand-btn'].forEach(cls => {
      const el = item.querySelector(`.${cls}`);
      if (el) el.style.display = '';
    });
    if (notaText.length > 200) item.classList.add('np-nota-item--collapsible');
  }

  // ── Documentos ────────────────────────────────────────────────

  _bindDocEvents() {
    document.getElementById('np-file-input')?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      await this._uploadDocs(files);
      e.target.value = '';
    });

    document.getElementById('np-doc-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.np-doc-del');
      if (!btn) return;
      this._deleteDoc(btn.dataset.docId);
    });
  }

  async _uploadDocs(files) {
    const feedback = document.getElementById('np-upload-feedback');
    const statusEl = document.getElementById('np-upload-status');
    const uploadBtn = document.querySelector('.np-doc-upload-btn');

    if (feedback) feedback.style.display = 'flex';
    if (uploadBtn) uploadBtn.style.opacity = '0.5';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (statusEl) statusEl.textContent =
        files.length > 1 ? `Enviando ${i + 1}/${files.length}…` : 'Enviando…';

      const { data, error } = await Documentos.upload(this._negocioId, file);
      if (error) { console.error('[NegocioPanel] Upload falhou:', error); continue; }

      const list = document.getElementById('np-doc-list');
      const empty = list?.querySelector('.np-empty-docs');
      if (empty) empty.remove();
      list?.insertAdjacentHTML('afterbegin', this._docHTML(data));
      this._updateDocCount(1);
    }

    if (feedback) feedback.style.display = 'none';
    if (uploadBtn) uploadBtn.style.opacity = '';
  }

  async _deleteDoc(docId) {
    const item = document.getElementById(`np-doc-${docId}`);
    if (!item) return;
    item.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    item.style.opacity = '0';
    item.style.transform = 'translateX(20px)';

    const { error } = await Documentos.delete(docId);
    if (error) {
      console.error('[NegocioPanel] Erro ao remover doc:', error);
      item.style.opacity = ''; item.style.transform = ''; return;
    }
    setTimeout(() => {
      item.remove();
      const list = document.getElementById('np-doc-list');
      if (list && !list.querySelector('.np-doc-item'))
        list.innerHTML = `<p class="np-empty-docs">Nenhum arquivo anexado.</p>`;
    }, 220);
    this._updateDocCount(-1);
  }

  _docHTML(doc) {
    const id = String(doc.documento_id ?? doc.id ?? Date.now());
    const url = doc.documento_link || '';
    const name = this._fileNameFromUrl(url);
    const ext = (name.split('.').pop() || '').toLowerCase();
    return `
      <div class="np-doc-item" id="np-doc-${id}">
        <div class="np-doc-icon np-doc-icon--${this._fileIconClass(ext)}">
          ${this._fileIconSVG(ext)}
        </div>
        <div class="np-doc-info">
          <a class="np-doc-name" href="${url}" target="_blank" rel="noopener">${name}</a>
          <span class="np-doc-ext">${ext ? ext.toUpperCase() : 'FILE'}</span>
        </div>
        <button class="np-doc-del" data-doc-id="${id}" title="Remover arquivo">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  }

  _fileNameFromUrl(url) {
    if (!url) return 'arquivo';
    const raw = decodeURIComponent(url.split('/').pop().split('?')[0]);
    return raw.replace(/^\d{13,}_/, '');
  }

  _fileIconClass(ext) {
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) return 'image';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
    if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
    return 'default';
  }

  _fileIconSVG(ext) {
    const cls = this._fileIconClass(ext);
    if (cls === 'pdf') return `<svg viewBox="0 0 24 24"><rect x="3" y="2" width="18" height="20" rx="2"/><path d="M7 8h3M7 12h5M7 16h5"/></svg>`;
    if (cls === 'image') return `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    if (cls === 'word') return `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2-4 2 4"/></svg>`;
    if (cls === 'excel') return `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>`;
    if (cls === 'archive') return `<svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
    return `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  }

  _updateDocCount(delta) {
    const badge = document.getElementById('np-doc-count');
    if (!badge) return;
    const next = (parseInt(badge.textContent || '0', 10)) + delta;
    badge.textContent = next > 0 ? String(next) : '';
  }

  // ── Anotações (contagem) ──────────────────────────────────────

  _updateNotaCount(delta) {
    const badge = document.getElementById('np-nota-count');
    if (!badge) return;
    const current = parseInt(badge.textContent || '0', 10);
    const next = current + delta;
    badge.textContent = next > 0 ? String(next) : '';
  }

  _notaHTML(a) {
    const raw = a.nota || '';
    const texto = raw.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const isLong = raw.length > 200;
    const safeText = raw.replace(/"/g, '&quot;');
    const dateFmt = this._fmtNoteDate(a.criado_em);
    return `
      <div class="np-nota-item${isLong ? ' np-nota-item--collapsible' : ''}"
           id="np-nota-${a.notacao_id}"
           data-nota-id="${a.notacao_id}"
           data-nota-text="${safeText}">
        <div class="np-nota-texto">${texto}</div>
        ${isLong ? `<button class="np-nota-expand-btn">Ver mais ↓</button>` : ''}
        ${dateFmt ? `<time class="np-nota-date">${dateFmt}</time>` : ''}
        <button class="np-nota-edit-btn" title="Editar anotação">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>`;
  }

  // ── Helpers ───────────────────────────────────────────────────

  _infoItem(label, value, icon) {
    const icons = {
      phone: `<circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c.27 6.44 4.25 10.42 10.69 10.69M8.56 2.75L3 8.31A18.44 18.44 0 0 0 14.69 20l5.56-5.56"/>`,
      mail: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
      'map-pin': `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
      tag: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
      calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
      clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
      'check-circle': `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
      'alert-circle': `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
    };
    if (!value) return '';
    return `
      <div class="np-info-item">
        <div class="np-info-label">
          <svg viewBox="0 0 24 24">${icons[icon] || ''}</svg>
          ${label}
        </div>
        <div class="np-info-value">${value}</div>
      </div>`;
  }

  _taskHTML(t) {
    const done = t.tarefa_status;
    const venc = this._fmtDate(t.tarefa_vencimento);
    const overdue = !done && t.tarefa_vencimento && new Date(t.tarefa_vencimento) < new Date();
    const tituloEsc = (t.tarefa_titulo || '').replace(/"/g, '&quot;');
    return `
      <div class="np-task${done ? ' np-task--done' : ''}${overdue ? ' np-task--overdue' : ''}" id="np-task-${t.tarefa_id}">
        <div class="np-task-check${!done ? ' np-task-check--pending' : ''}"
             ${!done ? `data-tarefa-id="${t.tarefa_id}" data-tarefa-titulo="${tituloEsc}" title="Clique para concluir"` : ''}
        >${done ? '✓' : ''}</div>
        <div class="np-task-info">
          <div class="np-task-title">${t.tarefa_titulo}</div>
          ${t.tarefa_descricao ? `<div class="np-task-desc">${t.tarefa_descricao}</div>` : ''}
          ${venc ? `<div class="np-task-venc${overdue ? ' np-task-venc--late' : ''}">${overdue ? '⚠ ' : ''}${venc}</div>` : ''}
        </div>
      </div>`;
  }

  _fmtNoteDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHrs < 24) return `há ${diffHrs}h`;
    if (diffDays === 1) return 'ontem';
    if (diffDays < 7) return `há ${diffDays} dias`;

    // Mais de 7 dias: "24 abr" ou "24 abr 2024" se ano diferente
    const opts = { day: '2-digit', month: 'short' };
    if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('pt-BR', opts).replace('.', '');
  }

  _fmtDate(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  // ── Data de Recontato ─────────────────────────────────────────

  _recontadoBadgePanel(raw) {
    if (!raw) return '<p class="np-recontado-none">Nenhuma data definida</p>';
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d     = new Date(raw);
    const dDay  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let cls = '', label = '';
    if (dDay < today) {
      cls   = 'np-recontado-badge--overdue';
      label = `⚠ Vencido — ${this._fmtDate(raw)}`;
    } else if (dDay.getTime() === today.getTime()) {
      cls   = 'np-recontado-badge--today';
      label = `🔔 Hoje`;
    } else {
      cls   = 'np-recontado-badge--future';
      label = `📅 ${this._fmtDate(raw)}`;
    }
    return `<span class="np-recontado-badge ${cls}">${label}</span>`;
  }

  _bindRecontadoForm(negocioId) {
    const input   = document.getElementById('np-recontado-input');
    const saveBtn = document.getElementById('np-recontado-save');
    const editBtn = document.getElementById('np-recontado-edit');
    const field   = document.getElementById('np-recontado-field');
    const actions = document.getElementById('np-recontado-actions');
    const origHTML = saveBtn?.innerHTML;

    const EDIT_HTML   = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar`;
    const CANCEL_HTML = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancelar`;

    // Edit button: toggle field visibility
    editBtn?.addEventListener('click', () => {
      const isEditing = field?.style.display !== 'none';
      if (field)   field.style.display = isEditing ? 'none' : 'flex';
      if (editBtn) editBtn.innerHTML   = isEditing ? EDIT_HTML : CANCEL_HTML;
    });

    saveBtn?.addEventListener('click', async () => {
      const val = input?.value;
      let isoDate = null;
      if (val) {
        const [y, m, d] = val.split('-').map(Number);
        isoDate = new Date(y, m - 1, d, 12, 0, 0).toISOString();
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;animation:spin 0.7s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Salvando…`;

      const { error } = await Negocios.updateRecontado(negocioId, isoDate);
      saveBtn.disabled = false;
      saveBtn.innerHTML = origHTML;

      if (error) {
        console.error('[NegocioPanel] Erro ao salvar recontato:', error);
        saveBtn.classList.add('np-recontado-save--error');
        setTimeout(() => saveBtn.classList.remove('np-recontado-save--error'), 2000);
        return;
      }

      const badgeEl = document.querySelector('.np-recontado-badge, .np-recontado-none');
      if (badgeEl) badgeEl.outerHTML = this._recontadoBadgePanel(isoDate);

      if (isoDate) {
        if (actions) actions.style.display = 'flex';
        if (field)   field.style.display   = 'none';
        if (editBtn) editBtn.innerHTML      = EDIT_HTML;
      } else {
        if (actions) actions.style.display = 'none';
        if (field)   field.style.display   = 'flex';
      }

      saveBtn.classList.add('np-recontado-save--ok');
      setTimeout(() => saveBtn.classList.remove('np-recontado-save--ok'), 1500);
      this._updateKanbanCardRecontado(negocioId, isoDate);
    });

    this._bindClearRecontado(negocioId);
  }

  _bindClearRecontado(negocioId) {
    document.getElementById('np-recontado-clear')?.addEventListener('click', async () => {
      const clearBtn = document.getElementById('np-recontado-clear');
      if (clearBtn) clearBtn.disabled = true;

      const { error } = await Negocios.updateRecontado(negocioId, null);
      if (error) {
        console.error('[NegocioPanel] Erro ao limpar recontato:', error);
        if (clearBtn) clearBtn.disabled = false;
        return;
      }

      const input = document.getElementById('np-recontado-input');
      if (input) input.value = '';

      const badgeEl = document.querySelector('.np-recontado-badge, .np-recontado-none');
      if (badgeEl) badgeEl.outerHTML = '<p class="np-recontado-none">Nenhuma data definida</p>';

      clearBtn?.remove();
      this._updateKanbanCardRecontado(negocioId, null);
    });
  }

  // ── Valor do Negócio ────────────────────────────────────────

  _bindValorField(negocioId) {
    const display   = document.getElementById('np-valor-display');
    const editBtn   = document.getElementById('np-valor-edit-btn');
    const field     = document.getElementById('np-valor-field');
    const input     = document.getElementById('np-valor-input');
    const saveBtn   = document.getElementById('np-valor-save-btn');
    const cancelBtn = document.getElementById('np-valor-cancel-btn');
    const wrap      = display?.closest('.np-valor-wrap');

    const _fmt = v =>
      v != null
        ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : null;

    // Substitui o display por <span> com valor formatado (usado após salvar)
    const _setDisplay = (val) => {
      if (!wrap) return;
      const existing = document.getElementById('np-valor-display');
      if (val != null) {
        // Se era o badge vazio, troca por span
        if (existing?.classList.contains('np-valor-empty')) {
          const span = document.createElement('span');
          span.className = 'np-valor';
          span.id = 'np-valor-display';
          span.textContent = _fmt(val);
          existing.replaceWith(span);
          if (editBtn) editBtn.style.display = '';
        } else if (existing) {
          existing.textContent = _fmt(val);
        }
      } else {
        // Volta para badge vazio
        if (existing && !existing.classList.contains('np-valor-empty')) {
          const btn = document.createElement('button');
          btn.className = 'np-valor-empty';
          btn.id = 'np-valor-display';
          btn.title = 'Adicionar valor do negócio';
          btn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Adicionar valor`;
          btn.addEventListener('click', _openField);
          existing.replaceWith(btn);
          if (editBtn) editBtn.style.display = 'none';
        }
      }
    };

    const _openField = () => {
      const d = document.getElementById('np-valor-display');
      if (d) d.style.display = 'none';
      if (editBtn) editBtn.style.display = 'none';
      if (field)   field.style.display   = 'flex';
      input?.focus();
      input?.select();
    };

    // Badge vazio também abre o campo
    if (display?.classList.contains('np-valor-empty')) {
      display.addEventListener('click', _openField);
    }

    // Cancelar
    cancelBtn?.addEventListener('click', () => {
      if (field) field.style.display = 'none';
      const d = document.getElementById('np-valor-display');
      if (d) d.style.display = '';
      if (editBtn && !d?.classList.contains('np-valor-empty')) editBtn.style.display = '';
    });

    // Salvar
    const _save = async () => {
      const raw   = input?.value.trim();
      const valor = raw !== '' ? parseFloat(raw) : null;

      if (raw !== '' && (isNaN(valor) || valor < 0)) {
        input?.classList.add('np-valor-input--error');
        setTimeout(() => input?.classList.remove('np-valor-input--error'), 1500);
        return;
      }

      if (saveBtn) saveBtn.disabled = true;

      const { error } = await Negocios.updateValor(negocioId, valor);

      if (saveBtn) saveBtn.disabled = false;

      if (error) {
        console.error('[NegocioPanel] Erro ao salvar valor:', error);
        input?.classList.add('np-valor-input--error');
        setTimeout(() => input?.classList.remove('np-valor-input--error'), 2000);
        return;
      }

      // Fecha o campo
      if (field) field.style.display = 'none';

      // Troca badge ↔ span conforme novo valor
      _setDisplay(valor);

      // Atualiza card no kanban se estiver visível
      const cardEl = document.getElementById(`opp-${negocioId}`);
      if (cardEl) {
        const valEl = cardEl.querySelector('.opp-valor');
        if (valEl) valEl.textContent = valor != null ? _fmt(valor) : '';
      }
    };

    saveBtn?.addEventListener('click', _save);
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter')  _save();
      if (e.key === 'Escape') cancelBtn?.click();
    });

    // Botão lápis (quando já tem valor)
    editBtn?.addEventListener('click', _openField);
  }

  // ── Faturamento ───────────────────────────────────────────

  _bindFaturamentoField(negocioId) {
    const saveBtn  = document.getElementById('np-faturamento-save');
    const input    = document.getElementById('np-faturamento-input');
    const editBtn  = document.getElementById('np-faturamento-edit');
    const clearBtn = document.getElementById('np-faturamento-clear');
    const field    = document.getElementById('np-faturamento-field');
    const actions  = document.getElementById('np-faturamento-actions');
    const valorEl  = document.getElementById('np-faturamento-valor');

    const EDIT_HTML   = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar`;
    const CANCEL_HTML = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancelar`;

    // Edit button: toggle field visibility
    editBtn?.addEventListener('click', () => {
      const isEditing = field?.style.display !== 'none';
      if (field)   field.style.display = isEditing ? 'none' : 'flex';
      if (editBtn) editBtn.innerHTML   = isEditing ? EDIT_HTML : CANCEL_HTML;
    });

    // Salvar
    saveBtn?.addEventListener('click', async () => {
      const raw = input?.value.trim();
      const valor = raw !== '' ? parseFloat(raw) : null;

      if (raw !== '' && (isNaN(valor) || valor < 0)) {
        input?.classList.add('np-faturamento-input--error');
        setTimeout(() => input?.classList.remove('np-faturamento-input--error'), 1500);
        return;
      }

      saveBtn.disabled = true;
      saveBtn.classList.add('np-faturamento-save--loading');

      const { error } = await Negocios.updateFaturamento(negocioId, valor);
      saveBtn.disabled = false;
      saveBtn.classList.remove('np-faturamento-save--loading');

      if (error) {
        console.error('[NegocioPanel] Erro ao salvar faturamento:', error);
        saveBtn.classList.add('np-faturamento-save--error');
        setTimeout(() => saveBtn.classList.remove('np-faturamento-save--error'), 2000);
        return;
      }

      // Atualiza display
      if (valorEl) {
        valorEl.textContent = valor != null
          ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '—';
      }

      if (valor != null) {
        // Tem valor: mostra actions, esconde field, reseta btn editar
        if (actions) actions.style.display = 'flex';
        if (field)   field.style.display   = 'none';
        if (editBtn) editBtn.innerHTML      = EDIT_HTML;
      } else {
        // Limpou pelo campo vazio: esconde actions, mostra field
        if (actions) actions.style.display = 'none';
        if (field)   field.style.display   = 'flex';
      }

      saveBtn.classList.add('np-faturamento-save--ok');
      setTimeout(() => saveBtn.classList.remove('np-faturamento-save--ok'), 1800);
    });

    // Enter no input = salvar
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn?.click();
    });

    // Limpar
    clearBtn?.addEventListener('click', async () => {
      clearBtn.disabled = true;
      const { error } = await Negocios.updateFaturamento(negocioId, null);
      if (error) {
        console.error('[NegocioPanel] Erro ao limpar faturamento:', error);
        clearBtn.disabled = false;
        return;
      }
      if (input)   input.value = '';
      if (valorEl) valorEl.textContent = '—';
      // Estado vazio: esconde actions, mostra field
      if (actions) actions.style.display = 'none';
      if (field)   field.style.display   = 'flex';
      clearBtn.disabled = false;
    });
  }


  _updateKanbanCardRecontado(negocioId, isoDate) {
    const cardEl = document.getElementById(`opp-${negocioId}`);
    if (!cardEl) return;
    const existing = cardEl.querySelector('.opp-recontado-row');
    if (!isoDate) { existing?.remove(); return; }

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d     = new Date(isoDate);
    const dDay  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const fmt   = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    let mod = '', label = '';
    if (dDay < today)                              { mod = 'opp-recontado--overdue'; label = `⚠ Recontato: ${fmt}`; }
    else if (dDay.getTime() === today.getTime())   { mod = 'opp-recontado--today';   label = `🔔 Recontato: Hoje`; }
    else                                           { mod = 'opp-recontado--future';  label = `📅 Recontato: ${fmt}`; }

    const html = `<div class="opp-recontado-row"><span class="opp-recontado ${mod}">${label}</span></div>`;
    if (existing) { existing.outerHTML = html; }
    else {
      const statusRow = cardEl.querySelector('.opp-status-row');
      if (statusRow) statusRow.insertAdjacentHTML('afterend', html);
    }
  }

  _renderError() {
    const el = document.getElementById('np-content');
    if (el) el.innerHTML = `<div class="np-error">Erro ao carregar o negócio.</div>`;
  }
}
