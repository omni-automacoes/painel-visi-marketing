/**
 * inicio-operacoes.js — Visualização "Operações" da página Início
 *
 * KPIs operacionais (sem filtro por vendedor — visão global da equipe):
 *   1. Clientes na Etapa de Onboarding — negocios com pipeline_id=2 e etapa_id≠10
 *   2. Saúde Média dos Clientes        — a configurar (placeholder)
 *   3. Clientes para Otimizar          — clientes com cliente_otimizacao=false
 *   4. Clientes Ativos                 — clientes com cliente_status='Ativado'
 */

import BarChart             from '../../charts/BarChart.js';
import LineChart            from '../../charts/LineChart.js';
import GaugeChart           from '../../charts/GaugeChart.js';
import { staggerAnimation } from '../../js/utils.js';
import { Negocios, Clientes, Tarefas, Usuarios } from '../../js/db.js';
import UserStore from '../../js/userStore.js';

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let barChart    = null;
let barChartOps = null;
let lineChart   = null;
let gaugeChart  = null;

// ── Atualiza um KPI card ─────────────────────────────────────────

/**
 * Calcula a saúde média a partir das 3 notas numéricas por pilar.
 * Retorna { media, comunicacao, entrega, performance } ou null se sem dados.
 */
function _calcularSaude(clientes = []) {
  if (!clientes.length) return null;

  const _avgPilar = (key) => {
    const vals = clientes.map(c => Number(c[key])).filter(v => !isNaN(v) && v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const comunicacao = _avgPilar('nota_comunicacao');
  const entrega     = _avgPilar('nota_entrega');
  const performance = _avgPilar('nota_performance');
  const media       = (comunicacao + entrega + performance) / 3;

  return { media, comunicacao, entrega, performance };
}

function _atualizarCard(id, valor, delta = null) {
  const card = document.getElementById(id);
  if (!card) return;
  const valEl   = card.querySelector('.smc-value');
  const deltaEl = card.querySelector('.smc-delta');
  if (valEl)   { valEl.textContent = valor; valEl.classList.remove('smc-loading'); }
  if (deltaEl && delta !== null) deltaEl.textContent = delta;
}

// ── Carregamento dos KPIs ────────────────────────────────────────

async function _carregarKPIs() {
  const userId = UserStore.getUserId();
  if (!userId) return;

  const [resOnboarding, resAtivos, resOtimizar, resSaude, resChurn, resNovos, resTarefas] = await Promise.all([
    Negocios.getOnboarding(userId),
    Clientes.getAtivos(userId),
    Clientes.getParaOtimizar(userId),
    Clientes.getSaudeMedia(userId),
    Clientes.getChurnAnoAtual(userId),
    Clientes.getNovosAnoAtual(userId),
    Tarefas.getRecentesPorVendedor(userId),
  ]);

  // 1. Clientes na Etapa de Onboarding
  if (!resOnboarding.error) {
    _atualizarCard('ops-onboarding', (resOnboarding.data?.length ?? 0).toLocaleString('pt-BR'), 'pipeline ativo');
  }

  // 2. Saúde Média
  if (!resSaude.error) {
    const resultado = _calcularSaude(resSaude.data || []);
    const media = resultado?.media ?? null;
    _atualizarCard(
      'ops-saude',
      media !== null ? `${media.toFixed(1)} / 10` : '—',
      media !== null ? _labelSaude(media) : 'sem dados'
    );
  }

  // 3. Clientes para Otimizar
  if (!resOtimizar.error) {
    _atualizarCard('ops-otimizar', (resOtimizar.data?.length ?? 0).toLocaleString('pt-BR'), 'precisam de atenção');
  }

  // 4. Clientes Ativos
  if (!resAtivos.error) {
    _atualizarCard('ops-ativos', (resAtivos.data?.length ?? 0).toLocaleString('pt-BR'), 'status ativado');
  }

  // -- Satisfação (reutiliza resSaude) --
  if (!resSaude.error) {
    _atualizarSatisfacao(resSaude.data || []);
  }

  // -- Tarefas Recentes --
  if (!resTarefas.error) {
    _atualizarTarefas(resTarefas.data || []);
  }

  // -- Estatísticas de Churn (card dark) --
  if (!resChurn.error && !resNovos.error) {
    _atualizarChurn(resChurn.data || [], resNovos.data || []);
  }
}

function _labelSaude(nota) {
  if (nota >= 8.5) return '✨ Excelente';
  if (nota >= 7)   return '👍 Boa';
  if (nota >= 5)   return '🟡 Regular';
  if (nota >= 3)   return '⚠️ Atenção';
  return '🔴 Crítica';
}

/** Agrega churns e novos clientes por mês (array de 12) */
function _processarChurnMensal(churns = [], novos = []) {
  const churnMes = Array(12).fill(0);
  const novosMes = Array(12).fill(0);

  churns.forEach(c => {
    if (c.data_churn) churnMes[new Date(c.data_churn).getUTCMonth()]++;
  });
  novos.forEach(c => {
    if (c.criado_em) novosMes[new Date(c.criado_em).getUTCMonth()]++;
  });

  return { churnMes, novosMes };
}

/** Atualiza o card de Estatísticas de Churn */
function _atualizarChurn(churns = [], novos = []) {
  const mesAtual = new Date().getUTCMonth();

  // Métrica principal: churns do mês atual
  const churnMes = churns.filter(c => c.data_churn && new Date(c.data_churn).getUTCMonth() === mesAtual).length;

  const el = document.getElementById('ops-churn-valor');
  if (el) el.textContent = churnMes.toLocaleString('pt-BR');

  // Gráfico de barras
  const { churnMes: churnArr, novosMes: novosArr } = _processarChurnMensal(churns, novos);

  if (barChartOps) {
    barChartOps.destroy();
    barChartOps = new BarChart('barChartOps');
    barChartOps.init({
      labels:   MESES_ABREV,
      ganhos:   novosArr,   // ciano = Novos
      perdidos: churnArr,   // semitransparente = Churn
      labelGanhos:  'Novos Clientes',
      labelPerdidos: 'Churn',
    });
  }
}

/** Atualiza o card de Saúde do Cliente com os 3 pilares */
function _atualizarSatisfacao(clientes = []) {
  const notaEl   = document.getElementById('ops-satisfacao-nota');
  const legendEl = document.getElementById('ops-satisfacao-legend');

  const resultado = _calcularSaude(clientes);

  if (!resultado) {
    if (notaEl)   notaEl.textContent = '—';
    if (legendEl) legendEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:12px;">Sem dados</div>`;
    return;
  }

  const { media, comunicacao, entrega, performance } = resultado;

  // Nota geral no card
  if (notaEl) notaEl.textContent = media.toFixed(1);

  // Gauge: 0–10, meta visual = 10
  const pct = Math.min(Math.round((media / 10) * 100), 100);
  if (gaugeChart) gaugeChart.update(pct, media.toFixed(1));

  // Identifica o pilar mais fraco
  const pilares = [
    { key: 'comunicacao', label: 'Comunicação', valor: comunicacao },
    { key: 'entrega',     label: 'Entrega',      valor: entrega     },
    { key: 'performance', label: 'Performance',  valor: performance },
  ];
  const minValor = Math.min(...pilares.map(p => p.valor));

  if (legendEl) {
    legendEl.innerHTML = pilares.map(p => {
      const fraco = p.valor === minValor;
      return `
        <div class="legend-item">
          <span class="legend-label" style="color:${fraco ? '#f97316' : ''};font-weight:${fraco ? '600' : '400'};"
          >${fraco ? '⚠️ ' : ''}${p.label}</span>
          <span class="legend-value" style="color:${fraco ? '#f97316' : ''};">${p.valor.toFixed(1)}</span>
        </div>`;
    }).join('');
  }
}

/** Classifica urgência da tarefa com base na data de vencimento */
function _urgenciaTarefa(iso) {
  if (!iso) return { tipo: 'futura', label: 'Sem data', diff: Infinity };
  const venc    = new Date(iso);
  const hoje    = new Date();
  const vencDia = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate());
  const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diffDias = Math.round((vencDia - hojeDia) / (1000 * 60 * 60 * 24));
  if (diffDias < 0)   return { tipo: 'atrasada', label: `Atrasada ${Math.abs(diffDias)}d`, diff: diffDias };
  if (diffDias === 0) return { tipo: 'hoje',     label: 'Vence hoje',                       diff: 0 };
  if (diffDias === 1) return { tipo: 'futura',   label: 'Vence amanhã',                    diff: 1 };
  return { tipo: 'futura', label: venc.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), diff: diffDias };
}

/** Renderiza a lista de tarefas pendentes no card */
function _atualizarTarefas(tarefas = []) {
  const lista  = document.getElementById('tarefas-lista');
  const titulo = document.getElementById('tarefas-subtitulo');
  if (!lista) return;
  if (titulo) titulo.textContent = `${tarefas.length} tarefa${tarefas.length !== 1 ? 's' : ''} pendente${tarefas.length !== 1 ? 's' : ''}`;
  if (tarefas.length === 0) {
    lista.innerHTML = `<div class="activity-item" style="justify-content:center;color:var(--text-muted);font-size:13px;">Nenhuma tarefa pendente 🎉</div>`;
    return;
  }
  lista.innerHTML = tarefas.map(t => {
    const { tipo, label } = _urgenciaTarefa(t.tarefa_vencimento);
    const iniciais = t.tarefa_titulo.substring(0, 2).toUpperCase();
    const cfg = {
      atrasada: { dot: '#ef4444', tag: 'color:#ef4444;' },
      hoje:     { dot: '#f97316', tag: 'color:#f97316;' },
      futura:   { dot: '#1ACEEE', tag: 'color:var(--text-muted);' },
    }[tipo];
    return `
      <div class="activity-item" id="tarefa-ops-${t.tarefa_id}">
        <div class="activity-avatar">${iniciais}</div>
        <div class="activity-text">
          <div class="activity-title">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${cfg.dot};margin-right:6px;flex-shrink:0;vertical-align:middle;"></span>${t.tarefa_titulo}
          </div>
          <div class="activity-sub">${t.tarefa_descricao || 'Sem descrição'}</div>
        </div>
        <span style="font-size:11px;font-weight:600;white-space:nowrap;${cfg.tag}">${label}</span>
      </div>`;
  }).join('');
}


/** Agrega dados mensais de novos clientes e churns globais (12 posições) */
function _processarCarteiraMensal(churns = [], novos = []) {
  const churnArr = Array(12).fill(0);
  const novosArr = Array(12).fill(0);
  churns.forEach(c => { if (c.data_churn) churnArr[new Date(c.data_churn).getUTCMonth()]++; });
  novos.forEach(c  => { if (c.criado_em)  novosArr[new Date(c.criado_em).getUTCMonth()]++;  });
  return { churnArr, novosArr };
}

/** Monta o ranking de Top Gestores */
function _atualizarTopGestores(usuarios = [], clientes = []) {
  const tbody = document.getElementById('gestores-tbody');
  if (!tbody) return;

  if (!usuarios.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px;">Nenhum dado disponível</td></tr>`;
    return;
  }

  const PONTOS = {
    'Muito Satisfeito': 10, 'Satisfeito': 7.5, 'Razoável': 5,
    'Insatisfeito': 2.5,  'Muito Insatisfeito': 0,
  };

  const mesAtual    = new Date().getUTCMonth();
  const anoAtual    = new Date().getUTCFullYear();

  // Agrega métricas por user_id
  const stats = {};
  clientes.forEach(c => {
    const id = c.user_id;
    if (!stats[id]) stats[id] = { ativos: 0, satisfPts: 0, satisfN: 0, churnMes: 0, otimizar: 0 };
    if (c.cliente_status === 'Ativado') stats[id].ativos++;
    if (c.cliente_satisfacao && PONTOS[c.cliente_satisfacao] !== undefined) {
      stats[id].satisfPts += PONTOS[c.cliente_satisfacao];
      stats[id].satisfN++;
    }
    if (c.cliente_churn && c.data_churn) {
      const d = new Date(c.data_churn);
      if (d.getUTCMonth() === mesAtual && d.getUTCFullYear() === anoAtual) stats[id].churnMes++;
    }
    if (c.cliente_otimizacao === false) stats[id].otimizar++;
  });

  // Monta ranking: une com nomes, ordena por satisfação média DESC
  const ranking = usuarios
    .map(u => {
      const s = stats[u.user_id] || { ativos: 0, satisfPts: 0, satisfN: 0, churnMes: 0, otimizar: 0 };
      const satisfMedia = s.satisfN > 0 ? (s.satisfPts / s.satisfN) : null;
      return { nome: u.user_nome, ...s, satisfMedia };
    })
    .sort((a, b) => (b.satisfMedia ?? -1) - (a.satisfMedia ?? -1));

  tbody.innerHTML = ranking.map((g, i) => {
    const rankIcon  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const isTop     = i === 0 && g.ativos > 0;
    const satisfFmt = g.satisfMedia !== null ? g.satisfMedia.toFixed(1) : '—';
    const satisfColor = g.satisfMedia === null ? '' :
      g.satisfMedia >= 7.5 ? 'color:#4ADE80;' :
      g.satisfMedia >= 5   ? 'color:#FACC15;' : 'color:#ef4444;';

    return `
      <tr>
        <td style="font-weight:800;${isTop ? 'color:#1ACEEE;' : ''}">${rankIcon}</td>
        <td class="td-name" style="${isTop ? 'color:#1ACEEE;font-weight:700;' : ''}">${g.nome}</td>
        <td>${g.ativos}</td>
        <td style="font-weight:700;${satisfColor}">${satisfFmt}</td>
        <td style="color:${g.churnMes > 0 ? '#ef4444' : 'var(--text-secondary)'}">${g.churnMes}</td>
        <td style="color:${g.otimizar > 0 ? '#f97316' : 'var(--text-secondary)'}">${g.otimizar}</td>
      </tr>`;
  }).join('');
}


export default {
  renderContent() {
    return `
      <!-- KPI Mini Cards — Operações -->
      <div class="top-stats-row">

        <!-- 1. Onboarding -->
        <div class="stat-mini-card" id="ops-onboarding">
          <div class="smc-icon smc-icon-cyan">
            <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <div class="smc-label">Clientes em Onboarding</div>
          <div class="smc-value smc-loading">—</div>
          <div class="smc-delta">pipeline ativo</div>
        </div>

        <!-- 2. Saúde Média -->
        <div class="stat-mini-card" id="ops-saude" style="position:relative;">
          <div class="smc-icon smc-icon-black">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <div class="smc-label" style="display:flex;align-items:center;gap:5px;">
            Saúde Média dos Clientes
            <span class="saude-info-btn" id="saude-info-icon" tabindex="0" aria-label="Como é calculado">
              <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:var(--text-muted);fill:none;stroke-width:2;stroke-linecap:round;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </span>
          </div>
          <div class="smc-value smc-loading">—</div>
          <div class="smc-delta">—</div>
        </div>

        <!-- 3. Para Otimizar -->
        <div class="stat-mini-card" id="ops-otimizar">
          <div class="smc-icon smc-icon-cyan">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          </div>
          <div class="smc-label">Clientes para Otimizar</div>
          <div class="smc-value smc-loading">—</div>
          <div class="smc-delta">precisam de atenção</div>
        </div>

        <!-- 4. Ativos -->
        <div class="stat-mini-card" id="ops-ativos">
          <div class="smc-icon smc-icon-black">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="smc-label">Clientes Ativos</div>
          <div class="smc-value smc-loading">—</div>
          <div class="smc-delta">status ativado</div>
        </div>

      </div>

      <!-- Main Grid -->
      <div class="dashboard-grid">
        <!-- Card Estatísticas de Churn (dinâmico) -->
        <div class="card card-dark card-sales-stats" id="card-sales">
          <div class="card-header">
            <div>
              <div class="card-title">Estatísticas de Churn</div>
            </div>
            <span class="select-pill" style="cursor:default;">${MESES_FULL[new Date().getMonth()]}</span>
          </div>

          <div class="sales-metric">
            <span class="metric-label">Churn do Mês</span>
          </div>
          <div class="metric-value" id="ops-churn-valor">—</div>

          <div style="position:relative; height:150px; margin-top:8px;">
            <canvas id="barChartOps"></canvas>
          </div>
        </div>

        <!-- Card Satisfação do Cliente (dinâmico) -->
        <div class="card card-light card-funnel-overview" id="card-funnel">
          <div class="card-header">
            <div>
              <div class="card-title">Satisfação do Cliente</div>
              <div class="card-subtitle">Média dos clientes ativos</div>
            </div>
          </div>

          <div class="funnel-value-block">
            <div class="funnel-value" id="ops-satisfacao-nota">—</div>
            <div class="funnel-goal">Meta: <span>7 / 10</span></div>
          </div>

          <div class="gauge-wrapper">
            ${GaugeChart.html(0, 'gaugeArc')}
          </div>

          <div class="funnel-legend" id="ops-satisfacao-legend">
            <div class="legend-item" style="justify-content:center;color:var(--text-muted);font-size:12px;">
              Carregando...
            </div>
          </div>
        </div>
        <!-- Card Tarefas Recentes (Operações) -->
        <div class="card card-light card-recent" id="card-recent-ops">
          <div class="card-header">
            <div>
              <div class="card-title">Tarefas Recentes</div>
              <div class="card-subtitle" id="tarefas-subtitulo">carregando...</div>
            </div>
            <a href="#tarefas" class="btn btn-ghost" style="padding:6px 14px; font-size:12px;">Ver todas</a>
          </div>
          <div class="activities-list" id="tarefas-lista">
            <div class="activity-item" style="justify-content:center;color:var(--text-muted);font-size:13px;">
              Carregando tarefas...
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="bottom-row">
        <!-- Evolução da Carteira (todos os usuários) -->
        <div class="card card-dark" id="card-linechart">
          <div class="card-header">
            <div>
              <div class="card-title">Evolução da Carteira — ${new Date().getFullYear()}</div>
              <div class="card-subtitle">Novos clientes vs Churns — todos os usuários</div>
            </div>
            <div class="chart-legend">
              <span class="chart-legend-item">
                <span class="chart-legend-line chart-legend-line--cyan"></span>
                Novos Clientes
              </span>
              <span class="chart-legend-item">
                <span class="chart-legend-line" style="background:#ef4444;"></span>
                Churns
              </span>
            </div>
          </div>
          <div style="position:relative;height:200px;">
            <canvas id="lineChart"></canvas>
          </div>
        </div>

        <!-- Top Gestores (dinâmico) -->
        <div class="card card-light" id="card-gestores">
          <div class="card-header">
            <div>
              <div class="card-title">Top Gestores</div>
              <div class="card-subtitle">Comparação por carteira — ${MESES_FULL[new Date().getMonth()]} ${new Date().getFullYear()}</div>
            </div>
          </div>

          <table class="mini-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Gestor</th>
                <th>Ativos</th>
                <th>Satisfação</th>
                <th>Churn (mês)</th>
                <th>Otimizar</th>
              </tr>
            </thead>
            <tbody id="gestores-tbody">
              <tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px;">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async onMount() {
    barChart    = new BarChart('barChart');
    barChartOps = new BarChart('barChartOps');
    lineChart   = new LineChart('lineChart');
    gaugeChart  = new GaugeChart('gaugeArc', 75);

    gaugeChart.animate();
    staggerAnimation(document.getElementById('inicio-view-area'));

    // Busca dados globais da carteira (todos os usuários) em paralelo
    const [resChurnGlobal, resNovosGlobal] = await Promise.all([
      Clientes.getChurnAnoTodos(),
      Clientes.getNovosAnoTodos(),
    ]);

    if (!resChurnGlobal.error && !resNovosGlobal.error) {
      const { churnArr, novosArr } = _processarCarteiraMensal(
        resChurnGlobal.data || [],
        resNovosGlobal.data || []
      );
      lineChart.destroy();
      lineChart = new LineChart('lineChart');
      lineChart.init({
        receita: novosArr,
        meta:    churnArr,
        label1:  'Novos Clientes',
        label2:  'Churns',
        color1:  '#1ACEEE',
        color2:  '#ef4444',
      });
    } else {
      lineChart.init();
    }

    // ── Tooltip flutuante no body (escapa do stacking context) ──
    const TOOLTIP_HTML = `
      <div id="saude-tooltip-global" style="
        display:none; position:fixed; z-index:99999;
        width:250px; background:#0D0D0D;
        border:1px solid rgba(255,255,255,0.12);
        border-radius:12px; padding:14px 16px;
        font-size:12px; color:#ccc; line-height:1.5;
        box-shadow:0 8px 32px rgba(0,0,0,0.55);
        pointer-events:none; font-family:Inter,sans-serif;">
        <strong style="color:#fff;font-size:13px;display:block;margin-bottom:6px;">🧠 Como calculamos</strong>
        <p style="margin:4px 0 10px;">Média simples de <span style="color:#1ACEEE;font-weight:600;">3 pilares</span>
        definidos manualmente para cada cliente <strong>Ativo</strong>:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0;font-size:11px;">💬 Comunicação</td>
            <td style="text-align:right;color:#1ACEEE;font-weight:700;font-size:11px;">0 – 10</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:11px;">📦 Entrega</td>
            <td style="text-align:right;color:#1ACEEE;font-weight:700;font-size:11px;">0 – 10</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:11px;">📈 Performance</td>
            <td style="text-align:right;color:#1ACEEE;font-weight:700;font-size:11px;">0 – 10</td>
          </tr>
        </table>
        <p style="margin-top:10px;">
          <code style="background:rgba(26,206,238,0.1);color:#1ACEEE;padding:3px 7px;border-radius:6px;font-size:11px;">
            Nota = (Comunic. + Entrega + Perf.) / 3
          </code>
        </p>
        <p style="margin-top:8px;font-size:11px;color:var(--text-muted);">
          ⚠️ O pilar com menor nota é destacado no card.
        </p>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', TOOLTIP_HTML);
    const tip  = document.getElementById('saude-tooltip-global');
    const icon = document.getElementById('saude-info-icon');

    if (icon && tip) {
      const show = () => {
        const r = icon.getBoundingClientRect();
        tip.style.display = 'block';
        // Centraliza abaixo do ícone
        let left = r.left + r.width / 2 - 120;
        let top  = r.bottom + 8;
        // Evita sair da tela pela direita
        if (left + 240 > window.innerWidth - 8) left = window.innerWidth - 248;
        if (left < 8) left = 8;
        tip.style.left = left + 'px';
        tip.style.top  = top  + 'px';
      };
      const hide = () => { tip.style.display = 'none'; };

      icon.addEventListener('mouseenter', show);
      icon.addEventListener('mouseleave', hide);
      icon.addEventListener('focus',      show);
      icon.addEventListener('blur',       hide);
    }

    // Busca e preenche os KPIs de Operações
    await _carregarKPIs();

    // Busca dados globais para Top Gestores (somente cargo 'Operações')
    const [resGestores, resTodosClientes] = await Promise.all([
      Usuarios.getOperacoes(),
      Clientes.getTodosParaRanking(),
    ]);
    if (!resGestores.error && !resTodosClientes.error) {
      _atualizarTopGestores(resGestores.data || [], resTodosClientes.data || []);
    }
  },

  onDestroy() {
    if (barChart)    { barChart.destroy();    barChart    = null; }
    if (barChartOps) { barChartOps.destroy(); barChartOps = null; }
    if (lineChart)   { lineChart.destroy();   lineChart   = null; }
    if (gaugeChart)  { gaugeChart.destroy();  gaugeChart  = null; }
    // Remove o tooltip flutuante do body ao sair da página
    document.getElementById('saude-tooltip-global')?.remove();
  },
};
