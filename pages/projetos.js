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

// ── Builders HTML ───────────────────────────────────────────────────
function _renderCard(card) {
  const pri  = PRIORITY_META[card.card_prioridade] || PRIORITY_META['Média'];
  const due  = _fmtDate(card.card_data_entrega);
  const over = _isOverdue(card.card_data_entrega);

  return `
    <div class="pj-card" data-card-id="${card.card_id}" id="pjcard-${card.card_id}">
      <div class="pj-card-top">
        <span class="pj-priority ${pri.cls}">
          <span class="pj-pri-dot" style="background:${pri.dot}"></span>
          ${_esc(card.card_prioridade)}
        </span>
        <button class="pj-card-menu" data-action="card-del" data-card-id="${card.card_id}" title="Excluir card">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
      <h3 class="pj-card-title">${_esc(card.card_titulo)}</h3>
      ${card.card_descricao ? `<p class="pj-card-desc">${_esc(card.card_descricao)}</p>` : ''}
      ${due ? `
        <div class="pj-card-footer">
          <span class="pj-due ${over ? 'pj-due--overdue' : ''}">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${due}${over ? ' · Atrasado' : ''}
          </span>
        </div>` : ''}
    </div>`;
}

function _renderColumn(col) {
  const cards    = _state.cards[col.coluna_id] || [];
  const cardsHtml = cards.map(_renderCard).join('');
  return `
    <div class="pj-column" data-col-id="${col.coluna_id}" id="pjcol-${col.coluna_id}">
      <div class="pj-col-header">
        <div class="pj-col-left">
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
          ${card.card_descricao
            ? `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar`
            : `<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Adicionar Descrição`}
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

  el.innerHTML = files.map(f => `
    <div class="pjp-file" data-arquivo-id="${f.arquivo_id}">
      <div class="pjp-file-icon">
        <svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
      </div>
      <div class="pjp-file-info">
        <span class="pjp-file-name">${_esc(f.arquivo_nome)}</span>
        <span class="pjp-file-size">${_fmtSize(f.arquivo_tamanho)}</span>
      </div>
      <a class="pjp-file-dl" href="${f.arquivo_url}" target="_blank" download title="Baixar">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
      <button class="pjp-file-del" data-action="del-file" data-id="${f.arquivo_id}" title="Remover">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>`).join('');
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
    if (!titulo) return;

    const btn = document.getElementById('pjp-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" class="pjp-spin"><circle cx="12" cy="12" r="10"/></svg> Salvando...';

    const { error } = await KanbanCards.update(cardId, {
      card_titulo:       titulo,
      card_descricao:    desc,
      card_data_entrega: due,
      card_prioridade:   priority,
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
        // Re-render card no board
        const cardEl = document.getElementById(`pjcard-${cardId}`);
        if (cardEl) cardEl.outerHTML = _renderCard(c);
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
      const hasDesc = !!document.getElementById('pjp-desc')?.value.trim();
      b.innerHTML = hasDesc
        ? `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar`
        : `<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Adicionar Descrição`;
    }, 2000);
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

      filesEl?.insertAdjacentHTML('beforeend', `
        <div class="pjp-file" data-arquivo-id="${arquivo.arquivo_id}">
          <div class="pjp-file-icon">
            <svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          </div>
          <div class="pjp-file-info">
            <span class="pjp-file-name">${_esc(file.name)}</span>
            <span class="pjp-file-size">${_fmtSize(file.size)}</span>
          </div>
          <a class="pjp-file-dl" href="${url}" target="_blank" download title="Baixar">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
          <button class="pjp-file-del" data-action="del-file" data-id="${arquivo.arquivo_id}" title="Remover">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>`);

      const cnt = document.getElementById('pjp-files-count');
      if (cnt) { cnt.textContent = parseInt(cnt.textContent || '0') + 1; cnt.style.display = 'inline-flex'; }
    }
    e.target.value = '';
  });

  // ── Arquivos: excluir ──
  document.getElementById('pjp-files')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action="del-file"]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    const { error } = await KanbanArquivos.delete(id);
    if (error) { alert('Erro: ' + error.message); return; }
    btn.closest('.pjp-file')?.remove();
    const cnt = document.getElementById('pjp-files-count');
    if (cnt) {
      const v = Math.max(0, parseInt(cnt.textContent || '0') - 1);
      cnt.textContent   = v;
      cnt.style.display = v ? 'inline-flex' : 'none';
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
    const ordem = cards.length ? Math.max(...cards.map(c => c.card_ordem)) + 1 : 0;

    const { data, error } = await KanbanCards.create({
      coluna_id: colId, card_titulo: titulo,
      card_descricao: desc, card_data_entrega: due,
      card_prioridade: priority, card_ordem: ordem,
      tipo_kanban: _state.tipoKanban,
    });
    if (error) { alert('Erro: ' + error.message); return; }

    _state.cards[colId] = [...cards, data];
    const listEl = document.getElementById(`pjlist-${colId}`);
    listEl?.querySelector('.pj-add-card-btn')
      ?.insertAdjacentHTML('beforebegin', _renderCard(data));

    const count = document.querySelector(`#pjcol-${colId} .pj-col-count`);
    if (count) count.textContent = _state.cards[colId].length;

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
        <button class="pj-tab-btn${_state.tipoKanban === 'Criativos' ? ' pj-tab-btn--active' : ''}" data-type="Criativos">🎨 Criativos</button>
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
