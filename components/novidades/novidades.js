/**
 * novidades.js — Novidades do sistema e tutoriais guiados.
 *
 * - Catálogo na tabela `atualizacoes`; status por usuário em `atualizacoes_usuarios`
 *   (sem linha = "não visto").
 * - Pop-up avisa as novidades pendentes: "Ver agora" abre o tutorial, "Ver depois"
 *   adia por 4h. Após 3 adiamentos o pop-up para de insistir (a novidade segue no
 *   menu "Novidades", com selo). Fechar o tutorial no meio também conta como adiado;
 *   só chegar ao fim ("Concluir") marca como visto.
 * - Usuários criados depois da publicação não recebem avisos de novidades antigas.
 */
import { Atualizacoes } from '../../js/db.js';
import UserStore        from '../../js/userStore.js';
import Tour             from './tour.js';

const ADIAR_MS      = 4 * 60 * 60 * 1000;   // "Ver depois" = 4 horas
const MAX_ADIAMENTOS = 3;                    // depois disso o pop-up não insiste mais
const VERIFICAR_MS  = 30 * 60 * 1000;       // checagem periódica com a aba aberta
const RECARREGAR_MS = 5 * 60 * 1000;        // ao voltar para a aba, recarrega se passou disso
const ATRASO_INICIAL = 2000;                 // espera a tela montar antes do 1º aviso

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const Novidades = {
  _lista: [],            // [{ id, titulo, resumo, icone, passos, publicada_em, status, vezes_adiado, adiado_ate }]
  _carregadoEm: 0,
  _iniciado: false,
  _ocupado: false,       // pop-up ou tutorial em andamento

  // ── Inicialização ───────────────────────────────────────────
  init() {
    if (this._iniciado) return;
    this._iniciado = true;

    setTimeout(() => this.verificar(true), ATRASO_INICIAL);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.verificar(Date.now() - this._carregadoEm > RECARREGAR_MS);
    });
    setInterval(() => this.verificar(true), VERIFICAR_MS);
  },

  // ── Dados ───────────────────────────────────────────────────
  async carregar() {
    const userId = UserStore.getUserId();
    if (!userId) return this._lista;

    const [cat, st] = await Promise.all([
      Atualizacoes.getAtivas(),
      Atualizacoes.getStatusDoUsuario(userId),
    ]);
    if (cat.error) { console.error('[Novidades] catálogo:', cat.error); return this._lista; }
    if (st.error)  { console.error('[Novidades] status:', st.error); }

    const porId = new Map((st.data || []).map(s => [s.atualizacao_id, s]));
    this._lista = (cat.data || []).map(a => {
      const s = porId.get(a.id);
      return {
        ...a,
        status:       s?.status ?? null,
        vezes_adiado: s?.vezes_adiado ?? 0,
        adiado_ate:   s?.adiado_ate ?? null,
      };
    });
    this._carregadoEm = Date.now();
    this._notificar();
    return this._lista;
  },

  getLista() { return this._lista; },

  /** Novidades que o usuário ainda não concluiu (e que valem para ele) */
  pendentes() {
    const criadoEm = UserStore.getUser()?.criado_em;
    const desde = criadoEm ? new Date(criadoEm).getTime() : 0;
    return this._lista.filter(a => a.status !== 'visto' && new Date(a.publicada_em).getTime() >= desde);
  },

  /** Pendentes que podem aparecer no pop-up agora */
  _paraAvisar() {
    const agora = Date.now();
    return this.pendentes().filter(a =>
      a.vezes_adiado < MAX_ADIAMENTOS &&
      (!a.adiado_ate || new Date(a.adiado_ate).getTime() <= agora)
    );
  },

  _notificar() {
    window.dispatchEvent(new CustomEvent('novidades:changed', { detail: { pendentes: this.pendentes().length } }));
  },

  async _salvar(a, { status, vezesAdiado, adiadoAte }) {
    a.status = status; a.vezes_adiado = vezesAdiado; a.adiado_ate = adiadoAte;
    this._notificar();
    const { error } = await Atualizacoes.registrar(UserStore.getUserId(), a.id, { status, vezesAdiado, adiadoAte });
    if (error) console.error('[Novidades] erro ao salvar status:', error);
  },

  _marcarVisto(a) {
    return this._salvar(a, { status: 'visto', vezesAdiado: a.vezes_adiado, adiadoAte: null });
  },

  _adiar(a) {
    if (a.status === 'visto') return Promise.resolve();   // reassistir não "des-vê"
    return this._salvar(a, {
      status: 'adiado',
      vezesAdiado: a.vezes_adiado + 1,
      adiadoAte: new Date(Date.now() + ADIAR_MS).toISOString(),
    });
  },

  // ── Verificação periódica ───────────────────────────────────
  async verificar(recarregar = false) {
    if (this._ocupado || document.visibilityState !== 'visible') return;
    if (document.getElementById('nv-overlay')) return;     // popup bloqueante de nova versão
    if (recarregar || !this._carregadoEm) await this.carregar();
    if (this._ocupado) return;

    const lista = this._paraAvisar();
    if (lista.length) this._mostrarPopup(lista);
  },

  // ── Pop-up ──────────────────────────────────────────────────
  _mostrarPopup(lista) {
    this._ocupado = true;
    const unico = lista.length === 1;

    const el = document.createElement('div');
    el.className = 'nov-overlay';
    el.innerHTML = `
      <div class="nov-card" role="dialog" aria-modal="true">
        <div class="nov-badge">${unico ? 'Novidade no sistema' : `${lista.length} novidades no sistema`}</div>
        ${unico ? `
          <div class="nov-emoji">${esc(lista[0].icone || '🚀')}</div>
          <div class="nov-title">${esc(lista[0].titulo)}</div>
          <div class="nov-text">${esc(lista[0].resumo || '')}</div>
          <div class="nov-sub">Quer conhecer agora? Leva menos de 1 minuto.</div>
          <div class="nov-actions">
            <button class="nov-btn nov-btn--ghost" data-nov="depois" type="button">Ver depois</button>
            <button class="nov-btn nov-btn--primary" data-nov-ver="${lista[0].id}" type="button">Ver agora</button>
          </div>` : `
          <div class="nov-title">O que há de novo</div>
          <div class="nov-list">
            ${lista.map(a => `
              <div class="nov-item">
                <span class="nov-item-ico">${esc(a.icone || '🚀')}</span>
                <span class="nov-item-body"><strong>${esc(a.titulo)}</strong><small>${esc(a.resumo || '')}</small></span>
                <button class="nov-btn nov-btn--primary nov-btn--sm" data-nov-ver="${a.id}" type="button">Ver agora</button>
              </div>`).join('')}
          </div>
          <div class="nov-actions">
            <button class="nov-btn nov-btn--ghost" data-nov="depois" type="button">Ver depois</button>
          </div>`}
      </div>`;
    document.body.appendChild(el);

    const fechar = () => { document.removeEventListener('keydown', onKey, true); el.remove(); };
    const depois = async () => {
      fechar();
      await Promise.all(lista.map(a => this._adiar(a)));
      this._ocupado = false;
    };
    const onKey = (e) => { if (e.key === 'Escape') depois(); };
    document.addEventListener('keydown', onKey, true);

    el.addEventListener('click', (e) => {
      if (e.target === el) return depois();
      if (e.target.closest('[data-nov="depois"]')) return depois();
      const ver = e.target.closest('[data-nov-ver]');
      if (ver) {
        fechar();
        this._ocupado = false;
        this.iniciarTutorial(Number(ver.dataset.novVer));
      }
    });
  },

  // ── Tutorial ────────────────────────────────────────────────
  iniciarTutorial(id) {
    const a = this._lista.find(x => x.id === id);
    if (!a || this._ocupado || Tour.ativo) return;
    if (!Array.isArray(a.passos) || !a.passos.length) { this._marcarVisto(a); return; }

    this._ocupado = true;
    const terminar = () => {
      this._ocupado = false;
      // Se sobraram novidades a avisar, o pop-up volta em instantes
      setTimeout(() => this.verificar(false), 800);
    };

    new Tour(a.passos, {
      onConcluir: async () => { await this._marcarVisto(a); terminar(); },
      onFechar:   async () => { await this._adiar(a);       terminar(); },
    }).start();
  },
};

export default Novidades;
