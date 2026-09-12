/**
 * configuracoes.js — Página de Configurações do CRM Visi Marketing
 * Seções: [Admin] Cadastro de Novo Usuário
 */

import UserStore    from '../js/userStore.js';
import router       from '../js/router.js';
import { supabase } from '../js/supabase.js';
import { Pipelines, EtapasPipeline, MotivosPerdas, Usuarios, Metas } from '../js/db.js';
import { formatCurrency } from '../js/utils.js';
import { iniciarConexao, getStatus, desconectar } from '../js/googleCalendar.js';

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
          ${isAdmin ? `
          <div class="config-nav-group">
            <span class="config-nav-label">Administração</span>
            <button class="config-nav-item active" data-section="novo-usuario" id="config-nav-novo-usuario">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Novo Usuário
            </button>
            <button class="config-nav-item" data-section="funil" id="config-nav-funil">
              <svg viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Funil
                 <button class="config-nav-item" data-section="usuarios" id="config-nav-usuarios">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Usuários
            </button>
            <button class="config-nav-item" data-section="metas" id="config-nav-metas">
              <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Metas
            </button>
          </div>
          ` : ''}
          <div class="config-nav-group">
            <span class="config-nav-label">Geral</span>
            <button class="config-nav-item${!isAdmin ? ' active' : ''}" data-section="meu-perfil" id="config-nav-meu-perfil">
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Meu Perfil
            </button>
            <button class="config-nav-item" data-section="motivos-perda" id="config-nav-motivos-perda">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Motivos de Perda
            </button>
            <button class="config-nav-item" data-section="integracoes" id="config-nav-integracoes">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Integrações
            </button>
          </div>
        </aside>

        <div class="config-content" id="config-content">
          ${isAdmin
            ? _renderSectionNovoUsuario() + _renderSectionFunil() + _renderSectionUsuarios() + _renderSectionMetas() + _renderSectionMeuPerfil(false) + _renderSectionMotivosPerdas(false) + _renderSectionIntegracoes()
            : _renderSectionMeuPerfil(true) + _renderSectionMotivosPerdas(false) + _renderSectionIntegracoes()}
        </div>
      </div>

      <!-- ══ POPUP DE EDIÇÃO DE USUÁRIO ══════════════════════════════ -->
      <div class="nu-popup-overlay" id="edit-user-modal" aria-hidden="true">
        <div class="nu-popup" role="dialog" aria-modal="true" style="text-align: left; max-width: 500px;">
          <h3 class="nu-popup-title" style="margin-bottom: 20px;">Editar Usuário</h3>
          <form id="edit-user-form">
            <input type="hidden" id="edit-user-id" />
            <div class="config-form-row">
              <div class="config-field">
                <label class="config-label">Nome</label>
                <input type="text" id="edit-user-nome" class="config-input" required />
              </div>
              <div class="config-field">
                <label class="config-label">E-mail</label>
                <input type="email" id="edit-user-email" class="config-input" required />
              </div>
            </div>
            <div class="config-form-row">
              <div class="config-field">
                <label class="config-label">Telefone</label>
                <input type="tel" id="edit-user-telefone" class="config-input" />
              </div>
              <div class="config-field">
                <label class="config-label">Cargo</label>
                <select id="edit-user-cargo" class="config-input" required>
                  <option value="Administrador">Administrador</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Operações">Operações</option>
                </select>
              </div>
            </div>
            <div class="config-form-actions" style="margin-top: 24px; justify-content: flex-end;">
              <button type="button" class="btn btn-ghost" id="btn-edit-user-cancel">Cancelar</button>
              <button type="submit" class="btn btn-cyan" id="btn-edit-user-save">Salvar</button>
            </div>
          </form>
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

      <!-- ══ POPUP DE CADASTRAR/EDITAR META ══════════════════════════════ -->
      <div class="nu-popup-overlay" id="meta-modal" aria-hidden="true">
        <div class="nu-popup" role="dialog" aria-modal="true" style="text-align: left; max-width: 450px;">
          <h3 class="nu-popup-title" id="meta-modal-title" style="margin-bottom: 20px;">Adicionar Meta</h3>
          <form id="meta-modal-form">
            <input type="hidden" id="meta-modal-id" />
            <div class="config-form-row">
              <div class="config-field">
                <label class="config-label" for="meta-modal-mes">Mês <span class="config-required">*</span></label>
                <div class="config-input-wrap config-select-wrap">
                  <select id="meta-modal-mes" class="config-input config-select" required>
                    <option value="0">Janeiro</option>
                    <option value="1">Fevereiro</option>
                    <option value="2">Março</option>
                    <option value="3">Abril</option>
                    <option value="4">Maio</option>
                    <option value="5">Junho</option>
                    <option value="6">Julho</option>
                    <option value="7">Agosto</option>
                    <option value="8">Setembro</option>
                    <option value="9">Outubro</option>
                    <option value="10">Novembro</option>
                    <option value="11">Dezembro</option>
                  </select>
                  <svg class="config-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
              <div class="config-field">
                <label class="config-label" for="meta-modal-ano">Ano <span class="config-required">*</span></label>
                <div class="config-input-wrap config-select-wrap">
                  <select id="meta-modal-ano" class="config-input config-select" required>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                  </select>
                  <svg class="config-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>
            <div class="config-form-row" style="margin-top: 12px;">
              <div class="config-field">
                <label class="config-label" for="meta-modal-valor">Valor da Meta (R$) <span class="config-required">*</span></label>
                <input type="number" step="0.01" id="meta-modal-valor" class="config-input" placeholder="Ex: 100000.00" required />
              </div>
            </div>
            <div class="config-form-actions" style="margin-top: 24px; justify-content: flex-end;">
              <button type="button" class="btn btn-ghost" id="btn-meta-modal-cancel">Cancelar</button>
              <button type="submit" class="btn btn-cyan" id="btn-meta-modal-save">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  onMount() {
    _bindEvents();
    if (!UserStore.isAdmin()) {
      _loadMotivos();
    }
    _handleGoogleRedirect();
  },

  onDestroy() {
    _funilLoaded = false;
    _motivosLoaded = false;
    _usuariosLoaded = false;
    _metasLoaded = false;
  },
};

/**
 * Trata o retorno do fluxo OAuth do Google (redirect do n8n via
 * `#configuracoes/google-conectado` ou `#configuracoes/google-erro`):
 * abre a seção Integrações, mostra feedback e limpa o parâmetro do hash.
 */
function _handleGoogleRedirect() {
  const param = router.currentParam();
  if (param !== 'google-conectado' && param !== 'google-erro' && param !== 'integracoes') return;

  document.querySelectorAll('.config-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('config-nav-integracoes')?.classList.add('active');
  document.querySelectorAll('.config-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-integracoes')?.classList.add('active');

  _loadIntegracoes();

  if (param === 'google-conectado') {
    _showIntegracaoFeedback('success', 'Agenda do Google conectada com sucesso!');
  } else if (param === 'google-erro') {
    _showIntegracaoFeedback('error', 'Não foi possível conectar sua agenda do Google. Tente novamente.');
  }

  if (param !== 'integracoes') router.navigate('configuracoes');
}

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

function _renderSectionMetas() {
  return `
    <section class="config-section" id="section-metas">
      <div class="config-section-header">
        <div class="config-section-icon config-section-icon--admin">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <h2 class="config-section-title">Gerenciar Metas Mensais</h2>
          <p class="config-section-desc">Gerencie as metas globais de faturamento mensal do CRM.</p>
        </div>
        <span class="config-admin-badge">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Somente Administradores
        </span>
      </div>

      <div class="config-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0;">Metas Cadastradas</h3>
          <button id="btn-meta-abrir-modal" class="btn btn-cyan btn-sm" style="height: 32px; padding: 0 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar Meta
          </button>
        </div>

        <div id="meta-loading" class="funil-loading" style="padding: 16px 0;">
          <div class="funil-spinner"></div>
          Carregando metas...
        </div>

        <div id="meta-table-wrapper" style="display:none; margin-top: 16px; overflow-x: auto;">
          <table class="mini-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 10px;">Mês/Ano</th>
                <th style="text-align: left; padding: 10px;">Valor</th>
                <th style="text-align: left; padding: 10px;">Cadastrado em</th>
                <th style="text-align: center; padding: 10px; width: 100px;">Ações</th>
              </tr>
            </thead>
            <tbody id="meta-tbody">
              <!-- Renderizado dinamicamente -->
            </tbody>
          </table>
        </div>
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

// ── Integrações ────────────────────────────────────────────────────

function _renderSectionIntegracoes() {
  return `
    <section class="config-section" id="section-integracoes">
      <div class="config-section-header">
        <div class="config-section-icon" style="background: rgba(26, 206, 238, 0.1); color: var(--cyan);">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div>
          <h2 class="config-section-title">Integrações</h2>
          <p class="config-section-desc">Conecte sua conta do Google para sincronizar sua agenda com o CRM.</p>
        </div>
      </div>

      <div class="config-card">
        <div class="integracao-item">
          <div class="integracao-item-info">
            <div class="integracao-item-icon">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <p class="integracao-item-titulo">Google Calendar</p>
              <p class="integracao-item-status" id="integracao-google-status">Verificando conexão…</p>
            </div>
          </div>
          <button class="btn btn-primary" id="btn-integracao-google" disabled>Verificando…</button>
        </div>
        <div class="config-form-feedback" id="integracao-feedback" aria-live="polite"></div>
      </div>
    </section>
  `;
}

async function _loadIntegracoes() {
  const statusEl = document.getElementById('integracao-google-status');
  const btnEl    = document.getElementById('btn-integracao-google');
  const userId   = UserStore.getUserId();
  if (!statusEl || !btnEl || !userId) return;

  statusEl.textContent = 'Verificando conexão…';
  btnEl.disabled = true;
  btnEl.textContent = 'Verificando…';

  try {
    const { conectado, google_email } = await getStatus(userId);
    _renderIntegracaoEstado(conectado, google_email);
  } catch (err) {
    console.error('[Configurações] Erro ao verificar status do Google Calendar:', err);
    statusEl.textContent = 'Não foi possível verificar a conexão agora.';
    btnEl.disabled = false;
    btnEl.textContent = 'Tentar novamente';
    btnEl.onclick = () => _loadIntegracoes();
  }
}

function _renderIntegracaoEstado(conectado, googleEmail) {
  const statusEl = document.getElementById('integracao-google-status');
  const btnEl    = document.getElementById('btn-integracao-google');
  if (!statusEl || !btnEl) return;

  btnEl.disabled = false;

  if (conectado) {
    statusEl.innerHTML = `<span class="integracao-badge integracao-badge--on">Conectado</span> como ${_esc(googleEmail || '')}`;
    btnEl.textContent = 'Desconectar';
    btnEl.className = 'btn btn-ghost';
    btnEl.onclick = () => _desconectarGoogle();
  } else {
    statusEl.innerHTML = `<span class="integracao-badge integracao-badge--off">Não conectado</span>`;
    btnEl.textContent = 'Conectar com Google';
    btnEl.className = 'btn btn-primary';
    btnEl.onclick = () => _conectarGoogle();
  }
}

async function _conectarGoogle() {
  const btnEl  = document.getElementById('btn-integracao-google');
  const userId = UserStore.getUserId();
  if (!userId || !btnEl) return;

  btnEl.disabled = true;
  btnEl.textContent = 'Redirecionando…';

  try {
    const url = await iniciarConexao(userId);
    window.location.href = url;
  } catch (err) {
    console.error('[Configurações] Erro ao iniciar conexão com o Google:', err);
    btnEl.disabled = false;
    btnEl.textContent = 'Conectar com Google';
    _showIntegracaoFeedback('error', 'Não foi possível iniciar a conexão. Tente novamente.');
  }
}

async function _desconectarGoogle() {
  if (!confirm('Desconectar sua agenda do Google? Você deixará de ver e editar seus eventos pelo CRM até reconectar.')) return;

  const btnEl  = document.getElementById('btn-integracao-google');
  const userId = UserStore.getUserId();
  if (!userId || !btnEl) return;

  btnEl.disabled = true;
  btnEl.textContent = 'Desconectando…';

  try {
    await desconectar(userId);
    _renderIntegracaoEstado(false, null);
    _showIntegracaoFeedback('success', 'Agenda desconectada com sucesso.');
  } catch (err) {
    console.error('[Configurações] Erro ao desconectar Google:', err);
    _renderIntegracaoEstado(true, null);
    _showIntegracaoFeedback('error', 'Não foi possível desconectar agora. Tente novamente.');
  }
}

function _showIntegracaoFeedback(type, msg) {
  const el = document.getElementById('integracao-feedback');
  if (!el) return;
  const icons = {
    success: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
    error:   `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  };
  el.innerHTML = `
    <div class="config-feedback config-feedback--${type}" style="margin-top: 16px;">
      <svg viewBox="0 0 24 24">${icons[type] || icons.success}</svg>
      <span>${msg}</span>
    </div>`;
  setTimeout(() => { el.innerHTML = ''; }, 5000);
}

// ── Motivos de Perda ──────────────────────────────────────────────

function _renderSectionMotivosPerdas(isActive = false) {
  return `
    <section class="config-section${isActive ? ' active' : ''}" id="section-motivos-perda">
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
        <button class="funil-action-btn funil-action-btn--del" data-action="mp-delete" data-motivo-id="${m.motivo_id}" data-motivo-desc="${m.motivo_descricao}" title="Excluir motivo">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
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

    // ── Excluir motivo ──
    if (action === 'mp-delete') {
      const desc = btn.dataset.motivoDesc;
      if (!confirm(`Excluir o motivo "${desc}"? Esta ação não pode ser desfeita.`)) return;
      const { error } = await MotivosPerdas.delete(mid);
      if (error) { alert('Erro: ' + error.message); return; }
      const item = document.getElementById(`mp-item-${mid}`);
      item?.remove();
      motivosArr.splice(motivosArr.findIndex(m => m.motivo_id === mid), 1);
      const listEl2 = document.getElementById('mp-list');
      if (listEl2 && !motivosArr.length) listEl2.innerHTML = `<div class="mp-empty">Nenhum motivo cadastrado ainda.</div>`;
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

// ── Metas Manager ──────────────────────────────────────────────────

let _metasLoaded = false;
let _metasData = [];

async function _loadMetas() {
  if (_metasLoaded) return;
  _metasLoaded = true;

  const loading = document.getElementById('meta-loading');
  const wrapper = document.getElementById('meta-table-wrapper');
  const tbody   = document.getElementById('meta-tbody');

  const { data: metas, error } = await Metas.getAll();
  if (error) {
    if (loading) loading.textContent = '❌ Erro ao carregar metas.';
    return;
  }

  _metasData = metas || [];

  if (loading) loading.style.display = 'none';
  if (wrapper) wrapper.style.display = 'block';
  if (tbody) {
    tbody.innerHTML = _renderMetasTbody(_metasData);
  }

  _bindMetasActions();
}

function _renderMetasTbody(metas) {
  if (!metas.length) {
    return `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;">Nenhuma meta cadastrada ainda.</td></tr>`;
  }

  const formatarMesAno = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[date.getUTCMonth()]}/${date.getUTCFullYear()}`;
  };

  const formatarDataCriado = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return metas.map(m => `
    <tr id="meta-row-${m.meta_id}" style="border-bottom: 1px solid var(--border-light);">
      <td style="padding: 12px 10px; font-weight: 600; color: var(--text-primary);">${formatarMesAno(m.meta_data)}</td>
      <td style="padding: 12px 10px; color: var(--cyan); font-weight: 700;" class="meta-row-valor">${formatCurrency(Number(m.meta_valor) || 0)}</td>
      <td style="padding: 12px 10px; color: var(--text-secondary); font-size: 11px;">${formatarDataCriado(m.criado_em)}</td>
      <td style="padding: 12px 10px; text-align: center;">
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button class="funil-action-btn" data-action="meta-edit" data-meta-id="${m.meta_id}" data-meta-valor="${m.meta_valor}" data-meta-mes="${formatarMesAno(m.meta_data)}" title="Editar Valor">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="funil-action-btn funil-action-btn--del" data-action="meta-delete" data-meta-id="${m.meta_id}" data-meta-mes="${formatarMesAno(m.meta_data)}" title="Excluir Meta">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function _bindMetasActions() {
  const btnAbrirModal = document.getElementById('btn-meta-abrir-modal');
  const modal = document.getElementById('meta-modal');
  const form = document.getElementById('meta-modal-form');
  const cancelBtn = document.getElementById('btn-meta-modal-cancel');
  const tbody = document.getElementById('meta-tbody');

  // Abre modal para ADICIONAR meta
  const novoBtnAbrir = btnAbrirModal?.cloneNode(true);
  if (btnAbrirModal && novoBtnAbrir) {
    btnAbrirModal.parentNode.replaceChild(novoBtnAbrir, btnAbrirModal);
  }

  novoBtnAbrir?.addEventListener('click', () => {
    const modalTitle = document.getElementById('meta-modal-title');
    if (modalTitle) modalTitle.textContent = 'Adicionar Meta';

    const idInput = document.getElementById('meta-modal-id');
    if (idInput) idInput.value = '';

    const mesSelect = document.getElementById('meta-modal-mes');
    const anoSelect = document.getElementById('meta-modal-ano');
    const valorInput = document.getElementById('meta-modal-valor');

    // Inicializa com mês e ano atuais
    const agora = new Date();
    if (mesSelect) mesSelect.value = String(agora.getMonth());
    if (anoSelect) anoSelect.value = String(agora.getFullYear());
    if (valorInput) valorInput.value = '';

    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }
  });

  // Clone do form primeiro (isso clona e limpa os listeners antigos de todos os elementos internos, incluindo o botão Cancelar)
  const novoForm = form?.cloneNode(true);
  if (form && novoForm) {
    form.parentNode.replaceChild(novoForm, form);
  }

  // Agora buscamos o botão cancelar de dentro do form clonado e ativo na tela
  const novoCancelBtn = novoForm?.querySelector('#btn-meta-modal-cancel');
  novoCancelBtn?.addEventListener('click', () => {
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
    novoForm?.reset();
  });

  novoForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const idInput = document.getElementById('meta-modal-id');
    const mesSelect = document.getElementById('meta-modal-mes');
    const anoSelect = document.getElementById('meta-modal-ano');
    const valorInput = document.getElementById('meta-modal-valor');

    if (!mesSelect || !anoSelect || !valorInput) return;

    const metaId = idInput?.value;
    const mesVal = parseInt(mesSelect.value); // 0 a 11
    const anoVal = parseInt(anoSelect.value); // 2025 a 2030
    const valorVal = parseFloat(valorInput.value);

    if (isNaN(mesVal) || isNaN(anoVal) || isNaN(valorVal)) return;

    // Converte para o padrão formatado (primeiro dia do mês selecionado)
    const metaData = new Date(Date.UTC(anoVal, mesVal, 1)).toISOString();

    const saveBtn = document.getElementById('btn-meta-modal-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';
    }

    if (!metaId) {
      // MODO CRIAÇÃO (Adicionar)
      const { data: novaMeta, error } = await Metas.create(metaData, valorVal);

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
      }

      if (error) {
        alert('Erro ao cadastrar meta: ' + error.message);
        return;
      }

      _metasData.unshift(novaMeta);
    } else {
      // MODO EDIÇÃO
      const mid = parseInt(metaId);
      const { data: atualizada, error } = await Metas.update(mid, {
        meta_data: metaData,
        meta_valor: valorVal
      });

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
      }

      if (error) {
        alert('Erro ao atualizar meta: ' + error.message);
        return;
      }

      const idx = _metasData.findIndex(m => m.meta_id === mid);
      if (idx !== -1) {
        _metasData[idx] = atualizada;
      }
    }

    // Ordena localmente
    _metasData.sort((a, b) => new Date(b.meta_data) - new Date(a.meta_data));

    // Atualiza tabela
    const currentTbody = document.getElementById('meta-tbody');
    if (currentTbody) currentTbody.innerHTML = _renderMetasTbody(_metasData);

    // Fecha o modal
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  // Ações de clique na tabela (Editar / Excluir)
  const novoTbody = tbody?.cloneNode(true);
  if (tbody && novoTbody) {
    tbody.parentNode.replaceChild(novoTbody, tbody);
  }

  novoTbody?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const metaId = parseInt(btn.dataset.metaId);
    const metaMes = btn.dataset.metaMes;

    if (action === 'meta-edit') {
      const meta = _metasData.find(m => m.meta_id === metaId);
      if (!meta) return;

      const dateObj = new Date(meta.meta_data);
      const mesVal = dateObj.getUTCMonth();
      const anoVal = dateObj.getUTCFullYear();

      const modalTitle = document.getElementById('meta-modal-title');
      if (modalTitle) modalTitle.textContent = 'Editar Meta';

      const idInput = document.getElementById('meta-modal-id');
      if (idInput) idInput.value = String(metaId);

      const mesSelect = document.getElementById('meta-modal-mes');
      const anoSelect = document.getElementById('meta-modal-ano');
      const valorInput = document.getElementById('meta-modal-valor');

      if (mesSelect) mesSelect.value = String(mesVal);
      if (anoSelect) anoSelect.value = String(anoVal);
      if (valorInput) valorInput.value = String(meta.meta_valor);

      if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
      }
    }

    if (action === 'meta-delete') {
      if (!confirm(`Tem certeza que deseja excluir a meta de ${metaMes}?`)) return;

      const { error } = await Metas.delete(metaId);
      if (error) {
        alert('Erro ao excluir meta: ' + error.message);
        return;
      }

      // Remove localmente
      _metasData = _metasData.filter(m => m.meta_id !== metaId);

      // Remove a linha
      const row = document.getElementById(`meta-row-${metaId}`);
      row?.remove();

      if (!_metasData.length && novoTbody) {
        novoTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;">Nenhuma meta cadastrada ainda.</td></tr>`;
      }
    }
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
      if (section === 'usuarios') _loadUsuarios();
      if (section === 'metas') _loadMetas();
      if (section === 'integracoes') _loadIntegracoes();
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

  _bindMeuPerfilEvents();
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

// ── Seção de Usuários ──────────────────────────────────────────────

function _renderSectionUsuarios() {
  return `
    <section class="config-section" id="section-usuarios">
      <div class="config-section-header">
        <div class="config-section-icon config-section-icon--admin">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div>
          <h2 class="config-section-title">Gerenciar Usuários</h2>
          <p class="config-section-desc">Gerencie informações, cargos e redefina a senha dos usuários do CRM.</p>
        </div>
        <span class="config-admin-badge">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Somente Administradores
        </span>
      </div>

      <div id="usuarios-loading" class="funil-loading">
        <div class="funil-spinner"></div>
        Carregando usuários...
      </div>

      <div class="config-card" id="usuarios-card" style="display:none">
        <div class="mp-list" id="usuarios-list" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>
    </section>
  `;
}

let _usuariosLoaded = false;
let _usuariosData = [];

async function _loadUsuarios() {
  if (_usuariosLoaded) return;
  _usuariosLoaded = true;

  const loading = document.getElementById('usuarios-loading');
  const card    = document.getElementById('usuarios-card');
  const listEl  = document.getElementById('usuarios-list');

  const { data: usuarios, error } = await Usuarios.getAll();
  if (error) {
    if (loading) loading.textContent = '❌ Erro ao carregar usuários.';
    return;
  }
  _usuariosData = usuarios || [];

  if (loading) loading.style.display = 'none';
  if (card)   card.style.display = 'block';
  if (listEl) listEl.innerHTML = _renderUsuariosList(_usuariosData);

  _bindUsuariosActions();
}

function _renderUsuariosList(usuarios) {
  if (!usuarios.length) return `<div class="mp-empty">Nenhum usuário cadastrado.</div>`;
  
  return usuarios.map(u => `
    <div class="mp-item" style="display:flex; align-items:center; justify-content:space-between;" data-user-id="${u.user_id}">
      <div class="mp-item-left" style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
        <span class="mp-item-desc" style="font-weight:600;">${u.user_nome}</span>
        <span style="font-size:12px; color:var(--text-sec);">${u.user_email} • ${u.user_cargo}</span>
      </div>
      <div class="mp-item-actions">
        <button class="funil-action-btn" data-action="user-edit" data-user-id="${u.user_id}" title="Editar informações">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="funil-action-btn" data-action="user-reset-pwd" data-user-email="${u.user_email}" title="Enviar link de redefinição de senha">
          <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </button>
        <button class="funil-action-btn funil-action-btn--del" data-action="user-delete" data-user-id="${u.user_id}" data-user-nome="${u.user_nome}" title="Excluir usuário">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function _bindUsuariosActions() {
  const listEl = document.getElementById('usuarios-list');
  const modal = document.getElementById('edit-user-modal');
  const cancelBtn = document.getElementById('btn-edit-user-cancel');
  const form = document.getElementById('edit-user-form');

  listEl?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    
    if (action === 'user-edit') {
      const userId = btn.dataset.userId;
      const user = _usuariosData.find(u => u.user_id === userId);
      if (!user) return;
      
      document.getElementById('edit-user-id').value = user.user_id;
      document.getElementById('edit-user-nome').value = user.user_nome;
      document.getElementById('edit-user-email').value = user.user_email;
      document.getElementById('edit-user-telefone').value = user.user_telefone || '';
      document.getElementById('edit-user-cargo').value = user.user_cargo;
      
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }

    if (action === 'user-reset-pwd') {
      const email = btn.dataset.userEmail;
      if (confirm(`Enviar link de redefinição de senha para ${email}?`)) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/redefinir-senha.html'
        });
        if (error) {
          alert('Erro ao enviar e-mail: ' + error.message);
        } else {
          alert('Link de redefinição enviado com sucesso!');
        }
      }
    }

    if (action === 'user-delete') {
      const userId = btn.dataset.userId;
      const nome   = btn.dataset.userNome;
      if (!confirm(`Excluir o usuário "${nome}"? Esta ação não pode ser desfeita.`)) return;

      const { error } = await Usuarios.deletar(userId);
      if (error) {
        alert('Erro ao excluir usuário: ' + error.message);
        return;
      }

      _usuariosData = _usuariosData.filter(u => u.user_id !== userId);
      const listEl = document.getElementById('usuarios-list');
      if (listEl) listEl.innerHTML = _renderUsuariosList(_usuariosData);
    }
  });

  cancelBtn?.addEventListener('click', () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const userId = document.getElementById('edit-user-id').value;
    const nome = document.getElementById('edit-user-nome').value.trim();
    const email = document.getElementById('edit-user-email').value.trim();
    const telefone = document.getElementById('edit-user-telefone').value.trim();
    const cargo = document.getElementById('edit-user-cargo').value;

    const submitBtn = document.getElementById('btn-edit-user-save');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    const { error } = await Usuarios.atualizar(userId, {
      user_nome: nome,
      user_email: email,
      user_telefone: telefone,
      user_cargo: cargo
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Salvar';

    if (error) {
      alert('Erro ao atualizar usuário: ' + error.message);
      return;
    }

    const idx = _usuariosData.findIndex(u => u.user_id === userId);
    if (idx !== -1) {
      _usuariosData[idx].user_nome = nome;
      _usuariosData[idx].user_email = email;
      _usuariosData[idx].user_telefone = telefone;
      _usuariosData[idx].user_cargo = cargo;
    }

    if (listEl) listEl.innerHTML = _renderUsuariosList(_usuariosData);
    
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  });
}

// ── Meu Perfil (Edição pelo Próprio Usuário) ───────────────────────────

function _renderSectionMeuPerfil(isActive = false) {
  const user = UserStore.getUser();
  const avatarUrl = user?.user_avatar || '';
  const formattedTel = _formatPhoneNumber(user?.user_telefone || '');

  return `
    <section class="config-section${isActive ? ' active' : ''}" id="section-meu-perfil">
      <div class="config-section-header">
        <div class="config-section-icon" style="background: rgba(26, 206, 238, 0.1); color: var(--cyan);">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <h2 class="config-section-title">Meu Perfil</h2>
          <p class="config-section-desc">Visualize e edite as suas informações pessoais de cadastro no CRM.</p>
        </div>
      </div>

      <div class="config-card">
        <form class="config-form" id="form-meu-perfil" novalidate>
          <!-- Row 1: Avatar -->
          <div class="config-form-row">
            <div class="config-field" style="flex: 1;">
              <label class="config-label">Foto de Perfil</label>
              <label class="config-file-label" id="mp-avatar-label" for="mp-avatar">
                <div class="config-file-preview" id="mp-avatar-preview">
                  ${avatarUrl 
                    ? `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />`
                    : `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
                  }
                </div>
                <div class="config-file-info">
                  <span class="config-file-name" id="mp-avatar-name">${avatarUrl ? 'Alterar foto de perfil' : 'Clique para selecionar'}</span>
                  <span class="config-file-sub">ou arraste uma imagem aqui</span>
                </div>
                <input type="file" id="mp-avatar" name="user_avatar" accept="image/jpeg,image/png,image/webp,image/gif" class="config-file-input" />
              </label>
            </div>
          </div>

          <!-- Row 2: Nome + Email -->
          <div class="config-form-row">
            <div class="config-field">
              <label class="config-label" for="mp-nome">Nome Completo <span class="config-required">*</span></label>
              <div class="config-input-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" id="mp-nome" class="config-input" value="${_esc(user?.user_nome)}" placeholder="Ex: João da Silva" required />
              </div>
            </div>
            <div class="config-field">
              <label class="config-label" for="mp-email">E-mail</label>
              <div class="config-input-wrap" style="opacity: 0.65; cursor: not-allowed;">
                <svg class="config-input-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input type="email" id="mp-email" class="config-input" value="${_esc(user?.user_email)}" readonly style="cursor: not-allowed;" />
              </div>
            </div>
          </div>

          <!-- Row 3: Telefone + Cargo + Status -->
          <div class="config-form-row">
            <div class="config-field">
              <label class="config-label" for="mp-telefone">Telefone</label>
              <div class="config-input-wrap">
                <svg class="config-input-icon" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.56 3.44 2 2 0 0 1 3.53 1.25h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.74a16 16 0 0 0 6 6l.88-.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 16.92z"/></svg>
                <input type="tel" id="mp-telefone" class="config-input" value="${formattedTel}" placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div class="config-field">
              <label class="config-label" for="mp-cargo">Cargo</label>
              <div class="config-input-wrap" style="opacity: 0.65; cursor: not-allowed;">
                <svg class="config-input-icon" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                <input type="text" id="mp-cargo" class="config-input" value="${_esc(user?.user_cargo)}" readonly style="cursor: not-allowed;" />
              </div>
            </div>
            <div class="config-field">
              <label class="config-label" for="mp-status">Status</label>
              <div class="config-input-wrap" style="opacity: 0.65; cursor: not-allowed;">
                <svg class="config-input-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <input type="text" id="mp-status" class="config-input" value="${_esc(user?.user_status)}" readonly style="cursor: not-allowed;" />
              </div>
            </div>
          </div>

          <!-- Feedback -->
          <div class="config-form-feedback" id="mp-feedback" aria-live="polite"></div>

          <!-- Actions -->
          <div class="config-form-actions" style="margin-top: 20px;">
            <button type="submit" class="btn btn-cyan" id="btn-mp-salvar" style="min-width: 140px;">
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function _bindMeuPerfilEvents() {
  const mpTelefone = document.getElementById('mp-telefone');
  if (mpTelefone) {
    mpTelefone.addEventListener('input', (e) => {
      e.target.value = _formatPhoneNumber(e.target.value);
    });
  }

  // Preview do avatar de meu perfil
  const mpAvatarInput = document.getElementById('mp-avatar');
  if (mpAvatarInput) {
    mpAvatarInput.addEventListener('change', () => {
      const file = mpAvatarInput.files?.[0];
      const nameEl    = document.getElementById('mp-avatar-name');
      const previewEl = document.getElementById('mp-avatar-preview');
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

  // Drag-and-drop no label do avatar de meu perfil
  const mpAvatarLabel = document.getElementById('mp-avatar-label');
  if (mpAvatarLabel) {
    mpAvatarLabel.addEventListener('dragover', e => { e.preventDefault(); mpAvatarLabel.classList.add('config-file-drag'); });
    mpAvatarLabel.addEventListener('dragleave', () => mpAvatarLabel.classList.remove('config-file-drag'));
    mpAvatarLabel.addEventListener('drop', e => {
      e.preventDefault();
      mpAvatarLabel.classList.remove('config-file-drag');
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (mpAvatarInput) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        mpAvatarInput.files = dataTransfer.files;
        // Trigger change event manually
        mpAvatarInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // Submit do formulário de perfil
  const formMeuPerfil = document.getElementById('form-meu-perfil');
  formMeuPerfil?.addEventListener('submit', async (e) => {
    e.preventDefault();
    _clearMpFeedback();

    const user = UserStore.getUser();
    if (!user) return;

    const nome = document.getElementById('mp-nome')?.value.trim();
    const telRaw = document.getElementById('mp-telefone')?.value || '';
    let telefone = telRaw.replace(/\D/g, ""); // apenas números
    if (telefone && !telefone.startsWith("55")) {
      telefone = "55" + telefone;
    }

    if (!nome) {
      _showMpFeedback('error', 'O nome completo é obrigatório.');
      return;
    }

    _setMpLoading(true);

    try {
      let avatarUrl = user.user_avatar;
      const avatarFile = mpAvatarInput?.files?.[0];

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const filePath = `avatars/${user.user_id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(filePath, avatarFile, { upsert: true, contentType: avatarFile.type });

        if (uploadError) {
          console.warn('[Configurações] Erro no upload do avatar:', uploadError.message);
        } else {
          const { data: urlData } = supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(filePath);
          avatarUrl = urlData?.publicUrl ?? null;
        }
      }

      const now = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00';
      const { error: dbError } = await supabase
        .from('usuarios')
        .update({
          user_nome: nome,
          user_telefone: (telefone && telefone !== "55") ? telefone : null,
          user_avatar: avatarUrl,
          ultima_atualizacao: now,
        })
        .eq('user_id', user.user_id);

      if (dbError) throw dbError;

      // Sucesso! Atualiza UserStore e Sidebar
      const updatedUser = {
        ...user,
        user_nome: nome,
        user_telefone: (telefone && telefone !== "55") ? telefone : null,
        user_avatar: avatarUrl,
        ultima_atualizacao: now
      };

      UserStore.setUser(updatedUser);
      
      // Envia evento global para atualizar a barra lateral
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedUser }));

      _showMpFeedback('success', 'Perfil atualizado com sucesso!');
    } catch (err) {
      console.error('[Configurações] Erro ao atualizar perfil:', err);
      _showMpFeedback('error', err.message || 'Erro ao atualizar perfil.');
    } finally {
      _setMpLoading(false);
    }
  });
}

function _setMpLoading(on) {
  const btn = document.getElementById('btn-mp-salvar');
  if (!btn) return;
  btn.disabled = on;
  btn.textContent = on ? 'Salvando...' : 'Salvar Alterações';
}

function _showMpFeedback(type, msg) {
  const el = document.getElementById('mp-feedback');
  if (!el) return;
  const icons = {
    success: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
    error:   `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  };
  el.innerHTML = `
    <div class="config-feedback config-feedback--${type}" style="margin-top: 16px;">
      <svg viewBox="0 0 24 24">${icons[type] || icons.success}</svg>
      <span>${msg}</span>
    </div>`;
}

function _clearMpFeedback() {
  const el = document.getElementById('mp-feedback');
  if (el) el.innerHTML = '';
}

function _formatPhoneNumber(value) {
  if (!value) return "+55 ";
  let numbers = value.replace(/\D/g, "");
  if (numbers.startsWith("55")) {
    numbers = numbers.slice(2);
  }
  let formatted = "+55 ";
  if (numbers.length > 0) {
    if (numbers.length <= 2) {
      formatted += `(${numbers}`;
    } else if (numbers.length <= 6) {
      formatted += `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else if (numbers.length <= 10) {
      formatted += `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    } else {
      formatted += `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  }
  return formatted;
}

function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
