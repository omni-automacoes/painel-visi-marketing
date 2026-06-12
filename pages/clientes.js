/**
 * clientes.js — Página "Clientes"
 * Layout em sessões separadas: KPIs → Novos Clientes (Onboarding) → Ativados → Desativados
 * Dados reais puxados da tabela `clientes` filtrados pelo user_id do usuário logado.
 */

import UserStore  from '../js/userStore.js';
import { Clientes, Tarefas, Negocios, Usuarios, Reunioes, ClienteFeedback, FaturamentoCliente, FeedbackCampanhas, ContatoClientes } from '../js/db.js';


import router      from '../js/router.js';

// ─── Estado de módulo (cache) ────────────────────────────────────────────
// Armazena dados entre filtragens sem re-fetch ao banco
let _todosClientes   = [];  // lista completa
let _tasksByNegocio  = {};  // mapa negocio_id → tarefas
let _usuarios        = [];  // lista de gestores (admin)
let _filtroUserId    = '';  // '' = todos
let _paginaAtivados  = 1;
let _paginaDesativ   = 1;
let _sortAtivados    = { col: 'cliente_nome', dir: 'asc' };
let _sortDesativ     = { col: 'cliente_nome', dir: 'asc' };
let _isAdmin         = false;
let _viewModeAtivados = 'cards'; // 'cards' | 'list'
let _termoBusca      = '';       // pesquisa por nome
let _resumoListaFat  = {};       // mapa cliente_id → faturamento total
let _resumoListaCt   = {};       // mapa cliente_id → { reuniao: N, outro: N }
let _clienteAtivo    = null;     // cliente ativo no drawer

export default {
  render() {
    return `
      <style>
        /* ---- PAGE ---- */
        .clientes-page {
          display: flex;
          flex-direction: column;
          gap: 36px;
          animation: fadeSlideUp 0.4s ease;
        }

        /* ---- KPI ROW ---- */
        .kpi-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .kpi-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: 22px 24px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: var(--transition);
        }
        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.07);
        }
        .kpi-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .kpi-value {
          font-size: 30px;
          font-weight: 800;
          color: var(--black);
          line-height: 1;
        }
        .kpi-card.kpi-blue {
          background: #EFF6FF;
          border-color: #BFDBFE;
        }
        .kpi-card.kpi-blue .kpi-label { color: #1D4ED8; }
        .kpi-card.kpi-blue .kpi-value  { color: #1E3A8A; }

        /* ---- SECTION HEADING ---- */
        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .section-heading-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .section-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .section-dot.green  { background: #22C55E; }
        .section-dot.blue   { background: #3B82F6; }
        .section-dot.red    { background: #EF4444; }
        .section-title {
          font-size: 17px;
          font-weight: 800;
          color: var(--black);
          letter-spacing: -0.3px;
        }
        .section-count {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--bg);
          padding: 3px 10px;
          border-radius: 20px;
          border: 1px solid var(--border-light);
        }

        /* ---- TABLE ---- */
        .table-wrap {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow);
          overflow-x: auto;
        }
        .clientes-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .clientes-table th {
          background: #F8FAFC;
          padding: 13px 20px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          border-bottom: 1px solid var(--border-light);
          white-space: nowrap;
        }
        .clientes-table td {
          padding: 15px 20px;
          font-size: 14px;
          color: var(--black);
          border-bottom: 1px solid var(--border-light);
          vertical-align: middle;
        }
        .clientes-table tr:last-child td { border-bottom: none; }
        .clientes-table tbody tr { transition: var(--transition); cursor: pointer; }
        .clientes-table tbody tr:hover { background: #F8FAFC; }

        .client-info { display: flex; flex-direction: column; gap: 3px; }
        .client-name { font-weight: 700; color: var(--black); }
        .client-meta { font-size: 12px; color: var(--text-secondary); }

        /* ---- BADGES ---- */
        .badge {
          display: inline-flex; align-items: center;
          padding: 4px 10px; border-radius: 20px;
          font-size: 12px; font-weight: 600; white-space: nowrap;
        }
        .badge-green     { background: #F3F4F6; color: #374151; }
        .badge-blue      { background: #F3F4F6; color: #374151; }
        .badge-red       { background: #F3F4F6; color: #374151; }
        .badge-yellow    { background: #F3F4F6; color: #374151; }
        .badge-gray      { background: #F3F4F6; color: #374151; }
        .badge-purple    { background: #F3F4F6; color: #374151; }

        /* ---- ACTION BTN ---- */
        .btn-action {
          width: 32px; height: 32px; border-radius: 8px;
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border: 1px solid var(--border-light);
          color: var(--text-secondary); cursor: pointer; transition: var(--transition);
        }
        .btn-action:hover { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }

        /* Linha clicável */
        .clientes-table tbody tr[data-cliente-id] {
          cursor: pointer; transition: background 0.15s;
        }
        .clientes-table tbody tr[data-cliente-id]:hover {
          background: #F8FAFC;
        }
        .clientes-table tbody tr[data-cliente-id]:hover .btn-action {
          background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE;
        }

        /* ---- PAGINAÇÃO ---- */
        .pg-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 4px 4px; gap: 8px;
        }
        .pg-info {
          font-size: 12px; font-weight: 600; color: var(--text-secondary);
        }
        .pg-controls { display: flex; align-items: center; gap: 6px; }
        .pg-btn {
          min-width: 32px; height: 32px; padding: 0 10px;
          border-radius: 8px; border: 1.5px solid var(--border-light);
          background: var(--white); color: var(--text-secondary);
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: var(--transition); display: inline-flex;
          align-items: center; justify-content: center;
        }
        .pg-btn:hover:not(:disabled) { background: var(--cyan); color: #fff; border-color: var(--cyan); }
        .pg-btn.active { background: var(--cyan); color: #fff; border-color: var(--cyan); }
        .pg-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .pg-dots { font-size: 13px; color: var(--text-muted); padding: 0 2px; }

        /* ---- DARK MODE — TABELA & COMPONENTES ---- */
        [data-theme="dark"] .table-wrap {
          background: var(--card-dark, #1e1e1e);
          border-color: rgba(255,255,255,.08);
        }
        [data-theme="dark"] .clientes-table th {
          background: rgba(255,255,255,.04);
          color: rgba(255,255,255,.5);
          border-bottom-color: rgba(255,255,255,.08);
        }
        [data-theme="dark"] .clientes-table td {
          color: rgba(255,255,255,.85);
          border-bottom-color: rgba(255,255,255,.06);
        }
        [data-theme="dark"] .clientes-table tbody tr:hover,
        [data-theme="dark"] .clientes-table tbody tr[data-cliente-id]:hover {
          background: rgba(255,255,255,.05);
        }
        [data-theme="dark"] .client-name { color: rgba(255,255,255,.9); }
        [data-theme="dark"] .client-meta { color: rgba(255,255,255,.45); }

        /* Badges no dark */
        [data-theme="dark"] .badge-green  { background: rgba(22,163,74,.2);  color: #4ade80; }
        [data-theme="dark"] .badge-blue   { background: rgba(59,130,246,.2); color: #93c5fd; }
        [data-theme="dark"] .badge-red    { background: rgba(220,38,38,.2);  color: #f87171; }
        [data-theme="dark"] .badge-yellow { background: rgba(234,179,8,.2);  color: #fbbf24; }
        [data-theme="dark"] .badge-gray   { background: rgba(255,255,255,.08); color: rgba(255,255,255,.55); }
        [data-theme="dark"] .badge-purple { background: rgba(139,92,246,.2); color: #c4b5fd; }

        /* Botão ação no dark */
        [data-theme="dark"] .btn-action {
          background: transparent;
          border-color: rgba(255,255,255,.12);
          color: rgba(255,255,255,.45);
        }
        [data-theme="dark"] .btn-action:hover,
        [data-theme="dark"] .clientes-table tbody tr[data-cliente-id]:hover .btn-action {
          background: rgba(59,130,246,.15);
          color: #93c5fd;
          border-color: rgba(59,130,246,.35);
        }

        /* Paginação no dark */
        [data-theme="dark"] .pg-btn {
          background: rgba(255,255,255,.04);
          border-color: rgba(255,255,255,.1);
          color: rgba(255,255,255,.6);
        }
        [data-theme="dark"] .pg-btn:hover:not(:disabled) { background: var(--cyan); color: #fff; border-color: var(--cyan); }
        [data-theme="dark"] .pg-btn.active { background: var(--cyan); color: #fff; border-color: var(--cyan); }
        [data-theme="dark"] .pg-info { color: rgba(255,255,255,.4); }
        [data-theme="dark"] .pg-dots { color: rgba(255,255,255,.3); }

        /* Cards toolbar no dark */
        [data-theme="dark"] .cards-sort-select,
        [data-theme="dark"] .cl-filter-select,
        [data-theme="dark"] .cards-sort-dir {
          background: rgba(255,255,255,.06);
          border-color: rgba(255,255,255,.1);
          color: rgba(255,255,255,.8);
        }
        [data-theme="dark"] .cards-sort-select option,
        [data-theme="dark"] .cl-filter-select option,
        [data-theme="dark"] .cl-select option {
          background: #1e1e1e;
          color: #ffffff;
        }
        [data-theme="dark"] .cards-sort-label { color: rgba(255,255,255,.4); }
        [data-theme="dark"] .cards-sort-dir:hover { background: var(--cyan); color: #fff; border-color: var(--cyan); }

        /* Sort header ativo no dark */
        [data-theme="dark"] .clientes-table th[data-sort-col]:hover { color: var(--cyan); }
        [data-theme="dark"] .clientes-table th.sort-active { color: var(--cyan); }

        /* ---- CARDS ATIVADOS ---- */
        .cards-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px; gap: 12px; flex-wrap: wrap;
        }
        .cards-sort-wrap { display: flex; align-items: center; gap: 8px; }
        .cards-sort-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
        .cards-sort-select {
          font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: 8px;
          border: 1.5px solid var(--border-light); background: var(--white);
          color: var(--black); cursor: pointer; outline: none;
        }
        .cards-sort-dir {
          width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid var(--border-light);
          background: var(--white); font-size: 14px; cursor: pointer; display: flex;
          align-items: center; justify-content: center; transition: var(--transition);
        }
        .cards-sort-dir:hover { background: var(--cyan); color: #fff; border-color: var(--cyan); }
        .cliente-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px 16px;
          row-gap: 30px;
        }
        .cliente-card {
          background: var(--white); border-radius: 18px;
          border: 1.5px solid var(--border-light);
          padding: 20px 18px 16px;
          cursor: pointer; transition: all 0.2s ease;
          display: flex; flex-direction: column; gap: 14px;
          position: relative; overflow: hidden;
        }
        .cliente-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0;
          height: 3px; background: linear-gradient(90deg, #06B6D4, #3B82F6);
          opacity: 0; transition: opacity 0.2s;
        }
        .cliente-card:hover {
          border-color: #93C5FD;
          box-shadow: 0 8px 28px rgba(59,130,246,0.12);
          transform: translateY(-3px);
        }
        .cliente-card:hover::before { opacity: 1; }
        .card-header { display: flex; align-items: center; gap: 12px; }
        .card-avatar {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -0.5px;
        }
        .card-identity { flex: 1; min-width: 0; }
        .card-nome {
          font-size: 14px; font-weight: 800; color: var(--black);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .card-meta {
          font-size: 11px; color: var(--text-secondary); font-weight: 500;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-top: 2px;
        }
        .card-badges { display: flex; flex-wrap: wrap; gap: 6px; }
        .card-metrics {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 10px; border-top: 1px solid var(--border-light);
        }
        .card-metric-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .card-metric-value { font-size: 13px; font-weight: 800; color: var(--black); }
        .card-metric-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .card-metric-divider { width: 1px; height: 28px; background: var(--border-light); }

        /* ---- ALERTA NPS ---- */
        .nps-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #FECACA;
          border-left: 4px solid #DC2626;
          background: #FEF2F2;
          position: relative;
          overflow: hidden;
        }
        .nps-alert::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(220,38,38,0.06) 0%, transparent 60%);
          pointer-events: none;
        }
        .nps-alert-icon {
          font-size: 16px;
          flex-shrink: 0;
          animation: nps-pulse 1.6s ease-in-out infinite;
        }
        @keyframes nps-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.25); opacity: 0.7; }
        }
        .nps-alert-body {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .nps-alert-title {
          font-size: 12px;
          font-weight: 800;
          color: #991B1B;
          letter-spacing: 0.01em;
          text-transform: uppercase;
        }
        .nps-alert-sub {
          font-size: 11px;
          font-weight: 500;
          color: #B91C1C;
          line-height: 1.4;
        }
        .nps-alert-sub strong { font-weight: 800; }

        [data-theme="dark"] .nps-alert {
          background: rgba(220,38,38,0.12);
          border-color: rgba(220,38,38,0.3);
          border-left-color: #F87171;
        }
        [data-theme="dark"] .nps-alert-title { color: #FCA5A5; }
        [data-theme="dark"] .nps-alert-sub   { color: #F87171; }

        /* ---- METAS DE CONTATO NO CARD ---- */
        .card-goals {
          display: flex; gap: 8px; justify-content: center;
          padding-top: 10px; border-top: 1px solid var(--border-light);
        }

        /* ---- FLAG NPS EXTERNA ---- */
        .cliente-card--nps {
          overflow: visible; /* permite a flag sair do card */
          padding-bottom: 10px;
        }
        .card-nps-flag {
          position: absolute; bottom: -13px; left: 50%; transform: translateX(-50%);
          background: #DC2626; color: #fff;
          font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
          padding: 3px 14px; border-radius: 0 0 10px 10px;
          white-space: nowrap; pointer-events: none;
          box-shadow: 0 4px 12px rgba(220,38,38,.35);
        }
        [data-theme="dark"] .card-nps-flag {
          background: #b91c1c;
          box-shadow: 0 4px 12px rgba(220,38,38,.5);
        }

        /* ---- COLUNAS ORDINÁVEIS ---- */
        .clientes-table th[data-sort-col] { cursor: pointer; user-select: none; white-space: nowrap; }
        .clientes-table th[data-sort-col]:hover { color: var(--cyan); }
        .sort-icon { display: inline-block; margin-left: 5px; opacity: 0.3; font-size: 11px; vertical-align: middle; }
        .clientes-table th.sort-active { color: var(--cyan); }
        .clientes-table th.sort-active .sort-icon { opacity: 1; }

        .score-cell {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: default;
        }
        .score-cell .score-tooltip {
          display: none;
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: #1A1A1A;
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.5;
          padding: 8px 12px;
          border-radius: 8px;
          white-space: nowrap;
          z-index: 100;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
          pointer-events: none;
        }
        .score-cell .score-tooltip::after {
          content: '';
          position: absolute;
          top: 100%; left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: #1A1A1A;
        }
        .score-cell:hover .score-tooltip { display: block; }

        /* Score badge com cor dinâmica */
        .score-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 42px; padding: 4px 10px;
          border-radius: 20px; font-size: 13px; font-weight: 800;
          transition: box-shadow .15s;
        }
        /* ≥ 7 — verde, sem destaque */
        .score-badge.score-high { background: #dcfce7; color: #15803d; border: 1.5px solid #bbf7d0; }
        /* 5–6 — âmbar, sem destaque */
        .score-badge.score-mid  { background: #fef9c3; color: #854d0e; border: 1.5px solid #fde68a; }
        /* ≤ 4 — vermelho COM destaque */
        .score-badge.score-low  {
          background: #fee2e2; color: #b91c1c; border: 2px solid #fca5a5;
          box-shadow: 0 0 0 3px rgba(220,38,38,.18);
          animation: score-alert-pulse 2s ease-in-out infinite;
        }
        @keyframes score-alert-pulse {
          0%,100% { box-shadow: 0 0 0 3px rgba(220,38,38,.18); }
          50%      { box-shadow: 0 0 0 6px rgba(220,38,38,.08); }
        }
        .score-badge.score-none { background: #F3F4F6; color: #9CA3AF; font-weight:600; font-size:12px; border: 1.5px solid #E5E7EB; }

        /* Badge "Sem Saldo" — vermelho com destaque */
        .badge-sem-saldo {
          background: #fee2e2 !important; color: #b91c1c !important;
          border: 2px solid #fca5a5 !important;
          box-shadow: 0 0 0 3px rgba(220,38,38,.18);
          font-weight: 800 !important;
        }

        /* Dark mode scores */
        [data-theme="dark"] .score-badge.score-high { background: rgba(22,163,74,.18);  color: #4ade80; border-color: rgba(22,163,74,.35); }
        [data-theme="dark"] .score-badge.score-mid  { background: rgba(234,179,8,.18);  color: #fbbf24; border-color: rgba(234,179,8,.35); }
        [data-theme="dark"] .score-badge.score-low  { background: rgba(220,38,38,.18);  color: #f87171; border-color: rgba(220,38,38,.35);
          box-shadow: 0 0 0 3px rgba(220,38,38,.2); }
        [data-theme="dark"] .score-badge.score-none { background: rgba(255,255,255,.07); color: #6B7280; border-color: var(--border-light); }
        [data-theme="dark"] .badge-sem-saldo { background: rgba(220,38,38,.2) !important; color: #f87171 !important; border-color: rgba(220,38,38,.4) !important; }

        /* ---- EMPTY / ERROR ---- */
        .section-empty {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px dashed var(--border-light);
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
        }
        .section-error {
          background: #FFF1F2;
          border-radius: var(--radius-lg);
          border: 1px solid #FECDD3;
          padding: 20px 24px;
          font-size: 13px;
          color: #9F1239;
          font-weight: 500;
        }

        /* ---- SKELETON ---- */
        .clientes-skeleton {
          display: flex;
          flex-direction: column;
          gap: 36px;
          animation: fadeSlideUp 0.3s ease;
        }
        .sk-kpi-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .sk-block {
          border-radius: var(--radius-lg);
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ---- ONBOARDING GRID ---- */
        .onboarding-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
          gap: 18px;
        }
        .ob-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: 22px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          gap: 18px;
          transition: var(--transition);
        }
        .ob-card:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.06);
          border-color: #BFDBFE;
        }
        .ob-info-btn {
          background: none; border: none; padding: 4px; display: inline-flex;
          align-items: center; justify-content: center; cursor: pointer;
          color: var(--text-secondary); transition: var(--transition); border-radius: 6px;
        }
        .ob-info-btn:hover {
          background: var(--bg); color: var(--cyan);
        }
        .ob-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .ob-progress { display: flex; flex-direction: column; gap: 7px; }
        .ob-progress-labels {
          display: flex; justify-content: space-between;
          font-size: 12px; font-weight: 600; color: var(--text-secondary);
        }
        .progress-bar-bg {
          height: 6px; background: var(--bg);
          border-radius: 10px; overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%; background: var(--cyan);
          border-radius: 10px; transition: width 0.5s ease;
        }
        .progress-bar-fill.complete { background: #22C55E; }
        .ob-tasks { display: flex; flex-direction: column; gap: 8px; }
        .task-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 13px; border-radius: 9px;
          border: 1px solid var(--border-light);
          background: #FAFAFA; transition: var(--transition);
        }
        .task-row.done {
          background: #F0FDF4; border-color: #BBF7D0;
        }
        .task-row.done .task-label {
          text-decoration: line-through; color: #166534;
        }
        .task-check {
          width: 17px; height: 17px; border-radius: 50%;
          border: 2px solid #D1D5DB; background: var(--white);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: var(--transition);
        }
        .task-check.done {
          background: #22C55E; border-color: #22C55E;
        }
        .task-check.done svg { display: block; }
        .task-check svg {
          display: none; width: 10px; height: 10px;
          stroke: white; fill: none; stroke-width: 3;
          stroke-linecap: round; stroke-linejoin: round;
        }
        .task-label {
          font-size: 13px; font-weight: 500;
          color: var(--black); line-height: 1.3;
        }

        /* ---- DEADLINE BANNER ---- */
        .ob-deadline {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.4;
        }
        .ob-deadline-icon { font-size: 18px; flex-shrink: 0; }
        .ob-deadline-text { display: flex; flex-direction: column; gap: 1px; }
        .ob-deadline-text strong { font-weight: 700; font-size: 13px; }
        .ob-deadline-text span   { font-size: 12px; opacity: 0.85; }

        /* Atrasado — vermelho pulsante */
        .ob-deadline--late {
          background: #FEE2E2;
          border: 1px solid #FECACA;
          color: #991B1B;
          animation: pulse-late 2s ease-in-out infinite;
        }
        @keyframes pulse-late {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50%       { box-shadow: 0 0 0 4px rgba(239,68,68,0.15); }
        }

        /* Hoje — laranja urgente */
        .ob-deadline--today {
          background: #FFF7ED;
          border: 1px solid #FED7AA;
          color: #9A3412;
          animation: pulse-today 1.6s ease-in-out infinite;
        }
        @keyframes pulse-today {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
          50%       { box-shadow: 0 0 0 4px rgba(249,115,22,0.15); }
        }

        /* Dentro do prazo — verde suave */
        .ob-deadline--ok {
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          color: #166534;
        }

        /* Borda lateral colorida no card conforme urgência */
        .ob-card--late  { border-left: 3px solid #EF4444 !important; }
        .ob-card--today { border-left: 3px solid #F97316 !important; }

        /* ---- BOTÃO START (ATIVAÇÃO) ---- */
        .ob-start-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: var(--transition);
          letter-spacing: 0.2px;
        }
        .ob-start-btn.disabled {
          background: #F3F4F6;
          color: #9CA3AF;
          cursor: not-allowed;
        }
        .ob-start-btn.ready {
          background: linear-gradient(135deg, #22C55E, #16A34A);
          color: #fff;
          box-shadow: 0 4px 14px rgba(34,197,94,0.35);
          animation: pulse-start 2s ease-in-out infinite;
        }
        .ob-start-btn.ready:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(34,197,94,0.45);
        }
        @keyframes pulse-start {
          0%, 100% { box-shadow: 0 4px 14px rgba(34,197,94,0.35); }
          50%       { box-shadow: 0 4px 22px rgba(34,197,94,0.6); }
        }

        /* ---- FILTRO POR MEMBRO (ADMIN) ---- */
        .cl-filter-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--white);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          padding: 14px 20px;
          box-shadow: var(--shadow);
        }
        .cl-filter-bar svg {
          width: 16px; height: 16px;
          stroke: var(--text-secondary); fill: none;
          stroke-width: 2; stroke-linecap: round; flex-shrink: 0;
        }
        .cl-filter-label {
          font-size: 13px; font-weight: 700;
          color: var(--text-secondary); white-space: nowrap;
        }
        .cl-filter-select {
          flex: 1; max-width: 280px;
          padding: 7px 12px; border-radius: 8px; font-size: 13px;
          border: 1.5px solid var(--border-light); background: var(--white);
          color: var(--black); cursor: pointer; transition: var(--transition);
          font-family: inherit;
        }
        .cl-filter-select:focus {
          outline: none; border-color: var(--cyan);
          box-shadow: 0 0 0 3px rgba(6,182,212,0.12);
        }
        .cl-filter-clear {
          padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
          border: 1.5px solid var(--border-light); background: var(--white);
          color: var(--text-secondary); cursor: pointer; transition: var(--transition);
          display: none;
        }
        .cl-filter-clear.visible { display: inline-flex; align-items: center; gap: 6px; }
        .cl-filter-clear:hover { background: #FEE2E2; border-color: #FECACA; color: #991B1B; }
        .cl-filter-info {
          margin-left: auto; font-size: 12px; font-weight: 600;
          color: var(--text-secondary);
        }

        /* ---- MODAL CRIAR CLIENTE ---- */
        .cl-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.45); z-index: 1000;
          align-items: center; justify-content: center;
          backdrop-filter: blur(3px);
        }
        .cl-overlay.open { display: flex; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        .cl-modal {
          background: var(--white); border-radius: 20px;
          padding: 32px; width: 100%; max-width: 560px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 24px 60px rgba(0,0,0,0.18);
          animation: slideUp 0.25s ease;
        }
        @keyframes slideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }
        .cl-modal-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 24px;
        }
        .cl-modal-title { font-size: 18px; font-weight: 800; color: var(--black); }
        .cl-modal-close {
          width: 32px; height: 32px; border-radius: 8px; border: none;
          background: var(--bg); color: var(--text-secondary);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 18px; transition: var(--transition);
        }
        .cl-modal-close:hover { background: #FEE2E2; color: #991B1B; }
        .cl-form { display: flex; flex-direction: column; gap: 16px; }
        .cl-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .cl-field { display: flex; flex-direction: column; gap: 6px; }
        .cl-field.full { grid-column: 1 / -1; }
        .cl-label {
          font-size: 12px; font-weight: 700; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .cl-required { color: #EF4444; margin-left: 2px; }
        .cl-input, .cl-select, .cl-textarea {
          padding: 10px 14px; border-radius: 10px; font-size: 14px;
          border: 1.5px solid var(--border-light); background: var(--white);
          color: var(--black); transition: var(--transition);
          font-family: inherit; width: 100%; box-sizing: border-box;
        }
        .cl-input:focus, .cl-select:focus, .cl-textarea:focus {
          outline: none; border-color: var(--cyan); box-shadow: 0 0 0 3px rgba(6,182,212,0.12);
        }
        .cl-input.error { border-color: #EF4444; }
        .cl-textarea { resize: vertical; min-height: 80px; }
        /* Autocomplete negócio */
        .cl-autocomplete { position: relative; }
        .cl-autocomplete-list {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--white); border: 1.5px solid var(--border-light);
          border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          z-index: 10; overflow: hidden; display: none;
          max-height: 200px; overflow-y: auto;
        }
        .cl-autocomplete-list.open { display: block; }
        .cl-ac-item {
          padding: 10px 14px; font-size: 13px; cursor: pointer;
          transition: background 0.15s; display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
        }
        .cl-ac-item:hover { background: #F0F9FF; }
        .cl-ac-item strong { font-weight: 600; color: var(--black); }
        .cl-ac-item span { font-size: 11px; color: var(--text-secondary); }
        .cl-ac-empty { padding: 12px 14px; font-size: 13px; color: var(--text-muted); text-align: center; }
        /* Footer */
        .cl-modal-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          margin-top: 8px; padding-top: 20px;
          border-top: 1px solid var(--border-light);
        }
        .cl-btn-cancel {
          padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600;
          border: 1.5px solid var(--border-light); background: var(--white);
          color: var(--text-secondary); cursor: pointer; transition: var(--transition);
        }
        .cl-btn-cancel:hover { background: var(--bg); }
        .cl-btn-submit {
          padding: 10px 24px; border-radius: 10px; font-size: 14px; font-weight: 700;
          border: none; background: var(--cyan); color: #fff; cursor: pointer;
          transition: var(--transition); display: flex; align-items: center; gap: 8px;
        }
        .cl-btn-submit:hover { opacity: 0.9; transform: translateY(-1px); }
        .cl-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .cl-error-msg { font-size: 12px; color: #EF4444; font-weight: 500; margin-top: 2px; }

        /* ---- DRAWER DE DETALHES DO CLIENTE ---- */
        .cd-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.45); z-index: 900;
          backdrop-filter: blur(3px);
        }
        .cd-overlay.open { display: block; animation: fadeIn 0.2s ease; }
        .cd-drawer {
          position: fixed; top: 0; right: -48vw; height: 100vh;
          width: 45vw; min-width: 560px; max-width: 860px;
          background: var(--white); box-shadow: -12px 0 60px rgba(0,0,0,0.18);
          z-index: 901; overflow: hidden; transition: right 0.35s cubic-bezier(0.4,0,0.2,1);
          display: flex; flex-direction: column;
        }
        .cd-drawer.open { right: 0; }

        /* Header do drawer */
        .cd-drawer-header {
          padding: 0;
          border-bottom: 1px solid var(--border-light);
          position: sticky; top: 0;
          background: var(--white); z-index: 1;
          flex-shrink: 0;
        }
        .cd-header-top {
          display: flex; align-items: center; gap: 16px;
          padding: 20px 24px 16px;
        }
        .cd-header-avatar {
          width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
          background: linear-gradient(135deg, #06B6D4, #3B82F6);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 900; color: #fff; letter-spacing: -0.5px;
        }
        .cd-header-info { flex: 1; min-width: 0; }
        .cd-drawer-title {
          font-size: 20px; font-weight: 800; color: var(--black);
          line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cd-drawer-sub   { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
        .cd-header-actions { display: flex; align-items: center; gap: 8px; }
        .cd-close {
          width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid var(--border-light); flex-shrink: 0;
          background: var(--bg); color: var(--text-secondary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; transition: var(--transition);
        }
        .cd-close:hover { background: #FEE2E2; color: #991B1B; border-color: #FECACA; }

        /* Botão Churn — minimalista */
        .cd-btn-churn {
          height: 36px; padding: 0 12px; border-radius: 10px;
          border: 1.5px solid #fca5a5; background: #fff1f2;
          color: #b91c1c; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all .15s; flex-shrink: 0;
          font-family: inherit; letter-spacing: .01em;
        }
        .cd-btn-churn:hover { background: #fee2e2; border-color: #f87171; }
        [data-theme="dark"] .cd-btn-churn { background: rgba(220,38,38,.12); border-color: rgba(220,38,38,.3); color: #f87171; }
        [data-theme="dark"] .cd-btn-churn:hover { background: rgba(220,38,38,.22); }

        /* Botão Excluir */
        .cd-btn-delete {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          border-radius: 10px;
          border: 1.5px solid rgba(239,68,68,0.3);
          background: transparent;
          color: #ef4444;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .cd-btn-delete:hover { background: #fee2e2; border-color: #ef4444; }
        .cd-btn-delete svg {
          width: 16px; height: 16px;
          stroke: currentColor; fill: none;
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
        }
        [data-theme="dark"] .cd-btn-delete { border-color: rgba(239,68,68,0.3); color: #f87171; }
        [data-theme="dark"] .cd-btn-delete:hover { background: rgba(239,68,68,0.15); border-color: #f87171; }

        /* Popup Churn */
        .churn-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,.45); backdrop-filter: blur(3px);
          z-index: 3000;
        }
        .churn-overlay.open { display: block; }
        .churn-modal {
          display: none; position: fixed;
          top: 50%; left: 50%; transform: translate(-50%,-50%);
          background: var(--white); border-radius: 20px;
          border: 1.5px solid var(--border-light);
          box-shadow: 0 20px 60px rgba(0,0,0,.18);
          padding: 28px 28px 24px; width: 380px; max-width: 95vw;
          z-index: 3001; animation: churnFadeIn .2s ease;
        }
        .churn-modal.open { display: block; }
        @keyframes churnFadeIn { from { opacity:0; transform:translate(-50%,-54%); } to { opacity:1; transform:translate(-50%,-50%); } }
        .churn-modal-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .churn-modal-icon { font-size: 22px; }
        .churn-modal-title { font-size: 17px; font-weight: 800; color: var(--black); margin: 0; }
        .churn-modal-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0 0 20px; }
        .churn-modal-desc strong { color: #b91c1c; }
        .churn-modal-fields { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
        .churn-field { display: flex; flex-direction: column; gap: 5px; }
        .churn-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; }
        .churn-input {
          padding: 9px 12px; border-radius: 10px;
          border: 1.5px solid var(--border-light); background: var(--bg);
          font-size: 14px; font-weight: 500; color: var(--black);
          font-family: inherit; outline: none; transition: border-color .15s;
          width: 100%; box-sizing: border-box;
        }
        .churn-input:focus { border-color: #b91c1c; box-shadow: 0 0 0 3px rgba(220,38,38,.12); }
        .churn-char-count {
          font-size: 11px; font-weight: 600; color: var(--text-muted);
          text-align: right; transition: color .15s;
        }
        .churn-char-count.warn { color: #d97706; }
        .churn-char-count.danger { color: #dc2626; font-weight: 800; }
        .churn-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .churn-btn-cancel {
          padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
          border: 1.5px solid var(--border-light); background: var(--bg); color: var(--text-secondary);
          cursor: pointer; transition: all .15s; font-family: inherit;
        }
        .churn-btn-cancel:hover { background: var(--border-light); }
        .churn-btn-confirm {
          padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 700;
          border: none; background: #DC2626; color: #fff;
          cursor: pointer; transition: background .15s; font-family: inherit;
        }
        .churn-btn-confirm:hover { background: #b91c1c; }
        .churn-btn-confirm:disabled { opacity: .6; cursor: not-allowed; }
        [data-theme="dark"] .churn-modal { background: #1e1e1e; border-color: rgba(255,255,255,.1); }
        [data-theme="dark"] .churn-input { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.12); color: #f1f5f9; }
        [data-theme="dark"] .churn-input:focus { border-color: #f87171; box-shadow: 0 0 0 3px rgba(220,38,38,.2); }

        /* Tabs nav dentro do header */
        .cd-tabs {
          display: flex; gap: 0;
          padding: 0 24px;
          border-top: 1px solid var(--border-light);
          overflow-x: auto; scrollbar-width: none;
        }
        .cd-tabs::-webkit-scrollbar { display: none; }
        .cd-tab-btn {
          padding: 11px 16px; font-size: 12px; font-weight: 700;
          color: var(--text-muted); background: transparent; border: none;
          border-bottom: 2.5px solid transparent; cursor: pointer;
          transition: all 0.15s; white-space: nowrap; font-family: inherit;
          margin-bottom: -1px;
        }
        .cd-tab-btn:hover { color: var(--black); }
        .cd-tab-btn.active { color: var(--cyan); border-bottom-color: var(--cyan); }

        /* Body scrollável */
        .cd-body {
          flex: 1; overflow-y: auto; padding: 20px 24px 32px;
          scrollbar-width: thin;
        }
        .cd-tab-panel { display: none; }
        .cd-tab-panel.active { display: block; }

        [data-theme="dark"] .cd-drawer { background: var(--card-dark, #1a1a1a); }
        [data-theme="dark"] .cd-drawer-header { background: var(--card-dark, #1a1a1a); }
        [data-theme="dark"] .cd-close { background: rgba(255,255,255,0.06); border-color: var(--border-light); }
        [data-theme="dark"] .cd-close:hover { background: rgba(239,68,68,0.15); color: #F87171; border-color: rgba(239,68,68,0.3); }
        [data-theme="dark"] .cd-tab-btn.active { color: var(--cyan); }

        /* ---- SEÇÃO REUNIÕES ---- */
        .rn-list { display: flex; flex-direction: column; gap: 10px; }
        .rn-item {
          border: 1.5px solid var(--border-light); border-radius: 12px;
          overflow: hidden; transition: border-color 0.15s;
        }
        .rn-item:hover { border-color: var(--cyan); }
        .rn-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; cursor: pointer; gap: 10px;
          background: var(--white);
        }
        .rn-meta { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .rn-titulo { font-size: 13px; font-weight: 700; color: var(--black); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rn-data   { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
        .rn-chevron { font-size: 12px; color: var(--text-muted); transition: transform 0.2s; flex-shrink: 0; }
        .rn-item.open .rn-chevron { transform: rotate(180deg); }
        .rn-notes {
          display: none; padding: 10px 14px 14px;
          font-size: 13px; color: var(--text-secondary); line-height: 1.6;
          border-top: 1px solid var(--border-light); background: #FAFAFA;
          white-space: pre-wrap;
        }
        .rn-item.open .rn-notes { display: block; }
        .rn-del {
          width: 26px; height: 26px; border-radius: 6px; border: none;
          background: transparent; color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; transition: var(--transition); flex-shrink: 0;
        }
        .rn-del:hover { background: #FEE2E2; color: #991B1B; }
        .rn-empty { font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0; }
        /* Formulário nova reunião */
        .rn-form {
          display: none; flex-direction: column; gap: 10px;
          padding: 14px; border: 1.5px dashed var(--cyan); border-radius: 12px;
          background: #F0F9FF; margin-top: 4px;
        }
        .rn-form.open { display: flex; }
        .rn-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .rn-add-btn {
          display: flex; align-items: center; gap: 6px; padding: 8px 14px;
          border-radius: 10px; border: 1.5px solid var(--cyan); background: var(--white);
          color: var(--cyan); font-size: 13px; font-weight: 700; cursor: pointer;
          transition: var(--transition); width: 100%; justify-content: center;
        }
        .rn-add-btn:hover { background: var(--cyan); color: #fff; }
        .rn-save-btn {
          padding: 8px 0; border-radius: 10px; border: none;
          background: var(--cyan); color: #fff; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: var(--transition);
        }
        .rn-save-btn:hover { opacity: 0.88; }
        .rn-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ---- FEEDBACK SEMANAL ---- */
        .fb-add-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; padding: 9px 0; margin-top: 8px;
          border-radius: 10px; border: 1.5px solid var(--border-light);
          background: var(--white); color: var(--text-secondary);
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: var(--transition);
        }
        .fb-add-btn:hover { border-color: var(--cyan); color: var(--cyan); background: #F0F9FF; }
        .fb-form {
          display: none; flex-direction: column; gap: 12px;
          padding: 16px; border: 1.5px dashed var(--border-light);
          border-radius: 14px; background: #FAFAFA; margin-top: 8px;
        }
        .fb-form.open { display: flex; }
        .fb-mood-row {
          display: flex; gap: 8px; align-items: center;
        }
        .fb-mood-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-right: 4px; }
        .fb-mood-btn {
          width: 36px; height: 36px; border-radius: 10px; border: 2px solid var(--border-light);
          background: var(--white); font-size: 18px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: var(--transition);
        }
        .fb-mood-btn:hover, .fb-mood-btn.selected { border-color: var(--cyan); background: #EFF6FF; transform: scale(1.1); }
        .fb-submit-btn {
          padding: 9px 0; border-radius: 10px; border: none;
          background: var(--cyan); color: #fff; font-size: 13px;
          font-weight: 700; cursor: pointer; transition: var(--transition);
        }
        .fb-submit-btn:hover { opacity: 0.88; }
        /* Itens de histórico */
        .fb-list { display: flex; flex-direction: column; gap: 10px; }
        .fb-item {
          border: 1.5px solid var(--border-light); border-radius: 12px;
          padding: 12px 14px; background: var(--white);
          transition: border-color 0.15s;
        }
        .fb-item:hover { border-color: #93C5FD; }
        .fb-item-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 8px;
        }
        .fb-item-left { display: flex; align-items: center; gap: 8px; }
        .fb-week-badge {
          font-size: 10px; font-weight: 800; padding: 3px 8px;
          border-radius: 20px; background: #EFF6FF; color: #1D4ED8;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .fb-date { font-size: 11px; font-weight: 600; color: var(--text-muted); }
        .fb-mood-icon { font-size: 18px; line-height: 1; }
        .fb-text {
          font-size: 13px; color: var(--text-secondary); line-height: 1.6;
          white-space: pre-wrap;
        }
        .fb-empty { font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0; }

        .cd-section-title {
          font-size: 11px; font-weight: 800; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;
        }
        .cd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .cd-field { display: flex; flex-direction: column; gap: 4px; }
        .cd-field.full { grid-column: 1/-1; }
        .cd-field-label {
          font-size: 11px; font-weight: 700; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.4px;
        }
        .cd-field-value {
          font-size: 14px; font-weight: 500; color: var(--black);
          word-break: break-word; line-height: 1.5;
        }
        .cd-field-value.muted { color: var(--text-muted); font-style: italic; font-size: 13px; }
        .cd-divider { height: 1px; background: var(--border-light); }
        .cd-score-row {
          display: flex; gap: 10px;
        }
        .cd-score-pill {
          flex: 1; text-align: center; padding: 10px 6px; border-radius: 10px;
          background: var(--bg); border: 1px solid var(--border-light);
        }
        .cd-score-pill .cd-score-num {
          font-size: 22px; font-weight: 800; color: var(--black); display: block;
        }
        .cd-score-pill .cd-score-lbl {
          font-size: 10px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.4px;
        }

        /* ---- BARRA DE PESQUISA ---- */
        .cl-search-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--white);
          border: 1.5px solid var(--border-light);
          border-radius: 12px;
          padding: 10px 16px;
          box-shadow: var(--shadow);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .cl-search-bar:focus-within {
          border-color: var(--cyan);
          box-shadow: 0 0 0 3px rgba(6,182,212,0.12);
        }
        .cl-search-icon {
          color: var(--text-muted);
          flex-shrink: 0;
          width: 18px; height: 18px;
        }
        .cl-search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 14px;
          font-weight: 500;
          color: var(--black);
          font-family: inherit;
          outline: none;
        }
        .cl-search-input::placeholder { color: var(--text-muted); font-weight: 400; }
        .cl-search-clear {
          display: none;
          align-items: center;
          justify-content: center;
          width: 22px; height: 22px;
          border-radius: 50%; border: none;
          background: var(--bg); color: var(--text-secondary);
          cursor: pointer; font-size: 13px; transition: all 0.15s;
          flex-shrink: 0;
        }
        .cl-search-clear.visible { display: flex; }
        .cl-search-clear:hover { background: #FEE2E2; color: #991B1B; }
        .cl-search-count {
          font-size: 12px; font-weight: 700;
          color: var(--text-muted); white-space: nowrap;
          padding-left: 10px;
          border-left: 1.5px solid var(--border-light);
        }
        .cl-search-count strong { color: var(--cyan); }

        [data-theme="dark"] .cl-search-bar { background: var(--card-light); border-color: var(--border-light); }
        [data-theme="dark"] .cl-search-input { color: var(--black); }
        [data-theme="dark"] .cl-search-clear { background: rgba(255,255,255,0.07); }
        [data-theme="dark"] .cl-search-clear:hover { background: rgba(239,68,68,0.15); color: #F87171; }

        /* ---- DARK MODE OVERRIDES (CLIENTES) ---- */
        [data-theme="dark"] .sk-block {
          background: linear-gradient(90deg, #1A1A1A 25%, #222222 50%, #1A1A1A 75%);
        }
        [data-theme="dark"] .ob-card:hover {
          border-color: var(--cyan);
        }
        [data-theme="dark"] .task-row {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--border-light);
        }
        [data-theme="dark"] .task-row.done {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
        }
        [data-theme="dark"] .task-row.done .task-label {
          color: #4ADE80;
        }
        [data-theme="dark"] .task-check {
          background: var(--bg);
          border-color: var(--border-light);
        }
        [data-theme="dark"] .ob-deadline--late {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #F87171;
        }
        [data-theme="dark"] .ob-deadline--today {
          background: rgba(249, 115, 22, 0.1);
          border-color: rgba(249, 115, 22, 0.3);
          color: #FDBA74;
        }
        [data-theme="dark"] .ob-deadline--ok {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
          color: #4ADE80;
        }
        [data-theme="dark"] .cl-ac-item:hover {
          background: rgba(26, 206, 238, 0.1);
        }
        [data-theme="dark"] .cd-close:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #F87171;
        }
        [data-theme="dark"] .rn-notes {
          background: rgba(255, 255, 255, 0.03);
        }
        [data-theme="dark"] .rn-del:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #F87171;
        }
        [data-theme="dark"] .rn-form {
          background: rgba(26, 206, 238, 0.05);
        }
        [data-theme="dark"] .fb-add-btn:hover {
          background: rgba(26, 206, 238, 0.05);
        }
        [data-theme="dark"] .fb-form {
          background: rgba(255, 255, 255, 0.03);
        }
        [data-theme="dark"] .fb-mood-btn:hover,
        [data-theme="dark"] .fb-mood-btn.selected {
          background: rgba(26, 206, 238, 0.1);
        }
        [data-theme="dark"] .fb-item:hover {
          border-color: var(--cyan);
        }
        [data-theme="dark"] .fb-week-badge {
          background: rgba(26, 206, 238, 0.1);
          color: var(--cyan);
        }
        [data-theme="dark"] .cl-modal-close:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #F87171;
        }
        [data-theme="dark"] .cl-filter-clear:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #F87171;
        }

        /* ---- VIEW TOGGLE (Cards / Lista) ---- */
        .view-toggle-group {
          display: flex;
          border: 1.5px solid var(--border-light);
          border-radius: 10px;
          overflow: hidden;
          background: var(--white);
        }
        .view-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .view-toggle-btn svg {
          width: 14px; height: 14px;
          stroke: currentColor; fill: none;
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
          flex-shrink: 0;
        }
        .view-toggle-btn + .view-toggle-btn {
          border-left: 1.5px solid var(--border-light);
        }
        .view-toggle-btn:hover { background: var(--bg); color: var(--black); }
        .view-toggle-btn.active {
          background: var(--black);
          color: var(--white);
        }
        [data-theme="dark"] .view-toggle-btn.active {
          background: #FFFFFF;
          color: #000000;
        }

        /* ---- MODO LISTA — tabela de clientes ativados ---- */
        .cl-list-wrap {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow);
          overflow-x: auto;
        }
        .cl-list-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .cl-list-table th {
          background: #F8FAFC;
          padding: 12px 18px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          border-bottom: 1px solid var(--border-light);
          white-space: nowrap;
          cursor: pointer;
          user-select: none;
        }
        .cl-list-table th:hover { color: var(--cyan); }
        .cl-list-table th.sort-active { color: var(--cyan); }
        .cl-list-table td {
          padding: 13px 18px;
          font-size: 13px;
          color: var(--black);
          border-bottom: 1px solid var(--border-light);
          vertical-align: middle;
        }
        .cl-list-table tr:last-child td { border-bottom: none; }
        .cl-list-table tbody tr {
          cursor: pointer;
          transition: background 0.13s ease;
        }
        .cl-list-table tbody tr:hover { background: #F8FAFC; }

        .cl-list-avatar {
          width: 34px; height: 34px; border-radius: 9px;
          background: var(--cyan);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; color: #fff;
          flex-shrink: 0; letter-spacing: -0.3px;
        }
        .cl-list-name-cell {
          display: flex; align-items: center; gap: 10px;
        }
        .cl-list-name { font-weight: 700; color: var(--black); }
        .cl-list-seg  { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }

        [data-theme="dark"] .cl-list-table th { background: rgba(255,255,255,0.03); }
        [data-theme="dark"] .cl-list-table tbody tr:hover { background: rgba(255,255,255,0.04); }

        /* ---- COLUNAS EXTRAS DA LISTA ---- */
        .cl-td-date { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
        .cl-td-overdue { color: var(--text-secondary) !important; font-weight: 700; }
        .cl-td-fat { font-size: 13px; font-weight: 700; color: var(--text-secondary); white-space: nowrap; }
        [data-theme="dark"] .cl-td-fat { color: var(--black); }
        .cl-td-ct { white-space: nowrap; text-align: center; }
        .ct-meta-badge {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 700; padding: 4px 9px;
          border-radius: 20px; border: 1.5px solid transparent;
          white-space: nowrap;
        }
        .ct-meta-goal { font-weight: 400; opacity: .65; font-size: 11px; }
        /* Meta atingida */
        .ct-meta-ok      { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
        /* Meta parcial (só para contatos) */
        .ct-meta-parcial { background: #fef9c3; color: #854d0e; border-color: #fde68a; }
        /* Sem nenhum */
        .ct-meta-zero    { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
        /* Dark mode */
        [data-theme="dark"] .ct-meta-ok      { background: rgba(22,163,74,.18);  color: #4ade80; border-color: rgba(22,163,74,.35); }
        [data-theme="dark"] .ct-meta-parcial { background: rgba(234,179,8,.18);  color: #fbbf24; border-color: rgba(234,179,8,.35); }
        [data-theme="dark"] .ct-meta-zero    { background: rgba(220,38,38,.18);  color: #f87171; border-color: rgba(220,38,38,.35); }
      </style>

      <div class="page-header">
        <div class="page-title-block">
          <h1>Clientes</h1>
          <p>Gestão de carteira, métricas de sucesso e acompanhamento contínuo</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" id="btn-add-cliente">
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>
            Adicionar Cliente
          </button>
        </div>
      </div>

      <!-- Drawer de Detalhes do Cliente -->
      <div class="cd-overlay" id="cd-overlay"></div>
      <div class="cd-drawer" id="cd-drawer">
        <div class="cd-drawer-header" id="cd-drawer-header">
          <div class="cd-header-top">
            <div class="cd-header-avatar" id="cd-avatar">??</div>
            <div class="cd-header-info">
              <div class="cd-drawer-title" id="cd-nome">—</div>
              <div class="cd-drawer-sub" id="cd-sub">—</div>
            </div>
            <div class="cd-header-actions">
              <button class="cd-btn-churn" id="cd-btn-churn" title="Registrar Churn">⚠ Churn</button>
              <button class="cd-btn-delete" id="cd-btn-delete" title="Excluir cliente">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
              <button class="cd-close" id="cd-close">✕</button>
            </div>
          </div>
          <nav class="cd-tabs" id="cd-tabs">
            <button class="cd-tab-btn active" data-tab="geral">Geral</button>
            <button class="cd-tab-btn" data-tab="financeiro">Financeiro</button>
            <button class="cd-tab-btn" data-tab="contatos">Contatos</button>
            <button class="cd-tab-btn" data-tab="otimizacoes">Otimizações</button>
          </nav>
        </div>
        <div class="cd-body" id="cd-body"></div>
      </div>

      <!-- Modal Churn -->
      <div class="churn-overlay" id="churn-overlay"></div>
      <div class="churn-modal" id="churn-modal" role="dialog" aria-modal="true" aria-labelledby="churn-modal-title">
        <div class="churn-modal-header">
          <span class="churn-modal-icon">⚠️</span>
          <h3 class="churn-modal-title" id="churn-modal-title">Registrar Churn</h3>
        </div>
        <p class="churn-modal-desc">Esta ação irá marcar o cliente como <strong>Desativado</strong> e registrará o churn. Preencha os dados abaixo.</p>
        <div class="churn-modal-fields">
          <div class="churn-field">
            <label class="churn-label" for="churn-data">Data do Churn</label>
            <input class="churn-input" id="churn-data" type="date">
          </div>
          <div class="churn-field">
            <label class="churn-label" for="churn-receita">Receita Perdida (R$)</label>
            <input class="churn-input" id="churn-receita" type="text" placeholder="0,00" inputmode="decimal">
          </div>
          <div class="churn-field">
            <label class="churn-label" for="churn-motivo">Motivo do Churn</label>
            <input class="churn-input" id="churn-motivo" type="text" placeholder="Ex: Preço, concorrência, resultado…" maxlength="120">
            <span class="churn-char-count" id="churn-char-count">120 caracteres restantes</span>
          </div>
        </div>
        <div class="churn-modal-actions">
          <button class="churn-btn-cancel" id="churn-cancel">Cancelar</button>
          <button class="churn-btn-confirm" id="churn-confirm">Confirmar Churn</button>
        </div>
      </div>

      <!-- Modal Criar Cliente -->
      <div class="cl-overlay" id="cl-overlay">
        <div class="cl-modal" id="cl-modal">
          <div class="cl-modal-header">
            <span class="cl-modal-title">Adicionar Cliente</span>
            <button class="cl-modal-close" id="cl-modal-close">✕</button>
          </div>
          <form class="cl-form" id="cl-form" novalidate>
            <div class="cl-row">
              <div class="cl-field">
                <label class="cl-label">Nome<span class="cl-required">*</span></label>
                <input id="cl-nome" class="cl-input" type="text" placeholder="Nome do cliente" autocomplete="off">
                <span class="cl-error-msg" id="cl-nome-err"></span>
              </div>
              <div class="cl-field">
                <label class="cl-label">Telefone<span class="cl-required">*</span></label>
                <input id="cl-telefone" class="cl-input" type="text" placeholder="(11) 99999-9999" autocomplete="off">
                <span class="cl-error-msg" id="cl-telefone-err"></span>
              </div>
            </div>
            <div class="cl-row">
              <div class="cl-field">
                <label class="cl-label">E-mail</label>
                <input id="cl-email" class="cl-input" type="email" placeholder="email@exemplo.com" autocomplete="off">
              </div>
              <div class="cl-field">
                <label class="cl-label">Segmento</label>
                <input id="cl-segmento" class="cl-input" type="text" placeholder="Ex: Varejo, SaaS…" autocomplete="off">
              </div>
            </div>
            <div class="cl-field">
              <label class="cl-label">Negócio Vinculado <span style="font-size:11px;color:var(--text-muted);font-weight:400">(opcional)</span></label>
              <div class="cl-autocomplete">
                <input id="cl-negocio-input" class="cl-input" type="text" placeholder="Digite para buscar o negócio…" autocomplete="off">
                <div class="cl-autocomplete-list" id="cl-negocio-list"></div>
                <input type="hidden" id="cl-negocio-id">
              </div>
              <span class="cl-error-msg" id="cl-negocio-err"></span>
            </div>
            <div class="cl-field" id="cl-user-field" style="display:none">
              <label class="cl-label">Atribuir ao Usuário</label>
              <select id="cl-user-select" class="cl-select">
                <option value="">Carregando...</option>
              </select>
            </div>
            <div class="cl-field">
              <label class="cl-label">Investimento de Mídia (R$)</label>
              <input id="cl-midia" class="cl-input" type="number" min="0" step="0.01" placeholder="0,00" autocomplete="off">
            </div>
            <div class="cl-field" style="display: flex; flex-direction: row; align-items: center; gap: 8px; margin-top: 12px; margin-bottom: 12px;">
              <input id="cl-contrato" type="checkbox" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--cyan);">
              <label for="cl-contrato" class="cl-label" style="cursor: pointer; margin: 0; user-select: none;">Possui Contrato?</label>
            </div>
            <div class="cl-field" id="cl-contrato-duracao-wrap" style="display: none;">
              <label class="cl-label">Duração do Contrato (meses)<span class="cl-required">*</span></label>
              <input id="cl-contrato-duracao" class="cl-input" type="number" min="1" step="1" placeholder="Ex: 12" autocomplete="off">
              <span class="cl-error-msg" id="cl-contrato-duracao-err"></span>
            </div>
            <div class="cl-field">
              <label class="cl-label">Contexto Geral</label>
              <textarea id="cl-contexto" class="cl-textarea" placeholder="Informações relevantes sobre o cliente…"></textarea>
            </div>
            <div class="cl-field">
              <label class="cl-label">Descrição da Empresa</label>
              <textarea id="cl-descricao" class="cl-textarea" placeholder="O que a empresa faz, mercado, diferenciais…"></textarea>
            </div>
            <div class="cl-modal-footer">
              <button type="button" class="cl-btn-cancel" id="cl-btn-cancel">Cancelar</button>
              <button type="submit" class="cl-btn-submit" id="cl-btn-submit">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5v14"/></svg>
                Adicionar Cliente
              </button>
            </div>
          </form>
        </div>
      </div>

      <div id="clientes-page">
        ${this._renderSkeleton()}
      </div>
    `;
  },

  // ─── Skeleton de carregamento ────────────────────────────────────────────
  _renderSkeleton() {
    return `
      <div class="clientes-skeleton">
        <div class="sk-kpi-row">
          ${Array(4).fill('<div class="sk-block" style="height:88px"></div>').join('')}
        </div>
        <div>
          <div class="sk-block" style="height:24px; width:200px; margin-bottom:16px; border-radius:8px;"></div>
          <div class="sk-block" style="height:340px; border-radius:20px;"></div>
        </div>
        <div>
          <div class="sk-block" style="height:24px; width:160px; margin-bottom:16px; border-radius:8px;"></div>
          <div class="sk-block" style="height:200px; border-radius:20px;"></div>
        </div>
      </div>
    `;
  },


  // ─── onMount: busca dados reais ─────────────────────────────────────────
  async onMount() {
    const userId  = UserStore.getUserId();
    const isAdmin = UserStore.isAdmin();
    _isAdmin = isAdmin;
    if (!userId) return;

    // Bind do modal apenas uma vez por ciclo de vida da página
    if (!this._modalBound) {
      this._modalBound = true;
      this._bindModalEvents(isAdmin, userId);
    }

    // Bind do drawer e modals de churn apenas uma vez por ciclo de vida da página
    if (!this._drawerEventsBound) {
      this._drawerEventsBound = true;
      this._bindDrawerEvents();
    }

    // Buscar clientes
    const { data, error } = isAdmin
      ? await Clientes.getAllAdmin()
      : await Clientes.getAllPorUsuario(userId);

    const container = document.getElementById('clientes-page');
    if (!container) return;

    if (error) {
      container.innerHTML = `<div class="section-error">⚠️ Erro ao carregar clientes: ${error.message}</div>`;
      return;
    }

    _todosClientes  = data || [];
    _filtroUserId   = '';

    // Admin: buscar lista de usuários para o filtro
    if (isAdmin) {
      const { data: usrs } = await Usuarios.getVendedoresAtivos();
      _usuarios = usrs || [];
    }

    // Buscar tarefas de onboarding + dados complementares da lista (em paralelo)
    const novosAll = _todosClientes.filter(c => c.cliente_status === 'Novo Cliente');
    _tasksByNegocio = {};

    const fetchTarefas = async () => {
      if (novosAll.length > 0) {
        const negocioIds = novosAll.map(c => c.negocio_id).filter(Boolean);
        const { data: tarefasData } = await Tarefas.getOnboardingByNegocios(negocioIds);
        (tarefasData || []).forEach(t => {
          if (!_tasksByNegocio[t.negocio_id]) _tasksByNegocio[t.negocio_id] = [];
          _tasksByNegocio[t.negocio_id].push(t);
        });
      }
    };

    const fetchResumo = async () => {
      const { faturamentos, contatos } = await Clientes.getResumoLista();
      _resumoListaFat = {};
      faturamentos.forEach(f => {
        _resumoListaFat[f.cliente_id] = (_resumoListaFat[f.cliente_id] || 0) + parseFloat(f.faturamento_valor || 0);
      });

      // Períodos de referência
      const agora = new Date();

      // Início da semana atual (segunda-feira)
      const diaSemana = agora.getDay(); // 0=Dom … 6=Sab
      const diffSeg   = (diaSemana === 0 ? -6 : 1 - diaSemana); // ajuste p/ segunda
      const inicioSemana = new Date(agora);
      inicioSemana.setDate(agora.getDate() + diffSeg);
      inicioSemana.setHours(0, 0, 0, 0);

      // Início do mês atual
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      _resumoListaCt = {};
      contatos.forEach(ct => {
        if (!_resumoListaCt[ct.cliente_id]) _resumoListaCt[ct.cliente_id] = { reuniaoMes: 0, contatoSemana: 0 };
        const dataCt = ct.contato_data ? new Date(ct.contato_data) : null;
        if (ct.contato_tipo === 'Reunião') {
          // Conta reuniões do mês atual
          if (dataCt && dataCt >= inicioMes) _resumoListaCt[ct.cliente_id].reuniaoMes++;
        } else {
          // Conta outros contatos da semana atual
          if (dataCt && dataCt >= inicioSemana) _resumoListaCt[ct.cliente_id].contatoSemana++;
        }
      });
    };

    await Promise.all([fetchTarefas(), fetchResumo()]);

    this._renderPage(isAdmin);

    // Abre drawer direto se a URL contiver um cliente_id (ex: #clientes/42)
    const paramId = router.currentParam();
    if (paramId) {
      const clienteId = Number(paramId);
      const cliente = _todosClientes.find(c => c.cliente_id === clienteId);
      if (cliente) this._openClientDrawer(cliente);
    }
  },

  // ─── Renderiza / re-renderiza as secões com filtro aplicado ───────────────────
  _renderPage(isAdmin) {
    const container = document.getElementById('clientes-page');
    if (!container) return;

    const clientes = _filtroUserId
      ? _todosClientes.filter(c => c.user_id === _filtroUserId)
      : _todosClientes;

    // Aplica filtro de busca por nome (sem acento, sem case, busca parcial)
    const _norm = str => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const clientesFiltrados = _termoBusca
      ? clientes.filter(c => _norm(c.cliente_nome).includes(_norm(_termoBusca)))
      : clientes;

    const ativados    = clientesFiltrados.filter(c => c.cliente_status === 'Ativado');
    const novos       = clientesFiltrados.filter(c => c.cliente_status === 'Novo Cliente');
    const desativados = clientesFiltrados.filter(c => c.cliente_status === 'Desativado');

    const totalMidia = [...ativados, ...novos].reduce((acc, c) => acc + parseFloat(c.investimento_midia || 0), 0);
    const notasValidas = ativados.filter(c => c.nota_comunicacao && c.nota_entrega && c.nota_performance);
    let satisfacaoMedia = '-';
    if (notasValidas.length > 0) {
      const soma = notasValidas.reduce((acc, c) =>
        acc + (parseFloat(c.nota_comunicacao) + parseFloat(c.nota_entrega) + parseFloat(c.nota_performance)) / 3, 0);
      satisfacaoMedia = (soma / notasValidas.length).toFixed(1);
    }

    container.innerHTML = `
      <div class="clientes-page">
        ${this._renderKPIs(ativados.length, novos.length, totalMidia, satisfacaoMedia, isAdmin)}
        ${isAdmin ? this._renderFilterBar() : ''}
        ${this._renderSearchBar(clientesFiltrados.length)}
        ${this._renderOnboardingSection(novos, _tasksByNegocio)}
        ${this._renderCardsSection(ativados, _paginaAtivados, _sortAtivados, _resumoListaFat, _resumoListaCt)}
        ${this._renderTableSection('Desativados', 'red',   desativados, true,  _paginaDesativ,  'desativ',  _sortDesativ)}
      </div>
    `;

    this._bindOnboardingEvents(novos);
    if (isAdmin) this._bindFilterEvents(isAdmin);
    this._bindSearchEvents(isAdmin);
    this._bindPaginationEvents(isAdmin);
    this._bindSortEvents(isAdmin);

    // Delegar cliques de abertura do drawer localmente no container da página
    container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-cliente-id]');
      if (target) {
        if (target.classList.contains('task-row') || target.closest('.ob-card')) return;
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.rn-del') || e.target.closest('.ct-del') || e.target.closest('.fat-edit') || e.target.closest('.fat-del') || e.target.closest('.fc-del')) return;
        const id = Number(target.dataset.clienteId);
        const c  = _todosClientes.find(x => x.cliente_id === id);
        if (c) this._openClientDrawer(c);
      }
    });
  },

  // ─── Barra de pesquisa ───────────────────────────────────────────────────
  _renderSearchBar(total) {
    const hasSearch = !!_termoBusca;
    return `
      <div class="cl-search-bar">
        <svg class="cl-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id="cl-search-input"
          class="cl-search-input"
          type="text"
          placeholder="Pesquisar cliente por nome..."
          value="${hasSearch ? _termoBusca.replace(/"/g, '&quot;') : ''}"
          autocomplete="off"
          spellcheck="false"
        >
        <button class="cl-search-clear ${hasSearch ? 'visible' : ''}" id="cl-search-clear" title="Limpar pesquisa">✕</button>
        <span class="cl-search-count">
          ${hasSearch ? `<strong>${total}</strong> resultado${total !== 1 ? 's' : ''}` : `${total} cliente${total !== 1 ? 's' : ''}`}
        </span>
      </div>`;
  },

  _bindSearchEvents(isAdmin) {
    const input = document.getElementById('cl-search-input');
    const clear = document.getElementById('cl-search-clear');
    if (!input) return;

    // Foca no input preservando a posição do cursor
    if (_termoBusca) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }

    let _searchTimer;
    input.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => {
        _termoBusca     = input.value.trim();
        _paginaAtivados = 1;
        _paginaDesativ  = 1;
        this._renderPage(isAdmin);
      }, 200);
    });

    clear?.addEventListener('click', () => {
      _termoBusca     = '';
      _paginaAtivados = 1;
      _paginaDesativ  = 1;
      this._renderPage(isAdmin);
    });
  },

  // ─── Filtro por membro ───────────────────────────────────────────────────
  _renderFilterBar() {
    const total = _filtroUserId
      ? _todosClientes.filter(c => c.user_id === _filtroUserId).length
      : _todosClientes.length;
    const userOpts = _usuarios.map(u =>
      `<option value="${u.user_id}" ${u.user_id === _filtroUserId ? 'selected' : ''}>${u.user_nome}</option>`
    ).join('');
    const hasFilter = !!_filtroUserId;
    const filterName = hasFilter ? _usuarios.find(u => u.user_id === _filtroUserId)?.user_nome : '';
    return `
      <div class="cl-filter-bar">
        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span class="cl-filter-label">Filtrar por gestor:</span>
        <select class="cl-filter-select" id="cl-filter-select">
          <option value="">Todos os Membros</option>
          ${userOpts}
        </select>
        <button class="cl-filter-clear ${hasFilter ? 'visible' : ''}" id="cl-filter-clear">
          ✕ Limpar filtro
        </button>
        <span class="cl-filter-info">
          ${hasFilter ? `<strong style="color:var(--cyan)">${filterName}</strong> · ` : ''}${total} cliente${total !== 1 ? 's' : ''}
        </span>
      </div>`;
  },

  _bindFilterEvents(isAdmin) {
    const sel   = document.getElementById('cl-filter-select');
    const clear = document.getElementById('cl-filter-clear');
    sel?.addEventListener('change', () => {
      _filtroUserId   = sel.value;
      _paginaAtivados = 1;  // reset páginas ao filtrar
      _paginaDesativ  = 1;
      this._renderPage(isAdmin);
    });
    clear?.addEventListener('click', () => {
      _filtroUserId   = '';
      _paginaAtivados = 1;
      _paginaDesativ  = 1;
      this._renderPage(isAdmin);
    });
  },

  // ─── Paginação ──────────────────────────────────────────────────────────
  _bindPaginationEvents(isAdmin) {
    document.querySelectorAll('.pg-btn[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        const page    = Number(btn.dataset.page);
        if (section === 'ativados') _paginaAtivados = page;
        if (section === 'desativ')  _paginaDesativ  = page;
        this._renderPage(isAdmin);
      });
    });
  },

  // ─── Ordenação de colunas ──────────────────────────────────────────────
  _bindSortEvents(isAdmin) {
    // Tabela Desativados e tabela Lista Ativados (th headers)
    document.querySelectorAll('th[data-sort-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col     = th.dataset.sortCol;
        const section = th.dataset.section;
        const toggle  = (state) => {
          if (state.col === col) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
          else { state.col = col; state.dir = 'asc'; }
        };
        if (section === 'desativ')  { toggle(_sortDesativ);  _paginaDesativ  = 1; }
        if (section === 'ativados') { toggle(_sortAtivados); _paginaAtivados = 1; }
        this._renderPage(isAdmin);
      });
    });
    // Cards Ativados — select de ordenação
    document.getElementById('cards-sort-select')?.addEventListener('change', e => {
      _sortAtivados.col = e.target.value;
      _paginaAtivados = 1;
      this._renderPage(isAdmin);
    });
    document.getElementById('cards-sort-dir')?.addEventListener('click', () => {
      _sortAtivados.dir = _sortAtivados.dir === 'asc' ? 'desc' : 'asc';
      _paginaAtivados = 1;
      this._renderPage(isAdmin);
    });
    // Cliques nos cards e linhas da tabela agora são tratados via delegação de eventos no contêiner principal da página
    // View toggle — Cards ↔ Lista
    document.getElementById('view-toggle-cards')?.addEventListener('click', () => {
      if (_viewModeAtivados === 'cards') return;
      _viewModeAtivados = 'cards';
      this._renderPage(isAdmin);
    });
    document.getElementById('view-toggle-list')?.addEventListener('click', () => {
      if (_viewModeAtivados === 'list') return;
      _viewModeAtivados = 'list';
      this._renderPage(isAdmin);
    });
  },

  // ─── Modal Criar Cliente ─────────────────────────────────────────────────
  _bindModalEvents(isAdmin, userId) {
    const overlay  = document.getElementById('cl-overlay');
    const form     = document.getElementById('cl-form');
    const btnOpen  = document.getElementById('btn-add-cliente');
    const btnClose = document.getElementById('cl-modal-close');
    const btnCancel= document.getElementById('cl-btn-cancel');
    const submitBtn= document.getElementById('cl-btn-submit');
    if (!overlay || !form) return;

    const _open  = () => { 
      overlay.classList.add('open'); 
      form.reset(); 
      document.getElementById('cl-negocio-id').value = ''; 
      const wrapDuracao = document.getElementById('cl-contrato-duracao-wrap');
      if (wrapDuracao) wrapDuracao.style.display = 'none';
    };
    const _close = () => { overlay.classList.remove('open'); };
    btnOpen?.addEventListener('click', _open);
    btnClose?.addEventListener('click', _close);
    btnCancel?.addEventListener('click', _close);
    overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

    // Toggle da visibilidade da duração do contrato no modal manual
    const inputContrato = document.getElementById('cl-contrato');
    const wrapDuracao = document.getElementById('cl-contrato-duracao-wrap');
    const inputDuracao = document.getElementById('cl-contrato-duracao');
    inputContrato?.addEventListener('change', () => {
      if (inputContrato.checked) {
        if (wrapDuracao) wrapDuracao.style.display = 'block';
        if (inputDuracao) inputDuracao.required = true;
      } else {
        if (wrapDuracao) wrapDuracao.style.display = 'none';
        if (inputDuracao) {
          inputDuracao.required = false;
          inputDuracao.value = '';
        }
      }
    });

    // Preencher select de usuários (admin only)
    if (isAdmin) {
      const userField = document.getElementById('cl-user-field');
      const userSelect = document.getElementById('cl-user-select');
      if (userField) userField.style.display = 'flex';
      Usuarios.getGestores().then(({ data }) => {
        if (!userSelect || !data) return;
        userSelect.innerHTML = data.map(u =>
          `<option value="${u.user_id}" ${u.user_id === userId ? 'selected' : ''}>${u.user_nome} (${u.user_cargo})</option>`
        ).join('');
      });
    }

    // Autocomplete negócio
    const negInput = document.getElementById('cl-negocio-input');
    const negList  = document.getElementById('cl-negocio-list');
    const negId    = document.getElementById('cl-negocio-id');
    let _acTimer;
    negInput?.addEventListener('input', () => {
      const q = negInput.value.trim();
      negId.value = '';
      if (q.length < 2) { negList.classList.remove('open'); return; }
      clearTimeout(_acTimer);
      _acTimer = setTimeout(async () => {
        const { data } = await Negocios.buscarPorTitulo(q);
        if (!data?.length) {
          negList.innerHTML = '<div class="cl-ac-empty">Nenhum negócio encontrado</div>';
        } else {
          negList.innerHTML = data.map(n => {
            const statusColor = n.negocio_status === 'Ganho' ? '#166534' : n.negocio_status === 'Perdido' ? '#991B1B' : '#1E40AF';
            return `<div class="cl-ac-item" data-id="${n.negocio_id}" data-title="${n.negocio_titulo}">
              <strong>${n.negocio_titulo}</strong>
              <span style="color:${statusColor}">${n.negocio_status}</span>
            </div>`;
          }).join('');
        }
        negList.classList.add('open');
      }, 300);
    });
    negList?.addEventListener('click', e => {
      const item = e.target.closest('.cl-ac-item');
      if (!item) return;
      negInput.value = item.dataset.title;
      negId.value    = item.dataset.id;
      negList.classList.remove('open');
    });

    // Fecha o autocomplete ao clicar fora — usa AbortController p/ não acumular
    if (this._acAbort) this._acAbort.abort();
    this._acAbort = new AbortController();
    document.addEventListener('click', e => {
      if (!negInput?.contains(e.target) && !negList?.contains(e.target)) negList?.classList.remove('open');
    }, { signal: this._acAbort.signal });

    // Submit
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      let valid = true;
      const setErr = (id, msg) => {
        const el = document.getElementById(id);
        const inp = document.getElementById(id.replace('-err', ''));
        if (el) el.textContent = msg;
        if (inp) inp.classList.toggle('error', !!msg);
        if (msg) valid = false;
      };
      const nome     = document.getElementById('cl-nome').value.trim();
      const telefone = document.getElementById('cl-telefone').value.trim();
      const negocioId= document.getElementById('cl-negocio-id').value;

      setErr('cl-nome-err',     nome     ? '' : 'Nome é obrigatório');
      setErr('cl-telefone-err', telefone ? '' : 'Telefone é obrigatório');
      const hasContrato = document.getElementById('cl-contrato')?.checked || false;
      if (hasContrato) {
        const duracao = document.getElementById('cl-contrato-duracao').value.trim();
        setErr('cl-contrato-duracao-err', duracao ? '' : 'Duração é obrigatória');
      } else {
        setErr('cl-contrato-duracao-err', '');
      }
      if (!valid) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Salvando…';

      const targetUserId = isAdmin
        ? (document.getElementById('cl-user-select')?.value || userId)
        : userId;

      const payload = {
        cliente_nome:       nome,
        cliente_telefone:   telefone,
        cliente_email:      document.getElementById('cl-email').value.trim()      || null,
        cliente_status:     'Ativado',
        negocio_id:         negocioId ? Number(negocioId) : null,
        user_id:            targetUserId,
        investimento_midia: parseFloat(document.getElementById('cl-midia').value) || 0,
        cliente_contrato:   hasContrato,
        contrato_duracao:   hasContrato ? (parseInt(document.getElementById('cl-contrato-duracao').value, 10) || null) : null,
        segmento:           document.getElementById('cl-segmento').value.trim()   || null,
        contexto_geral:     document.getElementById('cl-contexto').value.trim()   || null,
        descricao_empresa:  document.getElementById('cl-descricao').value.trim()  || null,
      };

      const { error } = await Clientes.create(payload);

      submitBtn.disabled = false;
      submitBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5v14"/></svg> Adicionar Cliente';

      if (error) {
        alert('Erro ao criar cliente: ' + error.message);
        return;
      }
      _close();
      await this.onMount();
    });
  },

  // ─── KPIs ────────────────────────────────────────────────────────────────
  _renderKPIs(ativados, novos, totalMidia, satisfacaoMedia, isAdmin = false) {
    const midiaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMidia);
    const satDisplay = satisfacaoMedia !== '-' ? `${satisfacaoMedia}<span style="font-size:16px;font-weight:600;color:var(--text-secondary)">/10</span>` : '-';
    const adminTag = isAdmin
      ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#1D4ED8;background:#EFF6FF;border:1px solid #BFDBFE;padding:3px 10px;border-radius:20px;letter-spacing:0.3px;">
           🌐 Visão Global — Todos os Gestores
         </span>`
      : '';
    return `
      ${adminTag ? `<div style="display:flex;justify-content:flex-end">${adminTag}</div>` : ''}
      <div class="kpi-row">
        <div class="kpi-card">
          <span class="kpi-label">Clientes Ativados</span>
          <span class="kpi-value">${ativados}</span>
        </div>
        <div class="kpi-card kpi-blue">
          <span class="kpi-label">Em Onboarding</span>
          <span class="kpi-value">${novos}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Investimento Mídia</span>
          <span class="kpi-value" style="font-size:${totalMidia > 999999 ? '18px' : '22px'}">${midiaFmt}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Saúde Média (C/E/P)</span>
          <span class="kpi-value">${satDisplay}</span>
        </div>
      </div>
    `;
  },

  // ─── Seção Onboarding ─────────────────────────────────────────────────────
  _renderOnboardingSection(novos, tasksByNegocio = {}) {
    if (novos.length === 0) return '';

    // Nomes das 5 tarefas reais (a 6ª é o botão Start)
    const TASK_NAMES = [
      'Pegar Acessos',
      'Configurações BM e Páginas',
      'Token do Dashboard',
      'Desenvolvimento de Criativos',
      'Estruturar Campanha e Solicitar Saldo',
    ];

    const _deadline = (criadoEm) => {
      if (!criadoEm) return null;
      const prazoFmt = new Date(criadoEm);
      prazoFmt.setDate(prazoFmt.getDate() + 5);
      const hoje   = new Date();
      const diffMs = new Date(prazoFmt).setHours(0,0,0,0) - new Date(hoje).setHours(0,0,0,0);
      const dias   = Math.round(diffMs / 86400000);
      const label  = prazoFmt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      if (dias < 0)  return { estado: 'atrasado', dias: Math.abs(dias), label };
      if (dias === 0) return { estado: 'hoje',    dias: 0,              label };
      return              { estado: 'ok',         dias,                 label };
    };

    const cards = novos.map(c => {
      const tasks      = tasksByNegocio[c.negocio_id] || [];
      // Ordenar pelas 4 tarefas conhecidas
      const ordered    = TASK_NAMES.map(name => tasks.find(t => t.tarefa_titulo === name) || { tarefa_titulo: name, tarefa_status: false });
      const done       = ordered.filter(t => t.tarefa_status).length;
      const pct        = Math.round((done / TASK_NAMES.length) * 100);
      const allDone    = done === TASK_NAMES.length;
      const dl         = _deadline(c.criado_em);
      const midia      = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(c.investimento_midia || 0));

      const statusBadge = allDone
        ? `<span class="badge badge-green">Pronto p/ ativar ✓</span>`
        : `<span class="badge badge-blue">Em andamento</span>`;

      let deadlineBanner = '';
      if (dl) {
        if (dl.estado === 'atrasado') {
          deadlineBanner = `<div class="ob-deadline ob-deadline--late"><span class="ob-deadline-icon">🚨</span><div class="ob-deadline-text"><strong>Onboarding atrasado!</strong><span>Prazo era ${dl.label} · ${dl.dias} dia${dl.dias > 1 ? 's' : ''} em atraso</span></div></div>`;
        } else if (dl.estado === 'hoje') {
          deadlineBanner = `<div class="ob-deadline ob-deadline--today"><span class="ob-deadline-icon">⚡</span><div class="ob-deadline-text"><strong>Prazo finaliza hoje!</strong><span>Conclua as configurações até o fim do dia</span></div></div>`;
        } else {
          deadlineBanner = `<div class="ob-deadline ob-deadline--ok"><span class="ob-deadline-icon">📅</span><div class="ob-deadline-text"><strong>Prazo: ${dl.label}</strong><span>${dl.dias} dia${dl.dias > 1 ? 's' : ''} restante${dl.dias > 1 ? 's' : ''} para ativar</span></div></div>`;
        }
      }

      const tasksHtml = ordered.map(t => `
        <div class="task-row ${t.tarefa_status ? 'done' : ''}" data-tarefa-id="${t.tarefa_id || ''}" data-cliente-id="${c.cliente_id}" data-negocio-id="${c.negocio_id}">
          <div class="task-check ${t.tarefa_status ? 'done' : ''}">
            <svg viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3"/></svg>
          </div>
          <span class="task-label">${t.tarefa_titulo}</span>
        </div>`).join('');

      const startBtn = `
        <button class="ob-start-btn ${allDone ? 'ready' : 'disabled'}"
                data-cliente-id="${c.cliente_id}"
                ${allDone ? '' : 'disabled title="Conclua todas as tarefas primeiro"'}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          ${allDone ? 'Confirmar Start — Ativar Cliente' : 'Start (Ativação) — Conclua as tarefas acima'}
        </button>`;

      return `
        <div class="ob-card ${dl?.estado === 'atrasado' ? 'ob-card--late' : dl?.estado === 'hoje' ? 'ob-card--today' : ''}" id="ob-card-${c.cliente_id}">
          <div class="ob-header">
            <div class="client-info">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="client-name">${c.cliente_nome}</span>
                <button type="button" class="ob-info-btn" data-cliente-id="${c.cliente_id}" title="Ver informações do cliente">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </button>
              </div>
              <span class="client-meta">${c.cliente_email || ''} ${c.segmento ? '· ' + c.segmento : ''}</span>
            </div>
            ${statusBadge}
          </div>
          ${deadlineBanner}
          <div class="ob-progress">
            <div class="ob-progress-labels">
              <span>Progresso do setup</span>
              <span>${done}/${TASK_NAMES.length} tarefas · ${midia}</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${allDone ? 'complete' : ''}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="ob-tasks" id="ob-tasks-${c.cliente_id}">${tasksHtml}</div>
          ${startBtn}
        </div>`;
    }).join('');

    return `
      <section>
        <div class="section-heading">
          <div class="section-heading-left">
            <div class="section-dot blue"></div>
            <span class="section-title">Novos Clientes — Onboarding</span>
            <span class="section-count">${novos.length}</span>
          </div>
        </div>
        <div class="onboarding-grid">${cards}</div>
      </section>`;
  },

  // ─── Bind eventos de onboarding ──────────────────────────────────────────
  _bindOnboardingEvents(novos) {
    // Delegação em todo o container
    document.getElementById('clientes-page')?.addEventListener('click', async (e) => {

      // ── Botão Abrir Gaveta do Cliente ───────────────────────────────────
      const infoBtn = e.target.closest('.ob-info-btn');
      if (infoBtn) {
        const clienteId = Number(infoBtn.dataset.clienteId);
        const c = _todosClientes.find(x => x.cliente_id === clienteId);
        if (c) this._openClientDrawer(c);
        return;
      }

      // ── Checkbox de tarefa ──────────────────────────────────────────────
      const taskRow = e.target.closest('.task-row[data-tarefa-id]');
      if (taskRow && !taskRow.classList.contains('done')) {
        const tarefaId  = Number(taskRow.dataset.tarefaId);
        const clienteId = Number(taskRow.dataset.clienteId);
        if (!tarefaId) return;

        // Feedback visual imediato
        taskRow.classList.add('done');
        taskRow.querySelector('.task-check')?.classList.add('done');

        await Tarefas.concluir(tarefaId);

        // Verificar se todas as 4 tarefas do card estão concluídas
        const card       = document.getElementById(`ob-card-${clienteId}`);
        const allRows    = card?.querySelectorAll('.task-row');
        const allDoneNow = allRows && [...allRows].every(r => r.classList.contains('done'));

        if (allDoneNow) {
          // Atualizar barra de progresso para 100%
          card.querySelector('.progress-bar-fill')?.style.setProperty('width', '100%');
          card.querySelector('.progress-bar-fill')?.classList.add('complete');
          card.querySelector('.ob-progress-labels span:last-child').textContent = `${allRows.length}/${allRows.length} tarefas`;
          // Habilitar botão Start
          const btn = card.querySelector('.ob-start-btn');
          if (btn) {
            btn.classList.remove('disabled');
            btn.classList.add('ready');
            btn.removeAttribute('disabled');
            btn.removeAttribute('title');
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Confirmar Start — Ativar Cliente`;
          }
          // Atualizar badge do card
          card.querySelector('.badge')?.outerHTML;
          const badge = card.querySelector('.ob-header .badge');
          if (badge) { badge.className = 'badge badge-green'; badge.textContent = 'Pronto p/ ativar ✓'; }
        }
        return;
      }

      // ── Botão Start ────────────────────────────────────────────────────
      const startBtn = e.target.closest('.ob-start-btn.ready');
      if (startBtn) {
        const clienteId = Number(startBtn.dataset.clienteId);
        startBtn.disabled = true;
        startBtn.textContent = 'Ativando...';

        const { error } = await Clientes.ativar(clienteId);
        if (error) {
          startBtn.disabled = false;
          startBtn.textContent = 'Erro! Tente novamente';
          return;
        }

        // Recarregar a página de clientes
        await this.onMount();
      }
    });
  },

  // \u2500\u2500\u2500 Cards \u2014 se\u00e7\u00e3o Ativados \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  _renderCardsSection(data, page = 1, sort = { col: 'cliente_nome', dir: 'asc' }, resumoFat = {}, resumoCt = {}) {
    const SORT_OPTS = [
      { v: 'cliente_nome',        l: 'Nome' },
      { v: 'segmento',            l: 'Segmento' },
      { v: 'investimento_midia',  l: 'Inv. M\u00eddia' },
      { v: '_score',              l: 'Score' },
      { v: 'cliente_satisfacao',  l: 'Satisfa\u00e7\u00e3o' },
      { v: 'cliente_risco_churn', l: 'Risco Churn' },
    ];
    const riscoOrder = { 'Baixo': 1, 'Medio': 2, 'Alto': 3 };
    const sortedData = [...data].sort((a, b) => {
      let va, vb;
      if (sort.col === '_score') {
        const sc = c => { const n = [c.nota_comunicacao, c.nota_entrega, c.nota_performance].map(parseFloat); return n.every(v => !isNaN(v)) ? (n[0]+n[1]+n[2])/3 : -1; };
        va = sc(a); vb = sc(b);
      } else if (sort.col === 'cliente_risco_churn') {
        va = riscoOrder[a[sort.col]] ?? 0; vb = riscoOrder[b[sort.col]] ?? 0;
      } else if (sort.col === 'investimento_midia') {
        va = parseFloat(a[sort.col]) || 0; vb = parseFloat(b[sort.col]) || 0;
      } else {
        va = (a[sort.col] ?? '').toString().toLowerCase();
        vb = (b[sort.col] ?? '').toString().toLowerCase();
      }
      const cmp = typeof va === 'number' ? va - vb : va.localeCompare(vb, 'pt-BR');
      return sort.dir === 'asc' ? cmp : -cmp;
    });

    const PER_PAGE   = 12;
    const totalPages = Math.max(1, Math.ceil(sortedData.length / PER_PAGE));
    const safePage   = Math.min(Math.max(1, page), totalPages);
    const pageData   = sortedData.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
    const start      = sortedData.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
    const end        = Math.min(safePage * PER_PAGE, sortedData.length);

    const initials = nome => (nome || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

    const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits: 0 }).format(parseFloat(v || 0));

    const campanhaMap = { 'Campanha Ativa':'badge-gray', 'Pausado':'badge-gray', 'Otimizar':'badge-gray', 'Sem Saldo':'badge-red' };
    const satMap      = { 'Satisfeito':'badge-gray', 'Neutro':'badge-gray', 'Insatisfeito':'badge-red' };
    const riscoMap    = { 'Baixo':'badge-gray', 'Medio':'badge-gray', 'Alto':'badge-red' };

    const cardsHtml = pageData.map(c => {
      const nc = parseFloat(c.nota_comunicacao), ne = parseFloat(c.nota_entrega), np = parseFloat(c.nota_performance);
      const hasScore = !isNaN(nc) && !isNaN(ne) && !isNaN(np);
      const scoreVal = hasScore ? ((nc+ne+np)/3) : null;
      const scoreStr = scoreVal !== null ? scoreVal.toFixed(1) : '—';
      const scoreClass = scoreVal === null ? 'score-none' : scoreVal >= 7 ? 'score-high' : scoreVal >= 5 ? 'score-mid' : 'score-low';

      const fatTotal = resumoFat[c.cliente_id] ?? null;
      const fatStr   = fatTotal !== null ? fmtBRL(fatTotal) : '—';

      const ct = resumoCt[c.cliente_id] || { reuniaoMes: 0, contatoSemana: 0 };
      const ctClass = ct.contatoSemana >= 3 ? 'ct-meta-ok' : ct.contatoSemana > 0 ? 'ct-meta-parcial' : 'ct-meta-zero';
      const rnClass = ct.reuniaoMes   >= 1 ? 'ct-meta-ok' : 'ct-meta-zero';

      const badges = [
        c.cliente_campanha_status
          ? `<span class="badge ${c.cliente_campanha_status === 'Sem Saldo' ? 'badge-sem-saldo' : (campanhaMap[c.cliente_campanha_status]||'badge-gray')}" style="font-size:11px">${c.cliente_campanha_status}</span>`
          : '',
        c.cliente_satisfacao
          ? `<span class="badge ${c.cliente_satisfacao === 'Insatisfeito' ? 'badge-sem-saldo' : (satMap[c.cliente_satisfacao]||'badge-gray')}" style="font-size:11px">${c.cliente_satisfacao}</span>`
          : '',
        c.cliente_risco_churn     ? `<span class="badge ${riscoMap[c.cliente_risco_churn]||'badge-gray'}" style="font-size:11px">${c.cliente_risco_churn}</span>` : '',
        c.cliente_otimizacao      ? `<span class="badge badge-gray" style="font-size:11px">Otimizado</span>` : '',
      ].filter(Boolean).join('');

      let npsExpired = false;
      if (c.data_envio_nps) {
        const diffDays = Math.floor((new Date() - new Date(c.data_envio_nps)) / 86400000);
        if (diffDays > 30) npsExpired = true;
      } else {
        npsExpired = true;
      }

      return `
        <div class="cliente-card${npsExpired ? ' cliente-card--nps' : ''}" data-cliente-id="${c.cliente_id}">
          <div class="card-header">
            <div class="card-avatar" style="background:var(--cyan)">${initials(c.cliente_nome)}</div>
            <div class="card-identity">
              <div class="card-nome">${c.cliente_nome}</div>
              <div class="card-meta">${[c.segmento, c.cliente_email].filter(Boolean).join(' \u00b7') || '\u2014'}</div>
            </div>
          </div>
          ${badges ? `<div class="card-badges">${badges}</div>` : ''}
          <div class="card-metrics">
            <div class="card-metric-item">
              <span class="card-metric-value">${fmtBRL(c.investimento_midia)}</span>
              <span class="card-metric-label">Inv. M\u00eddia</span>
            </div>
            <div class="card-metric-divider"></div>
            <div class="card-metric-item">
              <span class="card-metric-value">${fatStr}</span>
              <span class="card-metric-label">Fat. Total</span>
            </div>
            <div class="card-metric-divider"></div>
            <div class="card-metric-item">
              <span class="score-badge ${scoreClass}" style="font-size:14px">${scoreStr}</span>
              <span class="card-metric-label">Score</span>
            </div>
          </div>
          <div class="card-goals">
            <span class="ct-meta-badge ${ctClass}" title="${ct.contatoSemana}/3 contatos esta semana">
              \ud83d\udcde ${ct.contatoSemana}<span class="ct-meta-goal">/3</span>
            </span>
            <span class="ct-meta-badge ${rnClass}" title="${ct.reuniaoMes}/1 reuni\u00e3o este m\u00eas">
              \ud83e\udd1d ${ct.reuniaoMes}<span class="ct-meta-goal">/1</span>
            </span>
          </div>
          ${npsExpired ? `<div class="card-nps-flag">\ud83d\udd34 NPS Pendente</div>` : ''}
        </div>`;
    }).join('');

    // Toolbar de ordena\u00e7\u00e3o
    const sortOptsHtml = SORT_OPTS.map(o =>
      `<option value="${o.v}" ${sort.col === o.v ? 'selected' : ''}>${o.l}</option>`
    ).join('');
    const dirIcon = sort.dir === 'asc' ? '\u2191' : '\u2193';

    // Pagina\u00e7\u00e3o
    const _pgBtn = (p, label, isActive = false, disabled = false) =>
      `<button class="pg-btn${isActive?' active':''}" data-section="ativados" data-page="${p}" ${disabled?'disabled':''}>${label}</button>`;
    const buildPages = () => {
      if (totalPages <= 1) return '';
      const btns = [_pgBtn(safePage - 1, '&#8592;', false, safePage === 1)];
      const range = [];
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= safePage - 1 && i <= safePage + 1)) range.push(i);
      }
      let prev = 0;
      range.forEach(i => {
        if (prev && i - prev > 1) btns.push(`<span class="pg-dots">\u2026</span>`);
        btns.push(_pgBtn(i, i, i === safePage));
        prev = i;
      });
      btns.push(_pgBtn(safePage + 1, '&#8594;', false, safePage === totalPages));
      return `<div class="pg-controls">${btns.join('')}</div>`;
    };
    const paginationHtml = sortedData.length > PER_PAGE ? `
      <div class="pg-bar">
        <span class="pg-info">${start}\u2013${end} de ${sortedData.length} clientes</span>
        ${buildPages()}
      </div>` : '';

    const emptyHtml = `<div class="section-empty">📄 Nenhum cliente ativado encontrado.</div>`;

    const fmtData = iso => {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
    };

    const listRowsHtml = pageData.map(c => {
      const nc = parseFloat(c.nota_comunicacao), ne = parseFloat(c.nota_entrega), np = parseFloat(c.nota_performance);
      const hasScore = !isNaN(nc) && !isNaN(ne) && !isNaN(np);
      const scoreVal = hasScore ? ((nc+ne+np)/3) : null;
      const scoreStr = scoreVal !== null ? scoreVal.toFixed(1) : '—';
      const scoreClass = scoreVal === null ? 'score-none' : scoreVal >= 7 ? 'score-high' : scoreVal >= 5 ? 'score-mid' : 'score-low';

      const fatTotal = resumoFat[c.cliente_id] ?? null;
      const fatStr   = fatTotal !== null ? fmtBRL(fatTotal) : '—';

      const ct = resumoCt[c.cliente_id] || { reuniaoMes: 0, contatoSemana: 0 };

      // Indicador de meta: cor por atingimento
      const ctClass  = ct.contatoSemana >= 3 ? 'ct-meta-ok' : ct.contatoSemana > 0 ? 'ct-meta-parcial' : 'ct-meta-zero';
      const rnClass  = ct.reuniaoMes   >= 1 ? 'ct-meta-ok' : 'ct-meta-zero';
      const ctTip    = `${ct.contatoSemana}/3 contatos esta semana`;
      const rnTip    = `${ct.reuniaoMes}/1 reunião este mês`;

      return `
        <tr data-cliente-id="${c.cliente_id}">
          <td>
            <div class="cl-list-name-cell">
              <div class="cl-list-avatar">${initials(c.cliente_nome)}</div>
              <div>
                <div class="cl-list-name">${c.cliente_nome}</div>
                <div class="cl-list-seg">${c.cliente_email || '—'}</div>
              </div>
            </div>
          </td>
          <td>${c.segmento || '—'}</td>
          <td>${fmtBRL(c.investimento_midia)}</td>
          <td><span class="score-badge ${scoreClass}">${scoreStr}</span></td>
          <td>${c.cliente_satisfacao
            ? `<span class="badge ${c.cliente_satisfacao === 'Insatisfeito' ? 'badge-sem-saldo' : (satMap[c.cliente_satisfacao]||'badge-gray')}">${c.cliente_satisfacao}</span>`
            : '—'}</td>
          <td>${c.cliente_campanha_status
            ? `<span class="badge ${c.cliente_campanha_status === 'Sem Saldo' ? 'badge-sem-saldo' : (campanhaMap[c.cliente_campanha_status]||'badge-gray')}">${c.cliente_campanha_status}</span>`
            : '—'}</td>
          <td>${c.cliente_risco_churn ? `<span class="badge ${riscoMap[c.cliente_risco_churn]||'badge-gray'}">${c.cliente_risco_churn}</span>` : '—'}</td>
          <td class="cl-td-fat">${fatStr}</td>
          <td class="cl-td-ct" title="${ctTip}"><span class="ct-meta-badge ${ctClass}">📞 ${ct.contatoSemana}<span class="ct-meta-goal">/3</span></span></td>
          <td class="cl-td-ct" title="${rnTip}"><span class="ct-meta-badge ${rnClass}">🤝 ${ct.reuniaoMes}<span class="ct-meta-goal">/1</span></span></td>
        </tr>`;
    }).join('');

    const listSortTh = (col, label) => {
      const isActive = sort.col === col;
      const arrow = isActive ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
      return `<th data-sort-col="${col}" data-section="ativados" class="${isActive ? 'sort-active' : ''}">${label}<span class="sort-icon">${arrow || '↕'}</span></th>`;
    };

    const listTableHtml = `
      <div class="cl-list-wrap">
        <table class="cl-list-table">
          <thead>
            <tr>
              ${listSortTh('cliente_nome', 'Cliente')}
              ${listSortTh('segmento', 'Segmento')}
              ${listSortTh('investimento_midia', 'Inv. Mídia')}
              ${listSortTh('_score', 'Score')}
              ${listSortTh('cliente_satisfacao', 'Satisfação')}
              ${listSortTh('cliente_campanha_status', 'Campanha')}
              ${listSortTh('cliente_risco_churn', 'Churn')}
              <th>Fat. Total</th>
              <th title="Meta: 3 contatos por semana">Contato/sem</th>
              <th title="Meta: 1 reunião por mês">Reunião/mês</th>
            </tr>
          </thead>
          <tbody>${listRowsHtml}</tbody>
        </table>
      </div>`;

    return `
      <section>
        <div class="section-heading">
          <div class="section-heading-left">
            <div class="section-dot green"></div>
            <span class="section-title">Ativados</span>
            <span class="section-count">${data.length}</span>
          </div>
          ${data.length > 0 ? `
          <div class="view-toggle-group">
            <button class="view-toggle-btn ${_viewModeAtivados === 'cards' ? 'active' : ''}" id="view-toggle-cards" title="Visualização em Cards">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Cards
            </button>
            <button class="view-toggle-btn ${_viewModeAtivados === 'list' ? 'active' : ''}" id="view-toggle-list" title="Visualização em Lista">
              <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Lista
            </button>
          </div>` : ''}
        </div>
        ${data.length === 0 ? emptyHtml : `
          <div class="cards-toolbar">
            <div class="cards-sort-wrap">
              <span class="cards-sort-label">Ordenar por:</span>
              <select id="cards-sort-select" class="cards-sort-select">${sortOptsHtml}</select>
              <button id="cards-sort-dir" class="cards-sort-dir" title="${sort.dir === 'asc' ? 'Crescente' : 'Decrescente'}">${dirIcon}</button>
            </div>
          </div>
          ${_viewModeAtivados === 'cards'
            ? `<div class="cliente-cards-grid">${cardsHtml}</div>`
            : listTableHtml
          }
          ${paginationHtml}
        `}
      </section>`;
  },

  _renderTableSection(title, dotColor, data, hideIfEmpty = false, page = 1, sectionId = '', sort = { col: 'cliente_nome', dir: 'asc' }) {
    if (hideIfEmpty && data.length === 0) return '';

    // ── Ordenar dados ─────────────────────────────────────────────────
    const riscoOrder = { 'Baixo': 1, 'Medio': 2, 'Alto': 3 };
    const sortedData = [...data].sort((a, b) => {
      let va, vb;
      if (sort.col === '_score') {
        const sc = c => { const n = [c.nota_comunicacao, c.nota_entrega, c.nota_performance].map(parseFloat); return n.every(v => !isNaN(v)) ? (n[0]+n[1]+n[2])/3 : -1; };
        va = sc(a); vb = sc(b);
      } else if (sort.col === 'cliente_risco_churn') {
        va = riscoOrder[a[sort.col]] ?? 0;
        vb = riscoOrder[b[sort.col]] ?? 0;
      } else if (sort.col === 'investimento_midia') {
        va = parseFloat(a[sort.col]) || 0;
        vb = parseFloat(b[sort.col]) || 0;
      } else if (sort.col === 'receita_perdida') {
        va = parseFloat(a[sort.col]) || 0;
        vb = parseFloat(b[sort.col]) || 0;
      } else if (sort.col === 'data_churn') {
        va = a[sort.col] ? new Date(a[sort.col]).getTime() : 0;
        vb = b[sort.col] ? new Date(b[sort.col]).getTime() : 0;
      } else if (sort.col === 'cliente_otimizacao') {
        va = a[sort.col] ? 1 : 0;
        vb = b[sort.col] ? 1 : 0;
      } else {
        va = (a[sort.col] ?? '').toString().toLowerCase();
        vb = (b[sort.col] ?? '').toString().toLowerCase();
      }
      const cmp = typeof va === 'number' ? va - vb : va.localeCompare(vb, 'pt-BR');
      return sort.dir === 'asc' ? cmp : -cmp;
    });

    const PER_PAGE   = 12;
    const totalPages = Math.max(1, Math.ceil(sortedData.length / PER_PAGE));
    const safePage   = Math.min(Math.max(1, page), totalPages);
    const pageData   = sortedData.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
    const start      = sortedData.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
    const end        = Math.min(safePage * PER_PAGE, sortedData.length);

    const emptyHtml  = `<div class="section-empty">Nenhum cliente ${title.toLowerCase()} encontrado.</div>`;

    // ── Helper para th ordinável ────────────────────────────────────────────────
    const th = (label, col, extra = '') => {
      const active = sort.col === col;
      const icon   = active ? (sort.dir === 'asc' ? '↑' : '↓') : '⇅';
      return `<th class="${active ? 'sort-active' : ''}" data-sort-col="${col}" data-section="${sectionId}" ${extra}>
        ${label}<span class="sort-icon">${icon}</span>
      </th>`;
    };


    const tbodyHtml = pageData.map(c => {
      // 1. Status da Campanha
      const campanha = c.cliente_campanha_status || null;
      let campanhaHtml = '<span style="color:var(--text-muted);font-size:13px">—</span>';
      if (campanha) {
        const campanhaMap = { 'Campanha Ativa':'badge-gray', 'Pausado':'badge-gray', 'Otimizar':'badge-gray', 'Sem Saldo':'badge-red' };
        campanhaHtml = `<span class="badge ${campanha === 'Sem Saldo' ? 'badge-sem-saldo' : (campanhaMap[campanha]||'badge-gray')}">${campanha}</span>`;
      }
      // 2. Otimização
      const otimHtml = c.cliente_otimizacao
        ? `<span class="badge badge-gray">Otimizado</span>`
        : `<span class="badge badge-sem-saldo">Pendente</span>`;
      // 3. Satisfação
      const satMap  = { 'Satisfeito':'badge-gray', 'Neutro':'badge-gray', 'Insatisfeito':'badge-red' };
      const satHtml = c.cliente_satisfacao
        ? `<span class="badge ${c.cliente_satisfacao === 'Insatisfeito' ? 'badge-sem-saldo' : (satMap[c.cliente_satisfacao]||'badge-gray')}">${c.cliente_satisfacao}</span>`
        : `<span style="color:var(--text-muted);font-size:13px">—</span>`;
      // 4. Risco Churn
      const riscoMap  = { 'Baixo':'badge-gray', 'Medio':'badge-gray', 'Alto':'badge-red' };
      const riscoHtml = c.cliente_risco_churn
        ? `<span class="badge ${riscoMap[c.cliente_risco_churn]||'badge-gray'}">${c.cliente_risco_churn}</span>`
        : `<span style="color:var(--text-muted);font-size:13px">—</span>`;
      // 5. Investimento
      const midia = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(parseFloat(c.investimento_midia||0));
      // 6. Score
      const nc = parseFloat(c.nota_comunicacao), ne = parseFloat(c.nota_entrega), np = parseFloat(c.nota_performance);
      const hasScore  = !isNaN(nc) && !isNaN(ne) && !isNaN(np);
      const scoreVal  = hasScore ? (nc+ne+np)/3 : null;
      const scoreStr  = scoreVal !== null ? scoreVal.toFixed(1) : null;
      const scoreClass= scoreVal===null?'score-none':scoreVal>=7?'score-high':scoreVal>=5?'score-mid':'score-low';
      const scoreHtml = `
        <div class="score-cell">
          <span class="score-badge ${scoreClass}">${scoreStr!==null?scoreStr:'—'}</span>
          <div class="score-tooltip">
            Média de 3 pilares de saúde do cliente:<br>
            📢 Comunicação: ${!isNaN(nc)?nc.toFixed(1):'—'}<br>
            📦 Entrega: ${!isNaN(ne)?ne.toFixed(1):'—'}<br>
            📈 Performance: ${!isNaN(np)?np.toFixed(1):'—'}
          </div>
        </div>`;

      return `
        <tr data-cliente-id="${c.cliente_id}">
          <td><div class="client-info"><span class="client-name">${c.cliente_nome}</span><span class="client-meta">${c.cliente_email||''} ${c.segmento?'· '+c.segmento:''}</span></div></td>
          <td>${scoreHtml}</td>
          <td style="font-weight:700">${midia}</td>
          <td style="color:var(--text-secondary);font-size:13px">${c.data_churn ? new Date(c.data_churn).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}) : '—'}</td>
          <td style="font-weight:700;color:${c.receita_perdida ? '#b91c1c' : 'var(--text-muted)'}">${c.receita_perdida ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(c.receita_perdida) : '—'}</td>
          <td style="font-size:13px;color:var(--text-secondary);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${c.motivo_churn||''}">${c.motivo_churn || '—'}</td>
        </tr>`;
    }).join('');

    // Controles de paginação
    const _pgBtn = (p, label, isActive = false, disabled = false) =>
      `<button class="pg-btn${isActive?' active':''}" data-section="${sectionId}" data-page="${p}" ${disabled?'disabled':''}>${label}</button>`;

    const buildPages = () => {
      if (totalPages <= 1) return '';
      const btns = [];
      btns.push(_pgBtn(safePage - 1, '&#8592;', false, safePage === 1));
      const range = [];
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= safePage - 1 && i <= safePage + 1)) range.push(i);
      }
      let prev = 0;
      range.forEach(i => {
        if (prev && i - prev > 1) btns.push(`<span class="pg-dots">…</span>`);
        btns.push(_pgBtn(i, i, i === safePage));
        prev = i;
      });
      btns.push(_pgBtn(safePage + 1, '&#8594;', false, safePage === totalPages));
      return `<div class="pg-controls">${btns.join('')}</div>`;
    };

    const paginationHtml = data.length > PER_PAGE ? `
      <div class="pg-bar">
        <span class="pg-info">${start}–${end} de ${data.length} clientes</span>
        ${buildPages()}
      </div>` : '';

    // Bind do drawer de detalhes agora é tratado via delegação no contêiner da página

    return `
      <section>
        <div class="section-heading">
          <div class="section-heading-left">
            <div class="section-dot ${dotColor}"></div>
            <span class="section-title">${title}</span>
            <span class="section-count">${data.length}</span>
          </div>
        </div>
        ${data.length === 0 ? emptyHtml : `
          <div class="table-wrap">
            <table class="clientes-table">
              <thead>
                <tr>
                  ${th('Cliente', 'cliente_nome')}
                  ${th('Score ⓘ', '_score', 'title="Média de Comunicação, Entrega e Performance (0–10)" style="cursor:pointer"')}
                  ${th('Inv. Mensal', 'investimento_midia')}
                  ${th('Data do Churn', 'data_churn')}
                  ${th('Receita Perdida', 'receita_perdida')}
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>${tbodyHtml}</tbody>
            </table>
          </div>
          ${paginationHtml}`}
      </section>`;
  },

  onDestroy() {
    _todosClientes  = [];
    _tasksByNegocio = {};
    _usuarios       = [];
    _filtroUserId   = '';
    _paginaAtivados = 1;
    _paginaDesativ  = 1;
    _sortAtivados   = { col: 'cliente_nome', dir: 'asc' };
    _sortDesativ    = { col: 'cliente_nome', dir: 'asc' };
    _isAdmin        = false;
    _clienteAtivo   = null;
    this._modalBound = false;
    this._drawerEventsBound = false;
    if (this._acAbort) {
      this._acAbort.abort();
      this._acAbort = null;
    }
  },

  _bindDrawerEvents() {
    const btnChurn      = document.getElementById('cd-btn-churn');
    const btnDelete     = document.getElementById('cd-btn-delete');
    const churnOverlay  = document.getElementById('churn-overlay');
    const churnModal    = document.getElementById('churn-modal');
    const churnCancel   = document.getElementById('churn-cancel');
    const churnConfirm  = document.getElementById('churn-confirm');
    const churnDataInp  = document.getElementById('churn-data');
    const churnRecInp   = document.getElementById('churn-receita');
    const churnMotivoInp  = document.getElementById('churn-motivo');
    const churnCharCount  = document.getElementById('churn-char-count');
    const closeBtn      = document.getElementById('cd-close');
    const overlay       = document.getElementById('cd-overlay');

    const closeDrawer = () => {
      document.getElementById('cd-drawer')?.classList.remove('open');
      document.getElementById('cd-overlay')?.classList.remove('open');
      window.location.hash = 'clientes';
      _clienteAtivo = null;
    };
    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);

    const _updateChurnCount = () => {
      if (!churnMotivoInp || !churnCharCount) return;
      const remaining = 120 - churnMotivoInp.value.length;
      churnCharCount.textContent = `${remaining} caractere${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`;
      churnCharCount.classList.toggle('warn',   remaining <= 30 && remaining > 10);
      churnCharCount.classList.toggle('danger', remaining <= 10);
    };
    churnMotivoInp?.addEventListener('input', _updateChurnCount);

    const openChurn = () => {
      if (!_clienteAtivo) return;
      churnDataInp.value   = new Date().toISOString().split('T')[0];
      churnRecInp.value    = '';
      if (churnMotivoInp) churnMotivoInp.value = '';
      _updateChurnCount();
      churnOverlay.classList.add('open');
      churnModal.classList.add('open');
      churnDataInp.focus();
    };
    const closeChurn = () => {
      churnOverlay.classList.remove('open');
      churnModal.classList.remove('open');
    };

    churnRecInp?.addEventListener('input', () => {
      let v = churnRecInp.value.replace(/\D/g, '');
      if (!v) { churnRecInp.value = ''; return; }
      v = (parseInt(v, 10) / 100).toFixed(2);
      churnRecInp.value = parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    btnChurn?.addEventListener('click', openChurn);
    churnCancel?.addEventListener('click', closeChurn);
    churnOverlay?.addEventListener('click', closeChurn);

    churnConfirm?.addEventListener('click', async () => {
      if (!_clienteAtivo) return;
      const dataVal = churnDataInp.value;
      if (!dataVal) { churnDataInp.focus(); return; }

      const recStr  = churnRecInp.value.replace(/\./g, '').replace(',', '.');
      const recVal  = parseFloat(recStr) || null;
      const motivoVal = churnMotivoInp?.value.trim() || null;

      churnConfirm.disabled = true;
      churnConfirm.textContent = 'Salvando…';

      const { error } = await Clientes.registrarChurn(_clienteAtivo.cliente_id, dataVal, recVal, motivoVal);
      if (error) {
        churnConfirm.disabled = false;
        churnConfirm.textContent = 'Confirmar Churn';
        alert('Erro ao registrar o churn. Tente novamente.');
        return;
      }

      const idx = _todosClientes.findIndex(x => x.cliente_id === _clienteAtivo.cliente_id);
      if (idx !== -1) {
        _todosClientes[idx] = {
          ..._todosClientes[idx],
          cliente_churn:   true,
          data_churn:      dataVal,
          receita_perdida: recVal,
          motivo_churn:    motivoVal,
          cliente_status:  'Desativado',
        };
      }

      closeChurn();
      document.getElementById('cd-drawer')?.classList.remove('open');
      document.getElementById('cd-overlay')?.classList.remove('open');
      window.location.hash = 'clientes';
      this._renderPage(_isAdmin);
    });

    btnDelete?.addEventListener('click', async () => {
      if (!_clienteAtivo) return;
      const nome = _clienteAtivo.cliente_nome || 'este cliente';
      const confirmado = confirm(`Tem certeza que deseja excluir "${nome}" permanentemente?\n\nEsta ação não pode ser desfeita.`);
      if (!confirmado) return;

      btnDelete.disabled = true;
      const { error } = await Clientes.delete(_clienteAtivo.cliente_id);

      if (error) {
        btnDelete.disabled = false;
        alert('Erro ao excluir o cliente: ' + error.message);
        return;
      }

      _todosClientes = _todosClientes.filter(x => x.cliente_id !== _clienteAtivo.cliente_id);
      document.getElementById('cd-drawer')?.classList.remove('open');
      document.getElementById('cd-overlay')?.classList.remove('open');
      window.location.hash = 'clientes';
      this._renderPage(_isAdmin);
    });

    document.getElementById('cd-tabs')?.querySelectorAll('.cd-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.cd-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.cd-tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`)?.classList.add('active');
      });
    });
  },

  // ─── Drawer de Detalhes/Edição do Cliente ─────────────────────────────────────────────
  async _openClientDrawer(c) {
    _clienteAtivo = c;

    // Reset tabs UI to 'geral' on open
    document.getElementById('cd-tabs')?.querySelectorAll('.cd-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === 'geral');
    });

    // Re-enable persistent buttons that might have been disabled in previous drawer operations
    const btnDelete = document.getElementById('cd-btn-delete');
    if (btnDelete) btnDelete.disabled = false;
    const churnConfirm = document.getElementById('churn-confirm');
    if (churnConfirm) {
      churnConfirm.disabled = false;
      churnConfirm.textContent = 'Confirmar Churn';
    }

    const fmtDate = v => v ? new Date(v).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const fmtBRL  = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(parseFloat(v||0));
    const statusMap = { 'Ativado':'badge-green', 'Novo Cliente':'badge-blue', 'Desativado':'badge-red' };
    const satMap    = { 'Satisfeito':'badge-gray', 'Neutro':'badge-gray', 'Insatisfeito':'badge-red' };
    const riscoMap  = { 'Baixo':'badge-gray', 'Medio':'badge-gray', 'Alto':'badge-red' };
    const campMap   = { 'Campanha Ativa':'badge-gray', 'Pausado':'badge-gray', 'Otimizar':'badge-gray', 'Sem Saldo':'badge-red' };
    const badge     = (v, map) => v ? `<span class="badge ${map[v]||'badge-gray'}" style="font-size:12px">${v}</span>` : '<span class="cd-info-value empty">—</span>';
    const fv        = v => `<span class="cd-info-value ${!v ? 'empty' : ''}">${v || '—'}</span>`;

    const inp = (id, val, type='text', ph='') => `<input id="${id}" class="cl-input" type="${type}" value="${val||''}" placeholder="${ph}" style="font-size:13px;padding:7px 10px;width:100%">`;
    const sel = (id, opts, val) => `<select id="${id}" class="cl-select" style="font-size:13px;padding:7px 10px;width:100%">${opts.map(o=>`<option value="${o.v}" ${o.v==val?'selected':''}>${o.l}</option>`).join('')}</select>`;
    const ta  = (id, val, ph='') => `<textarea id="${id}" class="cl-textarea" placeholder="${ph}" style="font-size:13px;min-height:70px;width:100%">${val||''}</textarea>`;

    const nc = parseFloat(c.nota_comunicacao), ne = parseFloat(c.nota_entrega), np = parseFloat(c.nota_performance);
    const hasScore = !isNaN(nc) && !isNaN(ne) && !isNaN(np);
    const scoreAvg = hasScore ? ((nc+ne+np)/3).toFixed(1) : null;

    // Load Reuniões e Feedbacks em paralelo
    const mondayStr = (() => {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0,0,0,0);
      return d.toISOString().split('T')[0];
    })();
    const [{ data: rData }, { data: fData }, { data: fatData }, { data: fcData }, { data: ctData }] = await Promise.all([
      Reunioes.getByClienteId(c.cliente_id),
      ClienteFeedback.getByClienteId(c.cliente_id),
      FaturamentoCliente.getByClienteId(c.cliente_id),
      FeedbackCampanhas.getByClienteId(c.cliente_id),
      ContatoClientes.getByClienteId(c.cliente_id),
    ]);
    const reunioes        = rData   || [];
    const feedbacks       = fData   || [];
    const faturamentos    = fatData || [];
    const fbCampanhas     = fcData  || [];
    const contatos        = ctData  || [];

    const fmtReuniaoData = v => v ? new Date(v).toLocaleString('pt-BR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const reuniaoItemsHtml = reunioes.length === 0
      ? `<div class="rn-empty">📅 Nenhuma reunião registrada ainda.</div>`
      : reunioes.map(r => `
          <div class="rn-item" data-rn-id="${r.reuniao_id}">
            <div class="rn-header">
              <div class="rn-meta">
                <span class="rn-titulo">${r.reuniao_titulo || 'Sem título'}</span>
                <span class="rn-data">📅 ${fmtReuniaoData(r.reuniao_data)}</span>
              </div>
              ${r.reuniao_notas ? '<span class="rn-chevron">▼</span>' : ''}
              <button type="button" class="rn-del" data-rn-del="${r.reuniao_id}" title="Excluir reunião">🗑</button>
            </div>
            ${r.reuniao_notas ? `<div class="rn-notes">${r.reuniao_notas}</div>` : ''}
          </div>`).join('');

    // Feedback helpers
    const HUMOR_EMOJI = { otimo: '😊', neutro: '😐', ruim: '😟', critico: '😡' };
    const _weekInterval = (semana) => {
      const seg = new Date(semana + 'T12:00:00');
      const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
      const fmt = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
      return `${fmt(seg)}–${fmt(dom)}`;
    };
    const _isoWeek = (semana) => {
      const d = new Date(semana + 'T12:00:00');
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const start = new Date(d.getFullYear(), 0, 1);
      return `Semana ${Math.ceil(((d - start) / 86400000 + 1) / 7)}`;
    };
    const _renderFeedbacks = (list) => {
      if (!list.length) return `<div class="fb-empty">📝 Nenhum feedback registrado ainda.</div>`;
      return list.map(f => `
        <div class="fb-item">
          <div class="fb-item-header">
            <div class="fb-item-left">
              <span class="fb-mood-icon">${HUMOR_EMOJI[f.feedback_humor] || '😐'}</span>
              <span class="fb-week-badge">${_isoWeek(f.feedback_semana)}</span>
              <span class="fb-date">${_weekInterval(f.feedback_semana)}</span>
            </div>
          </div>
          <div class="fb-text">${f.feedback_texto}</div>
        </div>`).join('');
    };

    const _initials = nome => (nome || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
    document.getElementById('cd-nome').textContent = c.cliente_nome || '—';
    document.getElementById('cd-sub').textContent  = [c.cliente_email, c.cliente_telefone, c.segmento].filter(Boolean).join(' · ') || '—';
    const avatarEl = document.getElementById('cd-avatar');
    if (avatarEl) avatarEl.textContent = _initials(c.cliente_nome);

    // Mostrar/ocultar botão Churn conforme estado atual do cliente
    const btnChurnHeader = document.getElementById('cd-btn-churn');
    if (btnChurnHeader) btnChurnHeader.style.display = c.cliente_churn ? 'none' : '';

    // Helper para gerar um Card editável
    const renderCard = (id, icon, title, viewHtml, editHtml) => `
      <div class="cd-card" id="card-${id}">
        <div class="cd-card-header">
          <div class="cd-card-title">${icon} ${title}</div>
          ${editHtml ? `<button type="button" class="cd-btn-edit" data-edit-target="${id}">✏️ Editar</button>` : ''}
        </div>
        <div class="cd-view-content" id="view-${id}">
          <div class="cd-info-grid">${viewHtml}</div>
        </div>
        ${editHtml ? `
        <form class="cd-edit-form" id="edit-${id}" data-section="${id}">
          <div class="cd-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-items:start;">${editHtml}</div>
          <div class="cd-form-actions">
            <button type="button" class="cl-btn-cancel-section" data-cancel-target="${id}">Cancelar</button>
            <button type="submit" class="cl-btn-submit">💾 Salvar Alterações</button>
          </div>
        </form>` : ''}
      </div>
    `;

    const vi = (label, value) => `<div class="cd-info-item"><span class="cd-info-label">${label}</span>${value}</div>`;
    const fld = (label, input, full=false) => `<div class="cd-field ${full?'full':''}"><span class="cd-field-label">${label}</span>${input}</div>`;

    // ── Card Informações Principais (visual rico) ─────────────────────────────────────
    const fmtRecontato = v => {
      if (!v) return null;
      return new Date(v).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric', timeZone:'America/Sao_Paulo' });
    };
    const recontVencido = c.data_recontato && new Date(c.data_recontato) < new Date();

    const infoRow = (icon, label, value, valueStyle = '') => value
      ? `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;background:var(--bg);border:1px solid var(--border-light)">
           <span style="font-size:16px;flex-shrink:0">${icon}</span>
           <div style="min-width:0;flex:1">
             <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${label}</div>
             <div style="font-size:13px;font-weight:600;color:var(--black);${valueStyle}white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value}</div>
           </div>
         </div>`
      : '';

    const identificacaoView = `<div style="grid-column:1/-1;display:flex;flex-direction:column;gap:10px">

      <!-- Bloco de identidade -->
      <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--bg);border:1px solid var(--border-light);border-radius:12px">
        <div style="width:56px;height:56px;border-radius:14px;flex-shrink:0;background:linear-gradient(135deg,#06B6D4,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px">
          ${_initials(c.cliente_nome)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:800;color:var(--black);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.cliente_nome || '—'}</div>
          ${c.segmento ? `<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-top:2px">${c.segmento}</div>` : ''}
          ${c.cliente_origem ? `<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-top:1px">📍 ${c.cliente_origem}</div>` : ''}
        </div>
      </div>

      <!-- Campos em grade dinâmica: 2 colunas, sem buracos -->
      ${(() => {
        const rows = [
          c.cliente_telefone ? infoRow('📞', 'Telefone', `<a href="tel:${c.cliente_telefone}" style="color:var(--black);text-decoration:none">${c.cliente_telefone}</a>`) : null,
          c.cliente_email    ? infoRow('✉️',  'E-mail',   `<a href="mailto:${c.cliente_email}" style="color:var(--black);text-decoration:none">${c.cliente_email}</a>`) : null,
          c.data_recontato   ? infoRow('📅', 'Recontato', fmtRecontato(c.data_recontato), recontVencido ? 'color:#dc2626;' : '') : null,
          c.segmento         ? infoRow('🏷️', 'Segmento', c.segmento) : null,
        ].filter(Boolean);
        if (!rows.length) return '';
        // Agrupa em pares
        let html = '<div style="display:flex;flex-direction:column;gap:8px">';
        for (let i = 0; i < rows.length; i += 2) {
          html += '<div style="display:grid;grid-template-columns:' + (rows[i+1] ? '1fr 1fr' : '1fr') + ';gap:8px">';
          html += rows[i];
          if (rows[i+1]) html += rows[i+1];
          html += '</div>';
        }
        html += '</div>';
        return html;
      })()}

      <!-- Financeiro -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="padding:12px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--border-light);display:flex;flex-direction:column;gap:3px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Inv. Mídia</div>
          <div style="font-size:15px;font-weight:800;color:var(--black);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fmtBRL(c.investimento_midia)}</div>
        </div>
        <div style="padding:12px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--border-light);display:flex;flex-direction:column;gap:3px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Contrato</div>
          <div style="font-size:15px;font-weight:800;color:var(--black);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.cliente_contrato ? `${c.contrato_duracao || 0} meses` : 'Sem contrato'}</div>
        </div>
      </div>

    </div>`;

    const cardIdentificacao = renderCard('identificacao', '📋', 'Informações Principais',
      identificacaoView,
      fld('Nome', inp('e-nome',c.cliente_nome,'text','Nome do cliente'), true) +
      fld('Telefone', inp('e-tel',c.cliente_telefone,'text','Telefone')) +
      fld('E-mail', inp('e-email',c.cliente_email,'email','E-mail')) +
      fld('Segmento', inp('e-seg',c.segmento,'text','Segmento')) +
      fld('Inv. Mídia (R$)', inp('e-midia',c.investimento_midia,'number','0'))
    );

    // ── Card Contrato (seção financeira) ─────────────────────────────────────────────
    const contratoView = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;grid-column:1/-1">
        <div style="padding:12px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--border-light);display:flex;flex-direction:column;gap:3px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Possui Contrato?</div>
          <div style="font-size:15px;font-weight:800;color:var(--black)">${c.cliente_contrato ? 'Sim' : 'Não'}</div>
        </div>
        <div style="padding:12px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--border-light);display:flex;flex-direction:column;gap:3px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Duração do Contrato</div>
          <div style="font-size:15px;font-weight:800;color:var(--black)">${c.cliente_contrato ? `${c.contrato_duracao || 0} meses` : '—'}</div>
        </div>
      </div>
    `;

    const cardContrato = renderCard('contrato', '💼', 'Informações de Contrato',
      contratoView,
      fld('Contrato', `<div style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <input type="checkbox" id="e-contrato" ${c.cliente_contrato ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
        <label for="e-contrato" style="font-size:13px;cursor:pointer;user-select:none;color:var(--black)">Possui Contrato</label>
      </div>`, true) +
      `<div id="e-contrato-duracao-wrap" class="cd-field" style="display: ${c.cliente_contrato ? 'block' : 'none'};">
        <span class="cd-field-label">Duração (meses)</span>
        <input id="e-contrato-duracao" class="cl-input" type="number" value="${c.contrato_duracao||''}" placeholder="Ex: 12" style="font-size:13px;padding:7px 10px;width:100%" ${c.cliente_contrato ? 'required' : ''}>
      </div>`
    );

    // ── Card Saúde & Status (visual rico) ────────────────────────────────────────────
    const scoreBar = (val, label) => {
      const num = parseFloat(val);
      if (isNaN(num)) return '';
      const pct = Math.min(100, (num / 10) * 100);
      const color = num >= 7 ? '#22c55e' : num >= 5 ? '#f59e0b' : '#ef4444';
      return `
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">${label}</span>
            <span style="font-size:13px;font-weight:800;color:var(--black)">${num.toFixed(1)}</span>
          </div>
          <div style="height:5px;border-radius:99px;background:var(--border-light);overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width .4s"></div>
          </div>
        </div>`;
    };

    const statusIconMap = {
      'Ativado':      '✅', 'Novo Cliente': '🆕', 'Desativado':   '🔴',
      'Satisfeito':   '😊', 'Neutro':       '😐', 'Insatisfeito': '😟',
      'Baixo':        '🟢', 'Medio':        '🟡', 'Alto':         '🔴',
      'Campanha Ativa': '🟢', 'Pausado': '🟡', 'Otimizar': '🔧', 'Sem Saldo': '🔴',
    };
    const statusLabelMap = { 'Medio': 'Médio' };
    const sIcon = v => statusIconMap[v] ? `${statusIconMap[v]} ${statusLabelMap[v] || v}` : '—';

    const indCell = (label, content) => `
      <div style="background:var(--bg);border:1px solid var(--border-light);border-radius:10px;padding:11px 13px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">${label}</div>
        <div style="font-size:13px;font-weight:600;color:var(--black)">${content}</div>
      </div>`;

    const statusCardView = `<div style="grid-column:1/-1;display:flex;flex-direction:column;gap:12px">
      ${hasScore ? `
      <div style="background:var(--bg);border:1px solid var(--border-light);border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px">Score de Desempenho</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
          ${scoreBar(nc,'Comunicação')}${scoreBar(ne,'Entrega')}${scoreBar(np,'Performance')}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border-light)">
          <span style="font-size:11px;font-weight:600;color:var(--text-muted)">Score Médio</span>
          <span style="font-size:24px;font-weight:900;color:var(--black)">${scoreAvg}</span>
        </div>
      </div>` : `
      <div style="background:var(--bg);border:1px solid var(--border-light);border-radius:10px;padding:14px 16px;color:var(--text-muted);font-size:13px;text-align:center">
        Nenhuma nota de desempenho registrada
      </div>`}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${indCell('Status', sIcon(c.cliente_status))}
        ${indCell('Campanha', sIcon(c.cliente_campanha_status))}
        ${indCell('Satisfação', sIcon(c.cliente_satisfacao))}
        ${indCell('Risco de Churn', sIcon(c.cliente_risco_churn))}
        ${indCell('Otimização', c.cliente_otimizacao ? '✅ Otimizado' : '⚪ Pendente')}
        ${indCell('Origem', c.cliente_origem || '—')}
      </div>
    </div>`;

    const cardStatus = renderCard('status', '🎯', 'Saúde & Status',
      statusCardView,
      fld('Status', sel('e-status',[{v:'Ativado',l:'Ativado'},{v:'Novo Cliente',l:'Novo Cliente'},{v:'Desativado',l:'Desativado'}],c.cliente_status)) +
      fld('Campanha', sel('e-campanha',[{v:'',l:'— Sem status —'},{v:'Campanha Ativa',l:'Campanha Ativa'},{v:'Pausado',l:'Pausado'},{v:'Otimizar',l:'Otimizar'},{v:'Sem Saldo',l:'Sem Saldo'}],c.cliente_campanha_status)) +
      fld('Otimização', sel('e-otim',[{v:'true',l:'Otimizado'},{v:'false',l:'Pendente'}],String(c.cliente_otimizacao))) +
      fld('Satisfação', sel('e-sat',[{v:'',l:'—'},{v:'Satisfeito',l:'Satisfeito'},{v:'Neutro',l:'Neutro'},{v:'Insatisfeito',l:'Insatisfeito'}],c.cliente_satisfacao)) +
      fld('Risco Churn', sel('e-risco',[{v:'',l:'—'},{v:'Baixo',l:'Baixo'},{v:'Medio',l:'Médio'},{v:'Alto',l:'Alto'}],c.cliente_risco_churn)) +
      fld('Origem', `<input id="e-origem" type="text" placeholder="Ex: Instagram, Indica\u00e7\u00e3o\u2026" value="${c.cliente_origem||''}" class="cl-select" style="font-size:13px;padding:7px 10px;width:100%">`)
    );

    const cardNotas = renderCard('desempenho', '📊', 'Notas de Desempenho (0-10)',
      (!hasScore ? `<div class="cd-info-value empty" style="grid-column:1/-1">Nenhuma nota registrada</div>` : 
      `<div class="cd-score-row" style="grid-column:1/-1">
         <div class="cd-score-pill"><span class="cd-score-num">${nc}</span><span class="cd-score-lbl">Comunicação</span></div>
         <div class="cd-score-pill"><span class="cd-score-num">${ne}</span><span class="cd-score-lbl">Entrega</span></div>
         <div class="cd-score-pill"><span class="cd-score-num">${np}</span><span class="cd-score-lbl">Performance</span></div>
         <div class="cd-score-pill" style="background:#F0FDF4;border-color:#BBF7D0"><span class="cd-score-num" style="color:#166534">${scoreAvg}</span><span class="cd-score-lbl">Score</span></div>
       </div>`),
      
      fld('Comunicação', inp('e-nc',c.nota_comunicacao,'number','0')) +
      fld('Entrega', inp('e-ne',c.nota_entrega,'number','0')) +
      fld('Performance', inp('e-np',c.nota_performance,'number','0'))
    );

    const cardContexto = renderCard('contexto', '💬', 'Contexto & Empresa',
      `<div style="grid-column:1/-1; display:flex; flex-direction:column; gap:16px;">
         ${vi('Contexto Geral', fv(c.contexto_geral))}
         ${vi('Descrição da Empresa', fv(c.descricao_empresa))}
       </div>`,
      fld('Contexto Geral', ta('e-contexto',c.contexto_geral,'Contexto geral do cliente…'), true) +
      fld('Descrição da Empresa', ta('e-descricao',c.descricao_empresa,'Descrição da empresa…'), true)
    );

    const cardHistorico = renderCard('historico', '🕐', 'Histórico',
      vi('Criado em', fv(fmtDate(c.criado_em))) +
      vi('Última atualização', fv(fmtDate(c.ultima_atualizacao))),
      null // Sem edição
    );

    // ── Card Churn (somente se cliente_churn === true) ──────────────────────
    const fmtChurnDate = iso => {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric', timeZone:'America/Sao_Paulo' });
    };
    const fmtBRLChurn = v => v
      ? new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 }).format(parseFloat(v))
      : '—';

    const cardChurn = c.cliente_churn ? `
      <div class="cd-card cd-card--churn" id="card-churn">
        <div class="cd-card-header">
          <div class="cd-card-title" style="color:#b91c1c">⚠️ Churn</div>
          <span class="cd-churn-badge">Cliente Desativado</span>
        </div>
        <div class="cd-view-content">
          <div style="display:flex;flex-direction:column;gap:10px">

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <!-- Data do Churn -->
              <div class="cd-churn-field">
                <div class="cd-churn-field-label">📅 Data do Churn</div>
                <div class="cd-churn-field-value">${fmtChurnDate(c.data_churn)}</div>
              </div>
              <!-- Receita Perdida -->
              <div class="cd-churn-field">
                <div class="cd-churn-field-label">💸 Receita Perdida</div>
                <div class="cd-churn-field-value" style="color:#b91c1c;font-size:20px">${fmtBRLChurn(c.receita_perdida)}</div>
              </div>
            </div>

            <!-- Motivo -->
            ${c.motivo_churn ? `
            <div class="cd-churn-field cd-churn-field--full">
              <div class="cd-churn-field-label">💬 Motivo</div>
              <div class="cd-churn-field-value" style="font-size:14px;line-height:1.5">${c.motivo_churn}</div>
            </div>` : ''}

          </div>
        </div>
      </div>` : '';

    const cardReunioes = `
      <div class="cd-card" id="card-reunioes">
        <div class="cd-card-header">
          <div class="cd-card-title">📝 Reuniões <span style="font-weight:500;font-size:11px;margin-left:6px;color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:12px;">${reunioes.length}</span></div>
        </div>
        <div class="rn-list" id="rn-list">${reuniaoItemsHtml}</div>
        <form id="rn-form" class="rn-form cd-edit-form">
          <div class="cd-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-items:start;">
            ${fld('Título *', '<input id="rn-titulo" class="cl-input" type="text" placeholder="Título da reunião" style="font-size:13px;padding:7px 10px;width:100%" required>')}
            ${fld('Data e Hora *', '<input id="rn-data" class="cl-input" type="datetime-local" style="font-size:13px;padding:7px 10px;width:100%" required>')}
          </div>
          <div class="cd-grid" style="margin-top:16px;">
            ${fld('Observações', ta('rn-notas', '', 'Anotações sobre a reunião...'), true)}
          </div>
          <div class="cd-form-actions">
            <button type="button" class="cl-btn-cancel-section" id="rn-cancel-btn">Cancelar</button>
            <button type="submit" class="cl-btn-submit" id="rn-save-btn">✔ Salvar Reunião</button>
          </div>
        </form>
        <button type="button" id="rn-add-btn" class="cd-btn-edit" style="margin-top:12px;display:flex;width:fit-content;background:var(--bg);border-color:var(--border-light);">➕ Nova Reunião</button>
      </div>`;

    // ── Card Faturamento Mensal ─────────────────────────────────────────
    const fmtMes = (iso) => {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
    };
    const mesKey = (iso) => {
      const d = new Date(iso);
      const tz = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      return `${tz.getFullYear()}-${String(tz.getMonth()+1).padStart(2,'0')}`;
    };
    const existingMonths = new Set(faturamentos.map(f => mesKey(f.faturamento_data)));

    // Mês atual (ex: "2026-05")
    const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const mesAtualKey = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
    const jaTemMesAtual = existingMonths.has(mesAtualKey);

    const fatTotalFormatado = faturamentos.length
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          faturamentos.reduce((s, f) => s + parseFloat(f.faturamento_valor || 0), 0)
        )
      : null;

    const fatHistoricoHtml = faturamentos.length === 0
      ? `<div class="fat-empty">📊 Nenhum faturamento registrado ainda.</div>`
      : faturamentos.map(f => {
          const val    = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(f.faturamento_valor || 0));
          const keyMes = mesKey(f.faturamento_data);
          return `
            <div class="fat-item" data-fat-id="${f.faturamento_id}" data-fat-mes="${keyMes}" data-fat-valor="${f.faturamento_valor}">
              <div class="fat-view">
                <div class="fat-mes">${fmtMes(f.faturamento_data)}</div>
                <div class="fat-valor">${val}</div>
                <div class="fat-actions">
                  <button type="button" class="fat-edit" data-fat-edit="${f.faturamento_id}" title="Editar">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button type="button" class="fat-del" data-fat-del="${f.faturamento_id}" title="Excluir">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
              <div class="fat-edit-row" style="display:none;">
                <input type="month" class="fat-edit-mes cl-input" value="${keyMes}" style="font-size:12px;padding:5px 8px;flex:1;min-width:120px;">
                <input type="number" class="fat-edit-valor cl-input" value="${f.faturamento_valor}" min="0" step="0.01" style="font-size:12px;padding:5px 8px;width:130px;">
                <button type="button" class="fat-edit-save cl-btn-submit" style="font-size:12px;padding:5px 12px;" data-fat-save="${f.faturamento_id}">✔</button>
                <button type="button" class="fat-edit-cancel cl-btn-cancel-section" style="font-size:12px;padding:5px 10px;" data-fat-cancel="${f.faturamento_id}">✕</button>
              </div>
            </div>`;
        }).join('');

    const cardFaturamento = `
      <div class="cd-card" id="card-faturamento">
        <div class="cd-card-header">
          <div class="cd-card-title">
            💰 Faturamento Mensal
          </div>
          <span id="fat-total-header" style="font-size:14px;font-weight:800;color:#166534;">${fatTotalFormatado ?? 'R$\u00a00,00'}</span>
        </div>

        <div class="fat-list" id="fat-list">${fatHistoricoHtml}</div>

        <form id="fat-form" class="cd-edit-form">
          <div class="cd-grid" style="grid-template-columns:1fr 1fr;align-items:end;gap:12px;margin-top:4px;">
            <div class="cd-field">
              <span class="cd-field-label">Mês de Referência *</span>
              <input id="fat-mes" type="month" class="cl-input" style="font-size:13px;padding:7px 10px;width:100%" required value="${mesAtualKey}">
            </div>
            <div class="cd-field">
              <span class="cd-field-label">Valor (R$) *</span>
              <input id="fat-valor" type="number" min="0" step="0.01" class="cl-input" placeholder="0,00" style="font-size:13px;padding:7px 10px;width:100%" required>
            </div>
          </div>
          <div class="cd-form-actions">
            <button type="button" class="cl-btn-cancel-section" id="fat-cancel-btn">Cancelar</button>
            <button type="submit" class="cl-btn-submit" id="fat-save-btn">💾 Salvar Faturamento</button>
          </div>
</form>

        <button type="button" id="fat-add-btn" class="cd-btn-edit" style="margin-top:12px;display:flex;width:fit-content;background:var(--bg);border-color:var(--border-light);">➕ Adicionar Faturamento</button>
      </div>`;

    // ── Card Contatos com o Cliente ────────────────────────────────────────────────
    // Helpers de datas
    const _semanaAtualRange = () => {
      const now = new Date();
      const day = now.getDay(); // 0=dom
      const seg = new Date(now); seg.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); seg.setHours(0,0,0,0);
      const dom = new Date(seg); dom.setDate(seg.getDate() + 6); dom.setHours(23,59,59,999);
      return { seg, dom };
    };
    const _mesAtualRange = () => {
      const now = new Date();
      const ini = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { ini, fim };
    };

    const { seg: semSeg, dom: semDom } = _semanaAtualRange();
    const { ini: mesIni, fim: mesFim } = _mesAtualRange();

    // Contatos desta semana e deste mês
    const contatosSemana  = contatos.filter(ct => {
      const d = new Date(ct.contato_data);
      return d >= semSeg && d <= semDom;
    });
    const reunioesMes = contatos.filter(ct => {
      const d = new Date(ct.contato_data);
      return ct.contato_tipo === 'Reunião' && d >= mesIni && d <= mesFim;
    });

    const semanaOk   = contatosSemana.length >= 3;
    const reuniaoOk  = reunioesMes.length   >= 1;

    // Barra de progresso semana (max 3)
    const semPct = Math.min(100, (contatosSemana.length / 3) * 100);
    const semColor = semanaOk ? '#16a34a' : contatosSemana.length >= 2 ? '#d97706' : '#dc2626';
    const semBg    = semanaOk ? '#dcfce7'  : contatosSemana.length >= 2 ? '#fef3c7'  : '#fee2e2';
    const semDarkBg = semanaOk ? 'rgba(22,163,74,0.15)' : contatosSemana.length >= 2 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)';

    const fmtContato = (iso) => new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    });

    const ctHistoricoHtml = contatos.length === 0
      ? `<div class="ct-empty">Nenhum contato registrado ainda.</div>`
      : contatos.slice(0, 15).map(ct => `
          <div class="ct-item" data-ct-id="${ct.contato_id}">
            <span class="ct-tipo ${ct.contato_tipo === 'Reunião' ? 'ct-reuniao' : 'ct-outro'}">${ct.contato_tipo === 'Reunião' ? '🤝' : '📞'} ${ct.contato_tipo}</span>
            <span class="ct-data">${fmtContato(ct.contato_data)}</span>
            <button type="button" class="ct-del" data-ct-del="${ct.contato_id}" title="Excluir">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>`).join('');

    const cardContatos = `
      <div class="cd-card" id="card-contatos">
        <div class="cd-card-header">
          <div class="cd-card-title">📱 Contatos com o Cliente</div>
        </div>

        <!-- Painel de Metas -->
        <div class="ct-metas">
          <!-- Meta Semanal -->
          <div class="ct-meta-item" style="--ct-color:${semColor};--ct-bg:${semBg};--ct-dark-bg:${semDarkBg};">
            <div class="ct-meta-header">
              <span class="ct-meta-label">Contatos esta semana</span>
              <span class="ct-meta-count" style="color:${semColor};">${contatosSemana.length}<span style="font-weight:400;font-size:11px;color:var(--text-muted);"> / 3</span></span>
            </div>
            <div class="ct-progress-track">
              <div class="ct-progress-fill" style="width:${semPct}%;background:${semColor};"></div>
            </div>
            ${!semanaOk ? `<div class="ct-alerta">⚠️ Faltam ${3 - contatosSemana.length} contato${3 - contatosSemana.length > 1 ? 's' : ''} esta semana</div>` : `<div class="ct-ok">✅ Meta semanal atingida!</div>`}
          </div>

          <!-- Meta Mensal (Reunião) -->
          <div class="ct-meta-item" style="--ct-color:${reuniaoOk ? '#16a34a' : '#dc2626'};--ct-bg:${reuniaoOk ? '#dcfce7' : '#fee2e2'};--ct-dark-bg:${reuniaoOk ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)'};">
            <div class="ct-meta-header">
              <span class="ct-meta-label">Reunião este mês</span>
              <span class="ct-meta-count" style="color:${reuniaoOk ? '#16a34a' : '#dc2626'};">${reunioesMes.length}<span style="font-weight:400;font-size:11px;color:var(--text-muted);"> / 1</span></span>
            </div>
            <div class="ct-progress-track">
              <div class="ct-progress-fill" style="width:${reuniaoOk ? 100 : 0}%;background:${reuniaoOk ? '#16a34a' : '#dc2626'};"></div>
            </div>
            ${!reuniaoOk ? `<div class="ct-alerta">⚠️ Nenhuma reunião registrada este mês</div>` : `<div class="ct-ok">✅ Reunião do mês realizada!</div>`}
          </div>
        </div>

        <!-- Botões de Ação Rápida -->
        <div class="ct-quick-actions">
          <button type="button" class="ct-quick-btn ct-btn-outro" id="ct-btn-outro">
            📞<span>Registrar Contato</span>
          </button>
          <button type="button" class="ct-quick-btn ct-btn-reuniao" id="ct-btn-reuniao">
            🤝<span>Registrar Reunião</span>
          </button>
        </div>

        <!-- Histórico -->
        <details class="ct-historico-details" id="ct-historico-details">
          <summary class="ct-historico-toggle">Ver histórico de contatos (${contatos.length})</summary>
          <div class="ct-list" id="ct-list">${ctHistoricoHtml}</div>
        </details>
      </div>`;

    // ── Card Otimizações de Campanha ──────────────────────────────────────────────
    const fmtFcData = (iso) => new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    });

    const fcItemsHtml = fbCampanhas.length === 0
      ? `<div class="fc-empty">📌 Nenhuma otimização registrada ainda.</div>`
      : fbCampanhas.map(f => `
          <div class="fc-item" data-fc-id="${f.feedback_id}">
            <div class="fc-meta">
              <span class="fc-date">${fmtFcData(f.criado_em)}</span>
              <button type="button" class="fc-del" data-fc-del="${f.feedback_id}" title="Excluir">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
            <p class="fc-texto">${f.feedback_texto.replace(/\n/g, '<br>')}</p>
          </div>`).join('');

    const cardOtimizacoes = `
      <div class="cd-card" id="card-otimizacoes">
        <div class="cd-card-header">
          <div class="cd-card-title">
            📈 Otimizações de Campanha
            <span class="fc-count-badge">${fbCampanhas.length}</span>
          </div>
        </div>

        <div class="fc-list" id="fc-list">${fcItemsHtml}</div>

        <form id="fc-form" class="cd-edit-form">
          <div class="cd-field full">
            <span class="cd-field-label">Descrição da Otimização *</span>
            <textarea id="fc-texto" class="cl-textarea" rows="4"
              placeholder="Descreva o que foi otimizado, ajustado ou testado na campanha..."
              style="width:100%;resize:vertical;"
            ></textarea>
          </div>
          <div class="cd-form-actions">
            <button type="button" class="cl-btn-cancel-section" id="fc-cancel-btn">Cancelar</button>
            <button type="submit" class="cl-btn-submit" id="fc-save-btn">💾 Salvar Otimização</button>
          </div>
        </form>

        <button type="button" id="fc-add-btn" class="cd-btn-edit"
          style="margin-top:12px;display:flex;width:fit-content;background:var(--bg);border-color:var(--border-light);">
          ➕ Registrar Otimização
        </button>
      </div>`;

    const cardFeedback = `
      <div class="cd-card" id="card-feedback">
        <div class="cd-card-header">
          <div class="cd-card-title">💬 Feedback Semanal <span style="font-weight:500;font-size:11px;margin-left:6px;color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:12px;">${feedbacks.length}</span></div>
        </div>
        <div class="fb-list" id="fb-list">${_renderFeedbacks(feedbacks)}</div>
        <form id="fb-form" class="fb-form cd-edit-form">
          <div style="margin-bottom:16px;">
            <span class="cd-field-label">Humor da semana *</span>
            <div class="fb-mood-row" style="margin-top:6px">
              <button type="button" class="fb-mood-btn" data-humor="otimo" title="Ótimo">😊</button>
              <button type="button" class="fb-mood-btn" data-humor="neutro" title="Neutro">😐</button>
              <button type="button" class="fb-mood-btn" data-humor="ruim" title="Ruim">😟</button>
              <button type="button" class="fb-mood-btn" data-humor="critico" title="Crítico">😡</button>
            </div>
          </div>
          ${fld('Observações da semana *', '<textarea class="cl-textarea" id="fb-texto" placeholder="Descreva o que aconteceu nessa semana com o cliente..." style="min-height:90px;width:100%;"></textarea>', true)}
          <div class="cd-form-actions">
            <button type="button" class="cl-btn-cancel-section" id="fb-cancel-btn">Cancelar</button>
            <button type="submit" class="cl-btn-submit" id="fb-submit-btn">💾 Salvar Feedback</button>
          </div>
        </form>
        ${feedbacks.some(f => f.feedback_semana === mondayStr)
          ? `<div style="text-align:center;font-size:12px;font-weight:700;color:#166534;padding:8px 0;background:#F0FDF4;border-radius:8px;margin-top:12px;">✅ Feedback desta semana já registrado</div>`
          : `<button type="button" id="fb-add-btn" class="cd-btn-edit" style="margin-top:12px;display:flex;width:fit-content;background:var(--bg);border-color:var(--border-light);">✏️ Registrar Feedback desta Semana</button>`
        }
      </div>`;

    const html = `
      <style>
        /* ---- CARDS GRID INTERNO ---- */
        .cd-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          padding-bottom: 24px;
          align-items: start;
        }
        .cd-card-full { grid-column: 1 / -1; }
        .cd-card {
          background: var(--white); border: 1px solid var(--border-light);
          border-radius: 12px; padding: 16px 18px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
          transition: box-shadow 0.2s;
        }
        .cd-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.06); }

        /* Card Churn */
        .cd-card--churn {
          border-color: #fca5a5;
          background: #fff8f8;
        }
        .cd-card--churn .cd-card-header {
          border-bottom-color: #fecaca;
        }
        .cd-churn-badge {
          font-size: 11px; font-weight: 700; padding: 3px 10px;
          border-radius: 20px; background: #fee2e2; color: #b91c1c;
          border: 1px solid #fca5a5; white-space: nowrap;
        }
        .cd-churn-field {
          padding: 12px 14px; border-radius: 10px;
          background: #fff1f2; border: 1px solid #fecaca;
          display: flex; flex-direction: column; gap: 4px;
        }
        .cd-churn-field--full { grid-column: 1 / -1; }
        .cd-churn-field-label {
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; color: #ef4444;
        }
        .cd-churn-field-value {
          font-size: 15px; font-weight: 800; color: #7f1d1d;
        }
        [data-theme="dark"] .cd-card--churn {
          background: rgba(220,38,38,.07);
          border-color: rgba(220,38,38,.3);
        }
        [data-theme="dark"] .cd-card--churn .cd-card-header { border-bottom-color: rgba(220,38,38,.2); }
        [data-theme="dark"] .cd-churn-badge { background: rgba(220,38,38,.2); color: #f87171; border-color: rgba(220,38,38,.35); }
        [data-theme="dark"] .cd-churn-field { background: rgba(220,38,38,.1); border-color: rgba(220,38,38,.2); }
        [data-theme="dark"] .cd-churn-field-label { color: #f87171; }
        [data-theme="dark"] .cd-churn-field-value { color: #fca5a5; }

        .cd-card-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px; padding-bottom: 10px;
          border-bottom: 1px solid #f3f4f6;
        }
        .cd-card-title {
          font-size: 13px; font-weight: 700; color: var(--text-dark);
          display: flex; align-items: center; gap: 6px;
        }
        .cd-btn-edit {
          background: none; border: 1px solid #e5e7eb; border-radius: 6px;
          padding: 4px 10px; font-size: 11px; font-weight: 600;
          color: var(--text-dark); cursor: pointer; transition: all 0.2s;
        }
        .cd-btn-edit:hover { background: #f9fafb; border-color: #d1d5db; color: var(--cyan); }
        .cd-info-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;
        }
        .cd-info-item { display: flex; flex-direction: column; gap: 3px; }
        .cd-info-label {
          font-size: 10px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .cd-info-value {
          font-size: 13px; font-weight: 500; color: var(--text-dark);
          word-break: break-word; white-space: pre-wrap;
        }
        .cd-info-value.empty { color: #9ca3af; font-style: italic; }
        .cd-edit-form { display: none; flex-direction: column; }
        .cd-edit-form.open { display: flex; animation: fadeIn 0.3s ease; }
        .cd-view-content.hidden { display: none; }
        .cd-form-actions {
          display: flex; justify-content: flex-end; gap: 8px;
          margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-light);
        }
        .cl-btn-cancel-section {
          background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px;
          font-size: 12px; font-weight: 600; color: var(--text-dark);
          padding: 7px 14px; cursor: pointer; transition: background 0.2s;
        }
        .cl-btn-cancel-section:hover { background: #e5e7eb; }
        .cd-field.full { grid-column: 1 / -1; }
        .cd-grid { display: grid; gap: 12px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        /* Tab panels */
        .cd-tab-panel { display: none; padding-top: 4px; }
        .cd-tab-panel.active { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
        .cd-tab-panel.active .cd-card-full { grid-column: 1 / -1; }

        /* ── Faturamento mensal ── */
        .fat-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
        .fat-item {
          border-radius: 10px;
          border: 1px solid var(--border-light);
          background: var(--bg);
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .fat-item:hover { border-color: var(--cyan); }
        .fat-view {
          display: flex; align-items: center;
          padding: 10px 14px; gap: 8px;
        }
        .fat-mes  { font-size: 13px; font-weight: 600; color: var(--black); text-transform: capitalize; flex: 1; }
        .fat-valor { font-size: 14px; font-weight: 800; color: #166534; white-space: nowrap; }
        .fat-actions { display: flex; align-items: center; gap: 4px; margin-left: 8px; }
        .fat-edit, .fat-del {
          background: transparent; border: none; cursor: pointer;
          color: var(--text-muted); padding: 5px; border-radius: 6px;
          display: flex; align-items: center; transition: all 0.15s;
        }
        .fat-edit:hover { background: #EFF6FF; color: #1D4ED8; }
        .fat-del:hover  { background: #FEE2E2; color: #991B1B; }
        .fat-edit-row {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px;
          border-top: 1px solid var(--border-light);
          background: var(--bg);
          flex-wrap: wrap;
        }
        .fat-empty { font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0; }

        [data-theme="dark"] .fat-item { background: rgba(255,255,255,0.03); }
        [data-theme="dark"] .fat-item:hover { border-color: var(--cyan); }
        [data-theme="dark"] .fat-valor { color: #4ADE80; }
        [data-theme="dark"] .fat-edit:hover { background: rgba(59,130,246,0.15); color: #93C5FD; }
        [data-theme="dark"] .fat-del:hover  { background: rgba(239,68,68,0.15); color: #F87171; }
        [data-theme="dark"] .fat-edit-row { border-top-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }

        /* ── Contatos com o Cliente ── */
        .ct-metas { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .ct-meta-item {
          background: var(--ct-bg, #f0fdf4);
          border: 1px solid var(--ct-color, #16a34a);
          border-radius: 10px; padding: 12px 14px;
          transition: all 0.2s;
        }
        .ct-meta-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .ct-meta-label  { font-size: 12px; font-weight: 700; color: var(--text-dark); }
        .ct-meta-count  { font-size: 20px; font-weight: 800; line-height: 1; }
        .ct-progress-track {
          height: 6px; background: rgba(0,0,0,0.08); border-radius: 99px; overflow: hidden; margin-bottom: 8px;
        }
        .ct-progress-fill { height: 100%; border-radius: 99px; transition: width 0.5s ease; }
        .ct-alerta { font-size: 11px; font-weight: 700; color: #b91c1c; }
        .ct-ok     { font-size: 11px; font-weight: 700; color: #15803d; }

        .ct-quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .ct-quick-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 16px; border-radius: 10px; border: 2px solid transparent;
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: all 0.18s; font-family: inherit;
        }
        .ct-quick-btn:active { transform: scale(0.97); }
        .ct-btn-outro   { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; }
        .ct-btn-outro:hover   { background: #DBEAFE; border-color: #93C5FD; }
        .ct-btn-reuniao { background: #F0FDF4; border-color: #BBF7D0; color: #15803D; }
        .ct-btn-reuniao:hover { background: #DCFCE7; border-color: #86EFAC; }

        .ct-historico-details { margin-top: 4px; }
        .ct-historico-toggle {
          font-size: 12px; font-weight: 600; color: var(--text-muted);
          cursor: pointer; padding: 6px 0; list-style: none; display: flex; align-items: center; gap: 6px;
        }
        .ct-historico-toggle::before { content: '▶'; font-size: 9px; transition: transform 0.2s; }
        details[open] .ct-historico-toggle::before { transform: rotate(90deg); }
        .ct-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
        .ct-item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px; border-radius: 8px;
          border: 1px solid var(--border-light); background: var(--bg);
          font-size: 12px;
        }
        .ct-tipo { font-weight: 700; white-space: nowrap; }
        .ct-reuniao { color: #15803d; }
        .ct-outro   { color: #1d4ed8; }
        .ct-data    { flex: 1; color: var(--text-muted); font-size: 11px; text-align: right; }
        .ct-del {
          background: transparent; border: none; cursor: pointer;
          color: var(--text-muted); padding: 3px; border-radius: 5px;
          display: flex; align-items: center; transition: all 0.15s;
        }
        .ct-del:hover { background: #FEE2E2; color: #991B1B; }
        .ct-empty { font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px 0; }

        [data-theme="dark"] .ct-meta-item { background: var(--ct-dark-bg, rgba(22,163,74,0.15)) !important; }
        [data-theme="dark"] .ct-meta-label { color: var(--black); }
        [data-theme="dark"] .ct-alerta { color: #FCA5A5; }
        [data-theme="dark"] .ct-ok     { color: #86EFAC; }
        [data-theme="dark"] .ct-btn-outro   { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.3); color: #93C5FD; }
        [data-theme="dark"] .ct-btn-outro:hover   { background: rgba(59,130,246,0.2); }
        [data-theme="dark"] .ct-btn-reuniao { background: rgba(22,163,74,0.12); border-color: rgba(22,163,74,0.3); color: #86EFAC; }
        [data-theme="dark"] .ct-btn-reuniao:hover { background: rgba(22,163,74,0.2); }
        [data-theme="dark"] .ct-item { background: rgba(255,255,255,0.03); }
        [data-theme="dark"] .ct-del:hover { background: rgba(239,68,68,0.15); color: #F87171; }
        [data-theme="dark"] .ct-progress-track { background: rgba(255,255,255,0.1); }

        /* ── Feedback Campanhas (Otimizações) ── */
        .fc-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
        .fc-item {
          border-radius: 10px;
          border: 1px solid var(--border-light);
          background: var(--bg);
          padding: 12px 14px;
          transition: border-color 0.15s;
        }
        .fc-item:hover { border-color: var(--cyan); }
        .fc-meta {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 8px;
        }
        .fc-date { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .fc-del {
          background: transparent; border: none; cursor: pointer;
          color: var(--text-muted); padding: 4px; border-radius: 6px;
          display: flex; align-items: center; transition: all 0.15s;
        }
        .fc-del:hover { background: #FEE2E2; color: #991B1B; }
        .fc-texto {
          font-size: 13px; line-height: 1.6; color: var(--text-dark);
          margin: 0; white-space: pre-wrap;
        }
        .fc-empty { font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0; }
        .fc-count-badge {
          font-weight: 500; font-size: 11px; margin-left: 6px;
          color: var(--text-muted); background: var(--bg);
          padding: 2px 8px; border-radius: 12px;
        }

        [data-theme="dark"] .fc-item { background: rgba(255,255,255,0.03); }
        [data-theme="dark"] .fc-item:hover { border-color: var(--cyan); }
        [data-theme="dark"] .fc-texto { color: var(--black); }
        [data-theme="dark"] .fc-del:hover { background: rgba(239,68,68,0.15); color: #F87171; }

        /* ---- DARK MODE OVERRIDES (CD CARDS) ---- */
        [data-theme="dark"] .cd-card { background: var(--card-light); border-color: var(--border-light); }
        [data-theme="dark"] .cd-card-header { border-color: var(--border-light); }
        [data-theme="dark"] .cd-card-title, [data-theme="dark"] .cd-info-value { color: var(--black); }
        [data-theme="dark"] .cd-btn-edit { border-color: var(--border-light); color: var(--text-secondary); background: transparent; }
        [data-theme="dark"] .cd-btn-edit:hover { background: rgba(26,206,238,0.1) !important; border-color: var(--cyan) !important; color: var(--cyan) !important; }
        [data-theme="dark"] .cl-btn-cancel-section { background: rgba(255,255,255,0.05); border-color: var(--border-light); color: var(--text-secondary); }
        [data-theme="dark"] .cl-btn-cancel-section:hover { background: rgba(255,255,255,0.1); }
      </style>
      <div id="cd-body-inner">
        <!-- Aba: Geral -->
        <div class="cd-tab-panel active" id="tab-geral">
          ${c.cliente_churn ? `<div class="cd-card-full">${cardChurn}</div>` : ''}
          <div class="cd-card-full">${cardIdentificacao}</div>
          <div class="cd-card-full">${cardStatus}</div>
          <div class="cd-card-full">${cardNotas}</div>
          <div class="cd-card-full">${cardContexto}</div>
          <div class="cd-card-full">${cardHistorico}</div>
        </div>
        <!-- Aba: Financeiro -->
        <div class="cd-tab-panel" id="tab-financeiro">
          <div class="cd-card-full">${cardContrato}</div>
          <div class="cd-card-full">${cardFaturamento}</div>
        </div>
        <!-- Aba: Contatos -->
        <div class="cd-tab-panel" id="tab-contatos">
          <div class="cd-card-full">${cardContatos}</div>
          <div class="cd-card-full">${cardReunioes}</div>
        </div>
        <!-- Aba: Otimizações -->
        <div class="cd-tab-panel" id="tab-otimizacoes">
          <div class="cd-card-full">${cardOtimizacoes}</div>
          <div class="cd-card-full">${cardFeedback}</div>
        </div>
      </div>
    `;

    const bodyEl = document.getElementById('cd-body');
    bodyEl.innerHTML = html;
    document.getElementById('cd-drawer')?.classList.add('open');
    document.getElementById('cd-overlay')?.classList.add('open');
    window.location.hash = `clientes/${c.cliente_id}`;

    // Toggle da visibilidade da duração do contrato no drawer de edição
    const editContrato = document.getElementById('e-contrato');
    const editDuracaoWrap = document.getElementById('e-contrato-duracao-wrap');
    const editDuracaoInput = document.getElementById('e-contrato-duracao');
    editContrato?.addEventListener('change', () => {
      if (editContrato.checked) {
        if (editDuracaoWrap) editDuracaoWrap.style.display = 'block';
        if (editDuracaoInput) editDuracaoInput.required = true;
      } else {
        if (editDuracaoWrap) editDuracaoWrap.style.display = 'none';
        if (editDuracaoInput) {
          editDuracaoInput.required = false;
          editDuracaoInput.value = '';
        }
      }
    });

    // Eventos das abas do drawer agora são tratados uma única vez via _bindDrawerEvents no onMount

    // Eventos de Toggle Editar
    bodyEl.querySelectorAll('.cd-btn-edit[data-edit-target]').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget.dataset.editTarget;
        document.getElementById(`view-${target}`).classList.add('hidden');
        document.getElementById(`edit-${target}`).classList.add('open');
        e.currentTarget.style.display = 'none';
      });
    });

    // Eventos de Toggle Cancelar
    bodyEl.querySelectorAll('.cl-btn-cancel-section[data-cancel-target]').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget.dataset.cancelTarget;
        document.getElementById(`view-${target}`).classList.remove('hidden');
        document.getElementById(`edit-${target}`).classList.remove('open');
        document.querySelector(`.cd-btn-edit[data-edit-target="${target}"]`).style.display = '';
        document.getElementById(`edit-${target}`).reset();
      });
    });

    // Eventos de Submit por Sessão
    bodyEl.querySelectorAll('.cd-edit-form[data-section]').forEach(form => {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        const saveBtn = e.currentTarget.querySelector('.cl-btn-submit');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        const g = id => document.getElementById(id)?.value ?? '';
        let payload = {};

        if (section === 'identificacao') {
          payload = {
            cliente_nome: g('e-nome') || c.cliente_nome,
            cliente_telefone: g('e-tel') || null,
            cliente_email: g('e-email') || null,
            segmento: g('e-seg') || null,
            investimento_midia: parseFloat(g('e-midia')) || 0,
          };
        } else if (section === 'contrato') {
          const hasContrato = document.getElementById('e-contrato')?.checked || false;
          if (hasContrato && !g('e-contrato-duracao').trim()) {
            alert('Por favor, insira a duração do contrato em meses.');
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Salvar Alterações';
            return;
          }
          payload = {
            cliente_contrato: hasContrato,
            contrato_duracao: hasContrato ? (parseInt(g('e-contrato-duracao'), 10) || null) : null,
          };
        } else if (section === 'status') {
          payload = {
            cliente_status: g('e-status'),
            cliente_campanha_status: g('e-campanha') || null,
            cliente_otimizacao: g('e-otim') === 'true',
            cliente_satisfacao: g('e-sat') || null,
            cliente_risco_churn: g('e-risco') || null,
            cliente_origem: g('e-origem') || null
          };
        } else if (section === 'desempenho') {
          payload = {
            nota_comunicacao: g('e-nc') || null,
            nota_entrega: g('e-ne') || null,
            nota_performance: g('e-np') || null
          };
          const npsAlterado = String(payload.nota_comunicacao ?? '') !== String(c.nota_comunicacao ?? '') ||
                              String(payload.nota_entrega ?? '') !== String(c.nota_entrega ?? '') ||
                              String(payload.nota_performance ?? '') !== String(c.nota_performance ?? '');
          if (npsAlterado) {
            payload.data_envio_nps = new Date().toISOString();
          }
        } else if (section === 'contexto') {
          payload = {
            contexto_geral: g('e-contexto') || null,
            descricao_empresa: g('e-descricao') || null
          };
        }

        const { data: updated, error } = await Clientes.updateCliente(c.cliente_id, payload);
        if (error) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Erro';
          alert('Erro ao salvar os dados.');
          return;
        }

        const idx = _todosClientes.findIndex(x => x.cliente_id === c.cliente_id);
        if (idx !== -1) _todosClientes[idx] = { ..._todosClientes[idx], ...payload, ...(updated||{}) };
        
        // Atualiza UI da gaveta com os novos dados
        this._openClientDrawer(_todosClientes[idx] || { ...c, ...payload });
      });
    });

    // Os eventos de Churn e Exclusão de cliente agora são tratados uma única vez via _bindDrawerEvents no onMount

    // ── Eventos Especiais: Reuniões ─────────────────────────────────────────────
    const rnList = document.getElementById('rn-list');
    rnList?.addEventListener('click', async e => {
      // Toggle expand
      const header = e.target.closest('.rn-header');
      const delBtn = e.target.closest('[data-rn-del]');
      if (header && !delBtn) header.closest('.rn-item')?.classList.toggle('open');
      
      // Excluir
      if (delBtn) {
        const rid = Number(delBtn.dataset.rnDel);
        if (!confirm('Excluir esta reunião?')) return;
        delBtn.disabled = true;
        const { error } = await Reunioes.delete(rid);
        if (!error) delBtn.closest('.rn-item')?.remove();
        else { delBtn.disabled = false; alert('Erro ao excluir.'); }
      }
    });

    const rnForm = document.getElementById('rn-form');
    const rnAddBtn = document.getElementById('rn-add-btn');
    const rnCancelBtn = document.getElementById('rn-cancel-btn');
    rnAddBtn?.addEventListener('click', () => {
      rnForm.classList.add('open');
      rnAddBtn.style.display = 'none';
      document.getElementById('rn-data').value = new Date().toISOString().slice(0,16);
    });
    rnCancelBtn?.addEventListener('click', () => {
      rnForm.classList.remove('open');
      rnAddBtn.style.display = 'flex';
      rnForm.reset();
    });

    rnForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const saveBtn = document.getElementById('rn-save-btn');
      const titulo  = document.getElementById('rn-titulo')?.value.trim();
      const data    = document.getElementById('rn-data')?.value;
      const notas   = document.getElementById('rn-notas')?.value.trim();
      if (!titulo || !data) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';

      const { data: nova, error } = await Reunioes.create({
        cliente_id: c.cliente_id, user_id: UserStore.getUserId(),
        reuniao_titulo: titulo, reuniao_data: new Date(data).toISOString(), reuniao_notas: notas || null
      });

      if (error) { saveBtn.disabled = false; saveBtn.textContent = 'Erro!'; return; }

      const empty = rnList.querySelector('.rn-empty');
      if (empty) empty.remove();
      rnList.insertAdjacentHTML('afterbegin', `
        <div class="rn-item">
          <div class="rn-header">
            <div class="rn-meta">
              <span class="rn-titulo">${nova.reuniao_titulo}</span>
              <span class="rn-data">📅 ${fmtReuniaoData(nova.reuniao_data)}</span>
            </div>
            ${nova.reuniao_notas ? '<span class="rn-chevron">▼</span>' : ''}
            <button type="button" class="rn-del" data-rn-del="${nova.reuniao_id}" title="Excluir reunião">🗑</button>
          </div>
          ${nova.reuniao_notas ? `<div class="rn-notes">${nova.reuniao_notas}</div>` : ''}
        </div>`);
      rnForm.classList.remove('open');
      rnForm.reset();
      rnAddBtn.style.display = 'flex';
      saveBtn.disabled = false;
      saveBtn.textContent = '✔ Salvar Reunião';
      document.querySelector('#card-reunioes .cd-card-title span').textContent = rnList.querySelectorAll('.rn-item').length;
    });

    // ── Eventos Especiais: Feedback ─────────────────────────────────────────────
    let selectedHumor = null;
    const fbForm = document.getElementById('fb-form');
    const fbAddBtn = document.getElementById('fb-add-btn');
    const fbCancelBtn = document.getElementById('fb-cancel-btn');
    const fbList = document.getElementById('fb-list');

    fbAddBtn?.addEventListener('click', () => {
      fbForm.classList.add('open');
      fbAddBtn.style.display = 'none';
    });
    fbCancelBtn?.addEventListener('click', () => {
      fbForm.classList.remove('open');
      fbAddBtn.style.display = 'flex';
      fbForm.reset();
      document.querySelectorAll('.fb-mood-btn').forEach(b => b.classList.remove('selected'));
      selectedHumor = null;
    });

    document.querySelectorAll('.fb-mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fb-mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedHumor = btn.dataset.humor;
      });
    });

    fbForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const texto   = document.getElementById('fb-texto')?.value.trim();
      const saveBtnFb = document.getElementById('fb-submit-btn');
      if (!selectedHumor) { alert('Selecione o humor da semana.'); return; }
      if (!texto)         { alert('Preencha as observações.'); return; }
      saveBtnFb.disabled = true;
      saveBtnFb.textContent = 'Salvando...';

      const { data: novo, error } = await ClienteFeedback.create({
        cliente_id: c.cliente_id, user_id: UserStore.getUserId(),
        feedback_semana: mondayStr, feedback_humor: selectedHumor, feedback_texto: texto,
      });

      if (error) {
        saveBtnFb.disabled = false; saveBtnFb.textContent = '💾 Salvar Feedback';
        alert(error.message.includes('unique') ? '⚠️ Já existe um feedback para esta semana.' : 'Erro ao salvar feedback.');
        return;
      }

      const emptyMsg = fbList.querySelector('.fb-empty');
      if (emptyMsg) emptyMsg.remove();
      fbList.insertAdjacentHTML('afterbegin', `
        <div class="fb-item">
          <div class="fb-item-header">
            <div class="fb-item-left">
              <span class="fb-mood-icon">${HUMOR_EMOJI[novo.feedback_humor]}</span>
              <span class="fb-week-badge">${_isoWeek(novo.feedback_semana)}</span>
              <span class="fb-date">${_weekInterval(novo.feedback_semana)}</span>
            </div>
          </div>
          <div class="fb-text">${novo.feedback_texto}</div>
        </div>`);

      fbForm.classList.remove('open');
      fbForm.reset();
      selectedHumor = null;
      if (fbAddBtn) fbAddBtn.outerHTML = `<div style="text-align:center;font-size:12px;font-weight:700;color:#166534;padding:8px 0;background:#F0FDF4;border-radius:8px;margin-top:12px;">✅ Feedback desta semana já registrado</div>`;
      document.querySelector('#card-feedback .cd-card-title span').textContent = fbList.querySelectorAll('.fb-item').length;
    });

    const fatList      = document.getElementById('fat-list');
    const fatForm      = document.getElementById('fat-form');
    const fatAddBtn    = document.getElementById('fat-add-btn');
    const fatCancelBtn = document.getElementById('fat-cancel-btn');

    // Abrir / fechar formulário de novo faturamento
    fatAddBtn?.addEventListener('click', () => {
      fatForm.classList.add('open');
      fatAddBtn.style.display = 'none';
      document.getElementById('fat-mes').value = mesAtualKey;
      document.getElementById('fat-valor').value = '';
      document.getElementById('fat-valor').focus();
    });
    fatCancelBtn?.addEventListener('click', () => {
      fatForm.classList.remove('open');
      fatAddBtn.style.display = 'flex';
      fatForm.reset();
    });

    // Helper: recalcula e exibe o total de faturamento no header do card
    const _recalcFatTotal = (list) => {
      const items = list.querySelectorAll('.fat-item');
      const soma  = [...items].reduce((acc, i) => acc + parseFloat(i.dataset.fatValor || 0), 0);
      const fmt   = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(soma);
      const el    = document.getElementById('fat-total-header');
      if (el) el.textContent = fmt;
    };

    // Delegação em fatList: editar, cancelar edição, salvar edição, excluir
    fatList?.addEventListener('click', async e => {
      const delBtn    = e.target.closest('[data-fat-del]');
      const editBtn   = e.target.closest('[data-fat-edit]');
      const saveBtn   = e.target.closest('[data-fat-save]');
      const cancelBtn = e.target.closest('[data-fat-cancel]');

      // ── Abrir edição inline
      if (editBtn) {
        const item    = editBtn.closest('.fat-item');
        const viewRow = item.querySelector('.fat-view');
        const editRow = item.querySelector('.fat-edit-row');
        // Fechar outras edições abertas
        fatList.querySelectorAll('.fat-item').forEach(i => {
          i.querySelector('.fat-view').style.display = 'flex';
          i.querySelector('.fat-edit-row').style.display = 'none';
        });
        viewRow.style.display = 'none';
        editRow.style.display = 'flex';
        editRow.querySelector('.fat-edit-valor').focus();
        return;
      }

      // ── Cancelar edição inline
      if (cancelBtn) {
        const item    = cancelBtn.closest('.fat-item');
        item.querySelector('.fat-view').style.display = 'flex';
        item.querySelector('.fat-edit-row').style.display = 'none';
        // Restaurar valores originais
        item.querySelector('.fat-edit-mes').value   = item.dataset.fatMes;
        item.querySelector('.fat-edit-valor').value = item.dataset.fatValor;
        return;
      }

      // ── Salvar edição inline
      if (saveBtn) {
        const fatId   = Number(saveBtn.dataset.fatSave);
        const item    = saveBtn.closest('.fat-item');
        const editRow = item.querySelector('.fat-edit-row');
        const newMes  = editRow.querySelector('.fat-edit-mes').value;    // "YYYY-MM"
        const newVal  = parseFloat(editRow.querySelector('.fat-edit-valor').value);

        if (!newMes)        { alert('Selecione o mês.'); return; }
        if (isNaN(newVal))  { alert('Informe um valor válido.'); return; }

        // Verificar unicidade: o mesmo mês já existe em outro item?
        const outroComMesmo = [...fatList.querySelectorAll('.fat-item')].some(i => {
          return Number(i.dataset.fatId) !== fatId && i.dataset.fatMes === newMes;
        });
        if (outroComMesmo) {
          alert(`⚠️ Já existe um faturamento para ${new Date(newMes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.`);
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = '...';

        const novaData = `${newMes}-01T00:00:00-03:00`;
        const { error } = await FaturamentoCliente.updateById(fatId, novaData, newVal);

        if (error) {
          saveBtn.disabled = false;
          saveBtn.textContent = '✔';
          alert('Erro ao atualizar faturamento.');
          return;
        }

        // Atualizar dataset e exibição
        item.dataset.fatMes   = newMes;
        item.dataset.fatValor = newVal;
        const mesLabel = new Date(newMes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        const valFmt   = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(newVal);
        item.querySelector('.fat-mes').textContent   = mesLabel;
        item.querySelector('.fat-valor').textContent = valFmt;

        item.querySelector('.fat-view').style.display   = 'flex';
        item.querySelector('.fat-edit-row').style.display = 'none';
        saveBtn.disabled = false;
        saveBtn.textContent = '✔';

        // Atualizar total no header
        _recalcFatTotal(fatList);
        return;
      }

      // ── Excluir faturamento
      if (delBtn) {
        const fatId = Number(delBtn.dataset.fatDel);
        if (!confirm('Excluir este registro de faturamento?')) return;
        delBtn.disabled = true;
        const { error } = await FaturamentoCliente.deleteById(fatId);
        if (!error) {
          const item = delBtn.closest('.fat-item');
          item?.remove();
          if (!fatList.querySelector('.fat-item')) {
            fatList.innerHTML = '<div class="fat-empty">📊 Nenhum faturamento registrado ainda.</div>';
          }
          _recalcFatTotal(fatList);
        } else {
          delBtn.disabled = false;
          alert('Erro ao excluir faturamento.');
        }
      }
    });

    // Submit de novo faturamento
    fatForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const saveBtnF  = document.getElementById('fat-save-btn');
      const mesVal    = document.getElementById('fat-mes')?.value;   // "YYYY-MM"
      const valorVal  = parseFloat(document.getElementById('fat-valor')?.value);

      if (!mesVal)         { alert('Selecione o mês de referência.'); return; }
      if (isNaN(valorVal)) { alert('Informe um valor válido.'); return; }

      // Verificar unicidade (client-side) — checar dataset dos itens existentes
      const mesSelecionado = mesVal;
      const mesJaExiste = [...(fatList.querySelectorAll('.fat-item') || [])].some(i => i.dataset.fatMes === mesSelecionado);
      if (mesJaExiste) {
        alert(`⚠️ Já existe um faturamento para ${new Date(mesVal + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}. Use o botão ✏️ para editar.`);
        return;
      }

      saveBtnF.disabled = true;
      saveBtnF.textContent = 'Salvando...';

      const dataISO = `${mesVal}-01T00:00:00-03:00`;
      const { data: novoFat, error } = await FaturamentoCliente.create(c.cliente_id, dataISO, valorVal);

      if (error) {
        saveBtnF.disabled = false;
        saveBtnF.textContent = '💾 Salvar Faturamento';
        alert(error.message?.includes('unique') ? '⚠️ Faturamento deste mês já registrado.' : 'Erro ao salvar faturamento.');
        return;
      }

      const valFmt   = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorVal);
      const mesLabel = new Date(mesVal + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      const fatIdNovo = novoFat.faturamento_id;

      const emptyEl = fatList.querySelector('.fat-empty');
      if (emptyEl) emptyEl.remove();

      fatList.insertAdjacentHTML('afterbegin', `
        <div class="fat-item" data-fat-id="${fatIdNovo}" data-fat-mes="${mesSelecionado}" data-fat-valor="${valorVal}">
          <div class="fat-view">
            <div class="fat-mes">${mesLabel}</div>
            <div class="fat-valor">${valFmt}</div>
            <div class="fat-actions">
              <button type="button" class="fat-edit" data-fat-edit="${fatIdNovo}" title="Editar">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button type="button" class="fat-del" data-fat-del="${fatIdNovo}" title="Excluir">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>
          <div class="fat-edit-row" style="display:none;">
            <input type="month" class="fat-edit-mes cl-input" value="${mesSelecionado}" style="font-size:12px;padding:5px 8px;flex:1;min-width:120px;">
            <input type="number" class="fat-edit-valor cl-input" value="${valorVal}" min="0" step="0.01" style="font-size:12px;padding:5px 8px;width:130px;">
            <button type="button" class="fat-edit-save cl-btn-submit" style="font-size:12px;padding:5px 12px;" data-fat-save="${fatIdNovo}">✔</button>
            <button type="button" class="fat-edit-cancel cl-btn-cancel-section" style="font-size:12px;padding:5px 10px;" data-fat-cancel="${fatIdNovo}">✕</button>
          </div>
        </div>`);

      fatForm.classList.remove('open');
      fatForm.reset();
      fatAddBtn.style.display = 'flex';
      saveBtnF.disabled = false;
      saveBtnF.textContent = '💾 Salvar Faturamento';

      _recalcFatTotal(fatList);
    });

    // ── Eventos: Otimizações de Campanha ────────────────────────────────────────
    const fcList      = document.getElementById('fc-list');
    const fcForm      = document.getElementById('fc-form');
    const fcAddBtn    = document.getElementById('fc-add-btn');
    const fcCancelBtn = document.getElementById('fc-cancel-btn');

    fcAddBtn?.addEventListener('click', () => {
      fcForm.classList.add('open');
      fcAddBtn.style.display = 'none';
      document.getElementById('fc-texto')?.focus();
    });
    fcCancelBtn?.addEventListener('click', () => {
      fcForm.classList.remove('open');
      fcAddBtn.style.display = 'flex';
      fcForm.reset();
    });

    // Excluir
    fcList?.addEventListener('click', async e => {
      const delBtn = e.target.closest('[data-fc-del]');
      if (!delBtn) return;
      if (!confirm('Excluir este registro de otimização?')) return;
      const fcId = Number(delBtn.dataset.fcDel);
      delBtn.disabled = true;
      const { error } = await FeedbackCampanhas.deleteById(fcId);
      if (!error) {
        delBtn.closest('.fc-item')?.remove();
        if (!fcList.querySelector('.fc-item')) {
          fcList.innerHTML = '<div class="fc-empty">📌 Nenhuma otimização registrada ainda.</div>';
        }
        const badge = document.querySelector('#card-otimizacoes .fc-count-badge');
        if (badge) badge.textContent = fcList.querySelectorAll('.fc-item').length;
      } else {
        delBtn.disabled = false;
        alert('Erro ao excluir.');
      }
    });

    // Submit novo feedback de campanha
    fcForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const saveBtnFc = document.getElementById('fc-save-btn');
      const texto = document.getElementById('fc-texto')?.value.trim();
      if (!texto) { alert('Preencha a descrição da otimização.'); return; }

      saveBtnFc.disabled = true;
      saveBtnFc.textContent = 'Salvando...';

      const { data: novo, error } = await FeedbackCampanhas.create(c.cliente_id, texto);

      if (error) {
        console.error('[FeedbackCampanhas] Erro ao salvar:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        saveBtnFc.disabled = false;
        saveBtnFc.textContent = '💾 Salvar Otimização';
        alert('Erro ao salvar otimização: ' + (error.message || JSON.stringify(error)));
        return;
      }

      const emptyEl = fcList.querySelector('.fc-empty');
      if (emptyEl) emptyEl.remove();

      const dataLabel = new Date(novo.criado_em).toLocaleString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
      });
      const textoHtml = texto.replace(/\n/g, '<br>');

      fcList.insertAdjacentHTML('afterbegin', `
        <div class="fc-item" data-fc-id="${novo.feedback_id}">
          <div class="fc-meta">
            <span class="fc-date">${dataLabel}</span>
            <button type="button" class="fc-del" data-fc-del="${novo.feedback_id}" title="Excluir">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
          <p class="fc-texto">${textoHtml}</p>
        </div>`);

      fcForm.classList.remove('open');
      fcForm.reset();
      fcAddBtn.style.display = 'flex';
      saveBtnFc.disabled = false;
      saveBtnFc.textContent = '💾 Salvar Otimização';

      const badge = document.querySelector('#card-otimizacoes .fc-count-badge');
      if (badge) badge.textContent = fcList.querySelectorAll('.fc-item').length;
    });

    // ── Eventos: Contatos com o Cliente ─────────────────────────────────────────
    const ctList    = document.getElementById('ct-list');
    const ctBtnOutro   = document.getElementById('ct-btn-outro');
    const ctBtnReuniao = document.getElementById('ct-btn-reuniao');

    // Helper: recalcula metas e atualiza os painéis de progresso
    const _atualizarMetasContatos = (todosContatos) => {
      const { seg: s, dom: d } = _semanaAtualRange();
      const { ini: mi, fim: mf } = _mesAtualRange();

      const semN = todosContatos.filter(ct => { const dd = new Date(ct.contato_data); return dd >= s && dd <= d; }).length;
      const rnN  = todosContatos.filter(ct => { const dd = new Date(ct.contato_data); return ct.contato_tipo === 'Reunião' && dd >= mi && dd <= mf; }).length;

      const semOk = semN >= 3;
      const rnOk  = rnN  >= 1;
      const sColor = semOk ? '#16a34a' : semN >= 2 ? '#d97706' : '#dc2626';
      const sDarkBg = semOk ? 'rgba(22,163,74,0.15)' : semN >= 2 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)';
      const sBg    = semOk ? '#dcfce7' : semN >= 2 ? '#fef3c7' : '#fee2e2';

      // Semana
      const semBox = document.querySelector('#card-contatos .ct-metas .ct-meta-item:first-child');
      if (semBox) {
        semBox.style.setProperty('--ct-color', sColor);
        semBox.style.setProperty('--ct-bg', sBg);
        semBox.style.setProperty('--ct-dark-bg', sDarkBg);
        semBox.querySelector('.ct-meta-count').childNodes[0].textContent = semN;
        semBox.querySelector('.ct-progress-fill').style.width = `${Math.min(100, (semN/3)*100)}%`;
        semBox.querySelector('.ct-progress-fill').style.background = sColor;
        const msg = semBox.querySelector('.ct-alerta, .ct-ok');
        if (msg) { msg.className = semOk ? 'ct-ok' : 'ct-alerta'; msg.textContent = semOk ? '✅ Meta semanal atingida!' : `⚠️ Faltam ${3-semN} contato${3-semN>1?'s':''} esta semana`; }
      }

      // Reunião mensal
      const rnBox = document.querySelector('#card-contatos .ct-metas .ct-meta-item:last-child');
      if (rnBox) {
        const rColor = rnOk ? '#16a34a' : '#dc2626';
        rnBox.style.setProperty('--ct-color', rColor);
        rnBox.style.setProperty('--ct-bg', rnOk ? '#dcfce7' : '#fee2e2');
        rnBox.style.setProperty('--ct-dark-bg', rnOk ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)');
        rnBox.querySelector('.ct-meta-count').childNodes[0].textContent = rnN;
        rnBox.querySelector('.ct-progress-fill').style.width = `${rnOk ? 100 : 0}%`;
        rnBox.querySelector('.ct-progress-fill').style.background = rColor;
        const msg = rnBox.querySelector('.ct-alerta, .ct-ok');
        if (msg) { msg.className = rnOk ? 'ct-ok' : 'ct-alerta'; msg.textContent = rnOk ? '✅ Reunião do mês realizada!' : '⚠️ Nenhuma reunião registrada este mês'; }
      }

      // Contador no <summary>
      const summary = document.querySelector('#ct-historico-details summary');
      if (summary) summary.textContent = `Ver histórico de contatos (${todosContatos.length})`;
    };

    // Cache local dos contatos (para _atualizarMetasContatos)
    const _ctCache = [...contatos];

    // Quick-add Contato (Outro)
    ctBtnOutro?.addEventListener('click', async () => {
      ctBtnOutro.disabled = true;
      ctBtnOutro.textContent = 'Salvando...';
      const { data: novo, error } = await ContatoClientes.create(c.cliente_id, 'Outro');
      if (error) { ctBtnOutro.disabled = false; ctBtnOutro.innerHTML = '📞<span>Registrar Contato</span>'; alert('Erro ao registrar contato.'); return; }

      _ctCache.unshift(novo);

      const dataLabel = fmtContato(novo.contato_data);
      const emptyEl = ctList?.querySelector('.ct-empty');
      if (emptyEl) emptyEl.remove();
      ctList?.insertAdjacentHTML('afterbegin', `
        <div class="ct-item" data-ct-id="${novo.contato_id}">
          <span class="ct-tipo ct-outro">📞 Outro</span>
          <span class="ct-data">${dataLabel}</span>
          <button type="button" class="ct-del" data-ct-del="${novo.contato_id}" title="Excluir">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>`);

      ctBtnOutro.disabled = false;
      ctBtnOutro.innerHTML = '📞<span>Registrar Contato</span>';
      _atualizarMetasContatos(_ctCache);
    });

    // Quick-add Reunião
    ctBtnReuniao?.addEventListener('click', async () => {
      ctBtnReuniao.disabled = true;
      ctBtnReuniao.textContent = 'Salvando...';
      const { data: novo, error } = await ContatoClientes.create(c.cliente_id, 'Reunião');
      if (error) { ctBtnReuniao.disabled = false; ctBtnReuniao.innerHTML = '🤝<span>Registrar Reunião</span>'; alert('Erro ao registrar reunião.'); return; }

      _ctCache.unshift(novo);

      const dataLabel = fmtContato(novo.contato_data);
      const emptyEl = ctList?.querySelector('.ct-empty');
      if (emptyEl) emptyEl.remove();
      ctList?.insertAdjacentHTML('afterbegin', `
        <div class="ct-item" data-ct-id="${novo.contato_id}">
          <span class="ct-tipo ct-reuniao">🤝 Reunião</span>
          <span class="ct-data">${dataLabel}</span>
          <button type="button" class="ct-del" data-ct-del="${novo.contato_id}" title="Excluir">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>`);

      ctBtnReuniao.disabled = false;
      ctBtnReuniao.innerHTML = '🤝<span>Registrar Reunião</span>';
      _atualizarMetasContatos(_ctCache);
    });

    // Excluir contato do histórico
    ctList?.addEventListener('click', async e => {
      const delBtn = e.target.closest('[data-ct-del]');
      if (!delBtn) return;
      const ctId = Number(delBtn.dataset.ctDel);
      if (!confirm('Excluir este contato?')) return;
      delBtn.disabled = true;
      const { error } = await ContatoClientes.deleteById(ctId);
      if (!error) {
        delBtn.closest('.ct-item')?.remove();
        const idx = _ctCache.findIndex(x => x.contato_id === ctId);
        if (idx !== -1) _ctCache.splice(idx, 1);
        if (!ctList.querySelector('.ct-item')) {
          ctList.innerHTML = '<div class="ct-empty">Nenhum contato registrado ainda.</div>';
        }
        _atualizarMetasContatos(_ctCache);
      } else {
        delBtn.disabled = false;
        alert('Erro ao excluir contato.');
      }
    });
  },
};
