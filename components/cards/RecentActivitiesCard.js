/**
 * RecentActivitiesCard.js — Card "Atividades Recentes"
 */

const ACTIVITIES = [
  { initials: 'CA', title: 'Contrato Assinado — Cliente A', sub: 'Grupo Nexus Tecnologia',    tag: 'signed',  tagLabel: 'Assinado', time: '09:14' },
  { initials: 'CB', title: 'Reunião Agendada — Cliente B',  sub: 'Infinity Commerce Ltda.',   tag: 'meeting', tagLabel: 'Reunião',  time: '10:30' },
  { initials: 'LP', title: 'Proposta Enviada — Lead Prog.', sub: 'Studio Alpha Design',       tag: 'call',    tagLabel: 'Proposta', time: '11:05' },
  { initials: 'MD', title: 'Follow-up realizado — Markel D.', sub: 'Delta Soluções S/A',     tag: 'call',    tagLabel: 'Ligação',  time: '13:22' },
];

export default class RecentActivitiesCard {
  static html() {
    const activitiesHTML = ACTIVITIES.map((a, i) => `
      <div class="activity-item" id="act-${i + 1}">
        <div class="activity-avatar">${a.initials}</div>
        <div class="activity-text">
          <div class="activity-title">${a.title}</div>
          <div class="activity-sub">${a.sub}</div>
        </div>
        <span class="activity-tag tag-${a.tag}">${a.tagLabel}</span>
        <span class="activity-time">${a.time}</span>
      </div>
    `).join('');

    return `
      <div class="card card-light card-recent" id="card-recent">
        <div class="card-header">
          <div>
            <div class="card-title">Atividades Recentes</div>
            <div class="card-subtitle">Hoje · ${ACTIVITIES.length} atividades</div>
          </div>
          <a href="#" class="btn btn-ghost" style="padding:6px 14px; font-size:12px;">Ver todas</a>
        </div>

        <div class="quick-stats">
          <div class="quick-stat-pill">
            <span class="qs-label">Hoje</span>
            <span class="qs-value">8</span>
            <span class="qs-delta">+3 vs. ontem</span>
          </div>
          <div class="quick-stat-pill">
            <span class="qs-label">Semana</span>
            <span class="qs-value">42</span>
            <span class="qs-delta">+12%</span>
          </div>
          <div class="quick-stat-pill">
            <span class="qs-label">Mês</span>
            <span class="qs-value">186</span>
            <span class="qs-delta">+28%</span>
          </div>
        </div>

        <div class="activities-list">
          ${activitiesHTML}
        </div>
      </div>
    `;
  }
}
