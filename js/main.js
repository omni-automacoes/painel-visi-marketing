/**
 * main.js — Entry point do CRM Visi Marketing
 * Inicializa: Guard de autenticação → UserStore → Sidebar → Router
 * Verifica nova_versao para exibir popup de atualização obrigatória.
 */
import Sidebar      from '../components/sidebar.js';
import router       from './router.js';
import UserStore    from './userStore.js';
import { supabase } from './supabase.js';
import { Usuarios } from './db.js';

// ── Popup de Nova Versão ─────────────────────────────────────────
function _mostrarPopupAtualizacao(userId) {
  // Injeta CSS inline (evita dependência de arquivo externo)
  const style = document.createElement('style');
  style.textContent = `
    #nv-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      animation: nvFadeIn 0.4s ease both;
      font-family: 'Inter', sans-serif;
    }
    @keyframes nvFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes nvSlideUp {
      from { opacity: 0; transform: translateY(28px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    #nv-card {
      background: #0F0F0F;
      border: 1px solid rgba(26,206,238,0.25);
      border-radius: 24px;
      padding: 48px 40px 40px;
      max-width: 460px;
      width: calc(100% - 48px);
      text-align: center;
      box-shadow: 0 0 0 1px rgba(26,206,238,0.08),
                  0 32px 80px rgba(0,0,0,0.7),
                  0 0 60px rgba(26,206,238,0.06);
      animation: nvSlideUp 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
    }
    #nv-badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: rgba(26,206,238,0.1);
      border: 1px solid rgba(26,206,238,0.25);
      border-radius: 20px;
      padding: 5px 14px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
      color: #1ACEEE; text-transform: uppercase;
      margin-bottom: 24px;
    }
    #nv-badge span { font-size: 14px; }
    #nv-icon {
      width: 72px; height: 72px;
      background: rgba(26,206,238,0.08);
      border: 1.5px solid rgba(26,206,238,0.2);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
    }
    #nv-icon svg {
      width: 32px; height: 32px;
      stroke: #1ACEEE; fill: none;
      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    }
    #nv-title {
      font-size: 22px; font-weight: 800;
      color: #FFFFFF; letter-spacing: -0.5px;
      margin-bottom: 12px; line-height: 1.3;
    }
    #nv-desc {
      font-size: 14px; color: #888; line-height: 1.6;
      margin-bottom: 32px;
    }
    #nv-desc strong { color: #ccc; font-weight: 600; }
    #nv-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%;
      background: #1ACEEE;
      color: #000;
      border: none; border-radius: 12px;
      padding: 15px 24px;
      font-size: 15px; font-weight: 800;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.15s;
      letter-spacing: -0.2px;
    }
    #nv-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    #nv-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    #nv-btn svg { width: 17px; height: 17px; stroke: #000; fill: none; stroke-width: 2.5; stroke-linecap: round; }
    #nv-footer {
      margin-top: 16px;
      font-size: 11px; color: #555; line-height: 1.5;
    }
    #nv-spinner {
      display: none;
      width: 17px; height: 17px;
      border: 2.5px solid rgba(0,0,0,0.3);
      border-top-color: #000;
      border-radius: 50%;
      animation: nvSpin 0.7s linear infinite;
    }
    @keyframes nvSpin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'nv-overlay';
  overlay.innerHTML = `
    <div id="nv-card">
      <div id="nv-badge"><span>🚀</span> Nova versão disponível</div>
      <div id="nv-icon">
        <svg viewBox="0 0 24 24">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      </div>
      <div id="nv-title">Atualização do Sistema</div>
      <div id="nv-desc">
        Uma <strong>nova versão</strong> do Visi Marketing CRM está disponível com melhorias e novos recursos.<br><br>
        Clique no botão abaixo para aplicar a atualização e continuar.
      </div>
      <button id="nv-btn">
        <div id="nv-spinner"></div>
        <svg viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
        Aplicar Atualização
      </button>
      <div id="nv-footer">
        O sistema será recarregado automaticamente após a atualização.
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Handler do botão
  document.getElementById('nv-btn').addEventListener('click', async () => {
    const btn     = document.getElementById('nv-btn');
    const spinner = document.getElementById('nv-spinner');
    btn.disabled  = true;
    spinner.style.display = 'block';
    btn.querySelector('svg:last-child').style.display = 'none';
    btn.childNodes[3].textContent = ' Atualizando…';

    // 1. Zera o flag no banco
    await Usuarios.aceitarAtualizacao(userId);

    // 2. Limpa todos os storages
    try { localStorage.clear(); }    catch (_) {}
    try { sessionStorage.clear(); }  catch (_) {}

    // 3. Limpa cache do Service Worker, se houver
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    // 4. Recarrega forçando bypass de cache
    window.location.reload(true);
  });
}

// ── Bootstrap ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // ── Guard: só prossegue se houver sessão ativa ─────────────
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    window.location.replace('/login.html');
    return;
  }

  const sidebarEl = document.getElementById('sidebar');
  const outlet    = document.getElementById('main-outlet');

  if (!sidebarEl || !outlet) {
    console.error('[main] Elementos #sidebar ou #main-outlet não encontrados.');
    return;
  }

  // ── Carrega perfil do usuário e popula o UserStore ──────────
  const userId = data.session.user.id;
  const { data: usuario, error } = await Usuarios.getMeu(userId);

  if (usuario && !error) {
    UserStore.setUser(usuario);

    // ── Verifica nova_versao ANTES de montar a UI ───────────
    if (usuario.nova_versao === true) {
      _mostrarPopupAtualizacao(userId);
      return; // bloqueia tudo — popup é o único elemento visível
    }
  } else {
    console.warn('[main] Não foi possível carregar perfil do usuário:', error);
  }

  // ── Inicializa sidebar ──────────────────────────────────────
  const sidebar = new Sidebar(sidebarEl, (route) => {
    router.navigate(route);
  });

  sidebar.render();

  if (usuario && !error) {
    sidebar.updateUser(usuario);
  }

  // ── Inicializa roteador ─────────────────────────────────────
  router.init(outlet, (activeRoute) => {
    sidebar.setActive(activeRoute);
  });
});

