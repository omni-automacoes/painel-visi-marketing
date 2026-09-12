/**
 * EventoModal.js — Modal de criar/editar evento da Agenda (Google Calendar)
 *
 * Uso:
 *   import EventoModal from './EventoModal.js';
 *   const modal = new EventoModal();
 *   modal.open({
 *     modo:     'criar' | 'editar',
 *     evento:   {...} | null,      // obrigatório em modo 'editar'
 *     userId:   'uuid',
 *     diaBase:  'YYYY-MM-DD',      // dia pré-selecionado em modo 'criar'
 *     onSaved:  (evento) => {...},
 *     onDeleted:(eventoId) => {...},
 *   });
 */
import { criarEvento, editarEvento, excluirEvento } from '../../js/googleCalendar.js';

export default class EventoModal {
  constructor() {
    this._opts = {};
  }

  // ── API pública ───────────────────────────────────────────────

  open({ modo = 'criar', evento = null, userId, diaBase = null, onSaved, onDeleted }) {
    this._opts = { modo, evento, userId, diaBase, onSaved, onDeleted };
    this._mount();
  }

  close() {
    const overlay = document.getElementById('evento-modal-overlay');
    if (!overlay) return;
    overlay.classList.add('modal-overlay--closing');
    document.removeEventListener('keydown', this._escHandler);
    setTimeout(() => overlay.remove(), 220);
  }

  // ── Mount ─────────────────────────────────────────────────────

  _mount() {
    document.getElementById('evento-modal-overlay')?.remove();

    const { modo, evento, diaBase } = this._opts;
    const isEdicao = modo === 'editar';

    const agora      = diaBase ? new Date(`${diaBase}T09:00:00`) : new Date();
    const fimPadrao  = new Date(agora.getTime() + 60 * 60 * 1000);

    const diaInteiro = evento?.diaInteiro || false;
    const inicioIso  = evento?.inicio || agora.toISOString();
    const fimIso     = evento?.fim    || fimPadrao.toISOString();

    const inicioData = _datePart(inicioIso);
    const inicioHora = _timePart(inicioIso, '09:00');
    const fimData    = _datePart(fimIso);
    const fimHora    = _timePart(fimIso, '10:00');

    const html = `
      <div class="modal-overlay" id="evento-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="evento-modal-title">
        <div class="modal-card" id="evento-modal-card">

          <div class="modal-header">
            <div class="modal-header-icon">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <h2 class="modal-title" id="evento-modal-title">${isEdicao ? 'Editar Evento' : 'Novo Evento'}</h2>
              <p class="modal-subtitle">${isEdicao ? 'Atualize as informações do evento' : 'Preencha as informações do evento'}</p>
            </div>
            <button class="modal-close" id="evento-modal-close-btn" title="Fechar">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <form class="modal-form" id="evento-modal-form" autocomplete="off">

            <div class="form-field">
              <label class="form-label" for="evt-titulo">Título <span class="form-required">*</span></label>
              <input class="form-input" id="evt-titulo" type="text" placeholder="Ex: Reunião com cliente"
                     value="${_esc(evento?.titulo || '')}" required autofocus>
              <span class="form-error" id="evt-error-titulo"></span>
            </div>

            <div class="form-field" style="flex-direction:row;align-items:center;gap:8px;">
              <input type="checkbox" id="evt-dia-inteiro" ${diaInteiro ? 'checked' : ''} style="width:16px;height:16px;">
              <label class="form-label" for="evt-dia-inteiro" style="margin:0;">Dia inteiro</label>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label class="form-label" for="evt-data-inicio">Início <span class="form-required">*</span></label>
                <input class="form-input" id="evt-data-inicio" type="date" value="${inicioData}" required>
              </div>
              <div class="form-field" id="evt-hora-inicio-field" style="${diaInteiro ? 'display:none' : ''}">
                <label class="form-label" for="evt-hora-inicio">Hora</label>
                <input class="form-input" id="evt-hora-inicio" type="time" value="${inicioHora}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label class="form-label" for="evt-data-fim">Fim <span class="form-required">*</span></label>
                <input class="form-input" id="evt-data-fim" type="date" value="${fimData}" required>
              </div>
              <div class="form-field" id="evt-hora-fim-field" style="${diaInteiro ? 'display:none' : ''}">
                <label class="form-label" for="evt-hora-fim">Hora</label>
                <input class="form-input" id="evt-hora-fim" type="time" value="${fimHora}">
              </div>
            </div>
            <span class="form-error" id="evt-error-data"></span>

            <div class="form-field">
              <label class="form-label" for="evt-local">Local</label>
              <input class="form-input" id="evt-local" type="text" placeholder="Ex: Escritório, Google Meet…"
                     value="${_esc(evento?.local || '')}">
            </div>

            <div class="form-field">
              <label class="form-label" for="evt-descricao">Descrição</label>
              <textarea class="form-input" id="evt-descricao" rows="3"
                        placeholder="Detalhes do evento…">${_esc(evento?.descricao || '')}</textarea>
            </div>

            <div class="modal-footer" style="${isEdicao ? 'justify-content:space-between;' : ''}">
              ${isEdicao ? `
              <button type="button" class="btn btn-ghost" id="evento-modal-excluir-btn" style="color:#dc2626;">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Excluir
              </button>` : ''}
              <div style="display:flex;gap:12px;${isEdicao ? '' : 'margin-left:auto;'}">
                <button type="button" class="btn btn-ghost" id="evento-modal-cancel-btn">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="evento-modal-submit-btn">
                  ${isEdicao ? 'Salvar Alterações' : 'Criar Evento'}
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    this._bindEvents();
  }

  // ── Events ────────────────────────────────────────────────────

  _bindEvents() {
    document.getElementById('evento-modal-close-btn') ?.addEventListener('click', () => this.close());
    document.getElementById('evento-modal-cancel-btn')?.addEventListener('click', () => this.close());

    document.getElementById('evento-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'evento-modal-overlay') this.close();
    });

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    const diaInteiroInput = document.getElementById('evt-dia-inteiro');
    diaInteiroInput?.addEventListener('change', () => {
      const mostrarHora = !diaInteiroInput.checked;
      document.getElementById('evt-hora-inicio-field').style.display = mostrarHora ? 'flex' : 'none';
      document.getElementById('evt-hora-fim-field').style.display    = mostrarHora ? 'flex' : 'none';
    });

    document.getElementById('evento-modal-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });

    document.getElementById('evento-modal-excluir-btn')?.addEventListener('click', () => this._excluir());
  }

  async _submit() {
    const errorTitulo = document.getElementById('evt-error-titulo');
    const errorData   = document.getElementById('evt-error-data');
    const submitBtn   = document.getElementById('evento-modal-submit-btn');
    errorTitulo.textContent = '';
    errorData.textContent   = '';

    const titulo = document.getElementById('evt-titulo').value.trim();
    if (!titulo) {
      errorTitulo.textContent = 'O título é obrigatório.';
      document.getElementById('evt-titulo').focus();
      return;
    }

    const diaInteiro = document.getElementById('evt-dia-inteiro').checked;
    const dataInicio = document.getElementById('evt-data-inicio').value;
    const dataFim    = document.getElementById('evt-data-fim').value;
    const horaInicio = document.getElementById('evt-hora-inicio').value || '00:00';
    const horaFim    = document.getElementById('evt-hora-fim').value || '00:00';

    if (!dataInicio || !dataFim) {
      errorData.textContent = 'Informe as datas de início e fim.';
      return;
    }

    const inicio = diaInteiro ? dataInicio : `${dataInicio}T${horaInicio}:00`;
    const fim    = diaInteiro ? dataFim    : `${dataFim}T${horaFim}:00`;

    if (new Date(fim) < new Date(inicio)) {
      errorData.textContent = 'O fim não pode ser antes do início.';
      return;
    }

    const payload = {
      titulo,
      descricao: document.getElementById('evt-descricao').value.trim(),
      local:     document.getElementById('evt-local').value.trim(),
      diaInteiro,
      inicio,
      fim,
    };

    submitBtn.disabled  = true;
    submitBtn.innerHTML = `<span class="btn-spinner"></span> Salvando…`;

    try {
      const { userId, modo, evento } = this._opts;
      const resultado = modo === 'editar'
        ? await editarEvento(userId, evento.id, payload)
        : await criarEvento(userId, payload);

      this.close();
      if (typeof this._opts.onSaved === 'function') this._opts.onSaved(resultado);
    } catch (err) {
      console.error('[EventoModal] Erro ao salvar evento:', err);
      submitBtn.disabled  = false;
      submitBtn.innerHTML = this._opts.modo === 'editar' ? 'Salvar Alterações' : 'Criar Evento';
      errorData.textContent = 'Não foi possível salvar o evento. Tente novamente.';
    }
  }

  async _excluir() {
    if (!confirm('Excluir este evento? Ele também será removido do Google Calendar.')) return;

    const btn = document.getElementById('evento-modal-excluir-btn');
    btn.disabled = true;

    try {
      const { userId, evento } = this._opts;
      await excluirEvento(userId, evento.id);
      this.close();
      if (typeof this._opts.onDeleted === 'function') this._opts.onDeleted(evento.id);
    } catch (err) {
      console.error('[EventoModal] Erro ao excluir evento:', err);
      btn.disabled = false;
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Extrai "YYYY-MM-DD" de uma string ISO (data ou datetime). */
function _datePart(iso) {
  return String(iso).slice(0, 10);
}

/** Extrai "HH:mm" de uma string ISO datetime; usa fallback para datas sem hora. */
function _timePart(iso, fallback) {
  const s = String(iso);
  return s.length > 10 ? s.slice(11, 16) : fallback;
}
