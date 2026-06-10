  async _openClientDrawer(c) {
    const fmtDate = v => v ? new Date(v).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const fmtBRL  = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(parseFloat(v||0));
    const statusMap = { 'Ativado':'badge-green', 'Novo Cliente':'badge-blue', 'Desativado':'badge-red' };
    const satMap    = { 'Satisfeito':'badge-green', 'Neutro':'badge-gray', 'Insatisfeito':'badge-red' };
    const riscoMap  = { 'Baixo':'badge-green', 'Medio':'badge-yellow', 'Alto':'badge-red' };
    const campMap   = { 'Ativa':'badge-green', 'Pausada':'badge-yellow', 'Inativa':'badge-gray', 'Suspensa':'badge-red' };
    const badge     = (v, map) => v ? `<span class="badge ${map[v]||'badge-gray'}" style="font-size:12px">${v}</span>` : '<span class="cd-info-value empty">—</span>';
    const fv        = v => `<span class="cd-info-value ${!v ? 'empty' : ''}">${v || '—'}</span>`;

    const inp = (id, val, type='text', ph='') => `<input id="${id}" class="cl-input" type="${type}" value="${val||''}" placeholder="${ph}" style="font-size:13px;padding:7px 10px;width:100%">`;
    const sel = (id, opts, val) => `<select id="${id}" class="cl-select" style="font-size:13px;padding:7px 10px;width:100%">${opts.map(o=>`<option value="${o.v}" ${o.v==val?'selected':''}>${o.l}</option>`).join('')}</select>`;
    const ta  = (id, val, ph='') => `<textarea id="${id}" class="cl-textarea" placeholder="${ph}" style="font-size:13px;min-height:70px;width:100%">${val||''}</textarea>`;

    const nc = parseFloat(c.nota_comunicacao), ne = parseFloat(c.nota_entrega), np = parseFloat(c.nota_performance);
    const hasScore = !isNaN(nc) && !isNaN(ne) && !isNaN(np);
    const scoreAvg = hasScore ? ((nc+ne+np)/3).toFixed(1) : null;

    // Load Reuniões e Feedbacks em paralelo
    const mondayStr = (() => {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0,0,0,0);
      return d.toISOString().split('T')[0];
    })();
    const [{ data: rData }, { data: fData }] = await Promise.all([
      Reunioes.getByClienteId(c.cliente_id),
      ClienteFeedback.getByClienteId(c.cliente_id),
    ]);
    const reunioes  = rData || [];
    const feedbacks = fData || [];

    const fmtReuniaoData = v => v ? new Date(v).toLocaleString('pt-BR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const reuniaoItemsHtml = reunioes.length === 0
      ? `<div class="rn-empty">📅 Nenhuma reunião registrada ainda.</div>`
      : reunioes.map(r => `
          <div class="rn-item" data-rn-id="${r.reuniao_id}">
            <div class="rn-header">
              <div class="rn-meta">
                <span class="rn-titulo">${r.reuniao_titulo || 'Sem título'}</span>
                <span class="rn-data">📅 ${fmtReuniaoData(r.reuniao_data)}</span>
              </div>
              ${r.reuniao_notas ? '<span class="rn-chevron">▼</span>' : ''}
              <button type="button" class="rn-del" data-rn-del="${r.reuniao_id}" title="Excluir reunião">🗑</button>
            </div>
            ${r.reuniao_notas ? `<div class="rn-notes">${r.reuniao_notas}</div>` : ''}
          </div>`).join('');

    // Feedback helpers
    const HUMOR_EMOJI = { otimo: '😊', neutro: '😐', ruim: '😟', critico: '😡' };
    const _weekInterval = (semana) => {
      const seg = new Date(semana + 'T12:00:00');
      const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
      const fmt = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
      return `${fmt(seg)}–${fmt(dom)}`;
    };
    const _isoWeek = (semana) => {
      const d = new Date(semana + 'T12:00:00');
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const start = new Date(d.getFullYear(), 0, 1);
      return `Semana ${Math.ceil(((d - start) / 86400000 + 1) / 7)}`;
    };
    const _renderFeedbacks = (list) => {
      if (!list.length) return `<div class="fb-empty">📝 Nenhum feedback registrado ainda.</div>`;
      return list.map(f => `
        <div class="fb-item">
          <div class="fb-item-header">
            <div class="fb-item-left">
              <span class="fb-mood-icon">${HUMOR_EMOJI[f.feedback_humor] || '😐'}</span>
              <span class="fb-week-badge">${_isoWeek(f.feedback_semana)}</span>
              <span class="fb-date">${_weekInterval(f.feedback_semana)}</span>
            </div>
          </div>
          <div class="fb-text">${f.feedback_texto}</div>
        </div>`).join('');
    };

    document.getElementById('cd-nome').textContent = c.cliente_nome || '—';
    document.getElementById('cd-sub').textContent  = [c.cliente_email, c.cliente_telefone, c.segmento].filter(Boolean).join(' · ') || '—';

    // Helper para gerar um Card editável
    const renderCard = (id, icon, title, viewHtml, editHtml) => `
      <div class="cd-card" id="card-${id}">
        <div class="cd-card-header">
          <div class="cd-card-title">${icon} ${title}</div>
          ${editHtml ? `<button type="button" class="cd-btn-edit" data-edit-target="${id}">✏️ Editar</button>` : ''}
        </div>
        <div class="cd-view-content" id="view-${id}">
          <div class="cd-info-grid">${viewHtml}</div>
        </div>
        ${editHtml ? `
        <form class="cd-edit-form" id="edit-${id}" data-section="${id}">
          <div class="cd-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-items:start;">${editHtml}</div>
          <div class="cd-form-actions">
            <button type="button" class="cl-btn-cancel-section" data-cancel-target="${id}">Cancelar</button>
            <button type="submit" class="cl-btn-submit">💾 Salvar Alterações</button>
          </div>
        </form>` : ''}
      </div>
    `;

    const vi = (label, value) => `<div class="cd-info-item"><span class="cd-info-label">${label}</span>${value}</div>`;
    const fld = (label, input, full=false) => `<div class="cd-field ${full?'full':''}"><span class="cd-field-label">${label}</span>${input}</div>`;

    const cardIdentificacao = renderCard('identificacao', '📋', 'Informações Principais',
      vi('Nome', fv(c.cliente_nome)) +
      vi('Telefone', fv(c.cliente_telefone)) +
      vi('E-mail', fv(c.cliente_email)) +
      vi('Segmento', fv(c.segmento)) +
      vi('Inv. Mídia', `<span style="font-weight:700">${fmtBRL(c.investimento_midia)}</span>`) +
      (_isAdmin ? vi('Mensalidade', `<span style="font-weight:800;color:#166534">${fmtBRL(c.cliente_mensalidade)}</span>`) : ''),
      
      fld('Nome', inp('e-nome',c.cliente_nome,'text','Nome do cliente'), true) +
      fld('Telefone', inp('e-tel',c.cliente_telefone,'text','Telefone')) +
      fld('E-mail', inp('e-email',c.cliente_email,'email','E-mail')) +
      fld('Segmento', inp('e-seg',c.segmento,'text','Segmento')) +
      fld('Inv. Mídia (R$)', inp('e-midia',c.investimento_midia,'number','0')) +
      (_isAdmin ? fld('<span style="color:#166534">&#128176; Mensalidade (R$)</span>', inp('e-mensalidade',c.cliente_mensalidade,'number','0')) : '')
    );

    const cardStatus = renderCard('status', '🎯', 'Status & Saúde',
      vi('Status', badge(c.cliente_status, statusMap)) +
      vi('Campanha', badge(c.cliente_campanha_status, campMap)) +
      vi('Otimização', c.cliente_otimizacao ? '<span class="badge badge-purple" style="font-size:12px">Sim</span>' : '<span class="badge badge-gray" style="font-size:12px">Não</span>') +
      vi('Satisfação', badge(c.cliente_satisfacao, satMap)) +
      vi('Risco Churn', badge(c.cliente_risco_churn, riscoMap)) +
      vi('Churn Ocorrido', c.cliente_churn ? '<span class="badge badge-red" style="font-size:12px">Sim</span>' : '<span class="badge badge-gray" style="font-size:12px">Não</span>'),
      
      fld('Status', sel('e-status',[{v:'Ativado',l:'Ativado'},{v:'Novo Cliente',l:'Novo Cliente'},{v:'Desativado',l:'Desativado'}],c.cliente_status)) +
      fld('Campanha', sel('e-campanha',[{v:'',l:'Sem status'},{v:'Ativa',l:'Ativa'},{v:'Pausada',l:'Pausada'},{v:'Inativa',l:'Inativa'},{v:'Suspensa',l:'Suspensa'}],c.cliente_campanha_status)) +
      fld('Otimização', sel('e-otim',[{v:'true',l:'Otimizado'},{v:'false',l:'Pendente'}],String(c.cliente_otimizacao))) +
      fld('Satisfação', sel('e-sat',[{v:'',l:'—'},{v:'Satisfeito',l:'Satisfeito'},{v:'Neutro',l:'Neutro'},{v:'Insatisfeito',l:'Insatisfeito'}],c.cliente_satisfacao)) +
      fld('Risco Churn', sel('e-risco',[{v:'',l:'—'},{v:'Baixo',l:'Baixo'},{v:'Medio',l:'Médio'},{v:'Alto',l:'Alto'}],c.cliente_risco_churn)) +
      fld('Churn Ocorrido', sel('e-churn',[{v:'false',l:'Não'},{v:'true',l:'Sim'}],String(c.cliente_churn)))
    );

    const cardNotas = renderCard('desempenho', '📊', 'Notas de Desempenho (0-10)',
      (!hasScore ? `<div class="cd-info-value empty" style="grid-column:1/-1">Nenhuma nota registrada</div>` : 
      `<div class="cd-score-row" style="grid-column:1/-1">
         <div class="cd-score-pill"><span class="cd-score-num">${nc}</span><span class="cd-score-lbl">Comunicação</span></div>
         <div class="cd-score-pill"><span class="cd-score-num">${ne}</span><span class="cd-score-lbl">Entrega</span></div>
         <div class="cd-score-pill"><span class="cd-score-num">${np}</span><span class="cd-score-lbl">Performance</span></div>
         <div class="cd-score-pill" style="background:#F0FDF4;border-color:#BBF7D0"><span class="cd-score-num" style="color:#166534">${scoreAvg}</span><span class="cd-score-lbl">Score</span></div>
       </div>`),
      
      fld('Comunicação', inp('e-nc',c.nota_comunicacao,'number','0')) +
      fld('Entrega', inp('e-ne',c.nota_entrega,'number','0')) +
      fld('Performance', inp('e-np',c.nota_performance,'number','0'))
    );

    const cardContexto = renderCard('contexto', '💬', 'Contexto & Empresa',
      `<div style="grid-column:1/-1; display:flex; flex-direction:column; gap:16px;">
         ${vi('Contexto Geral', fv(c.contexto_geral))}
         ${vi('Descrição da Empresa', fv(c.descricao_empresa))}
       </div>`,
      fld('Contexto Geral', ta('e-contexto',c.contexto_geral,'Contexto geral do cliente…'), true) +
      fld('Descrição da Empresa', ta('e-descricao',c.descricao_empresa,'Descrição da empresa…'), true)
    );

    const cardHistorico = renderCard('historico', '🕐', 'Histórico',
      vi('Criado em', fv(fmtDate(c.criado_em))) +
      vi('Última atualização', fv(fmtDate(c.ultima_atualizacao))),
      null // Sem edição
    );

    const cardReunioes = `
      <div class="cd-card" id="card-reunioes">
        <div class="cd-card-header">
          <div class="cd-card-title">📝 Reuniões <span style="font-weight:500;font-size:11px;margin-left:6px;color:var(--text-muted);background:#F3F4F6;padding:2px 8px;border-radius:12px;">${reunioes.length}</span></div>
        </div>
        <div class="rn-list" id="rn-list">${reuniaoItemsHtml}</div>
        <form id="rn-form" class="rn-form cd-edit-form">
          <div class="cd-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-items:start;">
            ${fld('Título *', '<input id="rn-titulo" class="cl-input" type="text" placeholder="Título da reunião" style="font-size:13px;padding:7px 10px;width:100%" required>')}
            ${fld('Data e Hora *', '<input id="rn-data" class="cl-input" type="datetime-local" style="font-size:13px;padding:7px 10px;width:100%" required>')}
          </div>
          <div class="cd-grid" style="margin-top:16px;">
            ${fld('Observações', ta('rn-notas', '', 'Anotações sobre a reunião...'), true)}
          </div>
          <div class="cd-form-actions">
            <button type="button" class="cl-btn-cancel-section" id="rn-cancel-btn">Cancelar</button>
            <button type="submit" class="cl-btn-submit" id="rn-save-btn">✔ Salvar Reunião</button>
          </div>
        </form>
        <button type="button" id="rn-add-btn" class="cd-btn-edit" style="margin-top:12px;display:flex;width:fit-content;background:#f9fafb;border-color:#d1d5db;">➕ Nova Reunião</button>
      </div>`;

    const cardFeedback = `
      <div class="cd-card" id="card-feedback">
        <div class="cd-card-header">
          <div class="cd-card-title">💬 Feedback Semanal <span style="font-weight:500;font-size:11px;margin-left:6px;color:var(--text-muted);background:#F3F4F6;padding:2px 8px;border-radius:12px;">${feedbacks.length}</span></div>
        </div>
        <div class="fb-list" id="fb-list">${_renderFeedbacks(feedbacks)}</div>
        <form id="fb-form" class="fb-form cd-edit-form">
          <div style="margin-bottom:16px;">
            <span class="cd-field-label">Humor da semana *</span>
            <div class="fb-mood-row" style="margin-top:6px">
              <button type="button" class="fb-mood-btn" data-humor="otimo" title="Ótimo">😊</button>
              <button type="button" class="fb-mood-btn" data-humor="neutro" title="Neutro">😐</button>
              <button type="button" class="fb-mood-btn" data-humor="ruim" title="Ruim">😟</button>
              <button type="button" class="fb-mood-btn" data-humor="critico" title="Crítico">😡</button>
            </div>
          </div>
          ${fld('Observações da semana *', '<textarea class="cl-textarea" id="fb-texto" placeholder="Descreva o que aconteceu nessa semana com o cliente..." style="min-height:90px;width:100%;"></textarea>', true)}
          <div class="cd-form-actions">
            <button type="button" class="cl-btn-cancel-section" id="fb-cancel-btn">Cancelar</button>
            <button type="submit" class="cl-btn-submit" id="fb-submit-btn">💾 Salvar Feedback</button>
          </div>
        </form>
        ${feedbacks.some(f => f.feedback_semana === mondayStr)
          ? `<div style="text-align:center;font-size:12px;font-weight:700;color:#166534;padding:8px 0;background:#F0FDF4;border-radius:8px;margin-top:12px;">✅ Feedback desta semana já registrado</div>`
          : `<button type="button" id="fb-add-btn" class="cd-btn-edit" style="margin-top:12px;display:flex;width:fit-content;background:#f9fafb;border-color:#d1d5db;">✏️ Registrar Feedback desta Semana</button>`
        }
      </div>`;

    const html = `
      <style>
        .cd-cards-grid { display: flex; flex-direction: column; gap: 16px; padding-bottom: 24px; }
        .cd-card { background: #fff; border: 1px solid var(--border-light); border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); transition: box-shadow 0.2s; }
        .cd-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .cd-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6; }
        .cd-card-title { font-size: 15px; font-weight: 700; color: var(--text-dark); display: flex; align-items: center; gap: 8px; }
        .cd-btn-edit { background: none; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; color: var(--text-dark); cursor: pointer; transition: all 0.2s; }
        .cd-btn-edit:hover { background: #f9fafb; border-color: #d1d5db; color: var(--cyan); }
        
        .cd-info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
        .cd-info-item { display: flex; flex-direction: column; gap: 4px; }
        .cd-info-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .cd-info-value { font-size: 14px; font-weight: 500; color: var(--text-dark); word-break: break-word; white-space: pre-wrap; }
        .cd-info-value.empty { color: #9ca3af; font-style: italic; }
        
        .cd-edit-form { display: none; flex-direction: column; }
        .cd-edit-form.open { display: flex; animation: fadeIn 0.3s ease; }
        .cd-view-content.hidden { display: none; }
        
        .cd-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light); }
        .cl-btn-cancel-section { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text-dark); padding: 8px 16px; cursor: pointer; transition: background 0.2s; }
        .cl-btn-cancel-section:hover { background: #e5e7eb; }
        
        /* Ajuste do form full width */
        .cd-field.full { grid-column: 1 / -1; }
        .cd-grid { display: grid; gap: 16px; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      </style>
      <div class="cd-cards-grid">
        ${cardIdentificacao}
        ${cardStatus}
        ${cardNotas}
        ${cardContexto}
        ${cardReunioes}
        ${cardFeedback}
        ${cardHistorico}
      </div>
    `;

    const bodyEl = document.getElementById('cd-body');
    bodyEl.innerHTML = html;
    document.getElementById('cd-drawer')?.classList.add('open');
    document.getElementById('cd-overlay')?.classList.add('open');
    window.location.hash = `clientes/${c.cliente_id}`;

    // Eventos de Toggle Editar
    bodyEl.querySelectorAll('.cd-btn-edit[data-edit-target]').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget.dataset.editTarget;
        document.getElementById(`view-${target}`).classList.add('hidden');
        document.getElementById(`edit-${target}`).classList.add('open');
        e.currentTarget.style.display = 'none';
      });
    });

    // Eventos de Toggle Cancelar
    bodyEl.querySelectorAll('.cl-btn-cancel-section[data-cancel-target]').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget.dataset.cancelTarget;
        document.getElementById(`view-${target}`).classList.remove('hidden');
        document.getElementById(`edit-${target}`).classList.remove('open');
        document.querySelector(`.cd-btn-edit[data-edit-target="${target}"]`).style.display = '';
        document.getElementById(`edit-${target}`).reset();
      });
    });

    // Eventos de Submit por Sessão
    bodyEl.querySelectorAll('.cd-edit-form[data-section]').forEach(form => {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        const saveBtn = e.currentTarget.querySelector('.cl-btn-submit');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        const g = id => document.getElementById(id)?.value ?? '';
        let payload = {};

        if (section === 'identificacao') {
          payload = {
            cliente_nome: g('e-nome') || c.cliente_nome,
            cliente_telefone: g('e-tel') || null,
            cliente_email: g('e-email') || null,
            segmento: g('e-seg') || null,
            investimento_midia: parseFloat(g('e-midia')) || 0,
            ...(_isAdmin && { cliente_mensalidade: parseFloat(g('e-mensalidade')) || null })
          };
        } else if (section === 'status') {
          payload = {
            cliente_status: g('e-status'),
            cliente_campanha_status: g('e-campanha') || null,
            cliente_otimizacao: g('e-otim') === 'true',
            cliente_satisfacao: g('e-sat') || null,
            cliente_risco_churn: g('e-risco') || null,
            cliente_churn: g('e-churn') === 'true'
          };
        } else if (section === 'desempenho') {
          payload = {
            nota_comunicacao: g('e-nc') || null,
            nota_entrega: g('e-ne') || null,
            nota_performance: g('e-np') || null
          };
          const npsAlterado = String(payload.nota_comunicacao ?? '') !== String(c.nota_comunicacao ?? '') ||
                              String(payload.nota_entrega ?? '') !== String(c.nota_entrega ?? '') ||
                              String(payload.nota_performance ?? '') !== String(c.nota_performance ?? '');
          if (npsAlterado) {
            payload.data_envio_nps = new Date().toISOString();
          }
        } else if (section === 'contexto') {
          payload = {
            contexto_geral: g('e-contexto') || null,
            descricao_empresa: g('e-descricao') || null
          };
        }

        const { data: updated, error } = await Clientes.updateCliente(c.cliente_id, payload);
        if (error) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Erro';
          alert('Erro ao salvar os dados.');
          return;
        }

        const idx = _todosClientes.findIndex(x => x.cliente_id === c.cliente_id);
        if (idx !== -1) _todosClientes[idx] = { ..._todosClientes[idx], ...payload, ...(updated||{}) };
        
        // Atualiza UI da gaveta com os novos dados
        this._openClientDrawer(_todosClientes[idx] || { ...c, ...payload });
      });
    });

    // ── Eventos Especiais: Reuniões ─────────────────────────────────────────────
    const rnList = document.getElementById('rn-list');
    rnList?.addEventListener('click', async e => {
      // Toggle expand
      const header = e.target.closest('.rn-header');
      const delBtn = e.target.closest('[data-rn-del]');
      if (header && !delBtn) header.closest('.rn-item')?.classList.toggle('open');
      
      // Excluir
      if (delBtn) {
        const rid = Number(delBtn.dataset.rnDel);
        if (!confirm('Excluir esta reunião?')) return;
        delBtn.disabled = true;
        const { error } = await Reunioes.delete(rid);
        if (!error) delBtn.closest('.rn-item')?.remove();
        else { delBtn.disabled = false; alert('Erro ao excluir.'); }
      }
    });

    const rnForm = document.getElementById('rn-form');
    const rnAddBtn = document.getElementById('rn-add-btn');
    const rnCancelBtn = document.getElementById('rn-cancel-btn');
    rnAddBtn?.addEventListener('click', () => {
      rnForm.classList.add('open');
      rnAddBtn.style.display = 'none';
      document.getElementById('rn-data').value = new Date().toISOString().slice(0,16);
    });
    rnCancelBtn?.addEventListener('click', () => {
      rnForm.classList.remove('open');
      rnAddBtn.style.display = 'flex';
      rnForm.reset();
    });

    rnForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const saveBtn = document.getElementById('rn-save-btn');
      const titulo  = document.getElementById('rn-titulo')?.value.trim();
      const data    = document.getElementById('rn-data')?.value;
      const notas   = document.getElementById('rn-notas')?.value.trim();
      if (!titulo || !data) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';

      const { data: nova, error } = await Reunioes.create({
        cliente_id: c.cliente_id, user_id: UserStore.getUserId(),
        reuniao_titulo: titulo, reuniao_data: new Date(data).toISOString(), reuniao_notas: notas || null
      });

      if (error) { saveBtn.disabled = false; saveBtn.textContent = 'Erro!'; return; }

      const empty = rnList.querySelector('.rn-empty');
      if (empty) empty.remove();
      rnList.insertAdjacentHTML('afterbegin', `
        <div class="rn-item">
          <div class="rn-header">
            <div class="rn-meta">
              <span class="rn-titulo">${nova.reuniao_titulo}</span>
              <span class="rn-data">📅 ${fmtReuniaoData(nova.reuniao_data)}</span>
            </div>
            ${nova.reuniao_notas ? '<span class="rn-chevron">▼</span>' : ''}
            <button type="button" class="rn-del" data-rn-del="${nova.reuniao_id}" title="Excluir reunião">🗑</button>
          </div>
          ${nova.reuniao_notas ? `<div class="rn-notes">${nova.reuniao_notas}</div>` : ''}
        </div>`);
      rnForm.classList.remove('open');
      rnForm.reset();
      rnAddBtn.style.display = 'flex';
      saveBtn.disabled = false;
      saveBtn.textContent = '✔ Salvar Reunião';
      document.querySelector('#card-reunioes .cd-card-title span').textContent = rnList.querySelectorAll('.rn-item').length;
    });

    // ── Eventos Especiais: Feedback ─────────────────────────────────────────────
    let selectedHumor = null;
    const fbForm = document.getElementById('fb-form');
    const fbAddBtn = document.getElementById('fb-add-btn');
    const fbCancelBtn = document.getElementById('fb-cancel-btn');
    const fbList = document.getElementById('fb-list');

    fbAddBtn?.addEventListener('click', () => {
      fbForm.classList.add('open');
      fbAddBtn.style.display = 'none';
    });
    fbCancelBtn?.addEventListener('click', () => {
      fbForm.classList.remove('open');
      fbAddBtn.style.display = 'flex';
      fbForm.reset();
      document.querySelectorAll('.fb-mood-btn').forEach(b => b.classList.remove('selected'));
      selectedHumor = null;
    });

    document.querySelectorAll('.fb-mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fb-mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedHumor = btn.dataset.humor;
      });
    });

    fbForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const texto  = document.getElementById('fb-texto')?.value.trim();
      const saveBtn = document.getElementById('fb-submit-btn');
      if (!selectedHumor) { alert('Selecione o humor da semana.'); return; }
      if (!texto)         { alert('Preencha as observações.'); return; }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';

      const { data: novo, error } = await ClienteFeedback.create({
        cliente_id: c.cliente_id, user_id: UserStore.getUserId(),
        feedback_semana: mondayStr, feedback_humor: selectedHumor, feedback_texto: texto,
      });

      if (error) {
        saveBtn.disabled = false; saveBtn.textContent = '💾 Salvar Feedback';
        alert(error.message.includes('unique') ? '⚠️ Já existe um feedback para esta semana.' : 'Erro ao salvar feedback.');
        return;
      }

      const emptyMsg = fbList.querySelector('.fb-empty');
      if (emptyMsg) emptyMsg.remove();
      fbList.insertAdjacentHTML('afterbegin', `
        <div class="fb-item">
          <div class="fb-item-header">
            <div class="fb-item-left">
              <span class="fb-mood-icon">${HUMOR_EMOJI[novo.feedback_humor]}</span>
              <span class="fb-week-badge">${_isoWeek(novo.feedback_semana)}</span>
              <span class="fb-date">${_weekInterval(novo.feedback_semana)}</span>
            </div>
          </div>
          <div class="fb-text">${novo.feedback_texto}</div>
        </div>`);
      
      fbForm.classList.remove('open');
      fbForm.reset();
      selectedHumor = null;
      if (fbAddBtn) fbAddBtn.outerHTML = `<div style="text-align:center;font-size:12px;font-weight:700;color:#166534;padding:8px 0;background:#F0FDF4;border-radius:8px;margin-top:12px;">✅ Feedback desta semana já registrado</div>`;
      document.querySelector('#card-feedback .cd-card-title span').textContent = fbList.querySelectorAll('.fb-item').length;
    });
  },
