/**
 * configuracoes.js — Página de Configurações do CRM Visi Marketing
 * Seções: [Admin] Cadastro de Novo Usuário
 */

import UserStore    from '../js/userStore.js';
import { supabase } from '../js/supabase.js';
import { Pipelines, EtapasPipeline, MotivosPerdas } from '../js/db.js';

// Bucket de avatares
const AVATAR_BUCKET = 'visi-marketing';

export default {
  render() {
    const isAdmin = UserStore.isAdmin();
    return `
      <div class="page-header">
        <div class="page-title-block">
          <h1>Configurações</h1>
          <p>Gerencie preferências, usuários e configurações gerais do sistema</p>
        </div>
      </div>

      <div class="config-layout">
        <aside class="config-nav" id="config-nav">
          <div class="config-nav-group">
            <span class="config-nav-label">Administração</span>
            ${isAdmin ? `
            <button class="config-nav-item active" data-section="novo-usuario" id="config-nav-novo-usuario">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Novo Usuário
            </button>
            <button class="config-nav-item" data-section="funil" id="config-nav-funil">
              <svg viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Funil
            </button>` : `
            <div class="config-nav-empty">
              <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Sem permissão
            </div>`}
          </div>
          <div class="config-nav-group">
            <span class="config-nav-label">Geral</span>
            <button class="config-nav-item" data-section="motivos-perda" id="config-nav-motivos-perda">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Motivos de Perda
            </button>
          </div>
        </aside>

        <div class="config-content" id="config-content">
          ${isAdmin
            ? _renderSectionNovoUsuario() + _renderSectionFunil() + _renderSectionMotivosPerdas()
            : _renderSectionAcessoNegado() + _renderSectionMotivosPerdas()}
        </div>
      </div>

      <!-- ══ POPUP DE SUCESSO ══════════════════════════════════════ -->
      <div class="nu-popup-overlay" id="nu-popup-overlay" aria-hidden="true">
        <div class="nu-popup" id="nu-popup" role="dialog" aria-modal="true">
          <div class="nu-popup-icon">
            <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3 class="nu-popup-title">Usuário Criado!</h3>
          <p class="nu-popup-desc" id="nu-popup-desc">O novo usuário foi cadastrado com sucesso no sistema.</p>
          <button class="btn btn-cyan nu-popup-close" id="btn-nu-popup-close">Fechar</button>
        </div>
      </div>
    `;
  },

  onMount() {
    _bindEvents();
  },

  onDestroy() {},
};

// ── HTML das seções ────────────────────────────────────────────────

function _renderSectionNovoUsuario() {
  return `
    <section class="config-section active" id="section-novo-usuario">
      <div class="config-section-header">
        <div class="config-section-icon config-section-icon--admin">
          <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <div>
          <h2 class="config-section-title">Cadastro de Novo Usuário</h2>
          <p class="config-section-desc">Crie um novo acesso ao CRM. O usuário receberá as credenciais para entrar no sistema.</p>
        </div>
        <span class="config-admin-badge">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Somente Administradores
        </span>
      </div>

      <div class="config-card">
        <form class="config-form" id="form-novo-usuario" novalidate>

          <!-- Row 1: Nome + E-mail -->
          <div class="config-form-row">
            <div class="config-field">
              <label class="config-label" for="nu-nome">Nome Completo <span class="config-required">*</span></label>
              <div class="config-input-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" id="nu-nome" name="user_nome" class="config-input" placeholder="Ex: João da Silva" required />
              </div>
            </div>
            <div class="config-field">
              <label class="config-label" for="nu-email">E-mail <span class="config-required">*</span></label>
              <div class="config-input-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input type="email" id="nu-email" name="user_email" class="config-input" placeholder="joao@empresa.com" required />
              </div>
            </div>
          </div>

          <!-- Row 2: Telefone + Cargo -->
          <div class="config-form-row">
            <div class="config-field">
              <label class="config-label" for="nu-telefone">Telefone</label>
              <div class="config-input-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.56 3.44 2 2 0 0 1 3.53 1.25h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.74a16 16 0 0 0 6 6l.88-.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 16.92z"/></svg>
                <input type="tel" id="nu-telefone" name="user_telefone" class="config-input" placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div class="config-field">
              <label class="config-label" for="nu-cargo">Cargo <span class="config-required">*</span></label>
              <div class="config-input-wrap config-select-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                <select id="nu-cargo" name="user_cargo" class="config-input config-select" required>
                  <option value="" disabled selected>Selecione o cargo</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Operações">Operações</option>
                </select>
                <svg class="config-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </div>

          <!-- Row 3: Status + Avatar (file) -->
          <div class="config-form-row">
            <div class="config-field">
              <label class="config-label" for="nu-status">Status <span class="config-required">*</span></label>
              <div class="config-input-wrap config-select-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <select id="nu-status" name="user_status" class="config-input config-select" required>
                  <option value="Ativo" selected>Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
                <svg class="config-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="config-field">
              <label class="config-label" for="nu-avatar">
                Foto de Perfil
                <span class="config-hint">Opcional — JPG, PNG, WEBP</span>
              </label>
              <label class="config-file-label" id="nu-avatar-label" for="nu-avatar">
                <div class="config-file-preview" id="nu-avatar-preview">
                  <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div class="config-file-info">
                  <span class="config-file-name" id="nu-avatar-name">Clique para selecionar</span>
                  <span class="config-file-sub">ou arraste uma imagem aqui</span>
                </div>
                <input type="file" id="nu-avatar" name="user_avatar" accept="image/jpeg,image/png,image/webp,image/gif" class="config-file-input" />
              </label>
            </div>
          </div>

          <!-- Divider -->
          <div class="config-form-divider"><span>Credenciais de Acesso</span></div>

          <!-- Row 4: Senha + Confirmar -->
          <div class="config-form-row">
            <div class="config-field">
              <label class="config-label" for="nu-senha">Senha <span class="config-required">*</span></label>
              <div class="config-input-wrap config-password-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input type="password" id="nu-senha" name="user_senha" class="config-input" placeholder="Mínimo 8 caracteres" minlength="8" required />
                <button type="button" class="config-toggle-password" data-target="nu-senha" title="Mostrar/ocultar senha">
                  <svg viewBox="0 0 24 24" class="icon-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            <div class="config-field">
              <label class="config-label" for="nu-confirmar-senha">Confirmar Senha <span class="config-required">*</span></label>
              <div class="config-input-wrap config-password-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input type="password" id="nu-confirmar-senha" name="user_confirmar_senha" class="config-input" placeholder="Repita a senha" minlength="8" required />
                <button type="button" class="config-toggle-password" data-target="nu-confirmar-senha" title="Mostrar/ocultar senha">
                  <svg viewBox="0 0 24 24" class="icon-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Feedback -->
          <div class="config-form-feedback" id="nu-feedback" aria-live="polite"></div>

          <!-- Actions -->
          <div class="config-form-actions">
            <button type="reset" class="btn btn-ghost" id="btn-nu-limpar">
              <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              Limpar Campos
            </button>
            <button type="submit" class="btn btn-cyan" id="btn-nu-salvar">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Criar Usuário
            </button>
          </div>

        </form>
      </div>
    </section>
  `;
}

function _renderSectionAcessoNegado() {
  return `
    <section class="config-section active" id="section-acesso-negado">
      <div class="config-acesso-negado">
        <div class="config-lock-icon">
          <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2>Acesso Restrito</h2>
        <p>Esta seção é exclusiva para usuários com cargo <strong>Administrador</strong>. Fale com o seu gestor para obter acesso.</p>
      </div>
    </section>
  `;
}

function _renderSectionFunil() {
  return `
    <section class="config-section" id="section-funil">
      <div class="config-section-header">
        <div class="config-section-icon config-section-icon--admin">
          <svg viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        </div>
        <div>
          <h2 class="config-section-title">Gerenciar Funis</h2>
          <p class="config-section-desc">Crie, edite e organize os funis de venda e suas etapas.</p>
        </div>
        <span class="config-admin-badge">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Somente Administradores
        </span>
      </div>

      <div id="funil-loading" class="funil-loading">
        <div class="funil-spinner"></div>
        Carregando funis...
      </div>

      <div id="funil-list" class="funil-list" style="display:none"></div>

      <div class="funil-add-wrap" id="funil-add-wrap" style="display:none">
        <form id="funil-new-form" class="funil-new-form">
          <div class="funil-new-fields">
            <input id="funil-new-nome" class="config-input" type="text" placeholder="Nome do funil" required />
            <div class="config-input-wrap config-select-wrap" style="min-width:160px">
              <select id="funil-new-vis" class="config-input config-select">
                <option value="Comercial">Comercial</option>
                <option value="Operações">Operações</option>
                <option value="Ambos">Ambos</option>
              </select>
              <svg class="config-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <button type="submit" class="btn btn-cyan" style="white-space:nowrap">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Criar Funil
            </button>
            <button type="button" id="funil-new-cancel" class="btn btn-ghost">Cancelar</button>
          </div>
        </form>
      </div>

      <button id="funil-add-btn" class="funil-add-btn" style="display:none">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Novo Funil
      </button>
    </section>
  `;
}

// ── Motivos de Perda ──────────────────────────────────────────────

function _renderSectionMotivosPerdas() {
  return `
    <section class="config-section" id="section-motivos-perda">
      <div class="config-section-header">
        <div class="config-section-icon" style="background:#FEF3C7">
          <svg viewBox="0 0 24 24" style="stroke:#D97706"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <h2 class="config-section-title">Motivos de Perda</h2>
          <p class="config-section-desc">Gerencie os motivos que podem ser registrados ao perder um neg\u00f3cio.</p>
        </div>
      </div>

      <div id="mp-loading" class="funil-loading">
        <div class="funil-spinner"></div>
        Carregando motivos...
      </div>

      <div class="config-card" id="mp-card" style="display:none">
        <div class="mp-list" id="mp-list"></div>

        <div class="mp-add-row" id="mp-add-row">
          <form id="mp-form" class="mp-form">
            <input id="mp-input" class="config-input" type="text" placeholder="Novo motivo de perda..." required />
            <button type="submit" class="btn btn-cyan mp-submit">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Adicionar
            </button>
          </form>
        </div>
      </div>
    </section>
  `;
}

let _motivosLoaded = false;

async function _loadMotivos() {
  if (_motivosLoaded) return;
  _motivosLoaded = true;

  const loading = document.getElementById('mp-loading');
  const card    = document.getElementById('mp-card');
  const listEl  = document.getElementById('mp-list');

  const { data: motivos, error } = await MotivosPerdas.getAllComStatus();
  if (error) {
    if (loading) loading.textContent = '❌ Erro ao carregar motivos.';
    return;
  }

  if (loading) loading.style.display = 'none';
  if (card)   card.style.display = 'block';
  if (listEl) listEl.innerHTML = _renderMotivosList(motivos || []);

  _bindMotivosActions(motivos || []);
}

function _renderMotivosList(motivos) {
  if (!motivos.length) {
    return `<div class="mp-empty">Nenhum motivo cadastrado ainda.</div>`;
  }
  return motivos.map(m => _renderMotivoItem(m)).join('');
}

function _renderMotivoItem(m) {
  return `
    <div class="mp-item ${m.motivo_status ? '' : 'mp-item--inativo'}" data-motivo-id="${m.motivo_id}" id="mp-item-${m.motivo_id}">
      <div class="mp-item-left">
        <span class="mp-item-desc">${m.motivo_descricao}</span>
        ${!m.motivo_status ? '<span class="mp-badge-inativo">Inativo</span>' : ''}
      </div>
      <div class="mp-item-actions">
        <button class="funil-action-btn" data-action="mp-edit" data-motivo-id="${m.motivo_id}" title="Renomear">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="funil-action-btn funil-action-btn--status" data-action="mp-toggle" data-motivo-id="${m.motivo_id}" data-status="${m.motivo_status}" title="${m.motivo_status ? 'Desativar' : 'Ativar'}">
          <svg viewBox="0 0 24 24">${m.motivo_status
            ? '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'
            : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
          </svg>
        </button>
      </div>
    </div>`;
}

function _bindMotivosActions(motivosArr) {
  const listEl = document.getElementById('mp-list');
  const form   = document.getElementById('mp-form');

  // Delegação de cliques na lista
  listEl?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const mid    = parseInt(btn.dataset.motivoId);

    // ── Renomear ──
    if (action === 'mp-edit') {
      const item   = document.getElementById(`mp-item-${mid}`);
      const descEl = item?.querySelector('.mp-item-desc');
      const atual  = descEl?.textContent.trim();
      const novo   = prompt('Novo nome do motivo:', atual);
      if (!novo || novo === atual) return;
      const { error } = await MotivosPerdas.update(mid, { motivo_descricao: novo });
      if (error) { alert('Erro: ' + error.message); return; }
      if (descEl) descEl.textContent = novo;
    }

    // ── Toggle ativo/inativo ──
    if (action === 'mp-toggle') {
      const novoStatus = !(btn.dataset.status === 'true');
      const { error } = await MotivosPerdas.update(mid, { motivo_status: novoStatus });
      if (error) { alert('Erro: ' + error.message); return; }
      // Re-renderiza o item
      const item = document.getElementById(`mp-item-${mid}`);
      const motivo = motivosArr.find(m => m.motivo_id === mid);
      if (motivo) {
        motivo.motivo_status = novoStatus;
        item?.outerHTML; // substitui
        item.outerHTML = _renderMotivoItem(motivo);
      }
    }
  });

  // Criar novo motivo
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('mp-input');
    const desc  = input?.value.trim();
    if (!desc) return;

    const submitBtn = form.querySelector('[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    const { data: novo, error } = await MotivosPerdas.create(desc);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar';

    if (error) { alert('Erro: ' + error.message); return; }

    motivosArr.push(novo);
    const emptyEl = listEl?.querySelector('.mp-empty');
    if (emptyEl) emptyEl.remove();
    listEl?.insertAdjacentHTML('beforeend', _renderMotivoItem(novo));
    if (input) input.value = '';
  });
}

// ── Funil Manager ──────────────────────────────────────────────────

let _funilLoaded = false;

async function _loadFunil() {
  if (_funilLoaded) return;
  _funilLoaded = true;

  const loading = document.getElementById('funil-loading');
  const list    = document.getElementById('funil-list');
  const addBtn  = document.getElementById('funil-add-btn');

  const { data: pipelines, error } = await Pipelines.getAll();
  if (error) {
    if (loading) loading.textContent = '❌ Erro ao carregar funis.';
    return;
  }

  // Busca etapas de todos os funis em paralelo
  const etapasMap = {};
  await Promise.all((pipelines || []).map(async p => {
    const { data } = await EtapasPipeline.getByPipeline(p.pipeline_id);
    etapasMap[p.pipeline_id] = data || [];
  }));

  if (loading) loading.style.display = 'none';
  if (list)   { list.style.display = 'flex'; list.innerHTML = _renderFunilList(pipelines || [], etapasMap); }
  if (addBtn) addBtn.style.display = 'inline-flex';

  _bindFunilActions(etapasMap);
}

function _renderFunilList(pipelines, etapasMap) {
  if (!pipelines.length) return `<div class="funil-empty">Nenhum funil cadastrado ainda.</div>`;
  return pipelines.map(p => _renderPipelineCard(p, etapasMap[p.pipeline_id] || [])).join('');
}

function _renderPipelineCard(p, etapas) {
  const statusCls = p.pipeline_status ? 'funil-status--ativo' : 'funil-status--inativo';
  const statusTxt = p.pipeline_status ? 'Ativo' : 'Inativo';
  const visCls = { Comercial: 'vis--comercial', 'Operações': 'vis--operacoes', Ambos: 'vis--ambos' }[p.funil_visualizacao] || '';

  const etapasHtml = etapas.length
    ? etapas.map((e, idx) => `
        <div class="funil-etapa" data-etapa-id="${e.etapa_id}" data-pipeline-id="${p.pipeline_id}">
          <span class="funil-etapa-ordem">${e.etapa_ordem}</span>
          <span class="funil-etapa-nome" data-field="nome">${e.etapa_nome}</span>
          <div class="funil-etapa-actions">
            <button class="funil-etapa-btn" data-action="etapa-up" data-etapa-id="${e.etapa_id}" data-pipeline-id="${p.pipeline_id}" title="Subir" ${idx === 0 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="funil-etapa-btn" data-action="etapa-down" data-etapa-id="${e.etapa_id}" data-pipeline-id="${p.pipeline_id}" title="Descer" ${idx === etapas.length - 1 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="funil-etapa-btn funil-etapa-btn--edit" data-action="etapa-edit" data-etapa-id="${e.etapa_id}" title="Renomear">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="funil-etapa-btn funil-etapa-btn--del" data-action="etapa-del" data-etapa-id="${e.etapa_id}" data-pipeline-id="${p.pipeline_id}" title="Excluir etapa">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>`).join('')
    : `<div class="funil-etapa-empty">Nenhuma etapa. Adicione a primeira abaixo.</div>`;

  return `
    <div class="funil-card" data-pipeline-id="${p.pipeline_id}" id="funil-card-${p.pipeline_id}">
      <div class="funil-card-header">
        <div class="funil-card-left">
          <button class="funil-card-toggle" data-action="toggle-card" data-pipeline-id="${p.pipeline_id}" title="Expandir/Recolher">
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="funil-card-info">
            <span class="funil-card-nome" data-field="nome">${p.pipeline_nome}</span>
            <div class="funil-card-meta">
              <span class="funil-vis-badge ${visCls}">${p.funil_visualizacao}</span>
              <span class="funil-status-badge ${statusCls}">${statusTxt}</span>
              <span class="funil-etapas-count">${etapas.length} etapa${etapas.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div class="funil-card-actions">
          <button class="funil-action-btn" data-action="pipeline-edit" data-pipeline-id="${p.pipeline_id}" title="Editar funil">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="funil-action-btn funil-action-btn--status" data-action="pipeline-toggle-status" data-pipeline-id="${p.pipeline_id}" data-status="${p.pipeline_status}" title="${p.pipeline_status ? 'Desativar' : 'Ativar'}">
            <svg viewBox="0 0 24 24">${p.pipeline_status
              ? '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'
              : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
            </svg>
          </button>
          <button class="funil-action-btn funil-action-btn--del" data-action="pipeline-del" data-pipeline-id="${p.pipeline_id}" title="Excluir funil">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>

      <div class="funil-card-body" id="funil-body-${p.pipeline_id}">
        <div class="funil-etapas-list" id="funil-etapas-${p.pipeline_id}">
          ${etapasHtml}
        </div>
        <form class="funil-etapa-add-form" id="funil-etapa-form-${p.pipeline_id}" data-pipeline-id="${p.pipeline_id}">
          <input class="config-input funil-etapa-input" type="text" placeholder="Nome da nova etapa..." required />
          <button type="submit" class="btn btn-cyan funil-etapa-add-btn">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar Etapa
          </button>
        </form>
      </div>
    </div>`;
}

function _bindFunilActions(etapasMap) {
  const list   = document.getElementById('funil-list');
  const addBtn = document.getElementById('funil-add-btn');
  const addWrap = document.getElementById('funil-add-wrap');
  const newForm = document.getElementById('funil-new-form');
  const cancelBtn = document.getElementById('funil-new-cancel');

  // Botão novo funil
  addBtn?.addEventListener('click', () => {
    addWrap.style.display = 'block';
    addBtn.style.display  = 'none';
    document.getElementById('funil-new-nome')?.focus();
  });
  cancelBtn?.addEventListener('click', () => {
    addWrap.style.display = 'none';
    addBtn.style.display  = 'inline-flex';
    newForm?.reset();
  });

  // Criar novo funil
  newForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const nome = document.getElementById('funil-new-nome')?.value.trim();
    const vis  = document.getElementById('funil-new-vis')?.value;
    if (!nome) return;

    const submitBtn = newForm.querySelector('[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando...';

    const { data: novo, error } = await Pipelines.create(nome, vis);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Criar Funil';

    if (error) { alert('Erro ao criar funil: ' + error.message); return; }

    etapasMap[novo.pipeline_id] = [];
    const cardHtml = _renderPipelineCard(novo, []);
    list.insertAdjacentHTML('beforeend', cardHtml);
    _bindCardActions(novo.pipeline_id, etapasMap);

    addWrap.style.display = 'none';
    addBtn.style.display  = 'inline-flex';
    newForm.reset();
  });

  // Bind em cada card existente
  (list?.querySelectorAll('.funil-card') || []).forEach(card => {
    const pid = parseInt(card.dataset.pipelineId);
    _bindCardActions(pid, etapasMap);
  });
}

function _bindCardActions(pipelineId, etapasMap) {
  const card = document.getElementById(`funil-card-${pipelineId}`);
  if (!card) return;

  // Delegação de eventos no card
  card.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const pid    = parseInt(btn.dataset.pipelineId || pipelineId);
    const eid    = parseInt(btn.dataset.etapaId);

    // ── Toggle expand ──
    if (action === 'toggle-card') {
      const body = document.getElementById(`funil-body-${pid}`);
      const icon = btn.querySelector('svg polyline');
      body?.classList.toggle('funil-card-body--open');
      if (icon) icon.setAttribute('points', body.classList.contains('funil-card-body--open') ? '18 15 12 9 6 15' : '6 9 12 15 18 9');
    }

    // ── Editar pipeline (nome / visualização) ──
    if (action === 'pipeline-edit') {
      const nomeEl = card.querySelector('.funil-card-nome');
      const atual  = nomeEl.textContent.trim();
      const novo   = prompt('Novo nome do funil:', atual);
      if (!novo || novo === atual) return;
      const { error } = await Pipelines.update(pid, { pipeline_nome: novo });
      if (error) { alert('Erro: ' + error.message); return; }
      nomeEl.textContent = novo;
    }

    // ── Toggle status pipeline ──
    if (action === 'pipeline-toggle-status') {
      const novoStatus = !(btn.dataset.status === 'true');
      const { error } = await Pipelines.update(pid, { pipeline_status: novoStatus });
      if (error) { alert('Erro: ' + error.message); return; }

      const badge = card.querySelector('.funil-status-badge');
      if (badge) {
        badge.textContent = novoStatus ? 'Ativo' : 'Inativo';
        badge.className = `funil-status-badge ${novoStatus ? 'funil-status--ativo' : 'funil-status--inativo'}`;
      }
      btn.dataset.status = String(novoStatus);
      btn.title = novoStatus ? 'Desativar' : 'Ativar';
      btn.querySelector('svg').innerHTML = novoStatus
        ? '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'
        : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
    }

    // ── Excluir pipeline ──
    if (action === 'pipeline-del') {
      if (!confirm(`Excluir o funil "${card.querySelector('.funil-card-nome')?.textContent}"? Todas as etapas serão removidas.`)) return;
      const { error } = await Pipelines.delete(pid);
      if (error) { alert('Erro: ' + error.message); return; }
      card.remove();
    }

    // ── Reordenar etapa (subir) ──
    if (action === 'etapa-up') {
      const etapas = etapasMap[pid];
      const idx    = etapas.findIndex(e => e.etapa_id === eid);
      if (idx <= 0) return;
      // Troca de ordem com a anterior
      const [curr, prev] = [etapas[idx], etapas[idx - 1]];
      await Promise.all([
        EtapasPipeline.update(curr.etapa_id, { etapa_ordem: prev.etapa_ordem }),
        EtapasPipeline.update(prev.etapa_id, { etapa_ordem: curr.etapa_ordem }),
      ]);
      [etapas[idx], etapas[idx - 1]] = [{ ...etapas[idx - 1], etapa_ordem: curr.etapa_ordem }, { ...etapas[idx], etapa_ordem: prev.etapa_ordem }];
      etapasMap[pid] = etapas;
      _refreshEtapasList(pid, etapasMap);
    }

    // ── Reordenar etapa (descer) ──
    if (action === 'etapa-down') {
      const etapas = etapasMap[pid];
      const idx    = etapas.findIndex(e => e.etapa_id === eid);
      if (idx >= etapas.length - 1) return;
      const [curr, next] = [etapas[idx], etapas[idx + 1]];
      await Promise.all([
        EtapasPipeline.update(curr.etapa_id, { etapa_ordem: next.etapa_ordem }),
        EtapasPipeline.update(next.etapa_id, { etapa_ordem: curr.etapa_ordem }),
      ]);
      [etapas[idx], etapas[idx + 1]] = [{ ...etapas[idx + 1], etapa_ordem: curr.etapa_ordem }, { ...etapas[idx], etapa_ordem: next.etapa_ordem }];
      etapasMap[pid] = etapas;
      _refreshEtapasList(pid, etapasMap);
    }

    // ── Renomear etapa ──
    if (action === 'etapa-edit') {
      const etapaRow  = btn.closest('.funil-etapa');
      const nomeEl    = etapaRow?.querySelector('.funil-etapa-nome');
      const atual     = nomeEl?.textContent.trim();
      const novo      = prompt('Novo nome da etapa:', atual);
      if (!novo || novo === atual) return;
      const { error } = await EtapasPipeline.update(eid, { etapa_nome: novo });
      if (error) { alert('Erro: ' + error.message); return; }
      if (nomeEl) nomeEl.textContent = novo;
      const etapa = etapasMap[pid]?.find(e => e.etapa_id === eid);
      if (etapa) etapa.etapa_nome = novo;
    }

    // ── Excluir etapa ──
    if (action === 'etapa-del') {
      const etapaRow = btn.closest('.funil-etapa');
      const nome     = etapaRow?.querySelector('.funil-etapa-nome')?.textContent;
      if (!confirm(`Excluir a etapa "${nome}"?`)) return;
      const { error } = await EtapasPipeline.delete(eid);
      if (error) { alert('Erro: ' + error.message); return; }
      etapasMap[pid] = (etapasMap[pid] || []).filter(e => e.etapa_id !== eid);
      _refreshEtapasList(pid, etapasMap);
    }
  });

  // ── Adicionar etapa ──
  const etapaForm = document.getElementById(`funil-etapa-form-${pipelineId}`);
  etapaForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const input = etapaForm.querySelector('.funil-etapa-input');
    const nome  = input?.value.trim();
    if (!nome) return;

    const etapas = etapasMap[pipelineId] || [];
    const novaOrdem = (etapas.length ? Math.max(...etapas.map(e => e.etapa_ordem)) : 0) + 1;

    const submitBtn = etapaForm.querySelector('[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    const { data: nova, error } = await EtapasPipeline.create(pipelineId, nome, novaOrdem);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar Etapa';

    if (error) { alert('Erro: ' + error.message); return; }

    etapasMap[pipelineId] = [...etapas, nova];
    _refreshEtapasList(pipelineId, etapasMap);
    input.value = '';
  });
}

function _refreshEtapasList(pipelineId, etapasMap) {
  const listEl = document.getElementById(`funil-etapas-${pipelineId}`);
  if (!listEl) return;

  const etapas = (etapasMap[pipelineId] || []).sort((a, b) => a.etapa_ordem - b.etapa_ordem);

  // Atualiza contador
  const countEl = document.querySelector(`#funil-card-${pipelineId} .funil-etapas-count`);
  if (countEl) countEl.textContent = `${etapas.length} etapa${etapas.length !== 1 ? 's' : ''}`;

  if (!etapas.length) {
    listEl.innerHTML = `<div class="funil-etapa-empty">Nenhuma etapa. Adicione a primeira abaixo.</div>`;
    return;
  }

  listEl.innerHTML = etapas.map((e, idx) => `
    <div class="funil-etapa" data-etapa-id="${e.etapa_id}" data-pipeline-id="${pipelineId}">
      <span class="funil-etapa-ordem">${e.etapa_ordem}</span>
      <span class="funil-etapa-nome">${e.etapa_nome}</span>
      <div class="funil-etapa-actions">
        <button class="funil-etapa-btn" data-action="etapa-up" data-etapa-id="${e.etapa_id}" data-pipeline-id="${pipelineId}" title="Subir" ${idx === 0 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button class="funil-etapa-btn" data-action="etapa-down" data-etapa-id="${e.etapa_id}" data-pipeline-id="${pipelineId}" title="Descer" ${idx === etapas.length - 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button class="funil-etapa-btn funil-etapa-btn--edit" data-action="etapa-edit" data-etapa-id="${e.etapa_id}" title="Renomear">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="funil-etapa-btn funil-etapa-btn--del" data-action="etapa-del" data-etapa-id="${e.etapa_id}" data-pipeline-id="${pipelineId}" title="Excluir">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

// ── Event binding ──────────────────────────────────────────────────

function _bindEvents() {
  // Navegação entre seções
  document.querySelectorAll('.config-nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.config-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.config-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${section}`)?.classList.add('active');
      if (section === 'funil') _loadFunil();
      if (section === 'motivos-perda') _loadMotivos();
    });
  });

  // Toggle senha
  document.querySelectorAll('.config-toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      const eye = btn.querySelector('.icon-eye');
      if (eye) {
        eye.innerHTML = show
          ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
          : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
      }
    });
  });

  // Preview do avatar
  const avatarInput = document.getElementById('nu-avatar');
  if (avatarInput) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files?.[0];
      const nameEl    = document.getElementById('nu-avatar-name');
      const previewEl = document.getElementById('nu-avatar-preview');
      if (!file) return;
      if (nameEl) nameEl.textContent = file.name;
      if (previewEl) {
        const reader = new FileReader();
        reader.onload = e => {
          previewEl.innerHTML = `<img src="${e.target.result}" alt="preview" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />`;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Drag-and-drop no label do avatar
  const avatarLabel = document.getElementById('nu-avatar-label');
  if (avatarLabel) {
    avatarLabel.addEventListener('dragover', e => { e.preventDefault(); avatarLabel.classList.add('config-file-drag'); });
    avatarLabel.addEventListener('dragleave', () => avatarLabel.classList.remove('config-file-drag'));
    avatarLabel.addEventListener('drop', e => {
      e.preventDefault();
      avatarLabel.classList.remove('config-file-drag');
      const file = e.dataTransfer?.files?.[0];
      if (file && avatarInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        avatarInput.files = dt.files;
        avatarInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // Submit
  const form = document.getElementById('form-novo-usuario');
  if (form) {
    form.addEventListener('submit', e => { e.preventDefault(); _handleSubmit(); });
    form.addEventListener('reset', () => {
      _clearFeedback();
      const nameEl    = document.getElementById('nu-avatar-name');
      const previewEl = document.getElementById('nu-avatar-preview');
      if (nameEl) nameEl.textContent = 'Clique para selecionar';
      if (previewEl) previewEl.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    });
  }

  // Popup close
  const closeBtn = document.getElementById('btn-nu-popup-close');
  const overlay  = document.getElementById('nu-popup-overlay');
  if (closeBtn) closeBtn.addEventListener('click', _closePopup);
  if (overlay)  overlay.addEventListener('click', e => { if (e.target === overlay) _closePopup(); });
}

// ── Lógica principal: criar usuário ───────────────────────────────

async function _handleSubmit() {
  const nome      = document.getElementById('nu-nome')?.value.trim();
  const email     = document.getElementById('nu-email')?.value.trim();
  const telefone  = document.getElementById('nu-telefone')?.value.trim();
  const cargo     = document.getElementById('nu-cargo')?.value;
  const status    = document.getElementById('nu-status')?.value;
  const senha     = document.getElementById('nu-senha')?.value;
  const confirma  = document.getElementById('nu-confirmar-senha')?.value;
  const avatarFile = document.getElementById('nu-avatar')?.files?.[0] ?? null;

  // Validações
  if (!nome || !email || !cargo || !senha) {
    return _showFeedback('error', 'Preencha todos os campos obrigatórios.');
  }
  if (senha.length < 8) {
    return _showFeedback('error', 'A senha deve ter pelo menos 8 caracteres.');
  }
  if (senha !== confirma) {
    return _showFeedback('error', 'As senhas não coincidem.');
  }

  _setLoading(true);
  _clearFeedback();

  try {
    // 1. Salvar sessão do admin atual para restaurar depois
    const { data: sessionData } = await supabase.auth.getSession();
    const adminSession = sessionData?.session;

    // 2. Criar usuário no Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: window.location.origin + '/login.html' },
    });

    if (signUpError) {
      throw new Error(signUpError.message);
    }

    const newUserId = signUpData?.user?.id;
    if (!newUserId) {
      throw new Error('Não foi possível obter o ID do novo usuário.');
    }

    // 3. Restaurar sessão do admin imediatamente (evita login automático no novo user)
    if (adminSession) {
      await supabase.auth.setSession({
        access_token:  adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }

    // 4. Upload do avatar (se selecionado)
    let avatarUrl = null;
    if (avatarFile) {
      const ext      = avatarFile.name.split('.').pop();
      const filePath = `avatars/${newUserId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, avatarFile, { upsert: true, contentType: avatarFile.type });

      if (uploadError) {
        console.warn('[Configurações] Erro no upload do avatar:', uploadError.message);
        // Não bloqueia — continua sem avatar
      } else {
        const { data: urlData } = supabase.storage
          .from(AVATAR_BUCKET)
          .getPublicUrl(filePath);
        avatarUrl = urlData?.publicUrl ?? null;
      }
    }

    // 5. Atualizar perfil na tabela `usuarios`
    // O trigger do Supabase Auth já cria a linha automaticamente ao fazer signUp.
    // Por isso usamos UPDATE (não INSERT) para preencher os campos faltantes.
    // Aguardamos 400ms para garantir que o trigger já executou antes do update.
    await new Promise(r => setTimeout(r, 400));

    const now = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00';
    const { error: dbError } = await supabase
      .from('usuarios')
      .update({
        user_nome:          nome,
        user_email:         email,
        user_telefone:      telefone || null,
        user_cargo:         cargo,
        user_status:        status,
        user_avatar:        avatarUrl,
        ultima_atualizacao: now,
      })
      .eq('user_id', newUserId);

    if (dbError) {
      throw new Error(`Usuário criado no Auth, mas erro ao salvar perfil: ${dbError.message}`);
    }

    // 6. Sucesso! Limpar form e abrir popup
    document.getElementById('form-novo-usuario')?.reset();
    _openPopup(nome);

  } catch (err) {
    console.error('[Configurações] Erro ao criar usuário:', err);
    _showFeedback('error', err.message || 'Erro inesperado. Tente novamente.');
  } finally {
    _setLoading(false);
  }
}

// ── Popup ──────────────────────────────────────────────────────────

function _openPopup(nome) {
  const overlay = document.getElementById('nu-popup-overlay');
  const desc    = document.getElementById('nu-popup-desc');
  if (desc) desc.textContent = `O usuário "${nome}" foi cadastrado com sucesso e já pode acessar o CRM com as credenciais configuradas.`;
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  }
}

function _closePopup() {
  const overlay = document.getElementById('nu-popup-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

// ── Utilidades ─────────────────────────────────────────────────────

function _setLoading(on) {
  const btn = document.getElementById('btn-nu-salvar');
  if (!btn) return;
  btn.disabled = on;
  btn.innerHTML = on
    ? `<svg class="config-spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg> Criando...`
    : `<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> Criar Usuário`;
}

function _showFeedback(type, msg) {
  const el = document.getElementById('nu-feedback');
  if (!el) return;
  const icons = {
    success: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
    error:   `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
    info:    `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,
  };
  el.innerHTML = `
    <div class="config-feedback config-feedback--${type}">
      <svg viewBox="0 0 24 24">${icons[type] || icons.info}</svg>
      <span>${msg}</span>
    </div>`;
}

function _clearFeedback() {
  const el = document.getElementById('nu-feedback');
  if (el) el.innerHTML = '';
}
