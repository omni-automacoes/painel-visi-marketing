/**
 * inicio-comercial.js — Visualização "Comercial" da página Início
 *
 * KPIs do mês atual, filtrados pelo vendedor_id do usuário logado:
 *   1. Negócios Abertos   — negocio_status = 'Aberto' (sem filtro de data)
 *   2. Taxa de Conversão  — Ganho / (Ganho + Perdido) no mês
 *   3. Ticket Médio       — média de negocio_valor dos negócios Ganhos no mês
 *   4. Receita Total      — soma de negocio_valor dos negócios Ganhos no mês
 *
 * Gráfico de barras: Ganhos x Perdidos por mês (ano inteiro)
 */
import FunnelOverviewCard   from '../../components/cards/FunnelOverviewCard.js';
import RecentActivitiesCard from '../../components/cards/RecentActivitiesCard.js';
import TopPerformersCard    from '../../components/cards/TopPerformersCard.js';
import BarChart             from '../../charts/BarChart.js';
import LineChart            from '../../charts/LineChart.js';
import GaugeChart           from '../../charts/GaugeChart.js';
import { staggerAnimation, formatCurrency } from '../../js/utils.js';
import { Negocios, Metas, Tarefas, Usuarios } from '../../js/db.js';
import UserStore            from '../../js/userStore.js';

const MESES_ABREV  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let barChart   = null;
let lineChart  = null;
let gaugeChart = null;

// ── Helpers ──────────────────────────────────────────────────────

function _mesAtual() {
  return MESES_FULL[new Date().getMonth()];
}

/**
 * @param {Array}  fechados  — negócios Ganho/Perdido do mês
 * @param {number} totalReunioes — negócios com reuniao_realizada=true no mês
 */
function _calcularFechados(fechados = [], totalReunioes = 0) {
  const ganhos = fechados.filter(n => n.negocio_status === 'Ganho');

  // Nova fórmula: Ganhos / Reuniões Realizadas × 100
  const taxaConversao = totalReunioes > 0
    ? Math.round((ganhos.length / totalReunioes) * 100)
    : 0;

  const receitaTotal = ganhos.reduce((acc, n) => acc + (Number(n.negocio_valor) || 0), 0);
  const ticketMedio  = ganhos.length > 0 ? receitaTotal / ganhos.length : 0;

  return { taxaConversao, receitaTotal, ticketMedio, totalGanhos: ganhos.length };
}

/** Agrupa negócios do ano em arrays de 12 posições (por mês UTC) */
function _processarGrafico(negocios = []) {
  const ganhos   = Array(12).fill(0);
  const perdidos = Array(12).fill(0);

  negocios.forEach(n => {
    const mes = new Date(n.data_fechamento).getUTCMonth();
    if (n.negocio_status === 'Ganho')    ganhos[mes]++;
    else if (n.negocio_status === 'Perdido') perdidos[mes]++;
  });

  return { labels: MESES_ABREV, ganhos, perdidos };
}

/** Soma receita de negócios Ganhos por mês (12 posições) */
function _processarReceitaMensal(negocios = []) {
  const receita = Array(12).fill(0);
  negocios.forEach(n => {
    if (n.negocio_status === 'Ganho') {
      const mes = new Date(n.data_fechamento).getUTCMonth();
      receita[mes] += Number(n.negocio_valor) || 0;
    }
  });
  return receita;
}

/** Mapeia metas por nome do mês para array de 12 posições */
function _processarMetaMensal(metas = []) {
  const indice = {
    'Janeiro':1,'Fevereiro':2,'Março':3,'Abril':4,'Maio':5,'Junho':6,
    'Julho':7,'Agosto':8,'Setembro':9,'Outubro':10,'Novembro':11,'Dezembro':12,
  };
  const meta = Array(12).fill(0);
  metas.forEach(m => {
    const idx = (indice[m.meta_mes] ?? 0) - 1;
    if (idx >= 0) meta[idx] = Number(m.meta_principal) || 0;
  });
  return meta;
}

function _atualizarCard(id, valor, delta = null) {
  const card = document.getElementById(id);
  if (!card) return;
  const valEl   = card.querySelector('.smc-value');
  const deltaEl = card.querySelector('.smc-delta');
  if (valEl)   { valEl.textContent = valor; valEl.classList.remove('smc-loading'); }
  if (deltaEl && delta !== null) deltaEl.textContent = delta;
}

/** Atualiza o card "Visão Geral do Funil" com dados reais */
function _atualizarFunil(receitaTotal, metaValor) {
  const pct      = metaValor > 0 ? Math.min(100, Math.round((receitaTotal / metaValor) * 100)) : 0;
  const pendente = Math.max(0, metaValor - receitaTotal);

  const receitaEl  = document.getElementById('funil-receita-valor');
  const metaEl     = document.getElementById('funil-meta-valor');
  const pendenteEl = document.getElementById('funil-pendente-valor');

  if (receitaEl)  receitaEl.textContent  = formatCurrency(receitaTotal, true);
  if (metaEl)     metaEl.textContent     = formatCurrency(metaValor, true);
  if (pendenteEl) pendenteEl.textContent = formatCurrency(pendente, true);

  const receitaLegEl = document.getElementById('funil-receita-valor-leg');
  if (receitaLegEl) receitaLegEl.textContent = formatCurrency(receitaTotal, true);

  // Atualiza o gauge com % real
  if (gaugeChart) gaugeChart.update(pct, `${pct}%`);
}

/** Classifica urgência da tarefa com base na data de vencimento */
function _urgenciaTarefa(iso) {
  if (!iso) return { tipo: 'futura', label: 'Sem data', diff: Infinity };

  const venc  = new Date(iso);
  const hoje  = new Date();
  // compara apenas o dia, ignorando horas
  const vencDia = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate());
  const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diffDias = Math.round((vencDia - hojeDia) / (1000 * 60 * 60 * 24));

  if (diffDias < 0)  return { tipo: 'atrasada', label: `Atrasada ${Math.abs(diffDias)}d`, diff: diffDias };
  if (diffDias === 0) return { tipo: 'hoje',     label: 'Vence hoje',                      diff: 0 };
  if (diffDias === 1) return { tipo: 'futura',   label: 'Vence amanhã',                    diff: 1 };
  return {
    tipo: 'futura',
    label: venc.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    diff: diffDias,
  };
}

/** Renderiza a lista de tarefas no card */
function _atualizarTarefas(tarefas = []) {
  const lista  = document.getElementById('tarefas-lista');
  const titulo = document.getElementById('tarefas-subtitulo');

  if (!lista) return;

  if (titulo) titulo.textContent = `${tarefas.length} tarefa${tarefas.length !== 1 ? 's' : ''} pendente${tarefas.length !== 1 ? 's' : ''}`;

  if (tarefas.length === 0) {
    lista.innerHTML = `
      <div class="activity-item" style="justify-content:center;color:var(--text-muted);font-size:13px;">
        Nenhuma tarefa pendente 🎉
      </div>`;
    return;
  }

  lista.innerHTML = tarefas.map(t => {
    const { tipo, label } = _urgenciaTarefa(t.tarefa_vencimento);
    const iniciais = t.tarefa_titulo.substring(0, 2).toUpperCase();

    // Estilos minimalistas por urgência
    const cfg = {
      atrasada: { dot: '#ef4444', tag: 'color:#ef4444;',         label },
      hoje:     { dot: '#f97316', tag: 'color:#f97316;',         label },
      futura:   { dot: '#1ACEEE', tag: 'color:var(--text-muted);', label },
    }[tipo];

    return `
      <div class="activity-item" id="tarefa-item-${t.tarefa_id}">
        <div class="activity-avatar">${iniciais}</div>
        <div class="activity-text">
          <div class="activity-title">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${cfg.dot};margin-right:6px;flex-shrink:0;vertical-align:middle;"></span>${t.tarefa_titulo}
          </div>
          <div class="activity-sub">${t.tarefa_descricao || 'Sem descrição'}</div>
        </div>
        <span style="font-size:11px;font-weight:600;white-space:nowrap;${cfg.tag}">${cfg.label}</span>
      </div>
    `;
  }).join('');
}

/** Monta e ordena o ranking de Top Vendedores */
function _atualizarRanking(vendedores = [], ganhos = []) {
  const tbody = document.getElementById('ranking-tbody');
  if (!tbody) return;

  if (!vendedores.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;">Nenhum dado disponível</td></tr>`;
    return;
  }

  // Agrupa ganhos por vendedor_id
  const stats = {};
  ganhos.forEach(n => {
    if (!stats[n.vendedor_id]) stats[n.vendedor_id] = { count: 0, receita: 0 };
    stats[n.vendedor_id].count++;
    stats[n.vendedor_id].receita += Number(n.negocio_valor) || 0;
  });

  // Junta com nomes e ordena por receita decrescente
  const ranking = vendedores
    .map(u => ({
      nome:        u.user_nome,
      fechamentos: stats[u.user_id]?.count   ?? 0,
      receita:     stats[u.user_id]?.receita ?? 0,
      ticket:      stats[u.user_id]?.count > 0
                    ? (stats[u.user_id].receita / stats[u.user_id].count)
                    : 0,
    }))
    .sort((a, b) => b.receita - a.receita);

  tbody.innerHTML = ranking.map((v, i) => {
    const isTop    = i === 0 && v.receita > 0;
    const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

    return `
      <tr>
        <td style="font-weight:800;${isTop ? 'color:#1ACEEE;' : ''}">${rankIcon}</td>
        <td class="td-name" style="${isTop ? 'color:#1ACEEE;font-weight:700;' : ''}">${v.nome}</td>
        <td>${v.fechamentos}</td>
        <td class="td-value">${formatCurrency(v.receita, true)}</td>
        <td style="color:var(--text-secondary);font-size:11px;">${v.ticket > 0 ? formatCurrency(v.ticket, true) : '—'}</td>
      </tr>
    `;
  }).join('');
}

// ── Carregamento de dados ────────────────────────────────────────

async function _carregarDados() {
  const vendedorId = UserStore.getUserId();
  if (!vendedorId) return;

  const [
    resAbertos, resFechados, resAnterior, resAno,
    resMeta, resTarefas, resMetasAno, resGanhosTodos, resVendedores, resReunioes,
  ] = await Promise.all([
    Negocios.getAbertosPorVendedor(vendedorId),
    Negocios.getFechadosMesAtual(vendedorId),
    Negocios.getFechadosMesAnterior(vendedorId),
    Negocios.getAnoAtualPorVendedor(vendedorId),
    Metas.getMesAtual(),
    Tarefas.getRecentesPorVendedor(vendedorId),
    Metas.getAnoAtual(),
    Negocios.getGanhosMesAtualTodos(),
    Usuarios.getVendedoresAtivos(),
    Negocios.getReunioesMesAtual(vendedorId),
  ]);

  // ── KPIs ──
  if (!resAbertos.error) {
    _atualizarCard('smc-abertos',
      (resAbertos.data?.length ?? 0).toLocaleString('pt-BR'),
      'em aberto hoje'
    );
  }

  if (!resFechados.error) {
    const totalReunioes = resReunioes.error ? 0 : (resReunioes.data?.length ?? 0);

    const kpi = _calcularFechados(resFechados.data || [], totalReunioes);

    // Calcula variação % vs. mês anterior
    const totalAnterior = resAnterior.error ? 0 : (resAnterior.data?.length ?? 0);
    const variacaoPct = totalAnterior > 0
      ? Math.round(((kpi.totalGanhos - totalAnterior) / totalAnterior) * 100)
      : null;

    const vendMesEl = document.getElementById('stat-vendas-mes');
    if (vendMesEl) vendMesEl.textContent = kpi.totalGanhos.toLocaleString('pt-BR');

    // Atualiza badge de variação
    const badgeEl = document.getElementById('stat-variacao-badge');
    if (badgeEl) {
      if (variacaoPct === null) {
        badgeEl.style.display = 'none';
      } else {
        const isPositivo = variacaoPct >= 0;
        badgeEl.style.display = '';
        badgeEl.className = `metric-badge ${isPositivo ? '' : 'metric-badge--neg'}`;
        badgeEl.innerHTML = `
          <svg viewBox="0 0 24 24"><polyline points="${isPositivo ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/></svg>
          ${isPositivo ? '+' : ''}${variacaoPct}% vs. mês anterior
        `;
      }
    }

    _atualizarCard('smc-conv',    `${kpi.taxaConversao}%`,               'Reuniões Realizadas → Vendas');
    _atualizarCard('smc-ticket',  formatCurrency(kpi.ticketMedio, true),  'média dos negócios ganhos');
    _atualizarCard('smc-receita', formatCurrency(kpi.receitaTotal, true), 'negócios ganhos no mês');

    // ── Funil: atualiza com receita real + meta do mês ──
    const metaValor = resMeta.error || !resMeta.data
      ? 0
      : Number(resMeta.data.meta_principal) || 0;

    _atualizarFunil(kpi.receitaTotal, metaValor);
  }

  // ── Tarefas Recentes ──
  if (!resTarefas.error) {
    _atualizarTarefas(resTarefas.data || []);
  }

  // ── Gráfico de barras (Ganho x Perdido por mês) ──
  if (!resAno.error && barChart) {
    const grafico = _processarGrafico(resAno.data || []);
    barChart.destroy();
    barChart = new BarChart('barChart');
    barChart.init(grafico);
  }

  // ── Gráfico de linha (Receita Gerada x Meta por mês) ──
  if (lineChart) {
    const receitaPorMes = _processarReceitaMensal(resAno.data || []);
    const metaPorMes   = _processarMetaMensal(resMetasAno.data || []);
    lineChart.destroy();
    lineChart = new LineChart('lineChart');
    lineChart.init({ receita: receitaPorMes, meta: metaPorMes });
  }

  // ── Ranking Top Vendedores ──
  if (!resVendedores.error && !resGanhosTodos.error) {
    _atualizarRanking(resVendedores.data || [], resGanhosTodos.data || []);
  }
}

// ── HTML ──────────────────────────────────────────────────────────

export default {
  renderContent() {
    const mesNome = _mesAtual();

    return `
      <!-- KPI Mini Cards -->
      <div class="top-stats-row">

        <div class="stat-mini-card" id="smc-abertos">
          <div class="smc-icon smc-icon-cyan">
            <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="smc-label">Negócios Abertos</div>
          <div class="smc-value smc-loading">—</div>
          <div class="smc-delta">em aberto hoje</div>
        </div>

        <div class="stat-mini-card" id="smc-conv">
          <div class="smc-icon smc-icon-black">
            <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div class="smc-label">Taxa de Conversão</div>
          <div class="smc-value smc-loading">—</div>
          <div class="smc-delta">Reuniões Realizadas → Vendas</div>
        </div>

        <div class="stat-mini-card" id="smc-ticket">
          <div class="smc-icon smc-icon-cyan">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="smc-label">Ticket Médio</div>
          <div class="smc-value smc-loading">—</div>
          <div class="smc-delta">média dos negócios ganhos</div>
        </div>

        <div class="stat-mini-card" id="smc-receita">
          <div class="smc-icon smc-icon-black">
            <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div class="smc-label">Receita Total</div>
          <div class="smc-value smc-loading">—</div>
          <div class="smc-delta">negócios ganhos no mês</div>
        </div>

      </div>

      <!-- Main Grid -->
      <div class="dashboard-grid">

        <!-- Card Estatísticas de Vendas (dinâmico) -->
        <div class="card card-dark card-sales-stats" id="card-sales">
          <div class="card-header">
            <div class="card-title">Estatísticas de Vendas</div>
            <span class="select-pill" style="cursor:default">${mesNome}</span>
          </div>

          <div class="sales-metric">
            <span class="metric-label">Vendas do Mês</span>
            <span class="metric-badge" id="stat-variacao-badge" style="display:none"></span>
          </div>
          <div class="metric-value" id="stat-vendas-mes">—</div>

          <div style="position:relative; height:150px; margin-top:8px;">
            <canvas id="barChart"></canvas>
          </div>
        </div>

        <!-- Card Visão Geral do Funil (dinâmico) -->
        <div class="card card-light card-funnel-overview" id="card-funnel">
          <div class="card-header">
            <div>
              <div class="card-title">Visão Geral do Funil</div>
              <div class="card-subtitle">Progresso do mês atual</div>
            </div>
          </div>

          <div class="funnel-value-block">
            <div class="funnel-value" id="funil-receita-valor">—</div>
            <div class="funnel-goal">Meta: <span id="funil-meta-valor">—</span></div>
          </div>

          <div class="gauge-wrapper">
            ${GaugeChart.html(0, 'gaugeArc')}
          </div>

          <div class="funnel-legend">
            <div class="legend-item">
              <span class="legend-dot legend-dot-cyan"></span>
              <span class="legend-label">Receita Gerada</span>
              <span class="legend-value" id="funil-receita-valor-leg">—</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot legend-dot-black"></span>
              <span class="legend-label">Pendente</span>
              <span class="legend-value" id="funil-pendente-valor">—</span>
            </div>
          </div>
        </div>
        <!-- Card Tarefas Recentes (dinâmico) -->
        <div class="card card-light card-recent" id="card-recent">
          <div class="card-header">
            <div>
              <div class="card-title">Tarefas Recentes</div>
              <div class="card-subtitle" id="tarefas-subtitulo">carregando...</div>
            </div>
            <a href="#tarefas" class="btn btn-ghost" style="padding:6px 14px; font-size:12px;">Ver todas</a>
          </div>

          <div class="activities-list" id="tarefas-lista">
            <!-- preenchido por _atualizarTarefas() -->
            <div class="activity-item" style="justify-content:center;color:var(--text-muted);font-size:13px;">
              Carregando tarefas...
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="bottom-row">
        <div class="card card-dark" id="card-linechart">
          <div class="card-header">
            <div>
              <div class="card-title">Progresso do Funil — ${new Date().getFullYear()}</div>
              <div class="card-subtitle">Receita gerada vs. meta mensal</div>
            </div>
            <div class="chart-legend">
              <span class="chart-legend-item">
                <span class="chart-legend-line chart-legend-line--cyan"></span>
                Receita
              </span>
              <span class="chart-legend-item">
                <span class="chart-legend-line chart-legend-line--ghost"></span>
                Meta
              </span>
            </div>
          </div>
          <div style="position:relative;height:200px;">
            <canvas id="lineChart"></canvas>
          </div>
        </div>

        <!-- Card Top Vendedores (dinâmico) -->
        <div class="card card-light" id="card-performers">
          <div class="card-header">
            <div>
              <div class="card-title">Top Vendedores</div>
              <div class="card-subtitle">Ranking mensal — ${MESES_FULL[new Date().getMonth()]} ${new Date().getFullYear()}</div>
            </div>
          </div>

          <table class="mini-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Vendedor</th>
                <th>Fechamentos</th>
                <th>Receita</th>
                <th>Ticket Médio</th>
              </tr>
            </thead>
            <tbody id="ranking-tbody">
              <tr>
                <td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px;">Carregando...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async onMount() {
    barChart   = new BarChart('barChart');
    lineChart  = new LineChart('lineChart');
    gaugeChart = new GaugeChart('gaugeArc', 75);

    // Inicia chart com placeholder enquanto os dados chegam
    barChart.init();
    lineChart.init();
    gaugeChart.animate();

    staggerAnimation(document.getElementById('inicio-view-area'));

    // Busca todos os dados (KPIs + gráfico) em paralelo
    await _carregarDados();
  },

  onDestroy() {
    if (barChart)   { barChart.destroy();   barChart   = null; }
    if (lineChart)  { lineChart.destroy();  lineChart  = null; }
    if (gaugeChart) { gaugeChart.destroy(); gaugeChart = null; }
  },
};
