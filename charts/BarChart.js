/**
 * BarChart.js — Wrapper do gráfico de barras (Chart.js)
 * Aceita dados dinâmicos via init(customData) ou usa defaults estáticos.
 */

export default class BarChart {
  constructor(canvasId) {
    this._canvasId = canvasId;
    this._instance = null;
  }

  /**
   * @param {Object|null} customData - opcional: { labels, ganhos, perdidos }
   */
  init(customData = null) {
    const ctx = document.getElementById(this._canvasId);
    if (!ctx || !window.Chart) return;

    if (this._instance) this._instance.destroy();

    const labels        = customData?.labels        ?? ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev'];
    const ganhos        = customData?.ganhos        ?? [42, 58, 71, 65, 80, 93];
    const perdidos      = customData?.perdidos      ?? [18, 22, 15, 20, 14, 12];
    const labelGanhos   = customData?.labelGanhos   ?? 'Vendas (Ganho)';
    const labelPerdidos = customData?.labelPerdidos ?? 'Perdidos';

    this._instance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: labelGanhos,
            data: ganhos,
            backgroundColor: '#1ACEEE',
            borderRadius: 8,
            borderSkipped: false,
          },
          {
            label: labelPerdidos,
            data: perdidos,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0D0D0D',
            titleColor: '#ffffff',
            bodyColor: '#aaaaaa',
            padding: 10,
            cornerRadius: 10,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#888', font: { family: 'Inter', size: 11, weight: '500' } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            border: { display: false, dash: [4, 4] },
            ticks: { color: '#888', font: { family: 'Inter', size: 11 }, maxTicksLimit: 5 },
          },
        },
        animation: { duration: 900, easing: 'easeOutCubic' },
      },
    });
  }

  destroy() {
    if (this._instance) {
      this._instance.destroy();
      this._instance = null;
    }
  }
}
