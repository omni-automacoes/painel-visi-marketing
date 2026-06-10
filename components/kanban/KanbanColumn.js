/**
 * KanbanColumn.js — Coluna individual do quadro Kanban
 * Recebe dados de etapa_pipeline + array de OppCard renderizados.
 */
export default class KanbanColumn {
  /**
   * @param {Object}    etapa      - Dados da etapa (etapa_id, etapa_nome, etapa_ordem)
   * @param {string[]}  cardsHTML  - Array de strings HTML dos cards
   * @param {number}    total      - Número de etapas do funil (para calcular "Etapa X / Y")
   */
  constructor(etapa, cardsHTML = [], total = 1) {
    this._etapa     = etapa;
    this._cardsHTML = cardsHTML;
    this._total     = total;
  }

  html() {
    const { etapa_id, etapa_nome, etapa_ordem } = this._etapa;
    const count      = this._cardsHTML.length;
    const isLast     = etapa_ordem === this._total;
    const countClass = isLast ? 'kanban-col-count cyan-count' : 'kanban-col-count';
    const emoji      = this._etapaEmoji(etapa_ordem, this._total);

    return `
      <div class="kanban-column" id="col-${etapa_id}" data-etapa-id="${etapa_id}">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${emoji} ${etapa_nome}</span>
          <span class="${countClass}">${count}</span>
        </div>

        ${this._cardsHTML.join('') || `
          <div class="kanban-empty-col">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Nenhum negócio</span>
          </div>
        `}

        <span class="kanban-add-btn" data-etapa-id="${etapa_id}" style="display:none;" aria-hidden="true"></span>
      </div>
    `;
  }

  /** Emoji baseado na posição da etapa no funil */
  _etapaEmoji(ordem, total) {
    if (ordem === 1)     return '🟢';
    if (ordem === total) return '✅';
    const mid = Math.ceil(total / 2);
    if (ordem <= mid)   return '🔵';
    return '⚡';
  }
}
