/**
 * email-marketing.js — Página de Disparo de E-mail Marketing
 *
 * Seções:
 *   1. Compose da mensagem (assunto + corpo, com botão de variável {nome})
 *   2. Seleção de contatos (puxado de negocios.negocio_email)
 *   3. Acompanhamento do status da campanha
 */

import UserStore                     from '../js/userStore.js';
import { Negocios, EmailMarketing, Usuarios } from '../js/db.js';

const WEBHOOK_URL      = 'https://n8n.omniautomacoes.com.br/webhook/5f397deb-1cda-4a22-9d2c-7d9fa2ae0f9e';
const WEBHOOK_SMTP_URL = 'https://n8n.omniautomacoes.com.br/webhook/409c3c71-ae14-4069-a2c6-cf2345a8c3da';

// ─── Estado local ──────────────────────────────────────────
let _contatos     = [];          // negócios com negocio_email preenchido
let _selecionados = new Set();   // IDs dos contatos marcados
let _campanhas    = [];          // histórico da sessão
let _busca        = '';
let _enviando     = false;
let _smtpSalvo    = null;        // { smtp_email, smtp_host, smtp_port, smtp_ssl } ou null

// ─── Helpers ───────────────────────────────────────────────
function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _iniciais(nome = '') {
  const p = nome.trim().split(' ');
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return nome.substring(0, 2).toUpperCase() || '??';
}

function _formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function _contatosFiltrados() {
  if (!_busca) return _contatos;
  const q = _busca.toLowerCase();
  return _contatos.filter(c =>
    (c.negocio_titulo || '').toLowerCase().includes(q) ||
    (c.negocio_email  || '').toLowerCase().includes(q)
  );
}

// Lê os campos do compose
function _getCompose() {
  const assunto = (document.getElementById('email-compose-assunto')?.value || '').trim();
  const corpo   = (document.getElementById('email-compose-corpo')?.value   || '').trim();
  return { assunto, corpo };
}

// ─── Render: contatos ──────────────────────────────────────
function _renderContatos() {
  const list    = document.getElementById('email-contacts-list');
  const counter = document.getElementById('email-contacts-count');
  if (!list) return;

  if (counter) counter.textContent = `${_selecionados.size} selecionados`;

  const filtrados = _contatosFiltrados();

  if (!filtrados.length) {
    list.innerHTML = `
      <div class="email-contacts-empty">
        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <p>${_busca
          ? `Nenhum contato para "<strong>${_esc(_busca)}</strong>"`
          : 'Nenhum contato com e-mail cadastrado.'}</p>
      </div>`;
    return;
  }

  list.innerHTML = filtrados.map(c => {
    const checked = _selecionados.has(c.negocio_id);
    return `
      <div class="email-contact-item ${checked ? 'checked' : ''}" data-id="${c.negocio_id}">
        <div class="email-contact-checkbox">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="email-contact-avatar">${_iniciais(c.negocio_titulo)}</div>
        <div class="email-contact-info">
          <div class="email-contact-name">${_esc(c.negocio_titulo)}</div>
          <div class="email-contact-email">${_esc(c.negocio_email)}</div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.email-contact-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = Number(item.dataset.id);
      if (_selecionados.has(id)) _selecionados.delete(id);
      else _selecionados.add(id);
      _renderContatos();
      _updateSendBtn();
    });
  });
}

// ─── Render: botão disparar ────────────────────────────────
function _updateSendBtn() {
  const sendBtn = document.getElementById('email-btn-send');
  const ctCount = document.getElementById('email-send-ct-count');
  if (!sendBtn) return;

  const { assunto, corpo } = _getCompose();
  const canSend = assunto && corpo && _selecionados.size > 0 && !_enviando;

  if (ctCount) ctCount.textContent = `${_selecionados.size} contato${_selecionados.size !== 1 ? 's' : ''}`;
  sendBtn.disabled = !canSend;
}

// ─── Render: lista de campanhas (dados reais do Supabase) ───────
function _renderStatusCampanhas() {
  const container = document.getElementById('email-campanhas-list');
  if (!container) return;

  if (!_campanhas.length) {
    container.innerHTML = `
      <div class="email-status-empty">
        <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        <strong>Nenhuma campanha disparada ainda</strong>
        <p>Seus disparos aparecerão aqui após iniciar uma campanha.</p>
      </div>`;
    return;
  }

  container.innerHTML = _campanhas.map((c, i) => {
    const total      = Number(c.email_negocios)   || 0;
    const progresso  = Number(c.email_progresso)  || 0;
    const pct        = total > 0 ? Math.min(Math.round((progresso / total) * 100), 100) : 0;
    const concluida  = pct === 100;
    const aguardando = progresso === 0;

    const badgeClass = concluida  ? 'success'
                     : aguardando ? 'pending'
                     : 'sending';
    const badgeLabel = concluida  ? 'Concluída'
                     : aguardando ? 'Aguardando'
                     : 'Em andamento';

    const barColor = concluida ? '#10b981' : aguardando ? '#94a3b8' : '#1ACEEE';

    return `
      <div class="email-campanha-card" style="animation-delay:${i * 0.04}s">
        <div class="email-campanha-header">
          <div class="email-campanha-title">${_esc(c.email_campanha)}</div>
          <span class="email-status-badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="email-campanha-meta">
          <span class="email-campanha-date">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${_formatarData(c.criado_em)}
          </span>
          <span class="email-campanha-count">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${progresso} / ${total} destinatários
          </span>
        </div>
        <div class="email-campanha-progress">
          <div class="email-campanha-bar-wrap">
            <div class="email-campanha-bar-fill" style="width:${pct}%;background:${barColor}"></div>
          </div>
          <span class="email-campanha-pct">${pct}%</span>
        </div>
      </div>`;
  }).join('');
}

// Insere uma campanha recém-criada no topo da lista local (sem recarregar do server)
function _adicionarCampanhaLocal(campanha) {
  _campanhas = [campanha, ..._campanhas];
  _renderStatusCampanhas();
}

// ─── Inserir variável no cursor ────────────────────────────
function _inserirVariavel(variavel) {
  const textarea = document.getElementById('email-compose-corpo');
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const val   = textarea.value;
  textarea.value = val.substring(0, start) + variavel + val.substring(end);
  // reposiciona o cursor após a variável inserida
  textarea.selectionStart = textarea.selectionEnd = start + variavel.length;
  textarea.focus();
  _updateSendBtn();
}

// ─── SMTP: render das duas visualizações ─────────────────────
function _renderSmtp() {
  const container = document.getElementById('smtp-section-body');
  if (!container) return;

  if (_smtpSalvo && _smtpSalvo.smtp_email) {
    // ── Visão: configuração ativa ──
    const sslLabel = _smtpSalvo.smtp_ssl ? 'Ativado' : 'Desativado';
    const sslClass = _smtpSalvo.smtp_ssl ? 'on' : '';
    const emailMask = _smtpSalvo.smtp_email; // mostra completo
    const hostMask  = _smtpSalvo.smtp_host;
    const portMask  = _smtpSalvo.smtp_port;

    container.innerHTML = `
      <div class="smtp-configured-view">
        <div class="smtp-configured-badge">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Servidor configurado e ativo
        </div>
        <div class="smtp-configured-grid">
          <div class="smtp-info-item">
            <span class="smtp-info-label">Remetente</span>
            <span class="smtp-info-val">${_esc(emailMask)}</span>
          </div>
          <div class="smtp-info-item">
            <span class="smtp-info-label">Host SMTP</span>
            <span class="smtp-info-val">${_esc(hostMask)}</span>
          </div>
          <div class="smtp-info-item">
            <span class="smtp-info-label">Porta</span>
            <span class="smtp-info-val">${_esc(String(portMask))}</span>
          </div>
          <div class="smtp-info-item">
            <span class="smtp-info-label">SSL</span>
            <span class="email-ssl-badge ${sslClass}" style="font-size:12px">${sslLabel}</span>
          </div>
        </div>
        <div class="smtp-configured-actions">
          <button class="email-btn-smtp edit" id="btn-smtp-editar">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar Configuração
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-smtp-editar')?.addEventListener('click', () => {
      _smtpSalvo = null;   // força modo formulário
      _renderSmtp();
      _bindSmtpFormEvents();
    });

  } else {
    // ── Visão: formulário de configuração ──
    container.innerHTML = `
      <div class="email-smtp-grid">
        <input id="smtp-email"  class="email-input" type="email"    placeholder="Ex: envios@suaempresa.com" />
        <input id="smtp-senha"  class="email-input" type="password" placeholder="Ex: sua_senha_de_app" />
        <input id="smtp-host"   class="email-input" type="text"     placeholder="Ex: smtp.gmail.com" />
        <input id="smtp-port"   class="email-input" type="number"   placeholder="Ex: 465" />

        <div class="email-ssl-wrap">
          <div class="email-ssl-label-row">
            <span class="email-ssl-text">SSL</span>
            <label class="email-ssl-switch">
              <input type="checkbox" id="smtp-ssl" checked />
              <span class="email-ssl-slider"></span>
            </label>
          </div>
          <span class="email-ssl-badge on" id="smtp-ssl-badge">Ativado</span>
        </div>

        <div class="email-smtp-save-wrap">
          <button class="email-btn-smtp" id="btn-smtp-salvar">
            <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.55a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 14.92z"/></svg>
            Testar Configuração
          </button>
        </div>
      </div>
      <div class="email-smtp-status" id="smtp-status"></div>
    `;

    _bindSmtpFormEvents();
  }
}

// ─── SMTP: validação via Webhook + persistência ───────────────
async function _testarSmtp() {
  const email  = document.getElementById('smtp-email')?.value.trim();
  const senha  = document.getElementById('smtp-senha')?.value.trim();
  const host   = document.getElementById('smtp-host')?.value.trim();
  const port   = document.getElementById('smtp-port')?.value.trim();
  const ssl    = document.getElementById('smtp-ssl')?.checked ?? true;
  const userId = UserStore.getUserId();

  // Valida campos obrigatórios
  const campos = ['smtp-email','smtp-senha','smtp-host','smtp-port'];
  let ok = true;
  campos.forEach(id => {
    const el = document.getElementById(id);
    if (!el?.value.trim()) {
      ok = false;
      el.style.borderColor = '#ef4444';
      el.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.15)';
      setTimeout(() => { el.style.borderColor=''; el.style.boxShadow=''; }, 1800);
    }
  });
  if (!ok) { _showToast('⚠️ Preencha todos os campos SMTP.'); return; }

  const btn      = document.getElementById('btn-smtp-salvar');
  const statusEl = document.getElementById('smtp-status');
  if (btn) { btn.disabled = true; btn.innerHTML = `<div class="email-smtp-spinner"></div> Validando…`; }
  if (statusEl) { statusEl.className = 'email-smtp-status'; }

  try {
    const res    = await fetch(WEBHOOK_SMTP_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: userId, email, senha, host, port, ssl }),
    });
    const json   = await res.json().catch(() => ({}));
    const status = (json.status || json.resultado || '').trim();

    if (status === 'Validado') {
      // ── Persiste no Supabase ──
      const { data: saved, error: errSave } = await Usuarios.salvarSmtp(userId, {
        smtp_email: email,
        smtp_senha: senha,
        smtp_host:  host,
        smtp_port:  port,
        smtp_ssl:   ssl,
      });

      if (errSave) {
        console.error('[SMTP] Erro ao salvar no Supabase:', errSave);
        // Mostra erro de persistência, mas a validação funcionou
        if (statusEl) {
          statusEl.className = 'email-smtp-status show error';
          statusEl.innerHTML = `
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Validado, mas houve erro ao salvar. Tente novamente.
          `;
        }
        if (btn) { btn.disabled = false; btn.innerHTML = `Testar novamente`; }
        return;
      }

      // ── Atualiza estado e alterna para visão configurada ──
      _smtpSalvo = saved || { smtp_email: email, smtp_senha: senha, smtp_host: host, smtp_port: port, smtp_ssl: ssl };
      _showToast('✅ SMTP configurado e salvo com sucesso!');
      _renderSmtp();

    } else {
      if (statusEl) {
        statusEl.className = 'email-smtp-status show error';
        statusEl.innerHTML = `
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Configuração inválida. Verifique os dados ou entre em contato com o suporte.
        `;
      }
      if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Testar novamente`; }
    }
  } catch (e) {
    console.error('[SMTP] Erro ao chamar webhook:', e);
    if (statusEl) {
      statusEl.className = 'email-smtp-status show error';
      statusEl.innerHTML = `
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Erro de conexão. Tente novamente ou acione o suporte.
      `;
    }
    if (btn) { btn.disabled = false; btn.innerHTML = `Testar novamente`; }
  }
}

function _bindSmtpFormEvents() {
  const sslInput = document.getElementById('smtp-ssl');
  const sslBadge = document.getElementById('smtp-ssl-badge');
  sslInput?.addEventListener('change', () => {
    if (sslBadge) {
      sslBadge.textContent = sslInput.checked ? 'Ativado' : 'Desativado';
      sslBadge.className   = `email-ssl-badge ${sslInput.checked ? 'on' : ''}`;
    }
  });
  document.getElementById('btn-smtp-salvar')?.addEventListener('click', _testarSmtp);
}

// ─── Disparo ───────────────────────────────────────────────
async function _dispararCampanha() {
  if (_enviando) return;

  const { assunto, corpo } = _getCompose();

  // ── Valida campos
  if (!assunto || !corpo) {
    _showToast('⚠️ Preencha o assunto e o corpo da mensagem.');
    ['email-compose-assunto', 'email-compose-corpo'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) {
        el.style.borderColor = '#ef4444';
        el.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.15)';
        setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 1800);
      }
    });
    return;
  }

  if (!_selecionados.size) {
    _showToast('⚠️ Selecione ao menos um contato.');
    return;
  }

  _enviando = true;
  _updateSendBtn();

  const userId      = UserStore.getUserId();
  const contatosSel = _contatos.filter(c => _selecionados.has(c.negocio_id));
  const total       = contatosSel.length;

  // ── Mostra o modal imediatamente (não espera Supabase/webhook)
  _showCampanhaModal(assunto, total);

  // ── Adiciona linhas de status na tabela local
  const ts   = Date.now();
  const novos = contatosSel.map(c => ({
    _localId:      `local-${ts}-${c.negocio_id}`,
    contato_nome:  c.negocio_titulo,
    contato_email: c.negocio_email,
    assunto,
    status:        'Enviando',
    enviado_em:    null,
  }));

  _campanhas = [...novos, ..._campanhas];
  _selecionados.clear();
  _renderStatusTable();
  _renderContatos();

  // ── Libera o botão já (campanha está em andamento em background)
  _enviando = false;
  _updateSendBtn();

  // ── Background: Supabase + Webhook (erros não bloqueiam a UI)
  let campanhaId = null;

  try {
    const { data: campanha, error: errCampanha } = await EmailMarketing.criar({
      email_campanha:  assunto,
      email_mensagem:  corpo,
      email_negocios:  total,
      email_progresso: 0,
      user_id:         userId,
    });
    if (errCampanha) {
      console.error('[EmailMarketing] Supabase insert error:', errCampanha);
    } else {
      campanhaId = campanha?.email_campanha_id ?? null;
      // Adiciona a nova campanha ao topo da lista em tempo real
      if (campanha) {
        _adicionarCampanhaLocal({
          email_campanha_id: campanha.email_campanha_id,
          email_campanha:    assunto,
          email_mensagem:    corpo,
          email_negocios:    total,
          email_progresso:   0,
          criado_em:         new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('[EmailMarketing] Supabase exception:', e);
  }

  try {
    await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:           userId,
        email_campanha_id: campanhaId,
        assunto,
        mensagem: corpo,
        contatos: contatosSel.map(c => ({
          nome:  c.negocio_titulo,
          email: c.negocio_email,
        })),
      }),
    });
  } catch (e) {
    console.warn('[EmailMarketing] Webhook error:', e);
  }

  // ── Atualiza status visual linha a linha (apenas UI)
  for (const item of novos) {
    await new Promise(r => setTimeout(r, 450));
    const idx = _campanhas.findIndex(c => c._localId === item._localId);
    if (idx !== -1) {
      _campanhas[idx].status     = 'Enviado';
      _campanhas[idx].enviado_em = new Date().toISOString();
    }
    _renderStatusCampanhas();
  }
}

// ─── Modal "Campanha Iniciada" ─────────────────────────────────
function _showCampanhaModal(assunto, total) {
  // Remove eventual modal anterior
  document.getElementById('email-campanha-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'email-campanha-modal';
  overlay.className = 'email-modal-overlay';
  overlay.innerHTML = `
    <div class="email-modal-box">
      <div class="email-modal-icon">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="email-modal-title">Campanha Iniciada! 🚀</div>
      <div class="email-modal-subtitle">
        Seus e-mails foram enviados ao servidor<br>e estão sendo processados agora.
      </div>
      <div class="email-modal-stats">
        <div class="email-modal-stat">
          <div class="stat-val cyan">${total}</div>
          <div class="stat-label">Destinatários</div>
        </div>
        <div class="email-modal-stat">
          <div class="stat-val">1</div>
          <div class="stat-label">Campanha</div>
        </div>
      </div>
      <div class="email-modal-assunto">
        ✉️ Assunto: <span>${assunto.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
      </div>
      <button class="email-modal-close" id="email-modal-close-btn">Entendido</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Fecha ao clicar no botão ou no overlay
  const _close = () => {
    overlay.classList.add('closing');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  };

  document.getElementById('email-modal-close-btn')?.addEventListener('click', _close);
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
}

// ─── Toast ─────────────────────────────────────────────────
function _showToast(msg) {
  let t = document.getElementById('email-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'email-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 3000);
}

// ─── Bind de eventos ───────────────────────────────────────
function _bindEvents() {
  // Busca contatos
  document.getElementById('email-search')?.addEventListener('input', e => {
    _busca = e.target.value.trim();
    _renderContatos();
  });

  // Selecionar / desmarcar todos
  document.getElementById('email-btn-select-all')?.addEventListener('click', () => {
    _contatosFiltrados().forEach(c => _selecionados.add(c.negocio_id));
    _renderContatos();
    _updateSendBtn();
  });

  document.getElementById('email-btn-deselect-all')?.addEventListener('click', () => {
    _selecionados.clear();
    _renderContatos();
    _updateSendBtn();
  });

  // Compose: atualiza botão ao digitar
  document.getElementById('email-compose-assunto')?.addEventListener('input', _updateSendBtn);
  document.getElementById('email-compose-corpo')?.addEventListener('input', _updateSendBtn);

  // Botão variável {nome}
  document.getElementById('email-var-nome')?.addEventListener('click', () => {
    _inserirVariavel('{nome}');
  });

  // Disparar
  document.getElementById('email-btn-send')?.addEventListener('click', _dispararCampanha);
}

// ─── Skeleton ──────────────────────────────────────────────
function _skeleton() {
  return `
    <div class="email-layout">
      <div class="email-card">
        <div class="email-card-header">
          <div class="email-skeleton" style="height:16px;width:160px"></div>
        </div>
        <div class="email-card-body">
          <div class="email-skeleton" style="height:44px;border-radius:10px;margin-bottom:10px"></div>
          <div class="email-skeleton" style="height:160px;border-radius:10px;margin-bottom:10px"></div>
          <div class="email-skeleton" style="height:32px;border-radius:8px;width:100px"></div>
        </div>
      </div>
      <div class="email-card">
        <div class="email-card-header">
          <div class="email-skeleton" style="height:16px;width:140px"></div>
        </div>
        <div class="email-card-body">
          ${Array(4).fill(`<div class="email-skeleton" style="height:50px;border-radius:10px;margin-bottom:8px"></div>`).join('')}
        </div>
      </div>
    </div>`;
}

// ─── HTML da página ────────────────────────────────────────
function _html() {
  return `
    <div class="email-layout">

      <!-- 0. Config SMTP -->
      <div class="email-card email-smtp-card">
        <div class="email-card-header">
          <div class="email-card-title">
            <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            Configuração do Servidor de E-mail (SMTP)
          </div>
        </div>
        <div class="email-card-body" id="smtp-section-body"></div>
      </div>

      <!-- 1. Compose da mensagem -->
      <div class="email-card">
        <div class="email-card-header">
          <div class="email-card-title">
            <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Escreva a Mensagem
          </div>
        </div>
        <div class="email-card-body">
          <input
            id="email-compose-assunto"
            class="email-input"
            type="text"
            placeholder="Assunto do e-mail (ex: Proposta especial para você 💼)"
            style="margin-bottom:10px"
          />

          <div class="email-vars-row">
            <span class="email-vars-label">Inserir variável:</span>
            <button class="email-var-btn" id="email-var-nome" title="Insere {nome} no cursor">{nome}</button>
          </div>

          <textarea
            id="email-compose-corpo"
            class="email-textarea"
            placeholder="Olá {nome},&#10;&#10;Escreva aqui o corpo do e-mail…"
            style="min-height:200px;margin-top:10px"
          ></textarea>

          <p class="email-vars-hint">
            💡 Use <code>{nome}</code> para personalizar com o nome do negócio de cada destinatário.
          </p>
        </div>
      </div>

      <!-- 2. Selecionar contatos -->
      <div class="email-card email-contacts-card">
        <div class="email-card-header">
          <div class="email-card-title">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Selecionar Contatos
          </div>
          <span class="email-contacts-count" id="email-contacts-count">0 selecionados</span>
        </div>
        <div class="email-card-body">
          <div class="email-search-wrap">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="email-search" id="email-search" type="text" placeholder="Buscar por nome ou e-mail…" />
          </div>
          <div class="email-contacts-actions">
            <button class="email-btn-sm" id="email-btn-select-all">Selecionar todos</button>
            <button class="email-btn-sm" id="email-btn-deselect-all">Desmarcar todos</button>
          </div>
          <div class="email-contacts-list" id="email-contacts-list"></div>
        </div>
      </div>

      <!-- Painel de disparo (full-width) -->
      <div class="email-card email-send-card">
        <div class="email-card-header">
          <div class="email-card-title">
            <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Disparar Campanha
          </div>
        </div>
        <div class="email-card-body">
          <div class="email-send-summary">
            <div class="email-summary-pill">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              <span>Destinatários:</span>
              <strong id="email-send-ct-count">0 contatos</strong>
            </div>
          </div>
          <button class="email-btn-send" id="email-btn-send" disabled>
            <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Disparar Campanha
          </button>
        </div>
      </div>

      <!-- 3. Status das Campanhas (full-width) -->
      <div class="email-card email-status-card">
        <div class="email-card-header">
          <div class="email-card-title">
            <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Status das Campanhas
          </div>
        </div>
        <div class="email-card-body">
          <div class="email-campanhas-list" id="email-campanhas-list"></div>
        </div>
      </div>

    </div>
  `;
}

// ─── Módulo exportado ──────────────────────────────────────
export default {
  render() {
    return `
      <div class="page-header">
        <div class="page-title-block">
          <h1>E-mail Marketing</h1>
          <p>Escreva sua mensagem e dispare para os contatos do funil</p>
        </div>
      </div>
      <div id="email-page-content">${_skeleton()}</div>
    `;
  },

  async onMount() {
    const userId    = UserStore.getUserId();
    const container = document.getElementById('email-page-content');
    if (!container) return;

    const { data, error } = await Negocios.getComEmail(userId);

    if (error) {
      console.error('[EmailMarketing] Erro ao carregar contatos:', error);
      container.innerHTML = `<p style="color:#ef4444;padding:40px;text-align:center">Erro ao carregar contatos: ${error.message}</p>`;
      return;
    }

    _contatos = (data || []).filter(c => c.negocio_email && c.negocio_email.trim() !== '');

    // ── Carrega configurações SMTP salvas ──
    const { data: smtpData } = await Usuarios.getSmtp(userId);
    _smtpSalvo = (smtpData && smtpData.smtp_email) ? smtpData : null;

    // ── Carrega histórico de campanhas do Supabase ──
    const { data: campanhasData } = await EmailMarketing.getByUsuario(userId);
    _campanhas = campanhasData || [];

    container.innerHTML = _html();
    _renderSmtp();
    _renderContatos();
    _updateSendBtn();
    _renderStatusCampanhas();
    _bindEvents();
  },

  onDestroy() {
    _contatos     = [];
    _selecionados = new Set();
    _campanhas    = [];
    _busca        = '';
    _enviando     = false;
    _smtpSalvo    = null;
  },
};
