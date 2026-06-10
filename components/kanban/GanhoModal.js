/**
 * GanhoModal.js — Popup de celebração/coleta de dados ao marcar negócio como "Ganho"
 *
 * Uso:
 *   import GanhoModal from './GanhoModal.js';
 *   const modal = new GanhoModal();
 *   modal.open(negocio, onConfirm, onCancel);
 */
import { Usuarios } from '../../js/db.js';

export default class GanhoModal {
  constructor() {
    this._escHandler = null;
  }

  // ── API pública ───────────────────────────────────────────────

  /**
   * Abre o modal pré-preenchendo com os dados do negócio.
   * Busca a lista de gestores (Operações/Administrador) antes de montar.
   */
  async open(negocio = {}, onConfirm, onCancel) {
    this._negocio   = negocio;
    this._onConfirm = onConfirm;
    this._onCancel  = onCancel;

    // Busca gestores antes de montar
    const { data: gestores } = await Usuarios.getGestores();
    this._mount(gestores || []);
  }

  close(canceled = false) {
    const overlay = document.getElementById('ganho-modal-overlay');
    if (!overlay) return;
    overlay.classList.add('ganho-modal--closing');
    setTimeout(() => overlay.remove(), 300);
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    if (canceled && typeof this._onCancel === 'function') this._onCancel();
  }

  // ── Mount ─────────────────────────────────────────────────────

  _mount(gestores = []) {
    document.getElementById('ganho-modal-overlay')?.remove();

    const neg = this._negocio || {};

    // Valores pré-preenchidos
    const nome     = neg.negocio_titulo   || '';
    const telefone = neg.negocio_telefone || '';
    const email    = neg.negocio_email    || '';
    const segmento = neg.negocio_segmento || '';

    // Monta as <option> do select de responsável
    const gestoresOptions = gestores.length
      ? gestores.map(g =>
          `<option value="${this._esc(g.user_id)}">${this._esc(g.user_nome)} — ${this._esc(g.user_cargo)}</option>`
        ).join('')
      : '<option value="" disabled>Nenhum gestor encontrado</option>';

    document.body.insertAdjacentHTML('beforeend', `
      <div class="ganho-modal-overlay" id="ganho-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ganho-modal-title">
        <div class="ganho-modal-card" id="ganho-modal-card">

          <!-- Confetti decorativo -->
          <div class="ganho-modal-confetti" aria-hidden="true">
            ${this._confettiHTML()}
          </div>

          <!-- Header -->
          <div class="ganho-modal-header">
            <div class="ganho-modal-trophy">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M8 21h8M12 17v4M17 3H7l1 8a4 4 0 0 0 8 0l1-8z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 3H4a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4M17 3h3a1 1 0 0 1 1 1v2a4 4 0 0 0-4 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="ganho-modal-header-text">
              <h2 class="ganho-modal-title" id="ganho-modal-title">🎉 Negócio Ganho!</h2>
              <p class="ganho-modal-subtitle">Preencha os dados do cliente para registrar esta conquista</p>
            </div>
            <button class="ganho-modal-close" id="ganho-modal-close" title="Fechar">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Divisor -->
          <div class="ganho-modal-divider"></div>

          <!-- Formulário -->
          <form class="ganho-modal-form" id="ganho-modal-form" autocomplete="off" novalidate>

            <!-- Seção: Dados do Cliente -->
            <div class="ganho-form-section">
              <div class="ganho-form-section-title">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Dados do Cliente
              </div>
              <div class="ganho-form-grid ganho-form-grid--3">
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-nome">
                    Nome do Cliente
                    <span class="ganho-form-required">*</span>
                  </label>
                  <input
                    class="ganho-form-input"
                    id="gf-nome"
                    name="gf_nome"
                    type="text"
                    placeholder="Nome completo"
                    value="${this._esc(nome)}"
                    required
                  >
                </div>
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-telefone">
                    Telefone do Cliente
                    <span class="ganho-form-required">*</span>
                  </label>
                  <input
                    class="ganho-form-input"
                    id="gf-telefone"
                    name="gf_telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value="${this._esc(telefone)}"
                    required
                  >
                </div>
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-email">
                    E-mail do Cliente
                    <span class="ganho-form-required">*</span>
                  </label>
                  <input
                    class="ganho-form-input"
                    id="gf-email"
                    name="gf_email"
                    type="email"
                    placeholder="cliente@empresa.com"
                    value="${this._esc(email)}"
                    required
                  >
                </div>
              </div>

              <!-- Responsável pelo Cliente -->
              <div class="ganho-form-grid ganho-form-grid--1" style="margin-top:12px">
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-responsavel">
                    Responsável pelo Cliente
                    <span class="ganho-form-required">*</span>
                  </label>
                  <div class="ganho-form-select-wrap">
                    <select
                      class="ganho-form-input ganho-form-select"
                      id="gf-responsavel"
                      name="gf_responsavel"
                      required
                    >
                      <option value="">— Selecione o responsável —</option>
                      ${gestoresOptions}
                    </select>
                    <svg class="ganho-form-select-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Seção: Informações Financeiras -->
            <div class="ganho-form-section">
              <div class="ganho-form-section-title">
                <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Investimento
              </div>
              <div class="ganho-form-grid ganho-form-grid--3">
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-investimento">
                    Investimento em Mídia
                    <span class="ganho-form-required">*</span>
                  </label>
                  <div class="ganho-form-input-prefix-wrap">
                    <span class="ganho-form-input-prefix">R$</span>
                    <input
                      class="ganho-form-input ganho-form-input--prefixed"
                      id="gf-investimento"
                      name="gf_investimento"
                      type="text"
                      placeholder="0,00"
                      required
                    >
                  </div>
                </div>
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-mensalidade">
                    Valor da Mensalidade
                    <span class="ganho-form-required">*</span>
                  </label>
                  <div class="ganho-form-input-prefix-wrap">
                    <span class="ganho-form-input-prefix">R$</span>
                    <input
                      class="ganho-form-input ganho-form-input--prefixed"
                      id="gf-mensalidade"
                      name="gf_mensalidade"
                      type="text"
                      placeholder="0,00"
                      required
                    >
                  </div>
                </div>
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-segmento">
                    Segmento
                    <span class="ganho-form-required">*</span>
                  </label>
                  <input
                    class="ganho-form-input"
                    id="gf-segmento"
                    name="gf_segmento"
                    type="text"
                    placeholder="Ex: E-commerce, SaaS, Varejo…"
                    value="${this._esc(segmento)}"
                    required
                  >
                </div>
              </div>
            </div>


            <!-- Seção: Contexto e Descrição -->
            <div class="ganho-form-section">
              <div class="ganho-form-section-title">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Contexto e Descrição
              </div>
              <div class="ganho-form-grid ganho-form-grid--1">
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-contexto">
                    Contexto Geral do Cliente
                    <span class="ganho-form-required">*</span>
                  </label>
                  <textarea
                    class="ganho-form-textarea"
                    id="gf-contexto"
                    name="gf_contexto"
                    rows="3"
                    placeholder="Descreva o contexto geral do cliente, suas necessidades, objetivos e expectativas…"
                    required
                  ></textarea>
                </div>
                <div class="ganho-form-field">
                  <label class="ganho-form-label" for="gf-descricao">
                    Descrição Sobre a Empresa
                    <span class="ganho-form-required">*</span>
                  </label>
                  <textarea
                    class="ganho-form-textarea"
                    id="gf-descricao"
                    name="gf_descricao"
                    rows="3"
                    placeholder="Descreva a empresa do cliente, seu mercado de atuação, produtos/serviços e diferenciais…"
                    required
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="ganho-modal-footer">
              <button type="button" class="ganho-btn-cancel" id="ganho-btn-cancel">
                Cancelar
              </button>
              <button type="submit" class="ganho-btn-confirm" id="ganho-btn-confirm">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Confirmar Negócio Ganho
              </button>
            </div>

          </form>
        </div>
      </div>
    `);

    this._bindEvents();

    // Animação de entrada
    requestAnimationFrame(() => {
      document.getElementById('ganho-modal-card')?.classList.add('ganho-modal-card--open');
    });
  }

  // ── Confetti ──────────────────────────────────────────────────

  _confettiHTML() {
    const colors = ['#1ACEEE','#34d399','#fbbf24','#f472b6','#a78bfa','#fb923c'];
    const pieces = [];
    for (let i = 0; i < 18; i++) {
      const color = colors[i % colors.length];
      const delay = (Math.random() * 1.2).toFixed(2);
      const left  = (Math.random() * 100).toFixed(1);
      const size  = (6 + Math.random() * 8).toFixed(1);
      const shape = i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'rect' : 'triangle';
      pieces.push(
        `<span class="ganho-confetti-piece ganho-confetti--${shape}"
               style="left:${left}%;background:${color};width:${size}px;height:${size}px;animation-delay:${delay}s;"></span>`
      );
    }
    return pieces.join('');
  }

  // ── Events ─────────────────────────────────────────────────────

  _bindEvents() {
    // Fechar
    document.getElementById('ganho-modal-close')?.addEventListener('click', () => this.close(true));
    document.getElementById('ganho-btn-cancel')?.addEventListener('click', () => this.close(true));

    // Click fora fecha
    document.getElementById('ganho-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'ganho-modal-overlay') this.close(true);
    });

    // ESC fecha
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(true); };
    document.addEventListener('keydown', this._escHandler);

    // Submit
    document.getElementById('ganho-modal-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });

    // Máscara de moeda — investimento
    const invInput = document.getElementById('gf-investimento');
    if (invInput) {
      invInput.addEventListener('input', () => {
        let raw = invInput.value.replace(/\D/g, '');
        if (!raw) { invInput.value = ''; return; }
        const num = parseInt(raw, 10) / 100;
        invInput.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
    }

    // Máscara de moeda — mensalidade
    const mensInput = document.getElementById('gf-mensalidade');
    if (mensInput) {
      mensInput.addEventListener('input', () => {
        let raw = mensInput.value.replace(/\D/g, '');
        if (!raw) { mensInput.value = ''; return; }
        const num = parseInt(raw, 10) / 100;
        mensInput.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
    }
  }

  _submit() {
    // Lista de todos os campos obrigatórios
    const campos = [
      { id: 'gf-nome',         label: 'Nome do Cliente',           tipo: 'input'    },
      { id: 'gf-telefone',     label: 'Telefone do Cliente',       tipo: 'input'    },
      { id: 'gf-email',        label: 'E-mail do Cliente',         tipo: 'input'    },
      { id: 'gf-responsavel',  label: 'Responsável pelo Cliente',  tipo: 'input'    },
      { id: 'gf-investimento', label: 'Investimento em Mídia',     tipo: 'input'    },
      { id: 'gf-mensalidade',  label: 'Valor da Mensalidade',      tipo: 'input'    },
      { id: 'gf-segmento',     label: 'Segmento',                  tipo: 'input'    },
      { id: 'gf-contexto',     label: 'Contexto Geral do Cliente', tipo: 'textarea' },
      { id: 'gf-descricao',    label: 'Descrição Sobre a Empresa', tipo: 'textarea' },
    ];

    // Valida todos e coleta os inválidos
    let primeiroInvalido = null;
    const invalidos = [];

    campos.forEach(({ id, tipo }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const vazio = !el.value.trim();
      el.classList.toggle('ganho-form-input--error', vazio);
      if (tipo === 'textarea') el.classList.toggle('ganho-form-textarea--error', vazio);
      if (vazio) {
        invalidos.push(id);
        if (!primeiroInvalido) primeiroInvalido = el;
      } else {
        // Remove erro ao digitar/selecionar
        el.addEventListener('input',  () => el.classList.remove('ganho-form-input--error', 'ganho-form-textarea--error'), { once: true });
        el.addEventListener('change', () => el.classList.remove('ganho-form-input--error'), { once: true });
      }
    });

    if (invalidos.length > 0) {
      primeiroInvalido?.focus();
      // Scroll para o primeiro campo inválido
      primeiroInvalido?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Todos válidos — coleta dados
    const dados = {
      nome_cliente:       document.getElementById('gf-nome')?.value.trim()          || '',
      telefone_cliente:   document.getElementById('gf-telefone')?.value.trim()      || '',
      email_cliente:      document.getElementById('gf-email')?.value.trim()         || '',
      responsavel_id:     document.getElementById('gf-responsavel')?.value          || null,
      investimento_midia: document.getElementById('gf-investimento')?.value.trim()  || '',
      mensalidade:        document.getElementById('gf-mensalidade')?.value.trim()   || '',
      segmento:           document.getElementById('gf-segmento')?.value.trim()      || '',
      // origem_cliente é preenchida automaticamente com negocio_origem
      origem_cliente:     this._negocio?.negocio_origem                              || '',
      contexto_geral:     document.getElementById('gf-contexto')?.value.trim()      || '',
      descricao_empresa:  document.getElementById('gf-descricao')?.value.trim()     || '',
    };

    // Feedback visual de sucesso no botão
    const btn  = document.getElementById('ganho-btn-confirm');
    const card = document.getElementById('ganho-modal-card');
    if (btn)  { btn.disabled = true; btn.innerHTML = '<span class="ganho-btn-spinner"></span> Salvando…'; }
    if (card) card.classList.add('ganho-modal-card--success');

    setTimeout(() => {
      this.close(false);
      if (typeof this._onConfirm === 'function') this._onConfirm(dados);
    }, 420);
  }

  // ── Util ───────────────────────────────────────────────────────

  _esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}
