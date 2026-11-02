/**
 * tour.js — Player de tutorial guiado (sem bibliotecas).
 *
 * Cada passo: {
 *   titulo, texto,
 *   rota?    — hash a abrir antes do passo (ex.: 'pipeline'),
 *   acoes?   — lista de ações de preparo (ver ACOES),
 *   alvo?    — seletor CSS do elemento destacado (sem alvo = balão centralizado),
 *   posicao? — 'bottom' | 'top' | 'left' | 'right' (preferência do balão)
 * }
 */
import router from '../../js/router.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function esperar(fn, timeout = 4000, passo = 100) {
  const fim = Date.now() + timeout;
  while (Date.now() < fim) {
    const v = fn();
    if (v) return v;
    await wait(passo);
  }
  return null;
}

const visivel = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';

// ── Ações de preparo da tela ──────────────────────────────────
const ACOES = {
  async 'filtro-barra'() {
    if (!document.querySelector('#filter-bar.filter-bar--open')) {
      document.getElementById('btn-kanban-filter')?.click();
      await esperar(() => document.querySelector('#filter-bar.filter-bar--open'), 1500);
      await wait(150);
    }
  },

  async 'filtro-abrir'() {
    await ACOES['filtro-barra']();
    const dd = document.getElementById('fpd-recontado');
    if (dd && !visivel(dd)) {
      document.querySelector('#fpill-recontado .fpill-btn')?.click();
      await esperar(() => visivel(document.getElementById('fpd-recontado')), 1500);
      await wait(150);
    }
  },

  async 'filtro-fechar'() {
    const dd = document.getElementById('fpd-recontado');
    if (dd && visivel(dd)) {
      document.body.click(); // o Funil fecha os dropdowns em clique fora
      await wait(100);
    }
  },

  async 'painel-abrir'() {
    if (visivel(document.getElementById('np-panel')) && document.querySelector('.np-sb-section--recontato')) return;
    const card = [...document.querySelectorAll('.opp-card')]
      .find(c => c.querySelector('.opp-recontado:not(.opp-recontado--done)'))
      || document.querySelector('.opp-card');
    card?.click();
    await esperar(() => document.querySelector('.np-sb-section--recontato'), 5000);
    await wait(300);
  },

  async 'painel-fechar'() {
    const btn = document.getElementById('np-close-btn');
    if (btn && visivel(btn)) {
      btn.click();
      await wait(350);
    }
  },
};

// ── Player ────────────────────────────────────────────────────
export default class Tour {
  /**
   * @param {object[]} passos
   * @param {{ onConcluir?: Function, onFechar?: Function }} opts
   */
  constructor(passos, opts = {}) {
    this._passos = passos;
    this._opts   = opts;
    this._i      = 0;
    this._alvo   = null;
    this._token  = 0;       // invalida passos antigos quando o usuário navega rápido
    this._abriuBarra = !document.querySelector('#filter-bar.filter-bar--open');
    this._ativo  = false;
  }

  static get ativo() { return !!document.getElementById('tour-root'); }

  start() {
    if (this._ativo || !this._passos?.length) return;
    this._ativo = true;

    const root = document.createElement('div');
    root.id = 'tour-root';
    root.innerHTML = `
      <div class="tour-block"></div>
      <div class="tour-spot" style="display:none"></div>
      <div class="tour-tip" role="dialog" aria-live="polite">
        <button class="tour-x" type="button" title="Fechar tutorial">×</button>
        <div class="tour-step"></div>
        <div class="tour-title"></div>
        <div class="tour-text"></div>
        <div class="tour-dots"></div>
        <div class="tour-actions">
          <button class="tour-skip" type="button">Pular</button>
          <span class="tour-nav">
            <button class="tour-prev" type="button">Anterior</button>
            <button class="tour-next" type="button">Próximo</button>
          </span>
        </div>
      </div>`;
    document.body.appendChild(root);
    this._root = root;
    this._spot = root.querySelector('.tour-spot');
    this._tip  = root.querySelector('.tour-tip');

    // Bloqueia cliques no app e impede que fechem popovers do Funil por engano
    root.addEventListener('click', e => e.stopPropagation());
    root.querySelector('.tour-block').addEventListener('mousedown', e => e.stopPropagation());
    root.querySelector('.tour-x').onclick    = () => this._fechar();
    root.querySelector('.tour-skip').onclick = () => this._fechar();
    root.querySelector('.tour-prev').onclick = () => this._ir(this._i - 1);
    root.querySelector('.tour-next').onclick = () => this._proximo();

    this._onKey = (e) => {
      if (e.key === 'Escape')           { e.preventDefault(); this._fechar(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); this._proximo(); }
      else if (e.key === 'ArrowLeft')   { e.preventDefault(); if (this._i > 0) this._ir(this._i - 1); }
    };
    document.addEventListener('keydown', this._onKey, true);
    this._onResize = () => this._posicionar();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('scroll', this._onResize, true);
    this._timer = setInterval(() => this._posicionar(), 250);

    this._ir(0);
  }

  _proximo() {
    if (this._i >= this._passos.length - 1) this._concluir();
    else this._ir(this._i + 1);
  }

  async _ir(i) {
    if (i < 0 || i >= this._passos.length) return;
    const token = ++this._token;
    this._i = i;
    const passo = this._passos[i];

    this._renderTexto();
    this._root.classList.add('tour-loading');

    // Rota
    if (passo.rota && router.currentRoute() !== passo.rota) {
      this._alvo = null;
      this._posicionar();
      window.location.hash = passo.rota;
      await wait(250);
      await esperar(() => document.querySelector('.page-outlet .kanban-board, .page-outlet .opp-card, .page-outlet #btn-kanban-filter'), 6000);
      if (token !== this._token) return;
    }

    // Ações de preparo
    for (const nome of passo.acoes || []) {
      try { await ACOES[nome]?.(); } catch (err) { console.warn('[Tour] ação falhou:', nome, err); }
      if (token !== this._token) return;
    }

    // Alvo
    this._alvo = null;
    if (passo.alvo) {
      const el = await esperar(() => {
        const e = document.querySelector(passo.alvo);
        return visivel(e) ? e : null;
      }, 3500);
      if (token !== this._token) return;
      if (el) {
        this._alvo = el;
        // Só rola se o alvo estiver fora da tela (evita deslocar containers à toa)
        const r = el.getBoundingClientRect();
        const fora = r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth;
        if (fora && !el.closest('.fpill-dropdown')) {   // popovers se ajustam sozinhos
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
        await wait(60);
      }
    }
    this._root.classList.remove('tour-loading');
    this._ultimoRect = null;
    this._posicionar();
  }

  _renderTexto() {
    const passo = this._passos[this._i];
    const total = this._passos.length;
    const q = (s) => this._root.querySelector(s);
    q('.tour-step').textContent  = `${this._i + 1} de ${total}`;
    q('.tour-title').textContent = passo.titulo || '';
    q('.tour-text').innerHTML    = this._fmt(passo.texto || '');
    q('.tour-dots').innerHTML    = this._passos.map((_, k) => `<i class="${k === this._i ? 'on' : k < this._i ? 'done' : ''}"></i>`).join('');
    q('.tour-prev').style.visibility = this._i === 0 ? 'hidden' : 'visible';
    q('.tour-next').textContent = this._i === total - 1 ? 'Concluir ✓' : 'Próximo';
    q('.tour-skip').style.visibility = this._i === total - 1 ? 'hidden' : 'visible';
  }

  /** Escapa HTML e habilita **negrito** e quebras de linha */
  _fmt(txt) {
    return String(txt)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  _posicionar() {
    if (!this._root || !this._tip) return;
    const passo = this._passos[this._i];
    const tip = this._tip;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!vw || !vh) return;   // janela sem dimensões (aba em segundo plano)
    const alvo = this._alvo && document.contains(this._alvo) && visivel(this._alvo) ? this._alvo : null;

    if (!alvo) {
      this._spot.style.display = 'none';
      this._root.classList.add('tour-centered');
      tip.style.left = tip.style.top = '';
      return;
    }
    this._root.classList.remove('tour-centered');

    const r = alvo.getBoundingClientRect();
    const key = [r.left, r.top, r.width, r.height, vw, vh, this._i].join('|');
    if (key === this._ultimoRect) return;
    this._ultimoRect = key;

    const pad = 6;
    Object.assign(this._spot.style, {
      display: 'block',
      left: `${r.left - pad}px`, top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });

    const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 14, m = 12;
    const area = { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad };
    const opcoes = {
      bottom: { x: area.l + (area.r - area.l) / 2 - tw / 2, y: area.b + gap },
      top:    { x: area.l + (area.r - area.l) / 2 - tw / 2, y: area.t - gap - th },
      right:  { x: area.r + gap, y: area.t + (area.b - area.t) / 2 - th / 2 },
      left:   { x: area.l - gap - tw, y: area.t + (area.b - area.t) / 2 - th / 2 },
    };
    const cabe = (p) => p.x >= m && p.y >= m && p.x + tw <= vw - m && p.y + th <= vh - m;
    const ordem = [passo.posicao, 'bottom', 'top', 'right', 'left'].filter(Boolean);
    let pos = ordem.map(k => opcoes[k]).find(cabe);
    if (!pos) {
      // Não cabe ao redor (alvo muito grande): ancora no canto inferior do alvo, dentro da tela
      pos = { x: Math.min(Math.max(area.l, m), vw - tw - m), y: Math.min(Math.max(area.b - th - gap, m), vh - th - m) };
    }
    tip.style.left = `${Math.min(Math.max(pos.x, m), Math.max(vw - tw - m, m))}px`;
    tip.style.top  = `${Math.min(Math.max(pos.y, m), Math.max(vh - th - m, m))}px`;
  }

  async _limpar() {
    this._ativo = false;
    this._token++;
    clearInterval(this._timer);
    document.removeEventListener('keydown', this._onKey, true);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scroll', this._onResize, true);
    this._root?.remove();
    this._root = null;
    // Deixa a tela como estava: fecha popover/painel e a barra de filtros, se o tour abriu
    try {
      await ACOES['filtro-fechar']();
      await ACOES['painel-fechar']();
      if (this._abriuBarra && document.querySelector('#filter-bar.filter-bar--open')) {
        document.getElementById('btn-kanban-filter')?.click();
      }
    } catch (_) {}
  }

  async _concluir() {
    await this._limpar();
    this._opts.onConcluir?.();
  }

  async _fechar() {
    await this._limpar();
    this._opts.onFechar?.();
  }
}
