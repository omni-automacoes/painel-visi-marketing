/**
 * projetos.js — Página de Projetos (Kanban com dados reais do Supabase)
 */

import { KanbanColunas, KanbanCards, KanbanComentarios, KanbanArquivos } from '../js/db.js';
import UserStore    from '../js/userStore.js';
import { supabase } from '../js/supabase.js';

// ── Estado ─────────────────────────────────────────────────────────
let _state = {
  columns:    [],  // [{ coluna_id, coluna_nome, coluna_cor, coluna_ordem }]
  cards:      {},  // { [coluna_id]: [...cards] }
  openCardId: null,
  tipoKanban: 'Projetos',
};

// ── Constantes ──────────────────────────────────────────────────────
const AVATAR_COLORS  = ['#6366F1','#F59E0B','#10B981','#EC4899','#3B82F6','#8B5CF6'];
const PRIORITY_META  = {
  'Alta':  { cls: 'pj-pri--alta',  dot: '#EF4444' },
  'Média': { cls: 'pj-pri--media', dot: '#F59E0B' },
  'Baixa': { cls: 'pj-pri--baixa', dot: '#10B981' },
};
const BUCKET = 'visi-marketing';
const COLORS  = ['#6366F1','#F59E0B','#10B981','#EF4444','#3B82F6','#8B5CF6','#EC4899','#06B6D4'];

// ── Utilidades ──────────────────────────────────────────────────────
function _fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function _fmtDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}
function _isOverdue(iso) {
  if (!iso) return false;
  return new Date(iso + 'T00:00:00') < new Date();
}
function _avatarColor(str = '') {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function _initials(nome = '') {
  const p = nome.trim().split(' ').filter(Boolean);
  if (!p.length) return '??';
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].substring(0, 2)).toUpperCase();
}
function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function _tagStyle(tag = '') {
  if (!tag) return null;
  const t = tag.toLowerCase().trim();

  // 1. Mapeamento Direto e Exato para as Etiquetas Padrão
  if (t === 'arte feita') {
    return { bg: 'rgba(139, 92, 246, 0.14)', color: '#7c3aed', border: 'rgba(139, 92, 246, 0.35)' }; // Roxo
  }
  if (t === 'enviado ao cliente' || t.includes('enviado')) {
    return { bg: 'rgba(59, 130, 246, 0.14)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.35)' }; // Azul
  }
  if (t === 'alteração' || t === 'alteracao' || t.includes('alteraç') || t.includes('alterac')) {
    return { bg: 'rgba(245, 158, 11, 0.14)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)' }; // Laranja
  }
  if (t === 'aprovado' || t.includes('aprovad')) {
    return { bg: 'rgba(16, 185, 129, 0.14)', color: '#059669', border: 'rgba(16, 185, 129, 0.35)' }; // Verde
  }
  if (t === 'postado' || t.includes('postad') || t.includes('publicad')) {
    return { bg: 'rgba(16, 185, 129, 0.14)', color: '#059669', border: 'rgba(16, 185, 129, 0.35)' }; // Verde
  }

  // 2. Mapeamento por Palavras-Chave Genericas
  if (t.includes('assessoria') || t.includes('tráfego') || t.includes('ads')) {
    return { bg: 'rgba(26, 206, 238, 0.14)', color: '#009bb6', border: 'rgba(26, 206, 238, 0.35)' }; // Ciano
  }
  if (t.includes('design') || t.includes('criativo') || t.includes('mídia') || t.includes('arte')) {
    return { bg: 'rgba(139, 92, 246, 0.14)', color: '#7c3aed', border: 'rgba(139, 92, 246, 0.35)' }; // Roxo
  }
  if (t.includes('desenvolvimento') || t.includes('site') || t.includes('landing') || t.includes('web') || t.includes('dev')) {
    return { bg: 'rgba(59, 130, 246, 0.14)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.35)' }; // Azul
  }
  if (t.includes('urgente') || t.includes('crítico') || t.includes('erro') || t.includes('bug')) {
    return { bg: 'rgba(239, 68, 68, 0.14)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.35)' }; // Vermelho
  }
  if (t.includes('reunião') || t.includes('call') || t.includes('alinhamento') || t.includes('briefing')) {
    return { bg: 'rgba(245, 158, 11, 0.14)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)' }; // Laranja
  }
  if (t.includes('finalizado') || t.includes('concluído') || t.includes('ok') || t.includes('sucesso')) {
    return { bg: 'rgba(16, 185, 129, 0.14)', color: '#059669', border: 'rgba(16, 185, 129, 0.35)' }; // Verde
  }

  // Fallback
  const colors = [
    { bg: 'rgba(26, 206, 238, 0.14)', color: '#009bb6', border: 'rgba(26, 206, 238, 0.35)' },
    { bg: 'rgba(59, 130, 246, 0.14)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.35)' },
    { bg: 'rgba(16, 185, 129, 0.14)', color: '#059669', border: 'rgba(16, 185, 129, 0.35)' },
    { bg: 'rgba(236, 72, 153, 0.14)', color: '#db2777', border: 'rgba(236, 72, 153, 0.35)' },
    { bg: 'rgba(245, 158, 11, 0.14)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)' },
  ];
  let h = 0;
  for (const char of t) h = (h * 31 + char.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
}

// ── Builders HTML ───────────────────────────────────────────────────
function _renderCard(card) {
  const pri            = PRIORITY_META[card.card_prioridade] || PRIORITY_META['Média'];
  const due            = _fmtDate(card.card_data_entrega);
  const over           = _isOverdue(card.card_data_entrega);
  const filesCount     = card.kanban_arquivos?.length || 0;
  const commentsCount  = card.kanban_comentarios?.length || 0;
  const tagStyle       = _tagStyle(card.card_etiqueta);
  const hasFooter      = due || filesCount > 0 || commentsCount > 0;

  return `
    <div class="pj-card" data-card-id="${card.card_id}" id="pjcard-${card.card_id}" draggable="true">
      
      <!-- Cabeçalho do Card: Tag em grande destaque (esquerda) e Prioridade discreta (direita) -->
      <div class="pj-card-top">
        <div class="pj-card-tag-wrap">
          ${card.card_etiqueta ? `
            <span class="pj-card-tag-highlight" style="background:${tagStyle.bg}; color:${tagStyle.color}; border-color:${tagStyle.border};">
              <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              ${_esc(card.card_etiqueta)}
            </span>
          ` : `
            <span class="pj-card-tag-default">
              <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Geral
            </span>
          `}
        </div>

        <div class="pj-card-top-right">
          <!-- Prioridade discreta -->
          <span class="pj-priority-subtle ${pri.cls}" title="Prioridade: ${_esc(card.card_prioridade)}">
            <span class="pj-pri-dot" style="background:${pri.dot}"></span>
            <span class="pj-pri-text">${_esc(card.card_prioridade)}</span>
          </span>

          <!-- Botão Excluir Card -->
          <button class="pj-card-menu" data-action="card-del" data-card-id="${card.card_id}" title="Excluir card">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>

      <!-- Título e Descrição -->
      <h3 class="pj-card-title">${_esc(card.card_titulo)}</h3>
      ${card.card_descricao ? `<p class="pj-card-desc">${_esc(card.card_descricao)}</p>` : ''}

      <!-- Rodapé do Card -->
      ${hasFooter ? `
        <div class="pj-card-footer">
          <div class="pj-card-footer-left">
            ${due ? `
              <span class="pj-due ${over ? 'pj-due--overdue' : ''}">
                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>${due}${over ? ' · Atrasado' : ''}</span>
              </span>` : ''}
          </div>

          <div class="pj-card-footer-right">
            ${commentsCount > 0 ? `
              <span class="pj-card-meta-badge" title="${commentsCount} comentário(s)">
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                ${commentsCount}
              </span>` : ''}
            ${filesCount > 0 ? `
              <span class="pj-card-meta-badge" title="${filesCount} arquivo(s) anexo(s)">
                <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                ${filesCount}
              </span>` : ''}
          </div>
        </div>` : ''}
    </div>`;
}

const PRIORITY_ORDER = {
  'Alta':  1,
  'Média': 2,
  'Baixa': 3,
};

function _sortCards(cards = []) {
  return [...cards].sort((a, b) => {
    const priA = PRIORITY_ORDER[a.card_prioridade] || 2;
    const priB = PRIORITY_ORDER[b.card_prioridade] || 2;
    if (priA !== priB) {
      return priA - priB; // 1 ('Alta') < 2 ('Média') < 3 ('Baixa')
    }
    return (a.card_ordem ?? 0) - (b.card_ordem ?? 0);
  });
}

function _renderColumn(col) {
  const cards     = _state.cards[col.coluna_id] || [];
  const sorted    = _sortCards(cards);
  const cardsHtml = sorted.map(_renderCard).join('');
  return `
    <div class="pj-column" data-col-id="${col.coluna_id}" id="pjcol-${col.coluna_id}">
      <div class="pj-col-header" draggable="true" data-col-drag="${col.coluna_id}">
        <div class="pj-col-left">
          <span class="pj-col-grip" title="Arrastar coluna">
            <svg viewBox="0 0 10 16"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>
          </span>
          <span class="pj-col-dot" style="background:${col.coluna_cor}"></span>
          <span class="pj-col-title" data-col-title="${col.coluna_id}">${_esc(col.coluna_nome)}</span>
          <span class="pj-col-count">${cards.length}</span>
        </div>
        <div class="pj-col-actions">
          <button class="pj-col-btn" data-action="edit-col" data-col-id="${col.coluna_id}" title="Renomear">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="pj-col-btn pj-col-btn--del" data-action="del-col" data-col-id="${col.coluna_id}" title="Excluir coluna">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
      <div class="pj-cards-list" id="pjlist-${col.coluna_id}">
        ${cardsHtml}
        <button class="pj-add-card-btn" data-action="add-card" data-col-id="${col.coluna_id}">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar card
        </button>
      </div>
    </div>`;
}

// ── Carregamento do board ───────────────────────────────────────────
async function _loadBoard() {
  const board = document.getElementById('pj-board');
  if (!board) return;

  board.innerHTML = `
    <div class="pj-loading">
      <div class="funil-spinner"></div>
      Carregando ${_state.tipoKanban.toLowerCase()}...
    </div>`;

  const { data: columns, error } = await KanbanColunas.getAll(_state.tipoKanban);
  if (error) {
    board.innerHTML = `<div class="pj-loading">❌ Erro ao carregar colunas: ${_esc(error.message)}</div>`;
    return;
  }

  _state.columns = columns || [];
  _state.cards   = {};

  // Carrega todos os cards em paralelo
  await Promise.all(
    _state.columns.map(async col => {
      const { data } = await KanbanCards.getByColuna(col.coluna_id);
      _state.cards[col.coluna_id] = data || [];
    })
  );

  _renderBoard();
  _bindDragDrop();
}

function _renderBoard() {
  const board = document.getElementById('pj-board');
  if (!board) return;

  const addWrap = `
    <div class="pj-add-col-wrap">
      <button class="pj-add-col-btn" id="pj-add-col-btn" data-action="add-col">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nova coluna
      </button>
    </div>`;

  board.innerHTML = _state.columns.map(_renderColumn).join('') + addWrap;
}

// ── Drag & Drop ─────────────────────────────────────────────────────
let _dnd = {
  draggingCard:     null,
  draggingCardId:   null,
  draggingCardData: null,
  draggingCol:      null,
  cardPlaceholder:  null,
  colPlaceholder:   null,
  srcColId:         null,
  destColId:        null,
};

function _createCardPlaceholder(refEl) {
  const ph = document.createElement('div');
  ph.className = 'pj-card pj-card--placeholder';
  ph.style.height = (refEl?.offsetHeight || 80) + 'px';
  return ph;
}

function _createColPlaceholder(refEl) {
  const ph = document.createElement('div');
  ph.className = 'pj-column pj-column--placeholder';
  ph.style.minWidth = (refEl?.offsetWidth || 280) + 'px';
  return ph;
}

function _bindDragDrop() {
  const board = document.getElementById('pj-board');
  if (!board) return;

  // ── COLUNAS: drag pelos headers ──────────────────────────────────
  const colHeaders = board.querySelectorAll('[data-col-drag]');

  colHeaders.forEach(header => {
    const colEl = header.closest('.pj-column');

    header.addEventListener('dragstart', e => {
      if (e.target.closest('button')) { e.preventDefault(); return; }
      _dnd.draggingCol = colEl;
      colEl.classList.add('pj-col--dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'col:' + colEl.dataset.colId);
      _dnd.colPlaceholder = _createColPlaceholder(colEl);
      setTimeout(() => { colEl.style.opacity = '0.35'; }, 0);
    });

    header.addEventListener('dragend', async () => {
      if (!_dnd.draggingCol) return;
      
      // Move a coluna para a posição final do placeholder antes de ler o DOM
      if (_dnd.colPlaceholder && _dnd.colPlaceholder.parentNode) {
        _dnd.colPlaceholder.parentNode.insertBefore(_dnd.draggingCol, _dnd.colPlaceholder);
      }

      _dnd.draggingCol.style.opacity = '';
      _dnd.draggingCol.classList.remove('pj-col--dragging');
      _dnd.colPlaceholder?.remove();

      // Persiste nova ordem das colunas lendo o DOM atualizado
      const colsInDom = [...board.querySelectorAll('.pj-column[data-col-id]')];
      const newOrder  = colsInDom.map((el, i) => ({ id: parseInt(el.dataset.colId), ordem: i + 1 }));

      const results = await Promise.all(newOrder.map(({ id, ordem }) =>
        KanbanColunas.update(id, { coluna_ordem: ordem })
      ));
      results.forEach((res, i) => {
        if (res.error) console.error('[DnD] Erro ao salvar coluna', newOrder[i].id, ':', res.error);
      });

      newOrder.forEach(({ id, ordem }) => {
        const col = _state.columns.find(c => c.coluna_id === id);
        if (col) col.coluna_ordem = ordem;
      });

      _dnd.draggingCol    = null;
      _dnd.colPlaceholder = null;
    });
  });

  // ── COLUNAS: zona de drag de colunas e cards ─────────────────────
  board.querySelectorAll('.pj-column').forEach(colEl => {
    colEl.addEventListener('dragover', e => {
      if (_dnd.draggingCard) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const destColId = parseInt(colEl.dataset.colId);
        if (!destColId) return;
        _dnd.destColId = destColId;

        const listEl = colEl.querySelector('.pj-cards-list');
        if (!listEl) return;

        const addBtn = listEl.querySelector('.pj-add-card-btn');

        // Prioridade e peso do card que está sendo arrastado
        const draggingPri = _dnd.draggingCardData?.card_prioridade || 'Média';
        const draggingWeight = PRIORITY_ORDER[draggingPri] || 2; // 1: Alta, 2: Média, 3: Baixa

        // Cards visíveis na coluna de destino (exclui o que está sendo arrastado e o placeholder)
        const renderedCards = [...listEl.querySelectorAll(
          '.pj-card:not(.pj-card--dragging):not(.pj-card--placeholder)'
        )];

        // Mapeia cards com seus respectivos pesos de prioridade
        const allKnownCards = [
          ...(_state.cards[destColId] || []),
          ...(_state.cards[_dnd.srcColId] || []),
          ...Object.values(_state.cards).flat(),
        ];

        const cardsWithWeight = renderedCards.map(el => {
          const cid = parseInt(el.dataset.cardId);
          const cdata = allKnownCards.find(c => c.card_id === cid);
          const pri = cdata?.card_prioridade || 'Média';
          const weight = PRIORITY_ORDER[pri] || 2;
          return { el, cid, weight };
        });

        const samePriCards  = cardsWithWeight.filter(c => c.weight === draggingWeight);
        const lowerPriCards = cardsWithWeight.filter(c => c.weight > draggingWeight);

        // Determina o elemento antes do qual o placeholder deve ser inserido:
        // 1. O placeholder NUNCA pode ficar antes de um card com prioridade maior
        // 2. O placeholder NUNCA pode ficar depois de um card com prioridade menor
        // 3. Dentro da mesma faixa de prioridade, segue a posição do cursor (e.clientY)
        let insertBeforeEl = null;

        if (samePriCards.length > 0) {
          let found = false;
          for (const item of samePriCards) {
            const box = item.el.getBoundingClientRect();
            const mid = box.top + box.height / 2;
            if (e.clientY < mid) {
              insertBeforeEl = item.el;
              found = true;
              break;
            }
          }
          // Se o cursor estiver abaixo do meio de todos os cards da mesma prioridade,
          // posiciona antes do primeiro card de prioridade inferior ou antes do botão Adicionar
          if (!found) {
            insertBeforeEl = lowerPriCards[0]?.el || addBtn;
          }
        } else {
          // Nenhum card da mesma prioridade na coluna: trava exatamente no limite permitido
          insertBeforeEl = lowerPriCards[0]?.el || addBtn;
        }

        if (!_dnd.cardPlaceholder) {
          _dnd.cardPlaceholder = _createCardPlaceholder(_dnd.draggingCard);
        }

        if (insertBeforeEl) {
          listEl.insertBefore(_dnd.cardPlaceholder, insertBeforeEl);
        } else {
          listEl.appendChild(_dnd.cardPlaceholder);
        }
        return;
      }

      if (!_dnd.draggingCol || _dnd.draggingCol === colEl) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const rect   = colEl.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;

      _dnd.colPlaceholder?.remove();
      _dnd.colPlaceholder = _createColPlaceholder(_dnd.draggingCol);
      if (before) {
        board.insertBefore(_dnd.colPlaceholder, colEl);
      } else {
        colEl.after(_dnd.colPlaceholder);
      }
    });

    colEl.addEventListener('dragenter', e => {
      if (_dnd.draggingCard || (_dnd.draggingCol && _dnd.draggingCol !== colEl)) {
        e.preventDefault();
      }
    });
  });

  // ── CARDS: drag ──────────────────────────────────────────────────
  board.querySelectorAll('.pj-card').forEach(cardEl => {
    cardEl.addEventListener('dragstart', e => {
      if (e.target.closest('button')) { e.preventDefault(); return; }
      const parentCol = cardEl.closest('.pj-column');
      const cardId = parseInt(cardEl.dataset.cardId);
      const srcColId = parentCol ? parseInt(parentCol.dataset.colId) : null;
      const cardData = (_state.cards[srcColId] || []).find(c => c.card_id === cardId)
        || Object.values(_state.cards).flat().find(c => c.card_id === cardId);

      _dnd.draggingCard     = cardEl;
      _dnd.draggingCardId   = cardId;
      _dnd.draggingCardData = cardData;
      _dnd.srcColId         = srcColId;
      _dnd.destColId        = srcColId;

      cardEl.classList.add('pj-card--dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'card:' + cardId);
      setTimeout(() => { cardEl.style.opacity = '0.35'; }, 0);
    });

    cardEl.addEventListener('dragend', async () => {
      if (!_dnd.draggingCard) return;

      const cardId      = _dnd.draggingCardId || parseInt(_dnd.draggingCard.dataset.cardId);
      const srcColId    = _dnd.srcColId;
      const destColId   = _dnd.destColId;
      const placeholder = _dnd.cardPlaceholder;

      _dnd.draggingCard.style.opacity = '';
      _dnd.draggingCard.classList.remove('pj-card--dragging');

      if (cardId && destColId && placeholder && placeholder.parentNode) {
        const listEl = placeholder.parentNode;

        // Insere o card arrastado exatamente no lugar do placeholder no DOM
        listEl.insertBefore(_dnd.draggingCard, placeholder);
        placeholder.remove();

        // Lê a ordem de cards resultante no DOM da coluna destino
        const cardElsInDest  = [...listEl.querySelectorAll('.pj-card:not(.pj-card--placeholder)')];
        const orderedCardIds = cardElsInDest.map(el => parseInt(el.dataset.cardId)).filter(Boolean);

        const card = (_state.cards[srcColId] || []).find(c => c.card_id === cardId)
          || (_state.cards[destColId] || []).find(c => c.card_id === cardId)
          || Object.values(_state.cards).flat().find(c => c.card_id === cardId);

        if (card) {
          // Se mudou de coluna, transfere no estado local
          if (srcColId !== destColId) {
            _state.cards[srcColId] = (_state.cards[srcColId] || []).filter(c => c.card_id !== cardId);
            card.coluna_id = destColId;
            _state.cards[destColId] = _state.cards[destColId] || [];
            _state.cards[destColId].push(card);
          }

          // Reorganiza o array _state.cards[destColId] segundo a ordem visual do DOM
          const cardMap = new Map((_state.cards[destColId] || []).map(c => [c.card_id, c]));
          const newCardList = [];
          orderedCardIds.forEach(id => {
            const c = cardMap.get(id);
            if (c) newCardList.push(c);
          });
          // Cards que possam ter ficado fora são mantidos
          _state.cards[destColId].forEach(c => {
            if (!orderedCardIds.includes(c.card_id)) newCardList.push(c);
          });
          _state.cards[destColId] = newCardList;

          // Recalcula o card_ordem de cada card na coluna destino e atualiza no Supabase
          const updates = [];
          _state.cards[destColId].forEach((c, index) => {
            const newOrdem = (index + 1) * 10;
            const needsColUpdate   = (c.card_id === cardId && srcColId !== destColId);
            const needsOrdemUpdate = c.card_ordem !== newOrdem;

            if (needsColUpdate || needsOrdemUpdate) {
              c.card_ordem = newOrdem;
              const payload = { card_ordem: newOrdem };
              if (needsColUpdate) payload.coluna_id = destColId;
              updates.push(KanbanCards.update(c.card_id, payload));
            }
          });

          if (updates.length > 0) {
            const results = await Promise.all(updates);
            results.forEach(res => {
              if (res?.error) console.error('[DnD] Erro ao salvar ordem/coluna do card:', res.error);
            });
          }
        }
      } else {
        placeholder?.remove();
      }

      // Re-renderiza o quadro para manter sincronia visual perfeita e reatacha eventos
      _renderBoard();
      _bindDragDrop();

      _dnd.draggingCard     = null;
      _dnd.draggingCardId   = null;
      _dnd.draggingCardData = null;
      _dnd.cardPlaceholder  = null;
      _dnd.srcColId         = null;
      _dnd.destColId        = null;
    });
  });
}

// ── Painel do card ──────────────────────────────────────────────────
async function _openCardPanel(cardId) {
  const card = Object.values(_state.cards).flat().find(c => c.card_id === cardId);
  if (!card) return;
  _state.openCardId = cardId;

  const root = document.getElementById('pj-panel-root');
  if (!root) return;

  root.innerHTML = _buildPanelSkeleton(card);
  _bindPanelClose(root);

  // Carrega comentários e arquivos em paralelo
  const [commRes, filesRes] = await Promise.all([
    KanbanComentarios.getByCard(cardId),
    KanbanArquivos.getByCard(cardId),
  ]);

  _renderPanelComments(commRes.data || []);
  _renderPanelFiles(filesRes.data || []);
  _bindPanelActions(card);
}

function _buildPanelSkeleton(card) {
  const pri  = PRIORITY_META[card.card_prioridade] || PRIORITY_META['Média'];
  const over = _isOverdue(card.card_data_entrega);

  return `
    <div class="pj-panel-overlay" id="pj-panel-overlay"></div>
    <div class="pj-panel" id="pj-panel">

      <div class="pjp-header">
        <span class="pj-priority ${pri.cls}">
          <span class="pj-pri-dot" style="background:${pri.dot}"></span>
          ${_esc(card.card_prioridade)}
        </span>
        <button class="pjp-close" id="pj-panel-close" title="Fechar">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="pjp-body">

        <!-- Título -->
        <input class="pjp-title-input" id="pjp-title" value="${_esc(card.card_titulo)}" placeholder="Título do card" />

        <!-- Data + Prioridade -->
        <div class="pjp-meta-row">
          <div class="pjp-meta-item">
            <span class="pjp-meta-label">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Data de Entrega
            </span>
            <input type="date" class="pjp-date-input" id="pjp-due" value="${card.card_data_entrega || ''}" />
            ${over ? '<span class="pjp-overdue-badge">Atrasado</span>' : ''}
          </div>
          <div class="pjp-meta-item">
            <span class="pjp-meta-label">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Prioridade
            </span>
            <div class="config-input-wrap config-select-wrap pjp-select-wrap">
              <select id="pjp-priority" class="config-input config-select">
                <option value="Alta"  ${card.card_prioridade === 'Alta'  ? 'selected' : ''}>🔴 Alta</option>
                <option value="Média" ${card.card_prioridade === 'Média' ? 'selected' : ''}>🟡 Média</option>
                <option value="Baixa" ${card.card_prioridade === 'Baixa' ? 'selected' : ''}>🟢 Baixa</option>
              </select>
              <svg class="config-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="pjp-meta-item">
            <span class="pjp-meta-label">
              <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
              Etiqueta
            </span>
            <div class="config-input-wrap config-select-wrap pjp-select-wrap">
              <select id="pjp-etiqueta" class="config-input config-select">
                <option value="" ${!card.card_etiqueta ? 'selected' : ''}>Sem Etiqueta</option>
                <option value="Arte Feita" ${card.card_etiqueta && card.card_etiqueta.toLowerCase() === 'arte feita' ? 'selected' : ''}>🎨 Arte Feita</option>
                <option value="Enviado ao Cliente" ${card.card_etiqueta && card.card_etiqueta.toLowerCase() === 'enviado ao cliente' ? 'selected' : ''}>📤 Enviado ao Cliente</option>
                <option value="Alteração" ${card.card_etiqueta && card.card_etiqueta.toLowerCase() === 'alteração' ? 'selected' : ''}>✏️ Alteração</option>
                <option value="Aprovado" ${card.card_etiqueta && card.card_etiqueta.toLowerCase() === 'aprovado' ? 'selected' : ''}>✅ Aprovado</option>
                <option value="Postado" ${card.card_etiqueta && card.card_etiqueta.toLowerCase() === 'postado' ? 'selected' : ''}>🚀 Postado</option>
              </select>
              <svg class="config-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
        </div>

        <!-- Descrição -->
        <div class="pjp-section">
          <div class="pjp-section-title">
            <svg viewBox="0 0 24 24"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
            Descrição
          </div>
          <textarea class="pjp-desc-input" id="pjp-desc" placeholder="Adicione uma descrição detalhada...">${_esc(card.card_descricao || '')}</textarea>
        </div>

        <!-- Salvar / Editar -->
        <button class="pjp-save-btn" id="pjp-save-btn">
          <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar Alterações
        </button>

        <!-- Arquivos -->
        <div class="pjp-section">
          <div class="pjp-section-header">
            <div class="pjp-section-title" style="margin-bottom:0">
              <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              Arquivos
              <span class="pjp-count" id="pjp-files-count" style="display:none"></span>
            </div>
            <label class="pjp-upload-btn">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Enviar
              <input type="file" multiple id="pjp-file-input" style="display:none" />
            </label>
          </div>
          <div class="pjp-files" id="pjp-files">
            <div class="pjp-loading-sm"><div class="funil-spinner"></div></div>
          </div>
        </div>

        <!-- Comentários -->
        <div class="pjp-section">
          <div class="pjp-section-title">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Comentários
            <span class="pjp-count" id="pjp-comments-count" style="display:none"></span>
          </div>
          <div class="pjp-comments" id="pjp-comments">
            <div class="pjp-loading-sm"><div class="funil-spinner"></div></div>
          </div>
          <div class="pjp-comment-input-row">
            <div class="pjp-comment-input-wrap">
              <textarea class="pjp-comment-input" placeholder="Escreva um comentário..." rows="1" id="pjp-comment-input"></textarea>
              <button class="pjp-comment-send" id="pjp-comment-send">
                <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Excluir card -->
        <div class="pjp-section pjp-danger-zone">
          <button class="pjp-del-card-btn" id="pjp-del-card" data-card-id="${card.card_id}">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Excluir este card
          </button>
        </div>

      </div>
    </div>`;
}

function _renderPanelComments(comments) {
  const el     = document.getElementById('pjp-comments');
  const counter = document.getElementById('pjp-comments-count');
  if (!el) return;

  if (counter) {
    counter.textContent  = comments.length;
    counter.style.display = comments.length ? 'inline-flex' : 'none';
  }

  if (!comments.length) {
    el.innerHTML = `<p class="pjp-empty">Nenhum comentário ainda.</p>`;
    return;
  }

  const myId = UserStore.getUserId();
  el.innerHTML = comments.map(c => {
    const isMe = c.user_id === myId;
    const nome  = isMe ? UserStore.getPrimeiroNome() : 'Usuário';
    const ini   = _initials(nome);
    const bg    = _avatarColor(c.user_id);
    return `
      <div class="pjp-comment" data-comentario-id="${c.comentario_id}">
        <div class="pjp-comment-avatar" style="background:${bg}">${ini}</div>
        <div class="pjp-comment-body">
          <div class="pjp-comment-meta">
            <strong>${_esc(nome)}</strong>
            <span>${_fmtDateTime(c.criado_em)}</span>
            ${isMe
              ? `<button class="pjp-comment-del" data-action="del-comment" data-id="${c.comentario_id}" title="Excluir">
                  <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>` : ''}
          </div>
          <p>${_esc(c.comentario_texto)}</p>
        </div>
      </div>`;
  }).join('');
}

async function _downloadFile(url, filename) {
  try {
    const parts = url.split('/' + BUCKET + '/');
    if (parts.length < 2) throw new Error('Caminho inválido');
    const path = decodeURIComponent(parts[1]);
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) throw error;

    const blobUrl = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Erro ao baixar arquivo:', err);
    // Fallback if client-side blob download fails
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function _isImage(filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}

function _buildFileHtml(f) {
  const isImg = _isImage(f.arquivo_nome);
  const iconHtml = isImg
    ? `<img src="${f.arquivo_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 7px;" />`
    : `<svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;

  return `
    <div class="pjp-file" data-arquivo-id="${f.arquivo_id}">
      <a class="pjp-file-link" href="${f.arquivo_url}" target="_blank" title="Visualizar arquivo em nova aba">
        <div class="pjp-file-icon">
          ${iconHtml}
        </div>
        <div class="pjp-file-info">
          <span class="pjp-file-name">${_esc(f.arquivo_nome)}</span>
          <span class="pjp-file-size">${_fmtSize(f.arquivo_tamanho)}</span>
        </div>
      </a>
      <button class="pjp-file-dl" data-action="download-file" data-url="${f.arquivo_url}" data-name="${_esc(f.arquivo_nome)}" title="Baixar">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="pjp-file-del" data-action="del-file" data-id="${f.arquivo_id}" title="Remover">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>`;
}

function _renderPanelFiles(files) {
  const el      = document.getElementById('pjp-files');
  const counter = document.getElementById('pjp-files-count');
  if (!el) return;

  if (counter) {
    counter.textContent  = files.length;
    counter.style.display = files.length ? 'inline-flex' : 'none';
  }

  if (!files.length) {
    el.innerHTML = `<p class="pjp-empty">Nenhum arquivo anexado.</p>`;
    return;
  }

  el.innerHTML = files.map(_buildFileHtml).join('');
}

function _bindPanelClose(root) {
  const close = () => { root.innerHTML = ''; _state.openCardId = null; };
  document.getElementById('pj-panel-close')?.addEventListener('click', close);
  document.getElementById('pj-panel-overlay')?.addEventListener('click', close);
  const onKey = e => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

function _bindPanelActions(card) {
  const cardId = card.card_id;

  // ── Salvar alterações ──
  document.getElementById('pjp-save-btn')?.addEventListener('click', async () => {
    const titulo   = document.getElementById('pjp-title')?.value.trim();
    const desc     = document.getElementById('pjp-desc')?.value.trim() || null;
    const due      = document.getElementById('pjp-due')?.value || null;
    const priority = document.getElementById('pjp-priority')?.value;
    const etiqueta = document.getElementById('pjp-etiqueta')?.value || null;
    if (!titulo) return;

    const btn = document.getElementById('pjp-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" class="pjp-spin"><circle cx="12" cy="12" r="10"/></svg> Salvando...';

    const { error } = await KanbanCards.update(cardId, {
      card_titulo:       titulo,
      card_descricao:    desc,
      card_data_entrega: due,
      card_prioridade:   priority,
      card_etiqueta:     etiqueta,
    });

    btn.disabled = false;

    if (error) {
      btn.innerHTML = '❌ Erro ao salvar';
      return;
    }

    // Atualiza estado local
    for (const cid in _state.cards) {
      const c = _state.cards[cid].find(c => c.card_id === cardId);
      if (c) {
        c.card_titulo       = titulo;
        c.card_descricao    = desc;
        c.card_data_entrega = due;
        c.card_prioridade   = priority;
        c.card_etiqueta     = etiqueta;
        // Re-render board para reorganizar os cards pela ordem de prioridade
        _renderBoard();
        _bindDragDrop();
      }
    }

    // Atualiza badge de prioridade no header do painel
    const pri = PRIORITY_META[priority] || PRIORITY_META['Média'];
    const header = document.querySelector('#pj-panel .pjp-header .pj-priority');
    if (header) {
      header.className = `pj-priority ${pri.cls}`;
      header.innerHTML = `<span class="pj-pri-dot" style="background:${pri.dot}"></span>${_esc(priority)}`;
    }

    btn.innerHTML = '✓ Salvo!';
    setTimeout(() => {
      const b = document.getElementById('pjp-save-btn');
      if (!b) return;
      b.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar Alterações`;
    }, 2000);
  });

  // Auto-salvar ao alterar selects ou data
  ['pjp-priority', 'pjp-etiqueta', 'pjp-due'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      document.getElementById('pjp-save-btn')?.click();
    });
  });

  // ── Excluir card ──
  document.getElementById('pjp-del-card')?.addEventListener('click', async () => {
    if (!confirm(`Excluir o card "${card.card_titulo}"?`)) return;
    const { error } = await KanbanCards.delete(cardId);
    if (error) { alert('Erro: ' + error.message); return; }

    for (const cid in _state.cards) {
      const prev = _state.cards[cid].length;
      _state.cards[cid] = _state.cards[cid].filter(c => c.card_id !== cardId);
      if (_state.cards[cid].length !== prev) {
        const count = document.querySelector(`#pjcol-${cid} .pj-col-count`);
        if (count) count.textContent = _state.cards[cid].length;
      }
    }
    document.getElementById(`pjcard-${cardId}`)?.remove();
    document.getElementById('pj-panel-root').innerHTML = '';
    _state.openCardId = null;
  });

  // ── Comentários: auto-resize ──
  const ta = document.getElementById('pjp-comment-input');
  ta?.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });

  // ── Comentários: enviar ──
  document.getElementById('pjp-comment-send')?.addEventListener('click', async () => {
    const val    = ta?.value.trim();
    const userId = UserStore.getUserId();
    if (!val || !userId) return;

    const { data, error } = await KanbanComentarios.create(cardId, userId, val);
    if (error) { alert('Erro: ' + error.message); return; }

    if (ta) { ta.value = ''; ta.style.height = 'auto'; }

    const commEl = document.getElementById('pjp-comments');
    commEl?.querySelector('.pjp-empty')?.remove();

    const nome = UserStore.getPrimeiroNome();
    const bg   = _avatarColor(userId);
    const ini  = _initials(nome);
    commEl?.insertAdjacentHTML('beforeend', `
      <div class="pjp-comment pjp-comment--new" data-comentario-id="${data.comentario_id}">
        <div class="pjp-comment-avatar" style="background:${bg}">${ini}</div>
        <div class="pjp-comment-body">
          <div class="pjp-comment-meta">
            <strong>${_esc(nome)}</strong>
            <span>${_fmtDateTime(data.criado_em)}</span>
            <button class="pjp-comment-del" data-action="del-comment" data-id="${data.comentario_id}" title="Excluir">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
          <p>${_esc(val)}</p>
        </div>
      </div>`);

    // Atualiza contador
    const cnt = document.getElementById('pjp-comments-count');
    if (cnt) { cnt.textContent = parseInt(cnt.textContent || '0') + 1; cnt.style.display = 'inline-flex'; }
  });

  // ── Comentários: excluir ──
  document.getElementById('pjp-comments')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action="del-comment"]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    const { error } = await KanbanComentarios.delete(id);
    if (error) { alert('Erro: ' + error.message); return; }
    btn.closest('.pjp-comment')?.remove();
    const cnt = document.getElementById('pjp-comments-count');
    if (cnt) {
      const v = Math.max(0, parseInt(cnt.textContent || '0') - 1);
      cnt.textContent   = v;
      cnt.style.display = v ? 'inline-flex' : 'none';
    }
  });

  // ── Arquivos: upload ──
  document.getElementById('pjp-file-input')?.addEventListener('change', async e => {
    const files  = Array.from(e.target.files || []);
    const userId = UserStore.getUserId();
    if (!files.length || !userId) return;

    const filesEl = document.getElementById('pjp-files');
    filesEl?.querySelector('.pjp-empty')?.remove();

    for (const file of files) {
      const path = `kanban/${cardId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });

      if (upErr) { alert(`Erro ao enviar "${file.name}": ${upErr.message}`); continue; }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = urlData?.publicUrl;

      const { data: arquivo, error: dbErr } = await KanbanArquivos.create({
        card_id: cardId, user_id: userId,
        arquivo_nome: file.name, arquivo_url: url, arquivo_tamanho: file.size,
      });
      if (dbErr) { alert('Erro ao salvar arquivo: ' + dbErr.message); continue; }

      // Atualiza estado local de arquivos do card e re-renderiza no board
      for (const cid in _state.cards) {
        const c = _state.cards[cid].find(card => card.card_id === cardId);
        if (c) {
          c.kanban_arquivos = c.kanban_arquivos || [];
          c.kanban_arquivos.push(arquivo);
          const cardEl = document.getElementById(`pjcard-${cardId}`);
          if (cardEl) cardEl.outerHTML = _renderCard(c);
        }
      }

      filesEl?.insertAdjacentHTML('beforeend', _buildFileHtml({
        arquivo_id: arquivo.arquivo_id,
        arquivo_nome: file.name,
        arquivo_url: url,
        arquivo_tamanho: file.size,
      }));

      const cnt = document.getElementById('pjp-files-count');
      if (cnt) { cnt.textContent = parseInt(cnt.textContent || '0') + 1; cnt.style.display = 'inline-flex'; }
    }
    e.target.value = '';
  });

  // ── Arquivos: ações (baixar / excluir) ──
  document.getElementById('pjp-files')?.addEventListener('click', async e => {
    const delBtn = e.target.closest('[data-action="del-file"]');
    if (delBtn) {
      const id = parseInt(delBtn.dataset.id);
      const { error } = await KanbanArquivos.delete(id);
      if (error) { alert('Erro: ' + error.message); return; }
      delBtn.closest('.pjp-file')?.remove();

      // Atualiza estado local de arquivos do card e re-renderiza no board
      const activeCardId = _state.openCardId;
      if (activeCardId) {
        for (const cid in _state.cards) {
          const c = _state.cards[cid].find(card => card.card_id === activeCardId);
          if (c && c.kanban_arquivos) {
            c.kanban_arquivos = c.kanban_arquivos.filter(f => f.arquivo_id !== id);
            const cardEl = document.getElementById(`pjcard-${activeCardId}`);
            if (cardEl) cardEl.outerHTML = _renderCard(c);
          }
        }
      }

      const cnt = document.getElementById('pjp-files-count');
      if (cnt) {
        const v = Math.max(0, parseInt(cnt.textContent || '0') - 1);
        cnt.textContent   = v;
        cnt.style.display = v ? 'inline-flex' : 'none';
      }
      return;
    }

    const dlBtn = e.target.closest('[data-action="download-file"]');
    if (dlBtn) {
      e.preventDefault();
      const url = dlBtn.dataset.url;
      const filename = dlBtn.dataset.name;
      dlBtn.disabled = true;
      await _downloadFile(url, filename);
      dlBtn.disabled = false;
    }
  });
}

// ── Eventos do board ────────────────────────────────────────────────
function _bindBoardActions() {
  const board = document.getElementById('pj-board');
  if (!board) return;

  // Delegação geral
  board.addEventListener('click', async e => {
    const btn    = e.target.closest('[data-action]');
    const action = btn?.dataset.action;

    // Sem ação → clique no card → abre painel
    if (!btn) {
      const card = e.target.closest('.pj-card');
      if (card) _openCardPanel(parseInt(card.dataset.cardId));
      return;
    }

    if (action === 'add-col') {
      document.getElementById('pj-add-col-overlay').style.display = 'flex';
      document.getElementById('pj-col-title-input')?.focus();
      return;
    }
    if (action === 'add-card') { _openAddCardModal(btn.dataset.colId); return; }
    if (action === 'edit-col') { await _editColumn(parseInt(btn.dataset.colId)); return; }
    if (action === 'del-col')  { await _deleteColumn(parseInt(btn.dataset.colId)); return; }
    if (action === 'card-del') {
      e.stopPropagation();
      await _deleteCard(parseInt(btn.dataset.cardId));
    }
  });

  const closeAddCol = () => {
    document.getElementById('pj-add-col-overlay').style.display = 'none';
    document.getElementById('pj-add-col-form')?.reset();
    document.querySelectorAll('.pj-color-swatch').forEach((s, i) =>
      s.classList.toggle('pj-color-swatch--active', i === 0));
  };
  document.getElementById('pj-add-col-close')?.addEventListener('click', closeAddCol);
  document.getElementById('pj-add-col-cancel')?.addEventListener('click', closeAddCol);
  document.getElementById('pj-add-col-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'pj-add-col-overlay') closeAddCol();
  });

  // Color swatches
  document.getElementById('pj-col-color-picker')?.addEventListener('click', e => {
    const sw = e.target.closest('.pj-color-swatch');
    if (!sw) return;
    document.querySelectorAll('.pj-color-swatch').forEach(s => s.classList.remove('pj-color-swatch--active'));
    sw.classList.add('pj-color-swatch--active');
  });

  document.getElementById('pj-add-col-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const nome  = document.getElementById('pj-col-title-input')?.value.trim();
    const cor   = document.querySelector('.pj-color-swatch--active')?.dataset.color || '#6366F1';
    if (!nome) return;
    const ordem = _state.columns.length
      ? Math.max(..._state.columns.map(c => c.coluna_ordem)) + 1 : 0;

    const { data, error } = await KanbanColunas.create(nome, cor, ordem, _state.tipoKanban);
    if (error) { alert('Erro: ' + error.message); return; }

    _state.columns.push(data);
    _state.cards[data.coluna_id] = [];

    document.querySelector('.pj-add-col-wrap')
      ?.insertAdjacentHTML('beforebegin', _renderColumn(data));
    closeAddCol();
  });

  // ── Novo card ──
  const closeAddCard = () => {
    document.getElementById('pj-add-card-overlay').style.display = 'none';
    document.getElementById('pj-add-card-form')?.reset();
  };
  document.getElementById('pj-add-card-close')?.addEventListener('click', closeAddCard);
  document.getElementById('pj-add-card-cancel')?.addEventListener('click', closeAddCard);
  document.getElementById('pj-add-card-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'pj-add-card-overlay') closeAddCard();
  });

  document.getElementById('pj-add-card-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const colId    = parseInt(document.getElementById('pj-modal-col-id')?.value);
    const titulo   = document.getElementById('pj-card-title-input')?.value.trim();
    const desc     = document.getElementById('pj-card-desc-input')?.value.trim() || null;
    const due      = document.getElementById('pj-card-due-input')?.value || null;
    const priority = document.getElementById('pj-card-pri-input')?.value;
    if (!titulo) return;

    const cards = _state.cards[colId] || [];
    const ordem = cards.length ? Math.max(...cards.map(c => c.card_ordem || 0)) + 10 : 10;

    const { data, error } = await KanbanCards.create({
      coluna_id: colId, card_titulo: titulo,
      card_descricao: desc, card_data_entrega: due,
      card_prioridade: priority, card_ordem: ordem,
      tipo_kanban: _state.tipoKanban,
    });
    if (error) { alert('Erro: ' + error.message); return; }

    _state.cards[colId] = [...cards, data];
    _renderBoard();
    _bindDragDrop();

    closeAddCard();
  });

  // ── Filtros ──
  document.querySelectorAll('.pj-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pj-filter-btn').forEach(b => b.classList.remove('pj-filter-btn--active'));
      btn.classList.add('pj-filter-btn--active');
      const q   = document.getElementById('pj-search')?.value || '';
      const pri = btn.dataset.filter === 'Todos' ? null : btn.dataset.filter;
      _filterCards(q, pri);
    });
  });

  document.getElementById('pj-search')?.addEventListener('input', e => {
    const active = document.querySelector('.pj-filter-btn--active');
    const pri    = (!active || active.dataset.filter === 'Todos') ? null : active.dataset.filter;
    _filterCards(e.target.value, pri);
  });
}

// ── CRUD auxiliares ─────────────────────────────────────────────────
async function _editColumn(colId) {
  const col = _state.columns.find(c => c.coluna_id === colId);
  if (!col) return;
  const novo = prompt('Novo nome da coluna:', col.coluna_nome);
  if (!novo || novo === col.coluna_nome) return;
  const { error } = await KanbanColunas.update(colId, { coluna_nome: novo });
  if (error) { alert('Erro: ' + error.message); return; }
  col.coluna_nome = novo;
  const el = document.querySelector(`[data-col-title="${colId}"]`);
  if (el) el.textContent = novo;
}

async function _deleteColumn(colId) {
  const col = _state.columns.find(c => c.coluna_id === colId);
  if (!col) return;
  if (!confirm(`Excluir a coluna "${col.coluna_nome}" e todos os cards dentro dela?`)) return;
  const { error } = await KanbanColunas.delete(colId);
  if (error) { alert('Erro: ' + error.message); return; }
  _state.columns = _state.columns.filter(c => c.coluna_id !== colId);
  delete _state.cards[colId];
  document.getElementById(`pjcol-${colId}`)?.remove();
}

async function _deleteCard(cardId) {
  const card = Object.values(_state.cards).flat().find(c => c.card_id === cardId);
  if (!card || !confirm(`Excluir o card "${card.card_titulo}"?`)) return;
  const { error } = await KanbanCards.delete(cardId);
  if (error) { alert('Erro: ' + error.message); return; }

  for (const cid in _state.cards) {
    const prev = _state.cards[cid].length;
    _state.cards[cid] = _state.cards[cid].filter(c => c.card_id !== cardId);
    if (_state.cards[cid].length !== prev) {
      const count = document.querySelector(`#pjcol-${cid} .pj-col-count`);
      if (count) count.textContent = _state.cards[cid].length;
    }
  }
  document.getElementById(`pjcard-${cardId}`)?.remove();
}

function _openAddCardModal(colId) {
  document.getElementById('pj-modal-col-id').value = colId;
  document.getElementById('pj-add-card-overlay').style.display = 'flex';
  document.getElementById('pj-card-title-input')?.focus();
}

function _filterCards(query, priority) {
  const q = (query || '').toLowerCase();
  document.querySelectorAll('.pj-card').forEach(el => {
    const title = el.querySelector('.pj-card-title')?.textContent.toLowerCase() || '';
    const desc  = el.querySelector('.pj-card-desc')?.textContent.toLowerCase()  || '';
    const pri   = el.querySelector('.pj-priority')?.textContent.trim()          || '';
    const matchQ = !q || title.includes(q) || desc.includes(q);
    const matchP = !priority || pri.includes(priority);
    el.style.display = matchQ && matchP ? '' : 'none';
  });
}

// ── Abas de navegação ──
function _bindTabsEvents() {
  const row = document.getElementById('pj-tabs-row');
  if (!row) return;

  row.addEventListener('click', async (e) => {
    const btn = e.target.closest('.pj-tab-btn');
    if (!btn) return;

    const newType = btn.dataset.type;
    if (newType === _state.tipoKanban) return;

    _state.tipoKanban = newType;

    // Atualiza classe ativa nas abas
    row.querySelectorAll('.pj-tab-btn').forEach(b => {
      b.classList.toggle('pj-tab-btn--active', b.dataset.type === newType);
    });

    // Re-carrega o quadro para o novo tipo
    await _loadBoard();
  });
}

// ── Módulo ──────────────────────────────────────────────────────────
export default {
  render() {
    return `
      <style>
        .pj-tabs-row {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 1.5px solid var(--border-light);
          padding-bottom: 0px;
          align-items: center;
        }
        .pj-tab-btn {
          background: none;
          border: none;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 3px solid transparent;
          margin-bottom: -1.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pj-tab-btn:hover {
          color: var(--cyan);
        }
        .pj-tab-btn--active {
          color: var(--cyan) !important;
          border-bottom-color: var(--cyan) !important;
        }
      </style>

      <div class="page-header pj-page-header">
        <div class="page-title-block">
          <h1>Projetos</h1>
          <p>Acompanhe e organize seus projetos em um quadro visual</p>
        </div>
        <div class="pj-header-actions">
          <div class="pj-search-wrap">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="pj-search" placeholder="Buscar cards..." id="pj-search" />
          </div>
          <div class="pj-filters">
            <button class="pj-filter-btn pj-filter-btn--active" data-filter="Todos">Todos</button>
            <button class="pj-filter-btn" data-filter="Alta">🔴 Alta</button>
            <button class="pj-filter-btn" data-filter="Média">🟡 Média</button>
            <button class="pj-filter-btn" data-filter="Baixa">🟢 Baixa</button>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs for Kanban Types -->
      <div class="pj-tabs-row" id="pj-tabs-row">
        <button class="pj-tab-btn${_state.tipoKanban === 'Projetos' ? ' pj-tab-btn--active' : ''}" data-type="Projetos">📁 Projetos</button>
        <button class="pj-tab-btn${_state.tipoKanban === 'Campanhas' ? ' pj-tab-btn--active' : ''}" data-type="Campanhas">📢 Campanhas</button>
        <button class="pj-tab-btn${_state.tipoKanban === 'Posts' ? ' pj-tab-btn--active' : ''}" data-type="Posts">📝 Posts</button>
      </div>

      <div class="pj-board-wrap">
        <div class="pj-board" id="pj-board">
          <div class="pj-loading"><div class="funil-spinner"></div> Carregando...</div>
        </div>
      </div>

      <!-- Modal: nova coluna -->
      <div class="pj-modal-overlay" id="pj-add-col-overlay" style="display:none">
        <div class="pj-modal">
          <div class="pj-modal-header">
            <h3>Nova Coluna</h3>
            <button class="pjp-close" id="pj-add-col-close">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form id="pj-add-col-form" class="pj-modal-form">
            <div class="pj-modal-field">
              <label>Nome da coluna *</label>
              <input type="text" id="pj-col-title-input" class="config-input" placeholder="Ex: Em Revisão..." required />
            </div>
            <div class="pj-modal-field">
              <label>Cor</label>
              <div class="pj-color-picker" id="pj-col-color-picker">
                ${COLORS.map((c, i) =>
                  `<button type="button" class="pj-color-swatch${i === 0 ? ' pj-color-swatch--active' : ''}" data-color="${c}" style="background:${c}"></button>`
                ).join('')}
              </div>
            </div>
            <div class="pj-modal-actions">
              <button type="button" class="btn btn-ghost" id="pj-add-col-cancel">Cancelar</button>
              <button type="submit" class="btn btn-cyan">Criar Coluna</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal: novo card -->
      <div class="pj-modal-overlay" id="pj-add-card-overlay" style="display:none">
        <div class="pj-modal">
          <div class="pj-modal-header">
            <h3>Novo Card</h3>
            <button class="pjp-close" id="pj-add-card-close">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form id="pj-add-card-form" class="pj-modal-form">
            <input type="hidden" id="pj-modal-col-id" />
            <div class="pj-modal-field">
              <label>Título *</label>
              <input type="text" id="pj-card-title-input" class="config-input" placeholder="Nome do card..." required />
            </div>
            <div class="pj-modal-field">
              <label>Descrição</label>
              <textarea id="pj-card-desc-input" class="pj-modal-textarea" placeholder="Descreva o projeto..." rows="3"></textarea>
            </div>
            <div class="pj-modal-row">
              <div class="pj-modal-field">
                <label>Data de Entrega</label>
                <input type="date" id="pj-card-due-input" class="config-input" />
              </div>
              <div class="pj-modal-field">
                <label>Prioridade</label>
                <div class="config-input-wrap config-select-wrap">
                  <select id="pj-card-pri-input" class="config-input config-select">
                    <option value="Alta">🔴 Alta</option>
                    <option value="Média" selected>🟡 Média</option>
                    <option value="Baixa">🟢 Baixa</option>
                  </select>
                  <svg class="config-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>
            <div class="pj-modal-actions">
              <button type="button" class="btn btn-ghost" id="pj-add-card-cancel">Cancelar</button>
              <button type="submit" class="btn btn-cyan">Criar Card</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Painel lateral do card -->
      <div id="pj-panel-root"></div>
    `;
  },

  onMount() {
    _loadBoard();
    _bindTabsEvents();
    _bindBoardActions();
  },

  onDestroy() {
    _state = { columns: [], cards: {}, openCardId: null, tipoKanban: 'Projetos' };
  },
};
