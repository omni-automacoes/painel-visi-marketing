/**
 * financeiro.js — Página de Gestão Financeira com Integração Supabase
 */

import { today, staggerAnimation } from '../js/utils.js';
import { FinanceiroReceitas, FinanceiroDespesas, Clientes } from '../js/db.js';
import UserStore from '../js/userStore.js';

// ── Estado ─────────────────────────────────────────────────────────
let _state = {
  receitas: [],
  despesas: [],
  clientes: [],
  selectedPeriod: "Julho 2026",
};

// ── Helpers ─────────────────────────────────────────────────────────
function _fmtBRL(val) {
  const num = parseFloat(val || 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _formatISODate(isoString) {
  if (!isoString) return '-';
  const match = String(isoString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '-';
  }
}

function _toInputDate(isoString) {
  if (!isoString) return '';
  const match = String(isoString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
}

// Filtro de período em memória
function _filterByPeriod(items, periodStr, dateKey) {
  const monthMap = {
    "Janeiro": 0, "Fevereiro": 1, "Março": 2, "Abril": 3, "Maio": 4, "Junho": 5,
    "Julho": 6, "Agosto": 7, "Setembro": 8, "Outubro": 9, "Novembro": 10, "Dezembro": 11
  };
  const parts = periodStr.split(' ');
  if (parts.length < 2) return items;
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  const targetMonth = monthMap[monthName];

  return items.filter(item => {
    const val = item[dateKey];
    if (!val) return false;
    const date = new Date(val);
    return date.getUTCFullYear() === year && date.getUTCMonth() === targetMonth;
  });
}

function _getPreviousPeriod(periodStr) {
  const monthList = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const parts = periodStr.split(' ');
  if (parts.length < 2) return null;
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  const monthIdx = monthList.indexOf(monthName);
  if (monthIdx === -1) return null;

  let prevMonthIdx = monthIdx - 1;
  let prevYear = year;
  if (prevMonthIdx < 0) {
    prevMonthIdx = 11;
    prevYear -= 1;
  }
  return `${monthList[prevMonthIdx]} ${prevYear}`;
}

function _shiftDateToPeriod(dateStr, targetPeriod) {
  if (!dateStr) return null;
  const monthMap = {
    "Janeiro": 0, "Fevereiro": 1, "Março": 2, "Abril": 3, "Maio": 4, "Junho": 5,
    "Julho": 6, "Agosto": 7, "Setembro": 8, "Outubro": 9, "Novembro": 10, "Dezembro": 11
  };
  const parts = targetPeriod.split(' ');
  const targetMonthName = parts[0];
  const targetYear = parseInt(parts[1], 10);
  const targetMonthIdx = monthMap[targetMonthName];

  const date = new Date(dateStr);
  const day = date.getUTCDate();

  const safeDate = new Date(Date.UTC(targetYear, targetMonthIdx, day));
  if (safeDate.getUTCMonth() !== targetMonthIdx) {
    const lastDay = new Date(Date.UTC(targetYear, targetMonthIdx + 1, 0)).getUTCDate();
    return `${targetYear}-${String(targetMonthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T12:00:00.000Z`;
  }
  return `${targetYear}-${String(targetMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`;
}

function _getDefaultDueDateForPeriod(periodStr) {
  const monthMap = {
    "Janeiro": 0, "Fevereiro": 1, "Março": 2, "Abril": 3, "Maio": 4, "Junho": 5,
    "Julho": 6, "Agosto": 7, "Setembro": 8, "Outubro": 9, "Novembro": 10, "Dezembro": 11
  };
  const parts = periodStr.split(' ');
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  const monthIdx = monthMap[monthName];

  // Define por padrão o dia 10 do mês selecionado
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-10T12:00:00.000Z`;
}

// Toast Inteligente
function _showToast(message) {
  if (!document.getElementById('fin-toast-style')) {
    const style = document.createElement('style');
    style.id = 'fin-toast-style';
    style.textContent = `
      .fin-toast-container {
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        display: flex; flex-direction: column; gap: 8px; pointer-events: none;
      }
      .fin-toast {
        background: #111; border: 1px solid rgba(26, 206, 238, 0.25);
        color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 13px;
        font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        display: flex; align-items: center; gap: 10px;
        animation: finToastIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        pointer-events: auto;
      }
      @keyframes finToastIn {
        from { opacity: 0; transform: translateY(20px) scale(0.9); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes finToastOut {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to   { opacity: 0; transform: translateY(-20px) scale(0.9); }
      }
    `;
    document.head.appendChild(style);
  }

  let container = document.querySelector('.fin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'fin-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'fin-toast';
  toast.innerHTML = `<span style="color:var(--cyan)">⚡</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'finToastOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// Renderizador dos campos dinâmicos do modal de criação
function _renderModalDynamicFields(tipo) {
  const container = document.getElementById('fin-modal-dynamic-fields');
  if (!container) return;

  if (tipo === 'receita') {
    const clientsOptions = _state.clientes.map(c => `<option value="${c.cliente_id}">${_esc(c.cliente_nome)}</option>`).join('');
    container.innerHTML = `
      <div class="fin-form-group">
        <label class="fin-form-label" for="fin-form-cliente">Cliente Associado</label>
        <select class="fin-form-input" id="fin-form-cliente">
          <option value="">-- Lançamento Avulso (Sem Vínculo) --</option>
          ${clientsOptions}
        </select>
      </div>
      <div class="fin-form-group" id="fin-nome-avulso-group">
        <label class="fin-form-label" for="fin-nome-avulso">Nome do Cliente / Identificador</label>
        <input class="fin-form-input" id="fin-nome-avulso" placeholder="Ex: Cliente Avulso Ltda" required />
      </div>
      <div class="fin-form-group">
        <label class="fin-form-label" for="fin-desc">Descrição da Receita</label>
        <input class="fin-form-input" id="fin-desc" placeholder="Ex: Mensalidade, Setup..." required />
      </div>
      <div class="fin-form-row">
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-valor">Valor (R$)</label>
          <input class="fin-form-input" id="fin-valor" type="number" step="0.01" placeholder="Ex: 1500" required />
        </div>
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-tipo-fat">Tipo</label>
          <select class="fin-form-input" id="fin-tipo-fat">
            <option value="Recorrente">Recorrente</option>
            <option value="Pontual">Pontual</option>
          </select>
        </div>
      </div>
      <div class="fin-form-row">
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-venc">Vencimento</label>
          <input class="fin-form-input" id="fin-venc" type="date" required />
        </div>
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-status">Status</label>
          <select class="fin-form-input" id="fin-status">
            <option value="Pendente">Pendente</option>
            <option value="Pago">Pago</option>
            <option value="Atrasado">Atrasado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
      </div>
      <div class="fin-form-group" id="fin-rec-pag-group" style="display:none;">
        <label class="fin-form-label" for="fin-rec-pag">Data de Recebimento</label>
        <input class="fin-form-input" id="fin-rec-pag" type="date" />
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="fin-form-group">
        <label class="fin-form-label" for="fin-desc">Fornecedor / Despesa</label>
        <input class="fin-form-input" id="fin-desc" placeholder="Ex: Software, Google Ads..." required />
      </div>
      <div class="fin-form-group">
        <label class="fin-form-label" for="fin-categoria">Categoria</label>
        <select class="fin-form-input" id="fin-categoria">
          <option value="Ferramentas">Ferramentas</option>
          <option value="Folha de Pagamento">Folha de Pagamento</option>
          <option value="Impostos">Impostos</option>
          <option value="Marketing">Marketing</option>
          <option value="Operacional">Operacional</option>
        </select>
      </div>
      <div class="fin-form-row">
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-valor">Valor (R$)</label>
          <input class="fin-form-input" id="fin-valor" type="number" step="0.01" placeholder="Ex: 1000" required />
        </div>
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-tipo-fat">Tipo</label>
          <select class="fin-form-input" id="fin-tipo-fat">
            <option value="Recorrente">Recorrente</option>
            <option value="Pontual">Pontual</option>
          </select>
        </div>
      </div>
      <div class="fin-form-row">
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-venc">Vencimento</label>
          <input class="fin-form-input" id="fin-venc" type="date" required />
        </div>
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-status">Status</label>
          <select class="fin-form-input" id="fin-status">
            <option value="Pendente">Pendente</option>
            <option value="Pago">Pago</option>
            <option value="Atrasado">Atrasado</option>
          </select>
        </div>
      </div>
      <div class="fin-form-group" id="fin-rec-pag-group" style="display:none;">
        <label class="fin-form-label" for="fin-rec-pag">Data de Pagamento</label>
        <input class="fin-form-input" id="fin-rec-pag" type="date" />
      </div>
    `;
  }

  // Monitora se o cliente é avulso
  const clientSelect = document.getElementById('fin-form-cliente');
  const avulsoGroup = document.getElementById('fin-nome-avulso-group');
  if (clientSelect && avulsoGroup) {
    clientSelect.addEventListener('change', () => {
      const isNowAvulso = clientSelect.value === '';
      avulsoGroup.style.display = isNowAvulso ? 'block' : 'none';
      const avulsoInput = document.getElementById('fin-nome-avulso');
      if (isNowAvulso) {
        avulsoInput.setAttribute('required', 'true');
      } else {
        avulsoInput.removeAttribute('required');
      }
    });
  }

  // Monitora alteração do Status para exibir data de recebimento/pagamento se Pago
  const statusSelect = document.getElementById('fin-status');
  const dateGroup = document.getElementById('fin-rec-pag-group');
  if (statusSelect && dateGroup) {
    statusSelect.addEventListener('change', () => {
      dateGroup.style.display = statusSelect.value === 'Pago' ? 'block' : 'none';
    });
  }
}

// Modal Criar Nova Movimentação
function _abrirModalNovaMovimentacao() {
  if (document.getElementById('fin-modal-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'fin-modal-overlay';
  overlay.innerHTML = `
    <div id="fin-modal-card">
      <div class="fin-modal-header">
        <h3 class="fin-modal-title">Nova Movimentação</h3>
        <button class="fin-modal-close" id="fin-modal-close-btn" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="fin-form-group">
        <label class="fin-form-label">Tipo de Transação</label>
        <div style="display:flex; gap:16px;">
          <label style="display:flex; align-items:center; gap:6px; font-size:13px; color:#FFF; cursor:pointer;">
            <input type="radio" name="mov_tipo" value="receita" checked style="accent-color:var(--cyan);" /> Receita
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-size:13px; color:#FFF; cursor:pointer;">
            <input type="radio" name="mov_tipo" value="despesa" style="accent-color:var(--cyan);" /> Despesa
          </label>
        </div>
      </div>
      
      <!-- Campos Dinâmicos -->
      <div id="fin-modal-dynamic-fields"></div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px;">
        <button class="btn btn-ghost" id="fin-modal-cancel" style="padding:10px 20px;">Cancelar</button>
        <button class="btn btn-cyan" id="fin-modal-save" style="padding:10px 20px;">Adicionar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Inicializa com campos de Receita
  _renderModalDynamicFields('receita');

  // Monitora rádio de alternância Receita/Despesa
  overlay.querySelectorAll('input[name="mov_tipo"]').forEach(rad => {
    rad.addEventListener('change', (e) => {
      _renderModalDynamicFields(e.target.value);
    });
  });

  const fechar = () => {
    overlay.style.animation = 'finFadeIn 0.2s reverse forwards';
    document.getElementById('fin-modal-card').style.animation = 'finSlideUp 0.2s reverse forwards';
    setTimeout(() => overlay.remove(), 200);
  };

  document.getElementById('fin-modal-close-btn').addEventListener('click', fechar);
  document.getElementById('fin-modal-cancel').addEventListener('click', fechar);
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

  document.getElementById('fin-modal-save').addEventListener('click', async () => {
    const isReceita = overlay.querySelector('input[name="mov_tipo"]:checked').value === 'receita';
    const valor = parseFloat(document.getElementById('fin-valor').value);
    const desc = document.getElementById('fin-desc').value;
    const venc = document.getElementById('fin-venc').value;
    const status = document.getElementById('fin-status').value;

    let nomeAvulso = '';
    let clienteIdVal = '';
    if (isReceita) {
      clienteIdVal = document.getElementById('fin-form-cliente').value;
      if (!clienteIdVal) {
        nomeAvulso = document.getElementById('fin-nome-avulso').value;
        if (!nomeAvulso) {
          _showToast('Preencha o nome do cliente avulso!');
          return;
        }
      }
    }

    if (!desc || isNaN(valor) || !venc) {
      _showToast('Preencha todos os campos obrigatórios!');
      return;
    }

    const saveBtn = document.getElementById('fin-modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    if (isReceita) {
      const payload = {
        cliente_id: clienteIdVal ? parseInt(clienteIdVal, 10) : null,
        receita_nome: clienteIdVal ? null : nomeAvulso,
        receita_descricao: desc,
        receita_tipo: document.getElementById('fin-tipo-fat').value,
        receita_valor: valor,
        data_vencimento: venc + 'T12:00:00.000Z',
        data_recebimento: status === 'Pago' ? (document.getElementById('fin-rec-pag').value ? document.getElementById('fin-rec-pag').value + 'T12:00:00.000Z' : new Date().toISOString()) : null,
        receita_status: status
      };

      const { error } = await FinanceiroReceitas.create(payload);
      if (error) {
        console.error(error);
        _showToast('Erro ao cadastrar receita no banco.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Adicionar';
      } else {
        _showToast('Receita cadastrada com sucesso!');
        fechar();
        _loadData();
      }
    } else {
      const payload = {
        despesa_nome: desc,
        despesa_categoria: document.getElementById('fin-categoria').value,
        despesa_tipo: document.getElementById('fin-tipo-fat').value,
        despesa_valor: valor,
        data_vencimento: venc + 'T12:00:00.000Z',
        data_pagamento: status === 'Pago' ? (document.getElementById('fin-rec-pag').value ? document.getElementById('fin-rec-pag').value + 'T12:00:00.000Z' : new Date().toISOString()) : null,
        despesa_status: status
      };

      const { error } = await FinanceiroDespesas.create(payload);
      if (error) {
        console.error(error);
        _showToast('Erro ao cadastrar despesa no banco.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Adicionar';
      } else {
        _showToast('Despesa cadastrada com sucesso!');
        fechar();
        _loadData();
      }
    }
  });
}

// Modal Editar Receita
function _abrirModalEdicaoReceita(r) {
  if (document.getElementById('fin-modal-overlay')) return;

  const clientsOptions = _state.clientes.map(c => `
    <option value="${c.cliente_id}" ${c.cliente_id === r.cliente_id ? 'selected' : ''}>
      ${_esc(c.cliente_nome)}
    </option>
  `).join('');

  const statusNormalizado = (r.receita_status || '').trim().toLowerCase();
  const isPago = statusNormalizado === 'pago';
  const isAvulso = !r.cliente_id;

  const overlay = document.createElement('div');
  overlay.id = 'fin-modal-overlay';
  overlay.innerHTML = `
    <div id="fin-modal-card">
      <div class="fin-modal-header">
        <h3 class="fin-modal-title">Editar Receita</h3>
        <button class="fin-modal-close" id="fin-modal-close-btn" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      
      <div class="fin-form-group">
        <label class="fin-form-label" for="fin-form-cliente">Cliente Associado</label>
        <select class="fin-form-input" id="fin-form-cliente">
          <option value="">-- Lançamento Avulso (Sem Vínculo) --</option>
          ${clientsOptions}
        </select>
      </div>
      <div class="fin-form-group" id="fin-nome-avulso-group" style="display: ${isAvulso ? 'block' : 'none'};">
        <label class="fin-form-label" for="fin-nome-avulso">Nome do Cliente / Identificador</label>
        <input class="fin-form-input" id="fin-nome-avulso" value="${_esc(r.receita_nome || '')}" />
      </div>
      <div class="fin-form-group">
        <label class="fin-form-label" for="fin-desc">Descrição da Receita</label>
        <input class="fin-form-input" id="fin-desc" value="${_esc(r.receita_descricao)}" required />
      </div>
      <div class="fin-form-row">
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-valor">Valor (R$)</label>
          <input class="fin-form-input" id="fin-valor" type="number" step="0.01" value="${r.receita_valor}" required />
        </div>
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-tipo-fat">Tipo</label>
          <select class="fin-form-input" id="fin-tipo-fat">
            <option value="Recorrente" ${r.receita_tipo === 'Recorrente' ? 'selected' : ''}>Recorrente</option>
            <option value="Pontual" ${r.receita_tipo === 'Pontual' ? 'selected' : ''}>Pontual</option>
          </select>
        </div>
      </div>
      <div class="fin-form-row">
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-venc">Vencimento</label>
          <input class="fin-form-input" id="fin-venc" type="date" value="${_toInputDate(r.data_vencimento)}" required />
        </div>
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-status">Status</label>
          <select class="fin-form-input" id="fin-status">
            <option value="Pendente" ${statusNormalizado === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="Pago" ${isPago ? 'selected' : ''}>Pago</option>
            <option value="Atrasado" ${statusNormalizado === 'atrasado' ? 'selected' : ''}>Atrasado</option>
            <option value="Cancelado" ${statusNormalizado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>
      </div>
      <div class="fin-form-group" id="fin-rec-pag-group" style="display: ${isPago ? 'block' : 'none'};">
        <label class="fin-form-label" for="fin-rec-pag">Data de Recebimento</label>
        <input class="fin-form-input" id="fin-rec-pag" type="date" value="${_toInputDate(r.data_recebimento)}" />
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px;">
        <button class="btn btn-ghost" id="fin-modal-delete" style="background:#EF4444; border-color:#EF4444; color:#FFF; padding:10px 16px;">Excluir</button>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-ghost" id="fin-modal-cancel" style="padding:10px 20px;">Cancelar</button>
          <button class="btn btn-cyan" id="fin-modal-save" style="padding:10px 20px;">Salvar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const clientSelect = document.getElementById('fin-form-cliente');
  const avulsoGroup = document.getElementById('fin-nome-avulso-group');
  clientSelect.addEventListener('change', () => {
    const isNowAvulso = clientSelect.value === '';
    avulsoGroup.style.display = isNowAvulso ? 'block' : 'none';
  });

  const statusSelect = document.getElementById('fin-status');
  const dateGroup = document.getElementById('fin-rec-pag-group');
  statusSelect.addEventListener('change', () => {
    dateGroup.style.display = statusSelect.value === 'Pago' ? 'block' : 'none';
  });

  const fechar = () => {
    overlay.style.animation = 'finFadeIn 0.2s reverse forwards';
    document.getElementById('fin-modal-card').style.animation = 'finSlideUp 0.2s reverse forwards';
    setTimeout(() => overlay.remove(), 200);
  };

  document.getElementById('fin-modal-close-btn').addEventListener('click', fechar);
  document.getElementById('fin-modal-cancel').addEventListener('click', fechar);
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

  // Excluir
  document.getElementById('fin-modal-delete').addEventListener('click', async () => {
    if (!confirm('Deseja realmente excluir esta receita?')) return;
    const deleteBtn = document.getElementById('fin-modal-delete');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Excluindo...';

    const { error } = await FinanceiroReceitas.delete(r.receita_id);
    if (error) {
      console.error(error);
      _showToast('Erro ao excluir do banco.');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Excluir';
    } else {
      _showToast('Receita excluída!');
      fechar();
      _loadData();
    }
  });

  // Salvar
  document.getElementById('fin-modal-save').addEventListener('click', async () => {
    const valor = parseFloat(document.getElementById('fin-valor').value);
    const desc = document.getElementById('fin-desc').value;
    const venc = document.getElementById('fin-venc').value;
    const status = document.getElementById('fin-status').value;

    const clienteIdVal = document.getElementById('fin-form-cliente').value;
    let nomeAvulso = '';
    if (!clienteIdVal) {
      nomeAvulso = document.getElementById('fin-nome-avulso').value;
      if (!nomeAvulso) {
        _showToast('Preencha o nome do cliente avulso!');
        return;
      }
    }

    if (!desc || isNaN(valor) || !venc) {
      _showToast('Preencha todos os campos!');
      return;
    }

    const saveBtn = document.getElementById('fin-modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    const payload = {
      cliente_id: clienteIdVal ? parseInt(clienteIdVal, 10) : null,
      receita_nome: clienteIdVal ? null : nomeAvulso,
      receita_descricao: desc,
      receita_tipo: document.getElementById('fin-tipo-fat').value,
      receita_valor: valor,
      data_vencimento: venc + 'T12:00:00.000Z',
      data_recebimento: status === 'Pago' ? (document.getElementById('fin-rec-pag').value ? document.getElementById('fin-rec-pag').value + 'T12:00:00.000Z' : new Date().toISOString()) : null,
      receita_status: status
    };

    const { error } = await FinanceiroReceitas.update(r.receita_id, payload);
    if (error) {
      console.error(error);
      _showToast('Erro ao atualizar receita.');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar';
    } else {
      _showToast('Receita atualizada!');
      fechar();
      _loadData();
    }
  });
}

// Modal Editar Despesa
function _abrirModalEdicaoDespesa(d) {
  if (document.getElementById('fin-modal-overlay')) return;

  const statusNormalizado = (d.despesa_status || '').trim().toLowerCase();
  const isPago = statusNormalizado === 'pago';

  const overlay = document.createElement('div');
  overlay.id = 'fin-modal-overlay';
  overlay.innerHTML = `
    <div id="fin-modal-card">
      <div class="fin-modal-header">
        <h3 class="fin-modal-title">Editar Despesa</h3>
        <button class="fin-modal-close" id="fin-modal-close-btn" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      
      <div class="fin-form-group">
        <label class="fin-form-label" for="fin-desc">Fornecedor / Despesa</label>
        <input class="fin-form-input" id="fin-desc" value="${_esc(d.despesa_nome)}" required />
      </div>
      <div class="fin-form-group">
        <label class="fin-form-label" for="fin-categoria">Categoria</label>
        <select class="fin-form-input" id="fin-categoria">
          <option value="Ferramentas" ${d.despesa_categoria === 'Ferramentas' ? 'selected' : ''}>Ferramentas</option>
          <option value="Folha de Pagamento" ${d.despesa_categoria === 'Folha de Pagamento' ? 'selected' : ''}>Folha de Pagamento</option>
          <option value="Impostos" ${d.despesa_categoria === 'Impostos' ? 'selected' : ''}>Impostos</option>
          <option value="Marketing" ${d.despesa_categoria === 'Marketing' ? 'selected' : ''}>Marketing</option>
          <option value="Operacional" ${d.despesa_categoria === 'Operacional' ? 'selected' : ''}>Operacional</option>
        </select>
      </div>
      <div class="fin-form-row">
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-valor">Valor (R$)</label>
          <input class="fin-form-input" id="fin-valor" type="number" step="0.01" value="${d.despesa_valor}" required />
        </div>
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-tipo-fat">Tipo</label>
          <select class="fin-form-input" id="fin-tipo-fat">
            <option value="Recorrente" ${d.despesa_tipo === 'Recorrente' ? 'selected' : ''}>Recorrente</option>
            <option value="Pontual" ${d.despesa_tipo === 'Pontual' ? 'selected' : ''}>Pontual</option>
          </select>
        </div>
      </div>
      <div class="fin-form-row">
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-venc">Vencimento</label>
          <input class="fin-form-input" id="fin-venc" type="date" value="${_toInputDate(d.data_vencimento)}" required />
        </div>
        <div class="fin-form-group">
          <label class="fin-form-label" for="fin-status">Status</label>
          <select class="fin-form-input" id="fin-status">
            <option value="Pendente" ${statusNormalizado === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="Pago" ${isPago ? 'selected' : ''}>Pago</option>
            <option value="Atrasado" ${statusNormalizado === 'atrasado' ? 'selected' : ''}>Atrasado</option>
          </select>
        </div>
      </div>
      <div class="fin-form-group" id="fin-rec-pag-group" style="display: ${isPago ? 'block' : 'none'};">
        <label class="fin-form-label" for="fin-rec-pag">Data de Pagamento</label>
        <input class="fin-form-input" id="fin-rec-pag" type="date" value="${_toInputDate(d.data_pagamento)}" />
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px;">
        <button class="btn btn-ghost" id="fin-modal-delete" style="background:#EF4444; border-color:#EF4444; color:#FFF; padding:10px 16px;">Excluir</button>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-ghost" id="fin-modal-cancel" style="padding:10px 20px;">Cancelar</button>
          <button class="btn btn-cyan" id="fin-modal-save" style="padding:10px 20px;">Salvar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const statusSelect = document.getElementById('fin-status');
  const dateGroup = document.getElementById('fin-rec-pag-group');
  statusSelect.addEventListener('change', () => {
    dateGroup.style.display = statusSelect.value === 'Pago' ? 'block' : 'none';
  });

  const fechar = () => {
    overlay.style.animation = 'finFadeIn 0.2s reverse forwards';
    document.getElementById('fin-modal-card').style.animation = 'finSlideUp 0.2s reverse forwards';
    setTimeout(() => overlay.remove(), 200);
  };

  document.getElementById('fin-modal-close-btn').addEventListener('click', fechar);
  document.getElementById('fin-modal-cancel').addEventListener('click', fechar);
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

  // Excluir
  document.getElementById('fin-modal-delete').addEventListener('click', async () => {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;
    const deleteBtn = document.getElementById('fin-modal-delete');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Excluindo...';

    const { error } = await FinanceiroDespesas.delete(d.despesa_id);
    if (error) {
      console.error(error);
      _showToast('Erro ao excluir despesa.');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Excluir';
    } else {
      _showToast('Despesa excluída!');
      fechar();
      _loadData();
    }
  });

  // Salvar
  document.getElementById('fin-modal-save').addEventListener('click', async () => {
    const valor = parseFloat(document.getElementById('fin-valor').value);
    const desc = document.getElementById('fin-desc').value;
    const venc = document.getElementById('fin-venc').value;
    const status = document.getElementById('fin-status').value;

    if (!desc || isNaN(valor) || !venc) {
      _showToast('Preencha todos os campos!');
      return;
    }

    const saveBtn = document.getElementById('fin-modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    const payload = {
      despesa_nome: desc,
      despesa_categoria: document.getElementById('fin-categoria').value,
      despesa_tipo: document.getElementById('fin-tipo-fat').value,
      despesa_valor: valor,
      data_vencimento: venc + 'T12:00:00.000Z',
      data_pagamento: status === 'Pago' ? (document.getElementById('fin-rec-pag').value ? document.getElementById('fin-rec-pag').value + 'T12:00:00.000Z' : new Date().toISOString()) : null,
      despesa_status: status
    };

    const { error } = await FinanceiroDespesas.update(d.despesa_id, payload);
    if (error) {
      console.error(error);
      _showToast('Erro ao atualizar despesa.');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar';
    } else {
      _showToast('Despesa atualizada!');
      fechar();
      _loadData();
    }
  });
}

// Importar movimentações do mês anterior
async function _importarMesAnterior() {
  const currentPeriod = _state.selectedPeriod;
  const prevPeriod = _getPreviousPeriod(currentPeriod);
  if (!prevPeriod) {
    _showToast("Período anterior não determinado.");
    return;
  }

  if (!confirm(`Deseja realmente importar todas as receitas e despesas de ${prevPeriod} para o período atual (${currentPeriod})?\n\nAs novas movimentações serão criadas com status 'Pendente'.`)) {
    return;
  }

  const prevRecs = _filterByPeriod(_state.receitas, prevPeriod, 'data_vencimento');
  const prevDesps = _filterByPeriod(_state.despesas, prevPeriod, 'data_vencimento');

  if (prevRecs.length === 0 && prevDesps.length === 0) {
    _showToast(`Nenhuma movimentação encontrada em ${prevPeriod} para importar.`);
    return;
  }

  const importBtn = document.getElementById('btn-importar-mes');
  if (importBtn) {
    importBtn.disabled = true;
    importBtn.textContent = 'Importando...';
  }

  try {
    // 1. Duplicar Receitas
    if (prevRecs.length > 0) {
      const newRecs = prevRecs.map(r => ({
        cliente_id: r.cliente_id,
        receita_nome: r.receita_nome,
        receita_descricao: r.receita_descricao,
        receita_tipo: r.receita_tipo,
        receita_valor: r.receita_valor,
        data_vencimento: _shiftDateToPeriod(r.data_vencimento, currentPeriod),
        data_recebimento: null,
        receita_status: 'Pendente'
      }));
      const { error } = await FinanceiroReceitas.createMany(newRecs);
      if (error) throw error;
    }

    // 2. Duplicar Despesas
    if (prevDesps.length > 0) {
      const newDesps = prevDesps.map(d => ({
        despesa_nome: d.despesa_nome,
        despesa_categoria: d.despesa_categoria,
        despesa_tipo: d.despesa_tipo,
        despesa_valor: d.despesa_valor,
        data_vencimento: _shiftDateToPeriod(d.data_vencimento, currentPeriod),
        data_pagamento: null,
        despesa_status: 'Pendente'
      }));
      const { error } = await FinanceiroDespesas.createMany(newDesps);
      if (error) throw error;
    }

    _showToast(`Importação de ${prevPeriod} concluída!`);
    await _loadData();
  } catch (err) {
    console.error("Erro ao importar:", err);
    _showToast("Erro durante a importação.");
  } finally {
    if (importBtn) {
      importBtn.disabled = false;
      importBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="7 3 7 8 15 8"/><circle cx="12" cy="18" r="3"/></svg>
        Importar Mês Anterior
      `;
    }
  }
}

// Importar clientes ativos como receitas de mensalidade
async function _importarClientesDoCRM() {
  const currentPeriod = _state.selectedPeriod;

  if (!confirm(`Deseja importar todos os clientes ativos do CRM como novas receitas de 'Mensalidade' para ${currentPeriod}?\n\nIsso criará uma receita pendente para cada cliente ativo com o valor da sua respectiva mensalidade.`)) {
    return;
  }

  const ativos = _state.clientes.filter(c => (c.cliente_status || '').trim().toLowerCase() === 'ativado');

  if (ativos.length === 0) {
    _showToast("Nenhum cliente com status 'Ativado' encontrado.");
    return;
  }

  const importBtn = document.getElementById('btn-importar-clientes');
  if (importBtn) {
    importBtn.disabled = true;
    importBtn.textContent = 'Importando...';
  }

  try {
    const dueDate = _getDefaultDueDateForPeriod(currentPeriod);
    const newRecs = ativos.map(c => ({
      cliente_id: c.cliente_id,
      receita_nome: null,
      receita_descricao: 'Mensalidade',
      receita_tipo: 'Recorrente',
      receita_valor: parseFloat(c.cliente_mensalidade || 0),
      data_vencimento: dueDate,
      data_recebimento: null,
      receita_status: 'Pendente'
    }));

    const { error } = await FinanceiroReceitas.createMany(newRecs);
    if (error) throw error;

    _showToast(`${ativos.length} mensalidades importadas com sucesso!`);
    await _loadData();
  } catch (err) {
    console.error("Erro ao importar clientes:", err);
    _showToast("Erro ao importar clientes do CRM.");
  } finally {
    if (importBtn) {
      importBtn.disabled = false;
      importBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Importar Clientes
      `;
    }
  }
}

// Carregamento de dados dinâmico e atualização da UI
async function _loadData() {
  // Mostra loading nos KPIs e tabelas
  document.getElementById('kpi-receitas')?.classList.add('smc-loading');
  document.getElementById('kpi-despesas')?.classList.add('smc-loading');
  document.getElementById('kpi-saldo')?.classList.add('smc-loading');

  const { data: recs, error: errRec } = await FinanceiroReceitas.getAll();
  const { data: desps, error: errDes } = await FinanceiroDespesas.getAll();
  const { data: clis, error: errCli } = await Clientes.getAll();

  if (errRec || errDes || errCli) {
    console.error("Erro no Supabase:", { errRec, errDes, errCli });
    _showToast("Erro ao carregar dados do Supabase.");
  }

  _state.receitas = recs || [];
  _state.despesas = desps || [];
  _state.clientes = clis || [];

  // Remove animação de loading e atualiza a view
  document.getElementById('kpi-receitas')?.classList.remove('smc-loading');
  document.getElementById('kpi-despesas')?.classList.remove('smc-loading');
  document.getElementById('kpi-saldo')?.classList.remove('smc-loading');

  _renderAll();
}

function _renderAll() {
  const receitasFiltradas = _filterByPeriod(_state.receitas, _state.selectedPeriod, 'data_vencimento');
  const despesasFiltradas = _filterByPeriod(_state.despesas, _state.selectedPeriod, 'data_vencimento');

  // Cálculo de totais
  const totalReceitas = receitasFiltradas.reduce((acc, curr) => acc + parseFloat(curr.receita_valor || 0), 0);
  const totalDespesas = despesasFiltradas.reduce((acc, curr) => acc + parseFloat(curr.despesa_valor || 0), 0);
  const saldoTotal = totalReceitas - totalDespesas;

  // Atualização dos KPI Cards
  const kpiRec = document.getElementById('kpi-receitas');
  const kpiDes = document.getElementById('kpi-despesas');
  const kpiSaldo = document.getElementById('kpi-saldo');

  if (kpiRec) kpiRec.textContent = _fmtBRL(totalReceitas);
  if (kpiDes) kpiDes.textContent = _fmtBRL(totalDespesas);
  if (kpiSaldo) {
    kpiSaldo.textContent = _fmtBRL(saldoTotal);
    kpiSaldo.style.color = saldoTotal >= 0 ? 'var(--cyan)' : '#EF4444';
  }

  // Atualização dos badges de contagem das abas
  const badgeRecCount = document.getElementById('badge-rec-count');
  const badgeDesCount = document.getElementById('badge-des-count');
  if (badgeRecCount) badgeRecCount.textContent = receitasFiltradas.length;
  if (badgeDesCount) badgeDesCount.textContent = despesasFiltradas.length;

  // Mapeamento de Clientes (cliente_id -> cliente_nome) para busca rápida em O(1)
  const clientMap = {};
  _state.clientes.forEach(c => {
    clientMap[c.cliente_id] = c.cliente_nome;
  });

  // Renderiza tabela de receitas
  const tbodyRec = document.getElementById('tbody-receitas');
  if (tbodyRec) {
    if (receitasFiltradas.length === 0) {
      tbodyRec.innerHTML = `<tr><td colspan="7" class="fin-empty-state">Nenhuma receita encontrada em ${_state.selectedPeriod}.</td></tr>`;
    } else {
      tbodyRec.innerHTML = receitasFiltradas.map((r) => {
        const statusVal = r.receita_status || 'Pendente';
        const statusClean = statusVal.trim().toLowerCase();
        const badgeStatusClass = statusClean === "pago" ? "fin-status-pago" : (statusClean === "atrasado" ? "fin-status-atrasado" : (statusClean === "cancelado" ? "fin-status-atrasado" : "fin-status-pendente"));
        const badgeTypeClass = r.receita_tipo === "Recorrente" ? "fin-type-recorrente" : "fin-type-pontual";
        const clienteNome = r.cliente_id && clientMap[r.cliente_id]
          ? clientMap[r.cliente_id]
          : (r.receita_nome || 'Lançamento Avulso');

        return `
          <tr class="fin-row-clickable" data-id="${r.receita_id}" data-type="receita" style="cursor:pointer;">
            <td>
              <div class="fin-name-cell">
                <span class="fin-name-main">${_esc(clienteNome)}</span>
              </div>
            </td>
            <td>${_esc(r.receita_descricao)}</td>
            <td><span class="fin-type-badge ${badgeTypeClass}">${r.receita_tipo}</span></td>
            <td class="fin-value-cell">${_fmtBRL(r.receita_valor)}</td>
            <td class="fin-date-cell">${_formatISODate(r.data_vencimento)}</td>
            <td class="fin-date-cell">${_formatISODate(r.data_recebimento)}</td>
            <td><span class="fin-status-badge ${badgeStatusClass}">${statusVal}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // Renderiza tabela de despesas
  const tbodyDes = document.getElementById('tbody-despesas');
  if (tbodyDes) {
    if (despesasFiltradas.length === 0) {
      tbodyDes.innerHTML = `<tr><td colspan="7" class="fin-empty-state">Nenhuma despesa encontrada em ${_state.selectedPeriod}.</td></tr>`;
    } else {
      tbodyDes.innerHTML = despesasFiltradas.map((d) => {
        const statusVal = d.despesa_status || 'Pendente';
        const statusClean = statusVal.trim().toLowerCase();
        const badgeStatusClass = statusClean === "pago" ? "fin-status-pago" : (statusClean === "atrasado" ? "fin-status-atrasado" : "fin-status-pendente");
        const badgeTypeClass = d.despesa_tipo === "Recorrente" ? "fin-type-recorrente" : "fin-type-pontual";

        return `
          <tr class="fin-row-clickable" data-id="${d.despesa_id}" data-type="despesa" style="cursor:pointer;">
            <td>
              <div class="fin-name-cell">
                <span class="fin-name-main">${_esc(d.despesa_nome)}</span>
              </div>
            </td>
            <td>${_esc(d.despesa_categoria)}</td>
            <td><span class="fin-type-badge ${badgeTypeClass}">${d.despesa_tipo}</span></td>
            <td class="fin-value-cell" style="color:#EF4444;">${_fmtBRL(d.despesa_valor)}</td>
            <td class="fin-date-cell">${_formatISODate(d.data_vencimento)}</td>
            <td class="fin-date-cell">${_formatISODate(d.data_pagamento)}</td>
            <td><span class="fin-status-badge ${badgeStatusClass}">${statusVal}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // Registra eventos de clique para edição
  document.querySelectorAll('.fin-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const id = parseInt(row.dataset.id, 10);
      const type = row.dataset.type;
      if (type === 'receita') {
        const r = _state.receitas.find(x => x.receita_id === id);
        if (r) _abrirModalEdicaoReceita(r);
      } else {
        const d = _state.despesas.find(x => x.despesa_id === id);
        if (d) _abrirModalEdicaoDespesa(d);
      }
    });
  });
}

// Componente Exportado
export default {
  render() {
    if (!UserStore.isAdmin()) {
      return `
        <div class="page-outlet" style="display: flex; align-items: center; justify-content: center; height: 70vh; text-align: center;">
          <div style="max-width: 420px; background: #0D0D0D; border: 1px solid rgba(239, 68, 68, 0.2); padding: 40px; border-radius: 20px;">
            <div style="width: 64px; height: 64px; background: rgba(239, 68, 68, 0.1); color: #EF4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 style="color: #FFF; font-size: 20px; font-weight: 700; margin-bottom: 10px;">Acesso Restrito</h2>
            <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
              Esta área é de acesso exclusivo para administradores do sistema. Se você acredita que isso é um erro, contate o suporte.
            </p>
            <a href="#inicio" class="btn btn-cyan" style="display: inline-flex; padding: 10px 24px; text-decoration: none; border-radius: 8px;">Voltar para o Início</a>
          </div>
        </div>
      `;
    }

    return `
      <!-- Cabeçalho (Header) -->
      <div class="page-header">
        <div class="page-title-block">
          <h1>Gestão Financeira</h1>
          <p>${today()}</p>
        </div>
        <div class="header-actions">
          <!-- Filtro de período -->
          <div class="fin-filter-container">
            <button class="fin-select-btn" id="fin-period-trigger">
              <span>Julho 2026</span>
              <svg viewBox="0 0 24 24" stroke="currentColor"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="fin-dropdown-menu" id="fin-period-dropdown">
              <button class="fin-dropdown-item" data-period="Maio 2026">Maio 2026</button>
              <button class="fin-dropdown-item" data-period="Junho 2026">Junho 2026</button>
              <button class="fin-dropdown-item active" data-period="Julho 2026">Julho 2026</button>
              <button class="fin-dropdown-item" data-period="Agosto 2026">Agosto 2026</button>
            </div>
          </div>
          <!-- Botão Importar Clientes -->
          <button class="btn btn-ghost" id="btn-importar-clientes" style="border: 1px solid rgba(26, 206, 238, 0.4); color: var(--cyan); display: flex; align-items: center; gap: 6px; padding: 10px 16px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Importar Clientes
          </button>
          <!-- Botão Importar Mês Anterior -->
          <button class="btn btn-ghost" id="btn-importar-mes" style="border: 1px solid rgba(26, 206, 238, 0.4); color: var(--cyan); display: flex; align-items: center; gap: 6px; padding: 10px 16px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="7 3 7 8 15 8"/><circle cx="12" cy="18" r="3"/></svg>
            Importar Mês Anterior
          </button>
          <!-- Botão Primário Ciano -->
          <button class="btn btn-cyan" id="btn-nova-movimentacao">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Movimentação
          </button>
        </div>
      </div>

      <!-- Cards de Resumo (Widgets) -->
      <div class="fin-stats-row">
        <!-- Receitas -->
        <div class="fin-stat-card">
          <div class="fin-stat-icon-wrap fin-icon-receita">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><polyline points="18 15 12 9 6 15"/></svg>
          </div>
          <div class="fin-stat-info">
            <span class="fin-stat-label">Total de Receitas</span>
            <span class="fin-stat-value smc-loading" id="kpi-receitas">Carregando...</span>
          </div>
        </div>

        <!-- Despesas -->
        <div class="fin-stat-card">
          <div class="fin-stat-icon-wrap fin-icon-despesa">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="fin-stat-info">
            <span class="fin-stat-label">Total de Despesas</span>
            <span class="fin-stat-value smc-loading" id="kpi-despesas">Carregando...</span>
          </div>
        </div>

        <!-- Saldo -->
        <div class="fin-stat-card">
          <div class="fin-stat-icon-wrap fin-icon-saldo">
            <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
          </div>
          <div class="fin-stat-info">
            <span class="fin-stat-label">Saldo do Mês</span>
            <span class="fin-stat-value smc-loading" id="kpi-saldo">Carregando...</span>
          </div>
        </div>
      </div>

      <!-- Area de Dados (Tabs e Tabelas) -->
      <div class="fin-tabs-container">
        <div class="fin-tabs-header">
          <div class="fin-tabs-triggers">
            <button class="fin-tab-btn active" data-tab="receitas">
              <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
              Receitas
              <span class="fin-tab-count" id="badge-rec-count">...</span>
            </button>
            <button class="fin-tab-btn" data-tab="despesas">
              <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              Despesas
              <span class="fin-tab-count" id="badge-des-count">...</span>
            </button>
          </div>
        </div>

        <!-- Painel 1: Receitas -->
        <div class="fin-tab-panel active" id="panel-receitas">
          <div class="fin-table-wrapper">
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Recebimento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="tbody-receitas">
                <tr><td colspan="7" class="fin-empty-state"><span class="smc-loading">Buscando receitas no Supabase...</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Painel 2: Despesas -->
        <div class="fin-tab-panel" id="panel-despesas">
          <div class="fin-table-wrapper">
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Fornecedor / Despesa</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="tbody-despesas">
                <tr><td colspan="7" class="fin-empty-state"><span class="smc-loading">Buscando despesas no Supabase...</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  onMount() {
    if (!UserStore.isAdmin()) return;
    staggerAnimation(document.querySelector('.page-outlet'));

    // Carrega dados assincronamente da base
    _loadData();

    // Dropdown de Período
    const periodTrigger = document.getElementById('fin-period-trigger');
    const periodDropdown = document.getElementById('fin-period-dropdown');

    if (periodTrigger && periodDropdown) {
      periodTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        periodTrigger.classList.toggle('active');
        periodDropdown.classList.toggle('show');
      });

      // Fechar ao clicar fora
      document.addEventListener('click', () => {
        periodTrigger.classList.remove('active');
        periodDropdown.classList.remove('show');
      });

      // Escolher período
      periodDropdown.querySelectorAll('.fin-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const selected = item.dataset.period;
          _state.selectedPeriod = selected;
          periodTrigger.querySelector('span').textContent = selected;

          periodDropdown.querySelectorAll('.fin-dropdown-item').forEach(btn => btn.classList.remove('active'));
          item.classList.add('active');

          periodTrigger.classList.remove('active');
          periodDropdown.classList.remove('show');

          _showToast(`Filtro aplicado: ${selected}`);
          _renderAll();
        });
      });
    }

    // Alternância de Abas (Tabs)
    const tabButtons = document.querySelectorAll('.fin-tab-btn');
    const panels = document.querySelectorAll('.fin-tab-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        tabButtons.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');

        panels.forEach(p => {
          if (p.id === `panel-${tab}`) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });

        // Alterna exibição do botão Importar Clientes apenas na aba Receitas
        const btnImportarClis = document.getElementById('btn-importar-clientes');
        if (btnImportarClis) {
          btnImportarClis.style.display = tab === 'receitas' ? 'flex' : 'none';
        }
      });
    });

    // Botão "Importar Clientes"
    const btnImportarClientes = document.getElementById('btn-importar-clientes');
    if (btnImportarClientes) {
      btnImportarClientes.addEventListener('click', _importarClientesDoCRM);
    }

    // Botão "Importar Mês Anterior"
    const btnImportar = document.getElementById('btn-importar-mes');
    if (btnImportar) {
      btnImportar.addEventListener('click', _importarMesAnterior);
    }

    // Botão "+ Nova Movimentação"
    const btnNova = document.getElementById('btn-nova-movimentacao');
    if (btnNova) {
      btnNova.addEventListener('click', _abrirModalNovaMovimentacao);
    }
  },

  onDestroy() {
    const modal = document.getElementById('fin-modal-overlay');
    if (modal) modal.remove();
  }
};
