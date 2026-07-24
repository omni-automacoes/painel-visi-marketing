/**
 * NewOppModal.js — Modal de criação de nova oportunidade
 *
 * Uso:
 *   import NewOppModal from './NewOppModal.js';
 *   const modal = new NewOppModal();
 *   modal.open({
 *     etapas:     [...],      // Array de { etapa_id, etapa_nome, etapa_ordem }
 *     pipelineId: 1,
 *     vendedorId: 'uuid',
 *     onCreated:  (negocio) => { ... }
 *   });
 */
import { Negocios } from '../../js/db.js';

export default class NewOppModal {
  constructor() {
    this._opts = {};
  }

  // ── API pública ───────────────────────────────────────────────

  open({ etapas = [], pipelineId, vendedorId, onCreated }) {
    this._opts = { etapas, pipelineId, vendedorId, onCreated };
    this._mount();
  }

  close() {
    const overlay = document.getElementById('new-opp-overlay');
    if (!overlay) return;
    overlay.classList.add('modal-overlay--closing');
    setTimeout(() => overlay.remove(), 220);
  }

  // ── Mount ─────────────────────────────────────────────────────

  _mount() {
    // Evita duplicata
    document.getElementById('new-opp-overlay')?.remove();

    const { etapas } = this._opts;
    const etapaOptions = etapas
      .sort((a, b) => a.etapa_ordem - b.etapa_ordem)
      .map(e => `<option value="${e.etapa_id}">${e.etapa_nome}</option>`)
      .join('');

    const html = `
      <div class="modal-overlay" id="new-opp-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-card" id="new-opp-card">

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header-icon">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div>
              <h2 class="modal-title" id="modal-title">Nova Oportunidade</h2>
              <p class="modal-subtitle">Preencha as informações do negócio</p>
            </div>
            <button class="modal-close" id="modal-close-btn" title="Fechar">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Form -->
          <form class="modal-form" id="new-opp-form" autocomplete="off">

            <!-- Nome (obrigatório) -->
            <div class="form-field">
              <label class="form-label" for="opp-titulo">
                Nome do Negócio
                <span class="form-required">*</span>
              </label>
              <input
                class="form-input"
                id="opp-titulo"
                name="negocio_titulo"
                type="text"
                placeholder="Ex: Proposta Agência Silva"
                required
                autofocus
              >
              <span class="form-error" id="error-titulo"></span>
            </div>

            <!-- Etapa (select) -->
            <div class="form-field">
              <label class="form-label" for="opp-etapa">Etapa</label>
              <div class="form-select-wrap">
                <select class="form-input form-select" id="opp-etapa" name="etapa_id">
                  <option value="">— Selecionar etapa —</option>
                  ${etapaOptions}
                </select>
                <svg class="form-select-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>

            <!-- 2 colunas: Telefone + Email -->
            <div class="form-row">
              <div class="form-field">
                <label class="form-label" for="opp-telefone">Telefone</label>
                <input class="form-input" id="opp-telefone" name="negocio_telefone"
                       type="tel" placeholder="(11) 99999-9999">
              </div>
              <div class="form-field">
                <label class="form-label" for="opp-email">E-mail</label>
                <input class="form-input" id="opp-email" name="negocio_email"
                       type="email" placeholder="contato@empresa.com">
              </div>
            </div>

            <!-- Origem + Segmento -->
            <div class="form-row">
              <div class="form-field">
                <label class="form-label" for="opp-origem">Origem</label>
                <input class="form-input" id="opp-origem" name="negocio_origem"
                       type="text" placeholder="Ex: Indicação, Ads…">
              </div>
              <div class="form-field">
                <label class="form-label" for="opp-segmento">Segmento</label>
                <input class="form-input" id="opp-segmento" name="negocio_segmento"
                       type="text" placeholder="Ex: E-commerce, SaaS…">
              </div>
            </div>

            <!-- Link do Instagram -->
            <div class="form-field">
              <label class="form-label" for="opp-instagram">Link do Instagram</label>
              <input class="form-input" id="opp-instagram" name="link_instagram"
                     type="text" placeholder="Ex: @perfil ou link">
            </div>

            <!-- Valor do Negócio + Faturamento do Cliente -->
            <div class="form-row">
              <div class="form-field">
                <label class="form-label" for="opp-valor">
                  Valor do Negócio
                </label>
                <div style="position:relative">
                  <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--text-muted);pointer-events:none">R$</span>
                  <input class="form-input" id="opp-valor" name="negocio_valor"
                         type="text" inputmode="decimal"
                         placeholder="0,00"
                         style="padding-left:32px">
                </div>
              </div>
              <div class="form-field">
                <label class="form-label" for="opp-faturamento">
                  Faturamento do Cliente
                </label>
                <div style="position:relative">
                  <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--text-muted);pointer-events:none">R$</span>
                  <input class="form-input" id="opp-faturamento" name="negocio_faturamento"
                         type="text" inputmode="decimal"
                         placeholder="0,00"
                         style="padding-left:32px">
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="modal-footer">
              <button type="button" class="btn btn-ghost" id="modal-cancel-btn">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="modal-submit-btn">
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Criar Negócio
              </button>
            </div>

          </form>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    this._bindEvents();
  }

  // ── Events ────────────────────────────────────────────────────

  _bindEvents() {
    // Fechar
    document.getElementById('modal-close-btn') ?.addEventListener('click', () => this.close());
    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => this.close());

    // Click fora do card fecha
    document.getElementById('new-opp-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'new-opp-overlay') this.close();
    });

    // ESC fecha
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    // Submit
    document.getElementById('new-opp-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });
  }

  async _submit() {
    const form      = document.getElementById('new-opp-form');
    const submitBtn = document.getElementById('modal-submit-btn');
    const errorEl   = document.getElementById('error-titulo');

    // Validação do nome
    const titulo = form.negocio_titulo.value.trim();
    if (!titulo) {
      errorEl.textContent = 'O nome do negócio é obrigatório.';
      form.negocio_titulo.classList.add('form-input--error');
      form.negocio_titulo.focus();
      return;
    }
    errorEl.textContent = '';
    form.negocio_titulo.classList.remove('form-input--error');

    // Estado de loading no botão
    submitBtn.disabled    = true;
    submitBtn.innerHTML   = `<span class="btn-spinner"></span> Criando…`;

    // Monta payload
    const payload = {
      negocio_titulo:  titulo,
      negocio_status:  'Aberto',
      pipeline_id:     this._opts.pipelineId,
      vendedor_id:     this._opts.vendedorId,
    };

    const etapaId    = parseInt(form.etapa_id?.value, 10);
    const telefone   = form.negocio_telefone?.value.trim();
    const email      = form.negocio_email?.value.trim();
    const origem     = form.negocio_origem?.value.trim();
    const segmento   = form.negocio_segmento?.value.trim();
    const instagram  = form.link_instagram?.value.trim();

    if (etapaId)  payload.etapa_id             = etapaId;
    if (telefone) payload.negocio_telefone      = telefone;
    if (email)    payload.negocio_email         = email;
    if (origem)   payload.negocio_origem        = origem;
    if (segmento) payload.negocio_segmento      = segmento;
    if (instagram) payload.link_instagram       = instagram;

    // Valor do Negócio: converte "1.500,00" → 1500.00
    const valStr = (form.negocio_valor?.value || '').trim().replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(valStr);
    if (!isNaN(valor) && valor > 0) payload.negocio_valor = valor;

    // Faturamento: converte "1.500,00" → 1500.00
    const fatStr = (form.negocio_faturamento?.value || '').trim().replace(/\./g, '').replace(',', '.');
    const faturamento = parseFloat(fatStr);
    if (!isNaN(faturamento) && faturamento > 0) payload.negocio_faturamento = faturamento;

    const { data, error } = await Negocios.create(payload);

    if (error) {
      console.error('[NewOppModal] Erro ao criar negócio:', error);
      submitBtn.disabled  = false;
      submitBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Criar Negócio`;

      // Mostra erro genérico abaixo do botão
      let errGlobal = document.getElementById('modal-error-global');
      if (!errGlobal) {
        document.querySelector('.modal-footer').insertAdjacentHTML('beforebegin',
          `<p class="form-error form-error--global" id="modal-error-global">Erro ao salvar. Tente novamente.</p>`);
      }
      return;
    }

    // Remove handler ESC
    document.removeEventListener('keydown', this._escHandler);

    // Fecha modal com animação de sucesso
    const card = document.getElementById('new-opp-card');
    if (card) { card.classList.add('modal-card--success'); }
    setTimeout(() => {
      this.close();
      if (typeof this._opts.onCreated === 'function') this._opts.onCreated(data);
    }, 400);
  }
}
