/**
 * FunnelOverviewCard.js — Card "Visão Geral do Funil" com gauge SVG
 */
import GaugeChart from '../../charts/GaugeChart.js';

export default class FunnelOverviewCard {
  static html(percent = 75) {
    return `
      <div class="card card-light card-funnel-overview" id="card-funnel">
        <div class="card-header">
          <div>
            <div class="card-title">Visão Geral do Funil</div>
            <div class="card-subtitle">Progresso anual acumulado</div>
          </div>
          <button class="btn btn-ghost" style="padding:6px 12px; font-size:12px;">
            <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
            </svg>
            Atualizar
          </button>
        </div>

        <div class="funnel-value-block">
          <div class="funnel-value">R$ 150.000</div>
          <div class="funnel-goal">Meta: <span>R$ 200.000</span></div>
        </div>

        <div class="gauge-wrapper">
          ${GaugeChart.html(percent, 'gaugeArc')}
        </div>

        <div class="funnel-legend">
          <div class="legend-item">
            <span class="legend-dot legend-dot-cyan"></span>
            <span class="legend-label">Receita Gerada</span>
            <span class="legend-value">R$ 150.000</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot legend-dot-black"></span>
            <span class="legend-label">Pendente</span>
            <span class="legend-value">R$ 50.000</span>
          </div>
        </div>
      </div>
    `;
  }
}
