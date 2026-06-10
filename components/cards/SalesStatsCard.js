/**
 * SalesStatsCard.js — Card "Estatísticas de Vendas" (fundo escuro)
 */
export default class SalesStatsCard {
  static html() {
    return `
      <div class="card card-dark card-sales-stats" id="card-sales">
        <div class="card-header">
          <div>
            <div class="card-title">Estatísticas de Vendas</div>
            <div class="card-subtitle">Atualizado há 1 dia</div>
          </div>
          <button class="select-pill" id="btn-period">
            Mensal
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        <div class="sales-metric">
          <span class="metric-label">Leads Novos</span>
          <span class="metric-badge">
            <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
            +14%
          </span>
        </div>
        <div class="metric-value">2.025</div>

        <div style="position:relative; height:150px; margin-top:8px;">
          <canvas id="barChart"></canvas>
        </div>
      </div>
    `;
  }
}
