/**
 * TopPerformersCard.js — Card "Top Vendedores" com tabela de ranking
 */

const PERFORMERS = [
  { rank: 1,  name: 'Ana Souza',   closes: 18, revenue: 'R$32k', progress: 92, highlight: true },
  { rank: 2,  name: 'Carlos M.',   closes: 15, revenue: 'R$27k', progress: 78 },
  { rank: 3,  name: 'Fernanda L.', closes: 12, revenue: 'R$21k', progress: 63 },
  { rank: 4,  name: 'Rafael P.',   closes: 10, revenue: 'R$18k', progress: 54 },
  { rank: 5,  name: 'Juliana V.',  closes: 9,  revenue: 'R$15k', progress: 45 },
];

export default class TopPerformersCard {
  static html() {
    const rowsHTML = PERFORMERS.map(p => `
      <tr>
        <td style="font-weight:800;${p.highlight ? 'color:#1ACEEE;' : ''}">${p.rank}</td>
        <td class="td-name">${p.name}</td>
        <td>${p.closes}</td>
        <td class="td-value">${p.revenue}</td>
        <td>
          <div class="progress-mini">
            <div class="progress-mini-fill" style="width:${p.progress}%"></div>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="card card-light" id="card-performers">
        <div class="card-header">
          <div>
            <div class="card-title">Top Vendedores</div>
            <div class="card-subtitle">Ranking mensal — Abril 2025</div>
          </div>
          <span style="font-size:11px;color:#1ACEEE;font-weight:600;cursor:pointer;">Ver ranking completo →</span>
        </div>

        <table class="mini-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Vendedor</th>
              <th>Fechamentos</th>
              <th>Receita</th>
              <th>Progresso</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    `;
  }
}
