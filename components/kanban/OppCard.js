/**
 * OppCard.js — Card de oportunidade individual do Kanban
 * Recebe dados reais da tabela `negocios` (com join de `usuarios`).
 * Exibe badge de tarefas pendentes quando taskCount > 0.
 * Exibe badge de data de recontato (data_recontado) quando disponível.
 */
export default class OppCard {
  /**
   * @param {Object} negocio    - Linha da tabela negocios (com usuarios)
   * @param {string} etapaLabel - Texto "Etapa X / Y" para exibição
   * @param {number} taskCount  - Quantidade de tarefas pendentes do negócio
   */
  constructor(negocio, etapaLabel = '', taskCount = 0) {
    this._n         = negocio;
    this._label     = etapaLabel;
    this._taskCount = taskCount;
  }

  // ── helpers ────────────────────────────────────────────────────

  _formatValor(valor) {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
  }

  _formatData(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  _statusTag(status) {
    switch (status) {
      case 'Ganho':   return { cls: 'tag-won',  label: '✓ Ganho'   };
      case 'Perdido': return { cls: 'tag-cold', label: '✗ Perdido' };
      default:        return { cls: 'tag-warm', label: 'Em aberto' };
    }
  }

  _vendedorAvatar() {
    const user = this._n.usuarios;
    if (!user) return '';

    if (user.user_avatar) {
      return `<img class="opp-avatar opp-avatar--img" src="${user.user_avatar}" alt="${user.user_nome}" title="${user.user_nome}">`;
    }

    const partes   = (user.user_nome || '?').trim().split(' ');
    const iniciais = partes.length > 1
      ? `${partes[0][0]}${partes[partes.length - 1][0]}`
      : partes[0].substring(0, 2);

    return `<div class="opp-avatar" title="${user.user_nome}">${iniciais.toUpperCase()}</div>`;
  }

  _taskBadge() {
    if (!this._taskCount) return '';
    const isUrgent = this._taskCount >= 3; // destaque vermelho se ≥ 3 tarefas
    return `
      <span class="opp-task-badge${isUrgent ? ' opp-task-badge--urgent' : ''}"
            title="${this._taskCount} tarefa${this._taskCount > 1 ? 's' : ''} pendente${this._taskCount > 1 ? 's' : ''}">
        <svg viewBox="0 0 24 24">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        ${this._taskCount}
      </span>
    `;
  }

  _recontadoBadge() {
    const raw = this._n.data_recontado;
    if (!raw) return '';

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d     = new Date(raw);
    const dDay  = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    let mod = '';
    let label = '';
    if (dDay < today) {
      mod   = 'opp-recontado--overdue';
      label = `⚠ Recontato: ${this._formatData(raw)}`;
    } else if (dDay.getTime() === today.getTime()) {
      mod   = 'opp-recontado--today';
      label = `🔔 Recontato: Hoje`;
    } else {
      mod   = 'opp-recontado--future';
      label = `📅 Recontato: ${this._formatData(raw)}`;
    }

    return `<span class="opp-recontado ${mod}" title="Data de recontato: ${this._formatData(raw)}">${label}</span>`;
  }

  // ── render ─────────────────────────────────────────────────────

  html() {
    const { negocio_id, negocio_titulo, negocio_valor, negocio_status, criado_em, data_fechamento } = this._n;
    const { cls: tagCls, label: tagLabel } = this._statusTag(negocio_status);
    const isWon     = negocio_status === 'Ganho';
    const isLost    = negocio_status === 'Perdido';
    const cardStyle = isWon  ? 'border:1.5px solid rgba(26,206,238,0.35);'
                    : isLost ? 'border:1.5px solid rgba(255,80,80,0.25);'
                    : '';
    const valueStyle  = isWon ? 'color:#1ACEEE;' : isLost ? 'color:#aaa;' : '';
    const stepStyle   = isWon ? 'color:#1ACEEE;font-weight:700;' : isLost ? 'color:#f66;font-weight:700;' : '';
    const stepLabel   = isWon ? 'Fechado 🎉' : isLost ? 'Perdido' : this._label;
    const displayDate = isWon || isLost ? this._formatData(data_fechamento) : this._formatData(criado_em);
    const recontadoBadge = this._recontadoBadge();

    return `
      <div class="opp-card" id="opp-${negocio_id}" draggable="true" style="${cardStyle}">
        <div class="opp-card-top">
          <div>
            <div class="opp-client">${negocio_titulo || '(sem título)'}</div>
            <div class="opp-industry">${displayDate}</div>
          </div>
        </div>
        <div class="opp-value" style="${valueStyle}">${this._formatValor(negocio_valor)}</div>
        <div class="opp-status-row">
          <span class="opp-tag ${tagCls}">${tagLabel}</span>
          ${this._taskBadge()}
        </div>
        ${recontadoBadge ? `<div class="opp-recontado-row">${recontadoBadge}</div>` : ''}
        <div class="opp-bottom">
          <div class="opp-avatars">${this._vendedorAvatar()}</div>
        </div>
      </div>
    `;
  }
}
