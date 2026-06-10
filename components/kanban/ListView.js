/**
 * ListView.js — Visualização em lista do Funil
 * - Filtro de etapa (chips acima da tabela)
 * - Todas as colunas ordenáveis
 */
import { EtapasPipeline, Negocios, Tarefas } from '../../js/db.js';

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

export default class ListView {
  constructor(containerId) {
    this._containerId     = containerId;
    this._statusFilter    = 'Aberto';
    this._vendedorFilter  = null;
    this._etapaFilter     = null;
    this._origemFilter    = null;
    this._recontadoFilter = null;
    this._searchQuery     = '';
    this._allNegocios     = [];
    this._etapas          = [];
    this._etapaMap        = {};
    this._tarefasMap      = {};
    this._sortBy          = 'criado_em';
    this._sortDir         = 'desc';
  }

  // ── API pública ───────────────────────────────────────────────

  setData({ etapas, allNegocios, tarefasMap }) {
    this._etapas      = [...(etapas ?? [])].sort((a, b) => a.etapa_ordem - b.etapa_ordem);
    this._allNegocios = allNegocios ?? [];
    this._tarefasMap  = tarefasMap  ?? {};
    this._buildEtapaMap();
  }

  async fetchData(pipelineId) {
    const container = document.getElementById(this._containerId);
    if (container) container.innerHTML = this._loadingHTML();

    const [etapasRes, negociosRes] = await Promise.all([
      EtapasPipeline.getByPipeline(pipelineId),
      Negocios.getByPipeline(pipelineId),
    ]);

    this._etapas      = [...(etapasRes.data ?? [])].sort((a, b) => a.etapa_ordem - b.etapa_ordem);
    this._allNegocios = negociosRes.data ?? [];

    const ids = this._allNegocios.map(n => n.negocio_id);
    const { data: t } = await Tarefas.getPendentesPorNegocios(ids);
    this._tarefasMap = {};
    (t ?? []).forEach(x => {
      this._tarefasMap[x.negocio_id] = (this._tarefasMap[x.negocio_id] || 0) + 1;
    });

    this._buildEtapaMap();
  }

  render(statusFilter, vendedorFilter) {
    if (statusFilter   !== undefined) this._statusFilter   = statusFilter;
    if (vendedorFilter !== undefined) this._vendedorFilter = vendedorFilter;
    this._renderList();
  }

  applyStatusFilter(status)       { this._statusFilter    = status;    this._renderList(); }
  applyVendedorFilter(vendedorId)  { this._vendedorFilter  = vendedorId; this._renderList(); }
  applyEtapaFilter(etapaId)        { this._etapaFilter     = etapaId;   this._renderList(); }
  applyOrigemFilter(origem)        { this._origemFilter    = origem;    this._renderList(); }
  applyRecontadoFilter(periodo)    { this._recontadoFilter = periodo;   this._renderList(); }
  applySearch(query)               { this._searchQuery     = query;     this._renderList(); }

  // ── Internos ──────────────────────────────────────────────────

  _buildEtapaMap() {
    this._etapaMap = {};
    this._etapas.forEach(e => { this._etapaMap[e.etapa_id] = e; });
  }

  _getFiltered() {
    let list = this._vendedorFilter
      ? this._allNegocios.filter(n => n.vendedor_id === this._vendedorFilter)
      : [...this._allNegocios];

    if (this._statusFilter !== 'Todos')
      list = list.filter(n => n.negocio_status === this._statusFilter);

    if (this._etapaFilter !== null)
      list = list.filter(n => n.etapa_id === this._etapaFilter);

    if (this._origemFilter)
      list = list.filter(n => n.negocio_origem === this._origemFilter);

    if (this._recontadoFilter)
      list = _applyDateFilter(list, this._recontadoFilter);

    // Filtro por busca (nome ou telefone)
    const q = (this._searchQuery || '').toLowerCase();
    if (q) {
      list = list.filter(n =>
        (n.negocio_titulo   || '').toLowerCase().includes(q) ||
        (n.negocio_telefone || '').toLowerCase().includes(q)
      );
    }

    // Ordenação
    list.sort((a, b) => {
      const va = this._getSortValue(a);
      const vb = this._getSortValue(b);
      if (va < vb) return this._sortDir === 'asc' ? -1 : 1;
      if (va > vb) return this._sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    return list;
  }

  _getSortValue(neg) {
    switch (this._sortBy) {
      case 'negocio_titulo':
        return (neg.negocio_titulo ?? '').toLowerCase();
      case 'negocio_valor':
        return parseFloat(neg.negocio_valor) || 0;
      case 'negocio_status': {
        const order = { Aberto: 0, Ganho: 1, Perdido: 2 };
        return order[neg.negocio_status] ?? 99;
      }
      case 'etapa':
        return this._etapaMap[neg.etapa_id]?.etapa_ordem ?? 0;
      case 'responsavel':
        return (neg.usuarios?.user_nome ?? '').toLowerCase();
      case 'tarefas':
        return this._tarefasMap[neg.negocio_id] || 0;
      case 'data_recontado':
        return neg.data_recontado ?? '';
      case 'negocio_origem':
        return (neg.negocio_origem ?? '').toLowerCase();
      case 'criado_em':
      default:
        return neg.criado_em ?? '';
    }
  }

  // ── Render principal ──────────────────────────────────────────

  _renderList() {
    const container = document.getElementById(this._containerId);
    if (!container) return;

    const negocios = this._getFiltered();

    container.innerHTML = `
      ${this._etapaFilterBarHTML()}
      ${negocios.length
        ? `<div class="pipeline-list-wrap">
             <table class="pipeline-list-table">
               <thead><tr>${this._theadHTML()}</tr></thead>
               <tbody>${negocios.map(n => this._rowHTML(n)).join('')}</tbody>
             </table>
           </div>`
        : this._emptyHTML()
      }`;

    // Bind etapa chips
    container.querySelectorAll('.etapa-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.etapaId === '' ? null : parseInt(chip.dataset.etapaId, 10);
        this._etapaFilter = id;
        this._renderList();
      });
    });

    // Bind ordenação das colunas
    container.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (this._sortBy === col) this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        else { this._sortBy = col; this._sortDir = 'asc'; }
        this._renderList();
      });
    });
  }

  // ── HTML helpers ──────────────────────────────────────────────

  _etapaFilterBarHTML() {
    const chips = [
      `<button class="etapa-chip${this._etapaFilter === null ? ' etapa-chip--active' : ''}"
               data-etapa-id="">Todas as etapas</button>`,
      ...this._etapas.map(e => `
        <button class="etapa-chip${this._etapaFilter === e.etapa_id ? ' etapa-chip--active' : ''}"
                data-etapa-id="${e.etapa_id}">
          <span class="etapa-chip-ordem">${e.etapa_ordem}</span>
          ${e.etapa_nome}
        </button>`)
    ].join('');

    // Conta por etapa (respeitando outros filtros, exceto o de etapa)
    const countMap = {};
    let base = this._vendedorFilter
      ? this._allNegocios.filter(n => n.vendedor_id === this._vendedorFilter)
      : [...this._allNegocios];
    if (this._statusFilter !== 'Todos') base = base.filter(n => n.negocio_status === this._statusFilter);
    base.forEach(n => { countMap[n.etapa_id] = (countMap[n.etapa_id] || 0) + 1; });

    const chipsWithCount = [
      `<button class="etapa-chip${this._etapaFilter === null ? ' etapa-chip--active' : ''}"
               data-etapa-id="">
        Todas
        <span class="etapa-chip-count">${base.length}</span>
      </button>`,
      ...this._etapas.map(e => `
        <button class="etapa-chip${this._etapaFilter === e.etapa_id ? ' etapa-chip--active' : ''}"
                data-etapa-id="${e.etapa_id}">
          <span class="etapa-chip-ordem">${e.etapa_ordem}</span>
          ${e.etapa_nome}
          <span class="etapa-chip-count">${countMap[e.etapa_id] || 0}</span>
        </button>`)
    ].join('');

    return `<div class="etapa-filter-bar">${chipsWithCount}</div>`;
  }

  _sortIcon(col) {
    if (this._sortBy !== col)
      return `<svg class="sort-icon sort-icon--idle" viewBox="0 0 24 24"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>`;
    return this._sortDir === 'asc'
      ? `<svg class="sort-icon sort-icon--asc"  viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
      : `<svg class="sort-icon sort-icon--desc" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
  }

  _theadHTML() {
    const cols = [
      { key: 'negocio_titulo',  label: 'Negócio',     cls: 'col-titulo'    },
      { key: 'negocio_valor',   label: 'Valor',        cls: 'col-valor'     },
      { key: 'negocio_status',  label: 'Status',       cls: 'col-status'    },
      { key: 'etapa',           label: 'Etapa',        cls: 'col-etapa'     },
      { key: 'responsavel',     label: 'Responsável',  cls: 'col-resp'      },
      { key: 'data_recontado',  label: 'Recontato',    cls: 'col-recontato' },
      { key: 'negocio_origem',  label: 'Origem',       cls: 'col-origem'    },
      { key: null,              label: 'Telefone',     cls: 'col-telefone'  },
      { key: null,              label: 'Segmento',     cls: 'col-segmento'  },
      { key: 'tarefas',         label: 'Tarefas',      cls: 'col-tarefas'   },
      { key: 'criado_em',       label: 'Criado em',    cls: 'col-data'      },
    ];
    return cols.map(c => `
      <th class="${c.cls}${c.key ? ' sortable' : ''}" ${c.key ? `data-sort="${c.key}"` : ''}>
        ${c.label} ${c.key ? this._sortIcon(c.key) : ''}
      </th>`).join('');
  }

  _rowHTML(neg) {
    const valor    = parseFloat(neg.negocio_valor) || 0;
    const hasValor = !!neg.negocio_valor;
    const valorFmt = hasValor
      ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
      : '—';
    const status   = neg.negocio_status;
    const isWon    = status === 'Ganho', isLost = status === 'Perdido';
    const statusCls = isWon ? 'tag-won' : isLost ? 'tag-cold' : 'tag-warm';
    const statusLbl = isWon ? '✓ Ganho' : isLost ? '✗ Perdido' : 'Em aberto';

    const etapa     = this._etapaMap[neg.etapa_id];
    const etapaNome = etapa?.etapa_nome ?? '—';
    const etapaOrd  = etapa?.etapa_ordem ?? 0;
    const total     = this._etapas.length;

    const user   = neg.usuarios;
    let avatarHTML = '', vendedorNome = '—';
    if (user) {
      const p = (user.user_nome || '?').trim().split(' ');
      const ini = p.length > 1 ? `${p[0][0]}${p[p.length-1][0]}` : p[0].substring(0, 2);
      vendedorNome = p.length > 1 ? `${p[0]} ${p[p.length-1]}` : p[0];
      avatarHTML   = user.user_avatar
        ? `<img class="list-avatar list-avatar--img" src="${user.user_avatar}" alt="${user.user_nome}">`
        : `<span class="list-avatar list-avatar--initials">${ini.toUpperCase()}</span>`;
    }

    const tc      = this._tarefasMap[neg.negocio_id] || 0;
    const taskHTML = tc > 0
      ? `<span class="opp-task-badge${tc >= 3 ? ' opp-task-badge--urgent' : ''}">
           <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
           ${tc}
         </span>`
      : '<span class="list-no-tasks">—</span>';

    // Criado em
    const dataISO = (isWon || isLost) ? neg.data_fechamento : neg.criado_em;
    const dataFmt = dataISO
      ? new Date(dataISO).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
      : '—';

    // Recontato
    let recontadoHTML = '<span class="list-no-tasks">—</span>';
    if (neg.data_recontado) {
      const rc    = new Date(neg.data_recontado);
      const today = new Date(); today.setHours(0,0,0,0);
      const rcDay = new Date(rc); rcDay.setHours(0,0,0,0);
      const diff  = Math.round((rcDay - today) / 86400000);
      const rcFmt = rc.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const cls   = diff < 0 ? 'opp-recontado--overdue' : diff === 0 ? 'opp-recontado--today' : 'opp-recontado--future';
      const lbl   = diff < 0 ? `Vencido · ${rcFmt}` : diff === 0 ? `Hoje · ${rcFmt}` : rcFmt;
      recontadoHTML = `<span class="opp-recontado ${cls}">${lbl}</span>`;
    }

    // Telefone
    const telHTML = neg.negocio_telefone
      ? `<a class="list-telefone" href="tel:${neg.negocio_telefone}" onclick="event.stopPropagation()">${neg.negocio_telefone}</a>`
      : '<span class="list-no-tasks">—</span>';

    // Origem
    const origemHTML = neg.negocio_origem
      ? `<span class="list-origem-badge">${neg.negocio_origem}</span>`
      : '<span class="list-no-tasks">—</span>';

    // Segmento
    const segHTML = neg.negocio_segmento
      ? `<span class="list-segmento">${neg.negocio_segmento}</span>`
      : '<span class="list-no-tasks">—</span>';

    return `
      <tr class="pipeline-list-row" id="list-row-${neg.negocio_id}" data-negocio-id="${neg.negocio_id}" style="cursor:pointer;">
        <td class="col-titulo col-sticky"><span class="list-titulo">${neg.negocio_titulo || '(sem título)'}</span></td>
        <td class="col-valor">
          <span class="list-valor${isWon ? ' list-valor--won' : isLost ? ' list-valor--lost' : ''}">${valorFmt}</span>
        </td>
        <td class="col-status"><span class="opp-tag ${statusCls}">${statusLbl}</span></td>
        <td class="col-etapa">
          <div class="list-etapa">
            <span class="list-etapa-nome">${etapaNome}</span>
            <span class="list-etapa-ordem">${etapaOrd}/${total}</span>
          </div>
        </td>
        <td class="col-resp">
          <div class="list-resp">${avatarHTML}<span class="list-resp-nome">${vendedorNome}</span></div>
        </td>
        <td class="col-recontato">${recontadoHTML}</td>
        <td class="col-origem">${origemHTML}</td>
        <td class="col-telefone">${telHTML}</td>
        <td class="col-segmento">${segHTML}</td>
        <td class="col-tarefas">${taskHTML}</td>
        <td class="col-data"><span class="list-data">${dataFmt}</span></td>
      </tr>`;
  }




  _emptyHTML() {
    return `
      <div class="pipeline-list-empty">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <p>Nenhum negócio encontrado para este filtro.</p>
      </div>`;
  }

  _loadingHTML() {
    return `
      <div class="pipeline-list-loading">
        ${[1,2,3,4,5].map(() => `
          <div class="list-skeleton-row">
            <span class="skeleton-line" style="width:20%;height:13px"></span>
            <span class="skeleton-line" style="width:9%;height:13px"></span>
            <span class="skeleton-line" style="width:8%;height:13px"></span>
            <span class="skeleton-line" style="width:11%;height:13px"></span>
            <span class="skeleton-line" style="width:10%;height:13px"></span>
            <span class="skeleton-line" style="width:9%;height:13px"></span>
            <span class="skeleton-line" style="width:8%;height:13px"></span>
            <span class="skeleton-line" style="width:10%;height:13px"></span>
            <span class="skeleton-line" style="width:9%;height:13px"></span>
            <span class="skeleton-line" style="width:5%;height:13px"></span>
            <span class="skeleton-line" style="width:7%;height:13px"></span>
          </div>`).join('')}
      </div>`;
  }
}
