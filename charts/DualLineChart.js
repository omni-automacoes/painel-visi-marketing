/**
 * DualLineChart.js — Wrapper do gráfico de linha com 2 séries (Chart.js)
 * Utilizado em: página Relatórios (evolução anual por setor)
 *
 * Suporta as duas séries no mesmo eixo Y (comparação direta, ex: Faturamento x Custo)
 * ou em eixos independentes (grandezas com escalas muito diferentes, ex: Faturamento x Ticket Médio)
 * definindo `axis: 'y' | 'y1'` em cada série.
 *
 * Lê as cores de grid/texto das variáveis CSS do tema ativo (--border-light, --text-secondary, --white)
 * para funcionar corretamente tanto no tema claro quanto no escuro.
 */

function _hexToRgba(hex, alpha) {
  const h    = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num  = parseInt(full, 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function _formatValor(val, format) {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (format === 'currency') return `R$ ${n.toLocaleString('pt-BR')}`;
  if (format === 'percent')  return `${n.toLocaleString('pt-BR')}%`;
  return n.toLocaleString('pt-BR');
}

function _formatEixo(val, format) {
  const n = Number(val);
  if (format === 'currency') {
    return Math.abs(n) >= 1000 ? `R$ ${(n / 1000).toFixed(0)}k` : `R$ ${n.toFixed(0)}`;
  }
  if (format === 'percent') return `${n.toFixed(0)}%`;
  return n.toLocaleString('pt-BR');
}

export default class DualLineChart {
  constructor(canvasId) {
    this._canvasId = canvasId;
    this._instance  = null;
  }

  /**
   * @param {Object} config
   *   labels:  string[] — rótulos do eixo X (ex: meses)
   *   series1: { data: number[], label: string, color: string, format: 'currency'|'number'|'percent', axis?: 'y'|'y1' }
   *   series2: { data: number[], label: string, color: string, format: 'currency'|'number'|'percent', axis?: 'y'|'y1' }
   */
  init({ labels, series1, series2 }) {
    const canvas = document.getElementById(this._canvasId);
    if (!canvas || !window.Chart) return;
    if (this._instance) this._instance.destroy();

    const rootStyles = getComputedStyle(document.documentElement);
    const gridColor  = rootStyles.getPropertyValue('--border-light').trim()   || 'rgba(0,0,0,0.07)';
    const tickColor  = rootStyles.getPropertyValue('--text-secondary').trim() || '#666666';
    const cardBg     = rootStyles.getPropertyValue('--white').trim()          || '#FFFFFF';

    const axis1 = series1.axis || 'y';
    const axis2 = series2.axis || axis1;

    const ctx      = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, _hexToRgba(series1.color, 0.18));
    gradient.addColorStop(1, _hexToRgba(series1.color, 0));

    const scales = {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: tickColor, font: { family: 'Inter', size: 11 } },
      },
      y: {
        position: 'left',
        grid: { color: gridColor, drawBorder: false },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: { family: 'Inter', size: 11 },
          callback: (val) => _formatEixo(val, axis1 === 'y' ? series1.format : series2.format),
          maxTicksLimit: 5,
        },
      },
    };

    if (axis2 !== axis1) {
      scales.y1 = {
        position: 'right',
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: tickColor,
          font: { family: 'Inter', size: 11 },
          callback: (val) => _formatEixo(val, series2.format),
          maxTicksLimit: 5,
        },
      };
    }

    this._instance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: series1.label,
            data: series1.data,
            borderColor: series1.color,
            backgroundColor: gradient,
            borderWidth: 2.5,
            pointBackgroundColor: series1.color,
            pointBorderColor: cardBg,
            pointBorderWidth: 1.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4,
            spanGaps: false,
            yAxisID: axis1,
          },
          {
            label: series2.label,
            data: series2.data,
            borderColor: series2.color,
            borderWidth: 2,
            pointBackgroundColor: series2.color,
            pointBorderColor: cardBg,
            pointBorderWidth: 1.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: false,
            tension: 0.4,
            spanGaps: false,
            yAxisID: axis2,
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
            bodyColor: '#ccc',
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label: (ctx) => {
                const s = ctx.datasetIndex === 0 ? series1 : series2;
                return ` ${ctx.dataset.label}: ${_formatValor(ctx.raw, s.format)}`;
              },
            },
          },
        },
        scales,
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
