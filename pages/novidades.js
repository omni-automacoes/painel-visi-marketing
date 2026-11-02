/**
 * novidades.js (página) — Histórico das novidades do sistema, com opção de rever cada tutorial.
 */
import Novidades from '../components/novidades/novidades.js';

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function _fmtData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

function _cardsHTML() {
  const lista = Novidades.getLista();
  if (!lista.length) return '<div class="novp-vazio">Nenhuma novidade publicada ainda.</div>';

  const pendentes = new Set(Novidades.pendentes().map(a => a.id));
  return lista.map(a => {
    const novo = pendentes.has(a.id);
    const temTutorial = Array.isArray(a.passos) && a.passos.length > 0;
    return `
      <div class="novp-card">
        <div class="novp-ico">${esc(a.icone || '🚀')}</div>
        <div class="novp-body">
          <div class="novp-top">
            <span class="novp-titulo">${esc(a.titulo)}</span>
            ${novo ? '<span class="novp-tag novp-tag--novo">Novo</span>' : '<span class="novp-tag novp-tag--visto">Visto</span>'}
          </div>
          <div class="novp-resumo">${esc(a.resumo || '')}</div>
          <div class="novp-data">Publicada em ${_fmtData(a.publicada_em)}</div>
        </div>
        ${temTutorial ? `<button class="novp-btn${novo ? '' : ' novp-btn--ghost'}" type="button" data-novp="${a.id}">${novo ? 'Ver tutorial' : 'Rever tutorial'}</button>` : ''}
      </div>`;
  }).join('');
}

function _render() {
  const el = document.getElementById('novp-list');
  if (el) el.innerHTML = _cardsHTML();
}

export default {
  render() {
    return `
      <div class="novp-head">
        <h1>Novidades</h1>
        <p>Tudo o que mudou no sistema. Reveja qualquer tutorial quando quiser.</p>
      </div>
      <div class="novp-list" id="novp-list"><div class="novp-vazio">Carregando…</div></div>`;
  },

  async onMount() {
    await Novidades.carregar();
    _render();

    this._onClick = (e) => {
      const btn = e.target.closest('[data-novp]');
      if (btn) Novidades.iniciarTutorial(Number(btn.dataset.novp));
    };
    this._onChange = () => _render();
    document.getElementById('novp-list')?.addEventListener('click', this._onClick);
    window.addEventListener('novidades:changed', this._onChange);
  },

  onDestroy() {
    window.removeEventListener('novidades:changed', this._onChange);
  },
};
