/**
 * KanbanBoard.js — Quadro Kanban dinâmico (Pipeline)
 *
 * Filtros suportados:
 *   - statusFilter:   'Aberto' | 'Ganho' | 'Perdido' | 'Todos'
 *   - vendedorFilter: UUID (string) | null (= todos)
 *
 * Uso:
 *   const board = new KanbanBoard('kanban-board');
 *   await board.render(pipelineId, statusFilter, vendedorFilter);
 *
 *   board.applyStatusFilter('Ganho');
 *   board.applyVendedorFilter('uuid-do-vendedor');
 *   board.applyVendedorFilter(null); // Todos
 */
import { EtapasPipeline, Negocios, Tarefas } from '../../js/db.js';
import KanbanColumn from './KanbanColumn.js';
import OppCard      from './OppCard.js';

/** Utilitário: filtra negócios por período de data_recontado */
function _applyDateFilter(list, period) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms    = 86400000;
  return list.filter(n => {
    if (!n.data_recontado) return false;
    const d = new Date(n.data_recontado);
    switch (period) {
      case 'hoje':      return d >= today && d < new Date(today.getTime() + ms);
      case 'ultimos7':  return d >= new Date(today.getTime() - 7  * ms) && d < new Date(today.getTime() + ms);
      case 'ultimos15': return d >= new Date(today.getTime() - 15 * ms) && d < new Date(today.getTime() + ms);
      case 'ultimos30': return d >= new Date(today.getTime() - 30 * ms) && d < new Date(today.getTime() + ms);
      case 'proximos7': return d >= today && d < new Date(today.getTime() + 7 * ms);
      default:          return true;
    }
  });
}

export default class KanbanBoard {
  constructor(containerId) {
    this._containerId     = containerId;
    this._pipelineId      = null;
    this._statusFilter    = 'Aberto';
    this._vendedorFilter  = null;
    this._origemFilter    = null;
    this._recontadoFilter = null;
    this._searchQuery     = '';
    this._allNegocios     = [];
    this._etapas          = [];
    this._tarefasMap      = {};
  }

  // ── API pública ────────────────────────────────────────────────

  async render(pipelineId, statusFilter, vendedorFilter) {
    this._pipelineId     = pipelineId     ?? this._pipelineId;
    this._statusFilter   = statusFilter   ?? this._statusFilter;
    // vendedorFilter pode ser null explicitamente (= todos), por isso checagem diferente
    if (vendedorFilter !== undefined) this._vendedorFilter = vendedorFilter;

    const container = document.getElementById(this._containerId);
    if (!container) return;

    container.innerHTML = this._loadingHTML();

    try {
      const [etapasRes, negociosRes] = await Promise.all([
        EtapasPipeline.getByPipeline(this._pipelineId),
        Negocios.getByPipeline(this._pipelineId),
      ]);

      if (etapasRes.error)   throw etapasRes.error;
      if (negociosRes.error) throw negociosRes.error;

      this._etapas      = etapasRes.data  ?? [];
      this._allNegocios = negociosRes.data ?? [];

      // Busca tarefas pendentes para todos os negócios do funil (1 query)
      const negocioIds = this._allNegocios.map(n => n.negocio_id);
      const { data: tarefasData } = await Tarefas.getPendentesPorNegocios(negocioIds);
      this._tarefasMap = {};
      (tarefasData ?? []).forEach(t => {
        this._tarefasMap[t.negocio_id] = (this._tarefasMap[t.negocio_id] || 0) + 1;
      });

      if (this._etapas.length === 0) {
        container.innerHTML = this._emptyHTML('Nenhuma etapa encontrada para este funil.');
        return;
      }

      this._renderBoard();

    } catch (err) {
      console.error('[KanbanBoard] Erro ao carregar dados:', err);
      const c = document.getElementById(this._containerId);
      if (c) c.innerHTML = this._emptyHTML('Erro ao carregar o funil. Tente novamente.');
    }
  }

  /** Troca funil (rebusca Supabase, mantém filtros atuais) */
  async setFilter(pipelineId) {
    await this.render(pipelineId, this._statusFilter, this._vendedorFilter);
  }

  /** Retorna dados em cache para uso por outras views (ex: ListView) */
  getData() {
    return {
      etapas:      this._etapas,
      allNegocios: this._allNegocios,
      tarefasMap:  this._tarefasMap,
    };
  }

  /** Re-renderiza do cache sem nova query ao Supabase */
  refresh() {
    if (this._allNegocios.length || this._etapas.length) {
      this._renderBoard();
    }
  }

  /** Aplica filtro de status sem nova query */
  applyStatusFilter(status)     { this._statusFilter    = status;    this._renderBoard(); }
  /** Aplica filtro de vendedor sem nova query */
  applyVendedorFilter(vendedorId) { this._vendedorFilter = vendedorId; this._renderBoard(); }
  /** Aplica filtro de origem */
  applyOrigemFilter(origem)     { this._origemFilter    = origem;    this._renderBoard(); }
  /** Aplica filtro de data de recontato */
  applyRecontadoFilter(periodo) { this._recontadoFilter = periodo;   this._renderBoard(); }
  /** Filtra por nome ou telefone */
  applySearch(query)            { this._searchQuery     = query;     this._renderBoard(); }

  // ── Render interno ─────────────────────────────────────────────

  _renderBoard() {
    const container = document.getElementById(this._containerId);
    if (!container) return;

    // Filtros encadeados (client-side)
    let list = this._vendedorFilter
      ? this._allNegocios.filter(n => n.vendedor_id === this._vendedorFilter)
      : [...this._allNegocios];

    if (this._statusFilter !== 'Todos') {
      if (this._statusFilter === 'Aberto') {
        list = list.filter(n => n.negocio_status === 'Aberto' || n.negocio_status === 'Ganho');
      } else {
        list = list.filter(n => n.negocio_status === this._statusFilter);
      }
    }

    if (this._origemFilter)
      list = list.filter(n => n.negocio_origem === this._origemFilter);

    if (this._recontadoFilter)
      list = _applyDateFilter(list, this._recontadoFilter);

    const q = (this._searchQuery || '').toLowerCase();
    const negociosFiltrados = q
      ? list.filter(n =>
          (n.negocio_titulo   || '').toLowerCase().includes(q) ||
          (n.negocio_telefone || '').toLowerCase().includes(q))
      : list;

    // 3. Agrupa por etapa
    const negociosPorEtapa = {};
    this._etapas.forEach(e => { negociosPorEtapa[e.etapa_id] = []; });
    negociosFiltrados.forEach(n => {
      if (negociosPorEtapa[n.etapa_id] !== undefined) {
        negociosPorEtapa[n.etapa_id].push(n);
      }
    });

    const total = this._etapas.length;
    const columnsHTML = this._etapas.map(etapa => {
      const cards      = negociosPorEtapa[etapa.etapa_id] ?? [];
      const etapaLabel = `Etapa ${etapa.etapa_ordem} / ${total}`;
      const cardsHTML  = cards.map(neg =>
        new OppCard(neg, etapaLabel, this._tarefasMap[neg.negocio_id] ?? 0).html()
      );
      return new KanbanColumn(etapa, cardsHTML, total).html();
    }).join('');

    container.style.gridTemplateColumns = `repeat(${total}, minmax(260px, 1fr))`;
    container.innerHTML = columnsHTML;

    this._updateSummary(negociosFiltrados, this._etapas);
    this._initDragAndDrop();
  }

  // ── Helpers de UI ──────────────────────────────────────────────

  _loadingHTML() {
    return [1, 2, 3, 4].map(() => `
      <div class="kanban-column kanban-column--skeleton">
        <div class="kanban-col-header">
          <span class="skeleton-line" style="width:60%;height:14px;"></span>
          <span class="skeleton-pill"></span>
        </div>
        ${[1, 2].map(() => `
          <div class="opp-card opp-card--skeleton">
            <div class="skeleton-line" style="width:80%;height:13px;margin-bottom:8px;"></div>
            <div class="skeleton-line" style="width:50%;height:22px;margin-bottom:12px;"></div>
            <div class="skeleton-line" style="width:40%;height:11px;"></div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  _emptyHTML(msg) {
    return `
      <div class="kanban-empty-board">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <p>${msg}</p>
      </div>
    `;
  }

  _updateSummary(negocios, etapas) {
    const abertos    = this._allNegocios.filter(n => n.negocio_status === 'Aberto');
    const totalValor = negocios.reduce((s, n) => s + (parseFloat(n.negocio_valor) || 0), 0);

    // Calcular Total Vendido (Ganho) aplicando os mesmos filtros
    let listGanho = this._vendedorFilter
      ? this._allNegocios.filter(n => n.vendedor_id === this._vendedorFilter)
      : [...this._allNegocios];

    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    listGanho = listGanho.filter(n => {
      if (n.negocio_status !== 'Ganho' || !n.data_fechamento) return false;
      const dataF = new Date(n.data_fechamento);
      return dataF.getMonth() === mesAtual && dataF.getFullYear() === anoAtual;
    });
    if (this._origemFilter)
      listGanho = listGanho.filter(n => n.negocio_origem === this._origemFilter);

    if (this._recontadoFilter)
      listGanho = _applyDateFilter(listGanho, this._recontadoFilter);

    const q = (this._searchQuery || '').toLowerCase();
    if (q) {
      listGanho = listGanho.filter(n =>
        (n.negocio_titulo   || '').toLowerCase().includes(q) ||
        (n.negocio_telefone || '').toLowerCase().includes(q)
      );
    }

    const totalVendido = listGanho.reduce((s, n) => s + (parseFloat(n.negocio_valor) || 0), 0);

    const labelTotal = this._statusFilter === 'Todos'   ? 'Valor Total'
                     : this._statusFilter === 'Aberto'  ? 'Total em aberto'
                     : this._statusFilter === 'Ganho'   ? 'Total ganho'
                     : 'Total perdido';

    const subLabel = this._statusFilter === 'Todos'   ? `${negocios.length} negócios`
                   : this._statusFilter === 'Aberto'  ? `${negocios.length} oportunidades ativas`
                   : `${negocios.length} ${this._statusFilter.toLowerCase()}s`;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('kpi-total-label', labelTotal);
    set('kpi-total-valor', totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }));
    set('kpi-fechado-valor', totalVendido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }));
    set('kpi-opp-count',   `${negocios.length}`);
    set('funil-opp-count', subLabel);

    const badge = document.querySelector('.nav-link[data-route="pipeline"] .nav-badge');
    if (badge) badge.textContent = String(abertos.length);
  }

  // ── Drag & Drop ────────────────────────────────────────────────

  _initDragAndDrop() {
    const board = document.getElementById(this._containerId);
    if (!board) return;

    let _origemEtapaId = null;

    board.querySelectorAll('.opp-card[draggable]').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        _origemEtapaId = null;
        const colOrigem = card.closest('.kanban-column');
        _origemEtapaId  = colOrigem ? parseInt(colOrigem.dataset.etapaId, 10) : null;

        // ── Imagem customizada elevada ──────────────────────────
        const ghost = card.cloneNode(true);
        ghost.style.cssText = `
          position: fixed; top: -9999px; left: -9999px;
          width: ${card.offsetWidth}px;
          transform: rotate(2deg) scale(1.04);
          box-shadow: 0 24px 60px rgba(0,0,0,0.22), 0 0 0 2px rgba(26,206,238,0.6);
          border-radius: 14px;
          opacity: 1;
          pointer-events: none;
          background: white;
        `;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, card.offsetWidth / 2, 30);
        setTimeout(() => ghost.remove(), 0);

        // ── Card original vira ghost ────────────────────────────
        setTimeout(() => card.classList.add('dragging'), 0);
      });

      card.addEventListener('dragend', async () => {
        card.classList.remove('dragging');
        // Remove highlight de todas as colunas
        board.querySelectorAll('.kanban-column').forEach(c => {
          c.classList.remove('kanban-col--drop-target');
        });

        const colDestino     = card.closest('.kanban-column');
        const destinoEtapaId = colDestino ? parseInt(colDestino.dataset.etapaId, 10) : null;

        if (!destinoEtapaId || destinoEtapaId === _origemEtapaId) return;

        const negocioId = parseInt(card.id.replace('opp-', ''), 10);
        if (!negocioId) return;

        card.classList.add('opp-card--saving');
        const { error } = await Negocios.updateEtapa(negocioId, destinoEtapaId);
        card.classList.remove('opp-card--saving');

        if (error) {
          console.error('[KanbanBoard] Erro ao atualizar etapa:', error);
          card.classList.add('opp-card--save-error');
          setTimeout(() => card.classList.remove('opp-card--save-error'), 2500);
          this._renderBoard();
        } else {
          const neg = this._allNegocios.find(n => n.negocio_id === negocioId);
          if (neg) neg.etapa_id = destinoEtapaId;
          card.classList.add('opp-card--save-ok');
          setTimeout(() => card.classList.remove('opp-card--save-ok'), 1200);
        }

        _origemEtapaId = null;
      });
    });

    board.querySelectorAll('.kanban-column').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = board.querySelector('.dragging');
        if (!dragging) return;

        // Highlight da coluna atual
        board.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('kanban-col--drop-target'));
        col.classList.add('kanban-col--drop-target');

        const addBtn = col.querySelector('.kanban-add-btn');
        col.insertBefore(dragging, addBtn);
      });

      col.addEventListener('dragleave', (e) => {
        // Remove highlight só quando sair de fato da coluna
        if (!col.contains(e.relatedTarget)) {
          col.classList.remove('kanban-col--drop-target');
        }
      });
    });
  }
}

