/**
 * LineChart.js — Wrapper do gráfico de linha (Chart.js)
 * Utilizado em: página Início — Progresso do Funil
 * Aceita dados dinâmicos via init(customData)
 */

export default class LineChart {
  constructor(canvasId) {
    this._canvasId = canvasId;
    this._instance = null;
  }

  /**
   * @param {Object|null} customData - opcional: { receita: number[], meta: number[] }
   */
  init(customData = null) {
    const canvas = document.getElementById(this._canvasId);
    if (!canvas || !window.Chart) return;

    if (this._instance) this._instance.destroy();

    const ctx      = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(26, 206, 238, 0.22)');
    gradient.addColorStop(1, 'rgba(26, 206, 238, 0)');

    const labels  = customData?.labels  ?? ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const receita = customData?.receita ?? Array(12).fill(0);
    const meta    = customData?.meta    ?? Array(12).fill(0);
    // Suporte a labels e cores customizadas (ex: Operações)
    const label1  = customData?.label1  ?? 'Receita Gerada';
    const label2  = customData?.label2  ?? 'Meta';
    const color1  = customData?.color1  ?? '#1ACEEE';
    const color2  = customData?.color2  ?? 'rgba(255,255,255,0.25)';

    this._instance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: label1,
            data: receita,
            borderColor: color1,
            borderWidth: 2.5,
            pointBackgroundColor: color1,
            pointBorderColor: '#0F0F0F',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            backgroundColor: gradient,
            tension: 0.4,
          },
          {
            label: label2,
            data: meta,
            borderColor: color2,
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0D0D0D',
            titleColor: '#fff',
            bodyColor: '#aaa',
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: R$ ${(ctx.raw ?? 0).toLocaleString('pt-BR')}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#888', font: { family: 'Inter', size: 11 } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            border: { display: false },
            ticks: {
              color: '#888',
              font: { family: 'Inter', size: 11 },
              callback: (val) => `R$ ${(val / 1000).toFixed(0)}k`,
              maxTicksLimit: 5,
            },
          },
        },
        animation: { duration: 1000, easing: 'easeOutCubic' },
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
