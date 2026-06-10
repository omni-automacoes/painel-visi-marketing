/**
 * GaugeChart.js — Gauge SVG animado
 * Utilizado em: FunnelOverviewCard
 * Suporta atualização dinâmica do percentual via update(percent)
 */

export default class GaugeChart {
  /**
   * @param {string} arcId   - ID do <circle> do arco principal (ciano)
   * @param {number} percent - Percentual de 0 a 100
   */
  constructor(arcId, percent = 75) {
    this._arcId    = arcId;
    this._percent  = Math.min(100, Math.max(0, percent));
    this._raf      = null;
  }

  animate(percent = null) {
    if (percent !== null) {
      this._percent = Math.min(100, Math.max(0, percent));
    }

    const circle = document.getElementById(this._arcId);
    if (!circle) return;

    const radius       = 80;
    const circumference = 2 * Math.PI * radius;
    const maxDash      = circumference * 0.75;
    const targetDash   = (maxDash * this._percent) / 100;

    circle.style.strokeDasharray  = circumference;
    circle.style.strokeDashoffset = circumference;

    const duration = 1200;
    let startTime = null;

    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3);
      circle.style.strokeDashoffset = circumference - targetDash * ease;
      if (progress < 1) this._raf = requestAnimationFrame(step);
    };

    this._raf = requestAnimationFrame(step);
  }

  /**
   * Atualiza o percentual e o texto central do gauge sem recriar o SVG.
   * @param {number} percent
   * @param {string} centerText - texto exibido na linha principal (ex: "75%")
   */
  update(percent, centerText = null) {
    // Cancela animação em andamento
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }

    this._percent = Math.min(100, Math.max(0, percent));

    // Atualiza textos do SVG
    const svg = document.getElementById(this._arcId)?.closest('svg');
    if (svg) {
      const [mainText, subText] = svg.querySelectorAll('text');
      if (mainText) mainText.textContent = centerText ?? `${Math.round(percent)}%`;
      if (subText)  subText.textContent  = 'concluído';
    }

    // Re-anima com o novo valor
    this.animate();
  }

  destroy() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  /**
   * Retorna o HTML estático do SVG do gauge
   */
  static html(percent = 75, arcId = 'gaugeArc') {
    return `
      <svg width="200" height="200" viewBox="0 0 200 200" class="gauge-svg">
        <!-- Track -->
        <circle cx="100" cy="100" r="80" class="gauge-track"
          fill="none" stroke-width="18"
          stroke-dasharray="502.65" stroke-dashoffset="125.66"
          stroke-linecap="round" transform="rotate(135 100 100)"
        />
        <!-- Cyan arc -->
        <circle cx="100" cy="100" r="80" id="${arcId}"
          fill="none" stroke="#1ACEEE" stroke-width="18"
          stroke-dasharray="502.65" stroke-dashoffset="502.65"
          stroke-linecap="round" transform="rotate(135 100 100)"
        />
        <!-- Center text -->
        <text x="100" y="95" text-anchor="middle"
          font-family="Inter" font-weight="900" font-size="28" class="gauge-main-text">${percent}%</text>
        <text x="100" y="114" text-anchor="middle"
          font-family="Inter" font-weight="500" font-size="12" class="gauge-sub-text">concluído</text>
      </svg>
    `;
  }
}
