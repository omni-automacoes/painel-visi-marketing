/**
 * router.js — Roteador Hash-based para o CRM Visi Marketing
 *
 * Usa window.location.hash (#inicio, #pipeline...) em vez de History API.
 * Isso garante que ao recarregar a página, o browser sempre carrega
 * index.html e o router lê o hash — nunca causando um 404 no servidor.
 *
 * Cada rota aponta para um módulo de página que exporta:
 *   { render(), onMount(), onDestroy() }
 */

const ROUTES = {
  inicio:            () => import('../pages/inicio.js'),
  pipeline:          () => import('../pages/pipeline.js'),
  clientes:          () => import('../pages/clientes.js'),
  tarefas:           () => import('../pages/tarefas.js'),
  relatorios:        () => import('../pages/relatorios.js'),
  'email-marketing': () => import('../pages/email-marketing.js'),
  configuracoes:     () => import('../pages/configuracoes.js'),
  projetos:          () => import('../pages/projetos.js'),
  financeiro:        () => import('../pages/financeiro.js'),
  contratos:         () => import('../pages/contratos.js'),
};

const DEFAULT_ROUTE = 'inicio';

class Router {
  constructor() {
    this._outlet       = null;
    this._currentPage  = null;
    this._onRouteChange = null;
  }

  /**
   * Inicializa o roteador.
   * @param {HTMLElement} outlet - Elemento onde as páginas são renderizadas
   * @param {Function}   onRouteChange - Callback chamado com o nome da rota ativa
   */
  init(outlet, onRouteChange) {
    this._outlet        = outlet;
    this._onRouteChange = onRouteChange;

    // Escuta mudanças de hash (voltar/avançar do browser + links href="#rota")
    window.addEventListener('hashchange', () => this._handleRoute());

    // Carrega rota inicial (lê o hash atual da URL)
    this._handleRoute();
  }

  /**
   * Navega para uma rota programaticamente.
   * @param {string} route - nome da rota (ex: 'inicio', 'pipeline')
   */
  navigate(route) {
    window.location.hash = route;
    // O evento hashchange é disparado automaticamente, então _handleRoute
    // será chamado pelo listener — não precisa chamar aqui.
  }

  /**
   * Retorna a rota atual (sem parâmetros).
   * Ex: hash '#clientes/42' → 'clientes'
   */
  currentRoute() {
    const hash = window.location.hash.replace('#', '').trim();
    return (hash.split('/')[0]) || DEFAULT_ROUTE;
  }

  /**
   * Retorna o parâmetro após a rota, se houver.
   * Ex: hash '#clientes/42' → '42'
   */
  currentParam() {
    const hash = window.location.hash.replace('#', '').trim();
    return hash.split('/')[1] || null;
  }

  async _handleRoute() {
    const route  = this.currentRoute();
    const loader = ROUTES[route] || ROUTES[DEFAULT_ROUTE];

    // Se só o parâmetro mudou (mesma rota base), não recarrega a página
    if (this._currentRoute === route && this._currentPage) {
      if (this._onRouteChange) this._onRouteChange(route);
      return;
    }
    this._currentRoute = route;

    // Destrói página atual se existir
    if (this._currentPage?.onDestroy) {
      this._currentPage.onDestroy();
    }
    this._currentPage = null;

    // Notifica callback (para atualizar sidebar active state)
    if (this._onRouteChange) {
      this._onRouteChange(route);
    }

    // Mostra skeleton enquanto carrega
    this._outlet.innerHTML = `
      <div class="page-outlet" style="opacity:0.5;">
        <div style="height:32px;background:rgba(0,0,0,0.04);border-radius:12px;margin-bottom:20px;width:220px;"></div>
        <div style="height:100px;background:rgba(0,0,0,0.04);border-radius:20px;margin-bottom:16px;"></div>
        <div style="height:300px;background:rgba(0,0,0,0.04);border-radius:20px;"></div>
      </div>
    `;

    try {
      const module = await loader();
      const page   = module.default;

      // Renderiza o HTML da página
      this._outlet.innerHTML = `<div class="page-outlet">${page.render()}</div>`;

      // Executa onMount após renderização
      if (page.onMount) {
        await page.onMount();
      }

      this._currentPage = page;
    } catch (err) {
      console.error('[Router] Erro ao carregar página:', route, err);
      this._outlet.innerHTML = `
        <div class="page-outlet">
          <div class="placeholder-page">
            <div class="placeholder-icon">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2>Erro ao carregar página</h2>
            <p>Não foi possível carregar a rota <strong>${route}</strong>. Tente novamente.</p>
          </div>
        </div>
      `;
    }
  }
}

export default new Router();
