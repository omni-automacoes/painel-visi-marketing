/**
 * contratos.js — Página "Contratos" (Gerador e Editor de Modelos de Contratos)
 *
 * Utiliza o modelo de contrato de marketing oficial da Visi Assessoria Ltda.
 * Permite:
 *   - Preenchimento rápido de variáveis (Nome do Cliente, Itens Adicionais, Prazos)
 *   - Edição direta do modelo padrão pelo usuário com blindagem de variáveis em chips protegidos
 *   - Persistência do modelo personalizado no Supabase (tabela contratos_modelos) e localStorage
 *   - Restauração para o padrão original de fábrica a qualquer momento
 *   - Exportação para PDF (impressão A4 nativa) e Word (.doc formatado)
 *
 * Exporta: { render(), onMount(), onDestroy() }
 */

import UserStore from '../js/userStore.js';
import { ContratosModelos } from '../js/db.js';

// ── Estado Local ───────────────────────────────────────────────────
let _isEditingTemplate   = false;
let _currentTemplateHTML = null;

// ── Modelo Padrão de Fábrica (com item 8 já corrigido em português) ──
const DEFAULT_CONTRACT_CONTENT = `
  <h1>CONTRATO GESTÃO DE MARKETING</h1>

  <p>CONTRATANTE: <b><span class="contract-var" data-var="cliente_nome">Nome da Contratante</span></b>, pessoa jurídica de direito privado, inscrito no CNPJ sob o nº 65.639.046/0001-09, doravante denominado CONTRATANTE.</p>
  
  <p>CONTRATADA: VISI ASSESSORIA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 50.174.894/0001-04, com endereço eletrônico contato@visimarketing.com.br.</p>
  
  <p>As partes acima qualificadas têm entre si justo e acordado o presente CONTRATO GESTÃO DE MARKETING, com as seguintes cláusulas:</p>

  <h2>1. DO OBJETO – SERVIÇOS CONTRATADOS</h2>
  <p>1.1. A CONTRATADA é empresa atuante na área de marketing com endereço constante nos rodapés do presente instrumento.</p>
  <p>1.2. O presente contrato tem por objeto a prestação de serviços de gestão de tráfego e campanhas publicitárias nas redes sociais, o que inclui desenvolvimento dos criativos voltados às campanhas, planejamento estratégico, execução, análise de resultados, acompanhamento e otimização das campanhas, visando alcançar os melhores resultados para o CONTRATANTE.</p>
  <p>1.3. A CONTRATADA se obriga a disponibilizar relatórios com os resultados das campanhas e análises de desempenho, a fim de manter o CONTRATANTE devidamente informado sobre a evolução dos serviços contratados.</p>
  <p>1.4. A CONTRATADA compromete-se a desenvolver as atividades mencionadas no item 1.1 de forma diligente e profissional, garantindo a aplicação das melhores práticas do mercado para o alcance dos objetivos definidos pelo CONTRATANTE.</p>
  
  <!-- Cláusula 1.5 Adicional -->
  <div id="section-1-5-wrapper"></div>

  <h2>2. DA REMUNERAÇÃO E CONDIÇÕES DE PAGAMENTO</h2>
  <p>2.1. A título de remuneração pelos serviços de assessoria de tráfego, o CONTRATANTE pagará à CONTRATADA o valor mensal de R$ 1.500,00, que será realizado via transferência Pix para a chave CNPJ nº 50.174.894/0001-04, até o dia 10 de cada mês.</p>
  
  <!-- Cláusula 2.2 Adicional -->
  <div id="section-2-2-wrapper"></div>
  
  <!-- Cláusula de Inadimplemento (Dinâmica) -->
  <div id="section-inadimplemento-wrapper"></div>
  
  <h2>3. DA VIGÊNCIA E RESCISÃO</h2>
  <p>3.1. O presente contrato terá duração inicial mínima de <b><span class="contract-var" data-var="contrato_duracao">03 (três) meses</span></b>, contados a partir da data de assinatura.</p>
  <p>Em caso de rescisão antecipada por iniciativa do CONTRATANTE, antes do término do período mínimo estabelecido, será devida multa rescisória equivalente a 50% (cinquenta por cento) do valor das mensalidades vincendas até o final do período contratado.</p>
  <p>3.2. Após o período mínimo de <b><span class="contract-var" data-var="contrato_duracao">03 (três) meses</span></b>, o CONTRATANTE poderá solicitar o cancelamento dos serviços prestados pela CONTRATADA a qualquer tempo, mediante aviso prévio, por escrito, com antecedência mínima de 30 (trinta) dias. Na hipótese de não ser concedido o referido aviso prévio, o CONTRATANTE ficará obrigado ao pagamento de 01 (uma) mensalidade adicional, a título de compensação. Cumprido o aviso prévio, não será devido qualquer valor adicional pela rescisão.</p>
  <p>3.3. Durante o aviso prévio, os serviços continuam sendo prestados e pagos normalmente.</p>
  <p>3.4. A CONTRATADA não será responsável pelo reembolso de valores de verbas publicitárias destinados à plataforma Meta Ads, sendo de exclusiva responsabilidade do CONTRATANTE requerer tal reembolso junto à plataforma.</p>

  <h2>4. DAS OBRIGAÇÕES DO CONTRATANTE</h2>
  <p>4.1. Efetuar o pagamento pontual dos valores acordados, conforme os prazos e condições estabelecidos neste contrato.</p>
  <p>4.2. Fornecer à CONTRATADA todas as informações, documentos e materiais necessários para a execução dos serviços de maneira eficiente e dentro dos padrões desejados.</p>
  <p>4.3. Respeitar o período de aviso prévio de rescisão contratual, conforme estipulado na Cláusula 3.1, responsabilizando-se pelo pagamento proporcional dos serviços prestados durante esse período.</p>

  <h2>5. DAS OBRIGAÇÕES DA CONTRATADA</h2>
  <p>5.1. Prestar os serviços de acordo com as especificações e prazos estabelecidos no presente contrato, aplicando as melhores práticas do mercado e zelando pela qualidade técnica dos serviços executados.</p>
  <p>5.2. Manter o sigilo e a confidencialidade de todas as informações de caráter reservado fornecidas pelo CONTRATANTE, abstendo-se de utilizar tais informações para fins alheios ao objeto deste contrato.</p>
  
  <h2>6. DA LIMITAÇÃO DE RESPONSABILIDADE</h2>
  <p>6.1. A CONTRATADA obriga-se a atuar em conformidade com a Legislação vigente sobre Proteção de Dados Pessoais e as determinações de órgãos reguladores/fiscalizadores sobre a matéria, em especial a Lei 13.709/2018, além das demais normas e políticas de proteção de dados de cada país onde houver qualquer tipo de tratamento dos dados dos clientes e colaboradores da empresa.</p>

  <h2>7. DO FORO</h2>
  <p>7.1. As partes elegem, de comum acordo, o Foro Central da Comarca de Várzea Paulista/SP, como competente para dirimir quaisquer dúvidas oriundas do presente Contrato, com expressa renúncia de qualquer outro, presente ou futuro, por mais privilegiado que seja.</p>

  <h2>8. DA PROTEÇÃO DE DADOS</h2>
  <p>8.1. As PARTES se comprometem a cumprir integralmente a legislação vigente sobre Proteção de Dados Pessoais, em especial a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD), e as normas e políticas de proteção de dados aplicáveis nos países onde ocorrer qualquer tipo de tratamento dos dados dos clientes e colaboradores.</p>

  <p style="text-align: right; margin-top: 40px; margin-bottom: 20px;">
      Várzea Paulista, <b><span class="contract-var" data-var="data_contrato">25 de Julho de 2026</span></b>.
  </p>

  <!-- Área de Assinaturas das Partes -->
  <div class="signature-block">
      <div class="signature-line">
          <p>CONTRATANTE</p>
          <p style="margin-top: 12px; font-weight: bold;"><span class="contract-var" data-var="cliente_nome">Nome da Contratante</span></p>
      </div>
      <div class="signature-line">
          <p>CONTRATADA</p>
          <p style="margin-top: 12px; font-weight: bold;">VISI ASSESSORIA LTDA</p>
      </div>
  </div>

  <!-- Área de Assinaturas das Testemunhas limpa -->
  <div class="signature-block" style="margin-top: 60px;">
      <div class="signature-line">
          <p>Nome: Vitor Cavalcante de Oliveira</p>
          <p>CPF: 484.176.838-60</p>
      </div>
      <div class="signature-line">
          <p>Nome: Wellington dos Santos Cavalcante</p>
          <p>CPF: 417.550.588-10</p>
      </div>
  </div>

  <!-- Rodapé Institucional -->
  <div class="contract-footer" style="margin-top: 60px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 8pt; text-align: center; color: #777; font-family: Arial, sans-serif; text-indent: 0 !important;" contenteditable="false">
    VISI ASSESSORIA LTDA · CNPJ 50.174.894/0001-04 · Várzea Paulista - SP · contato@visimarketing.com.br
  </div>
`;

// Helper: Formata valores numéricos para moeda (Real R$)
function formatarMoeda(valor) {
  const num = parseFloat(valor);
  if (isNaN(num)) return '0,00';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mostra mensagem Toast temporária
function _showToast(msg) {
  const existing = document.querySelector('.contrato-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'contrato-toast';
  toast.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> <span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Atualiza o valor de todas as ocorrências de uma variável no editor do contrato
function updateVariable(varName, value) {
  if (_isEditingTemplate) return;
  const spans = document.querySelectorAll(`.a4-paper [data-var="${varName}"]`);
  spans.forEach(span => {
    span.textContent = value || `[${varName.toUpperCase().replace('_', ' ')}]`;
  });
}

// Atualiza as cláusulas 1.5, 2.2 e 2.3 de acordo com o adicional selecionado
function updateAdicionais() {
  if (_isEditingTemplate) return;

  const selectAdicional   = document.getElementById('select-adicional');
  const adicionalValInput = document.getElementById('input-val-adicional');
  const wrapVal           = document.getElementById('wrap-val-adicional');

  const selectedOption = selectAdicional ? selectAdicional.value : 'nenhum';
  const adicionalVal   = parseFloat(adicionalValInput ? adicionalValInput.value : 0) || 0;

  // Mostra/oculta o campo de valor do adicional
  if (wrapVal) {
    wrapVal.style.display = selectedOption !== 'nenhum' ? 'block' : 'none';
  }

  // --- CLÁUSULA 1.5: Descrição do Serviço Adicional Selecionado ---
  const wrapper15 = document.getElementById('section-1-5-wrapper');
  let html15 = '';

  if (selectedOption === 'sdr') {
    html15 = `
      <p>1.5. <b>Serviço de SDR (pré-vendedor):</b> A CONTRATADA disponibilizará um profissional (SDR) ao atendimento e qualificação dos leads gerados pelas campanhas de tráfego pago geridas no âmbito deste contrato. O serviço compreende: atendimento ativo dos contatos recebidos via WhatsApp, qualificação dos leads conforme critérios definidos em alinhamento com a CONTRATANTE; condução dos contatos qualificados para a etapa seguinte do processo comercial, seja reunião, visita ou outro objetivo definido; recuperação de contatos que não responderam ou não avançaram no processo; e organização e atualização do CRM da CONTRATANTE, quando houver ferramenta disponível. O serviço de SDR é voltado exclusivamente para os leads originados pelas campanhas de tráfego pago, não abrangendo prospecção ativa de novos contatos externos.</p>
    `;
  } else if (selectedOption === 'ml') {
    html15 = `
      <p>1.5. <b>Gestão de Mercado Livre:</b> A CONTRATADA prestará o serviço de gestão da conta do Mercado Livre da CONTRATANTE, compreendendo: cadastro e publicação de anúncios a partir das informações e materiais fornecidos pela CONTRATANTE; otimização dos títulos, descrições, categorias e atributos dos anúncios para melhor posicionamento orgânico na plataforma; gestão dos anúncios patrocinados via Mercado Ads, incluindo criação de campanhas; e monitoramento periódico dos resultados com ajustes de estratégia conforme desempenho. O investimento em Mercado Ads é de responsabilidade exclusiva da CONTRATANTE, não estando incluído no valor dos serviços prestados pela CONTRATADA.</p>
    `;
  } else if (selectedOption === 'sm') {
    html15 = `
      <p>1.5. <b>Gestão de Social Media:</b> A CONTRATADA prestará o serviço de produção e gestão de conteúdo para o Instagram da CONTRATANTE, compreendendo: visitas presenciais ao estabelecimento da CONTRATANTE duas vezes ao mês, em periodicidade quinzenal, para captação de materiais audiovisuais; gravação dos vídeos pela equipe da CONTRATADA durante as visitas; edição do material captado; envio do conteúdo editado para aprovação da CONTRATANTE antes da publicação; e publicação dos conteúdos aprovados no perfil do Instagram da CONTRATANTE.</p>
    `;
  }

  if (wrapper15) {
    wrapper15.innerHTML = html15;
  }

  // --- CLÁUSULA 2.2 e Re-numeração do Inadimplemento (2.3 para 2.2) ---
  const wrapper22 = document.getElementById('section-2-2-wrapper');
  const wrapperInadimplemento = document.getElementById('section-inadimplemento-wrapper');

  if (selectedOption !== 'nenhum') {
    if (wrapper22) {
      wrapper22.innerHTML = `
        <p>2.2. A CONTRATANTE pagará à CONTRATADA o valor mensal de R$ <b><span class="contract-var" data-var="valor_adicionais">${formatarMoeda(adicionalVal)}</span></b>, nas mesmas condições de vencimento e forma de pagamento estabelecidas na Cláusula 2.1.</p>
      `;
    }
    if (wrapperInadimplemento) {
      wrapperInadimplemento.innerHTML = `
        <p>2.3. Fica estipulado que, em caso de inadimplemento, incidirá sobre o montante devido multa de 2%, bem como juros moratórios de 1% ao mês, sem prejuízo da cobrança de honorários advocatícios fixados em 15% sobre o valor total da dívida, calculados pro rata, até o dia do efetivo pagamento.</p>
      `;
    }
  } else {
    if (wrapper22) {
      wrapper22.innerHTML = '';
    }
    if (wrapperInadimplemento) {
      wrapperInadimplemento.innerHTML = `
        <p>2.2. Fica estipulado que, em caso de inadimplemento, incidirá sobre o montante devido multa de 2%, bem como juros moratórios de 1% ao mês, sem prejuízo da cobrança de honorários advocatícios fixados em 15% sobre o valor total da dívida, calculados pro rata, até o dia do efetivo pagamento.</p>
      `;
    }
  }
}

// Sincroniza todas as variáveis do formulário para o contrato
function syncAllInputs() {
  if (_isEditingTemplate) return;

  const fields = [
    { id: 'input-cliente-nome',      var: 'cliente_nome' },
    { id: 'input-contrato-duracao',  var: 'contrato_duracao' },
    { id: 'input-data-contrato',     var: 'data_contrato' }
  ];

  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) {
      updateVariable(f.var, el.value);
    }
  });

  // Atualiza cláusulas adicionais
  updateAdicionais();
}

// ── Carregamento do Template (Supabase -> LocalStorage -> Fábrica) ──
async function _carregarTemplate() {
  let html = null;

  try {
    const { data, error } = await ContratosModelos.get('padrao_marketing');
    if (!error && data?.conteudo_html) {
      html = data.conteudo_html;
    }
  } catch (e) {
    console.warn('[Contratos] Não foi possível carregar do Supabase:', e);
  }

  if (!html) {
    html = localStorage.getItem('visi_contrato_template_padrao');
  }

  if (!html) {
    html = DEFAULT_CONTRACT_CONTENT;
  }

  _currentTemplateHTML = html;
  const docContainer = document.querySelector('.a4-paper .document-content');
  if (docContainer) {
    docContainer.innerHTML = _currentTemplateHTML;
  }
}

// ── Alterna Modo de Edição do Modelo Padrão ─────────────────────────
function _toggleModoEdicaoTemplate(ativar) {
  _isEditingTemplate = ativar;

  const paper        = document.getElementById('contract-editor');
  const banner       = document.getElementById('contract-edit-banner');
  const btnEdit      = document.getElementById('btn-toggle-edit-template');
  const btnPdf       = document.getElementById('btn-download-pdf');
  const btnWord      = document.getElementById('btn-download-contract');
  const btnSave      = document.getElementById('btn-save-template');
  const btnCancel    = document.getElementById('btn-cancel-edit-template');
  const btnRestore   = document.getElementById('btn-restore-template');
  const formPane     = document.querySelector('.contratos-form-pane');

  if (ativar) {
    paper?.classList.add('template-editing-mode');
    if (banner) banner.style.display = 'flex';
    if (btnEdit) btnEdit.style.display = 'none';
    if (btnPdf) btnPdf.style.display = 'none';
    if (btnWord) btnWord.style.display = 'none';
    if (btnSave) btnSave.style.display = 'inline-flex';
    if (btnCancel) btnCancel.style.display = 'inline-flex';
    if (btnRestore) btnRestore.style.display = 'inline-flex';

    if (formPane) {
      formPane.style.opacity = '0.45';
      formPane.style.pointerEvents = 'none';
    }

    // Transforma variáveis em Chips Protegidos
    document.querySelectorAll('.a4-paper .contract-var').forEach(span => {
      span.classList.add('contract-var--chip');
      span.setAttribute('contenteditable', 'false');
      const v = span.dataset.var;
      let label = `[${v.toUpperCase()}]`;
      if (v === 'cliente_nome') label = '🔒 [NOME DO CLIENTE]';
      else if (v === 'contrato_duracao') label = '🔒 [DURAÇÃO DO CONTRATO]';
      else if (v === 'data_contrato') label = '🔒 [DATA DO CONTRATO]';
      else if (v === 'valor_adicionais') label = '🔒 [VALOR DO ADICIONAL]';
      span.textContent = label;
    });

    // Coloca marcadores visuais protegidos nos blocos automáticos
    const w15 = document.getElementById('section-1-5-wrapper');
    if (w15) {
      w15.innerHTML = `<div class="contract-section--chip" contenteditable="false">🔒 [BLOCO DINÂMICO: Descrição do Serviço Adicional (SDR, Mercado Livre ou Social Media)]</div>`;
    }
    const w22 = document.getElementById('section-2-2-wrapper');
    if (w22) {
      w22.innerHTML = `<div class="contract-section--chip" contenteditable="false">🔒 [BLOCO DINÂMICO: Cláusula de Valor do Serviço Adicional]</div>`;
    }
    const wInad = document.getElementById('section-inadimplemento-wrapper');
    if (wInad) {
      wInad.innerHTML = `<div class="contract-section--chip" contenteditable="false">🔒 [BLOCO DINÂMICO: Cláusula de Inadimplemento e Multa]</div>`;
    }

  } else {
    paper?.classList.remove('template-editing-mode');
    if (banner) banner.style.display = 'none';
    if (btnEdit) btnEdit.style.display = 'inline-flex';
    if (btnPdf) btnPdf.style.display = 'inline-flex';
    if (btnWord) btnWord.style.display = 'inline-flex';
    if (btnSave) btnSave.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnRestore) btnRestore.style.display = 'none';

    if (formPane) {
      formPane.style.opacity = '1';
      formPane.style.pointerEvents = 'auto';
    }
  }
}

// Salva o modelo editado pelo usuário
async function _salvarTemplate() {
  const docContainer = document.querySelector('.a4-paper .document-content');
  if (!docContainer) return;

  const btnSave = document.getElementById('btn-save-template');
  if (btnSave) btnSave.innerHTML = 'Salvando...';

  // Clona para limpar chips antes de salvar o HTML base
  const clone = docContainer.cloneNode(true);

  // Remove chips de variáveis, voltando para spans padrão
  clone.querySelectorAll('.contract-var').forEach(span => {
    span.classList.remove('contract-var--chip');
    span.removeAttribute('contenteditable');
    const v = span.dataset.var;
    if (v === 'cliente_nome') span.textContent = 'Nome da Contratante';
    else if (v === 'contrato_duracao') span.textContent = '03 (três) meses';
    else if (v === 'data_contrato') span.textContent = '25 de Julho de 2026';
    else span.textContent = `[${v.toUpperCase()}]`;
  });

  // Limpa o conteúdo interno dos wrappers dinâmicos para ficarem prontos para injeção
  const w15 = clone.querySelector('#section-1-5-wrapper');
  if (w15) w15.innerHTML = '';
  const w22 = clone.querySelector('#section-2-2-wrapper');
  if (w22) w22.innerHTML = '';
  const wInad = clone.querySelector('#section-inadimplemento-wrapper');
  if (wInad) wInad.innerHTML = '';

  const novoHTML = clone.innerHTML;

  // Persiste no Supabase e LocalStorage
  _currentTemplateHTML = novoHTML;
  localStorage.setItem('visi_contrato_template_padrao', novoHTML);

  try {
    await ContratosModelos.save('padrao_marketing', novoHTML);
  } catch (err) {
    console.warn('[Contratos] Erro ao salvar modelo no Supabase:', err);
  }

  // Restaura o docContainer com o novo template limpo
  docContainer.innerHTML = _currentTemplateHTML;

  _toggleModoEdicaoTemplate(false);
  syncAllInputs();

  if (btnSave) {
    btnSave.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Salvar Modelo`;
  }

  _showToast('Modelo padrão atualizado com sucesso!');
}

// Cancela o modo de edição sem salvar
function _cancelarEdicaoTemplate() {
  const docContainer = document.querySelector('.a4-paper .document-content');
  if (docContainer && _currentTemplateHTML) {
    docContainer.innerHTML = _currentTemplateHTML;
  }
  _toggleModoEdicaoTemplate(false);
  syncAllInputs();
}

// Restaura o modelo de fábrica original
async function _restaurarPadraoFabrica() {
  if (!confirm('Deseja restaurar o modelo de contrato original de fábrica da Visi Assessoria? Todas as personalizações salvas serão removidas.')) {
    return;
  }

  try {
    await ContratosModelos.reset('padrao_marketing');
  } catch (e) {}

  localStorage.removeItem('visi_contrato_template_padrao');
  _currentTemplateHTML = DEFAULT_CONTRACT_CONTENT;

  const docContainer = document.querySelector('.a4-paper .document-content');
  if (docContainer) {
    docContainer.innerHTML = DEFAULT_CONTRACT_CONTENT;
  }

  _toggleModoEdicaoTemplate(false);
  syncAllInputs();

  _showToast('Modelo restaurado para o padrão original de fábrica!');
}

// Inicializa os escutadores de eventos (Input listeners)
function bindFormEvents() {
  const elements = [
    'input-cliente-nome',
    'input-contrato-duracao',
    'input-data-contrato'
  ];

  elements.forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      const field = e.target;
      const varName = field.id.replace('input-', '').replace(/-/g, '_');
      updateVariable(varName, field.value);
    });
  });

  // Escuta seleção de serviço adicional
  document.getElementById('select-adicional')?.addEventListener('change', () => {
    const select   = document.getElementById('select-adicional');
    const valInput = document.getElementById('input-val-adicional');
    if (select && valInput) {
      if (select.value === 'sdr') valInput.value = 800;
      else if (select.value === 'ml') valInput.value = 1000;
      else if (select.value === 'sm') valInput.value = 1200;
      else valInput.value = 0;
    }
    updateAdicionais();
  });

  // Escuta valor do serviço adicional
  document.getElementById('input-val-adicional')?.addEventListener('input', updateAdicionais);

  // Botões de ação normais
  document.getElementById('btn-download-pdf')?.addEventListener('click', exportarPDF);
  document.getElementById('btn-download-contract')?.addEventListener('click', exportarWord);

  // Botões do modo de edição do modelo
  document.getElementById('btn-toggle-edit-template')?.addEventListener('click', () => _toggleModoEdicaoTemplate(true));
  document.getElementById('btn-save-template')?.addEventListener('click', _salvarTemplate);
  document.getElementById('btn-cancel-edit-template')?.addEventListener('click', _cancelarEdicaoTemplate);
  document.getElementById('btn-restore-template')?.addEventListener('click', _restaurarPadraoFabrica);
}

// Exporta o contrato atual editado como arquivo PDF
function exportarPDF() {
  const editor = document.getElementById('contract-editor');
  if (!editor) return;

  // Clona o editor para limpar estilos auxiliares (highlight azul/tracejado das variáveis)
  const clone = editor.cloneNode(true);
  clone.querySelectorAll('.contract-var').forEach(span => {
    span.removeAttribute('style');
    span.style.backgroundColor = 'transparent';
    span.style.borderBottom = 'none';
    span.style.fontWeight = 'bold';
    span.style.color = '#000000';
  });

  // Remove contenteditable das tags internas do clone
  clone.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
  });
  clone.removeAttribute('contenteditable');

  const clienteNome = document.getElementById('input-cliente-nome')?.value || 'Cliente';
  const contentHTML = clone.innerHTML;

  // Cria um iframe invisível para a impressão
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>${clienteNome}</title>
      <style>
        @page {
          size: A4;
          margin-top: 1.8cm;
          margin-bottom: 1.8cm;
          margin-left: 0cm;
          margin-right: 0cm;
        }
        @page :first {
          margin-top: 0cm;
          margin-bottom: 1.8cm;
        }
        body {
          font-family: Arial, sans-serif;
          color: #000000;
          margin: 0;
          padding: 0;
          background-color: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header-rectangle {
          background-color: #3A3838;
          height: 2.09cm;
          width: 100%;
        }
        .document-content {
          padding: 40px 70px;
          text-align: justify;
        }
        h1 {
          font-size: 14pt;
          font-weight: bold;
          text-align: center;
          margin-top: 0;
          margin-bottom: 40px;
          text-transform: uppercase;
        }
        h2 {
          font-size: 9pt;
          font-weight: bold;
          text-decoration: underline;
          margin-top: 25px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        p {
          font-size: 9pt;
          font-weight: normal;
          margin-bottom: 15px;
          line-height: 1.5;
        }
        .signature-block {
          margin-top: 80px;
          display: flex;
          justify-content: space-between;
          page-break-inside: avoid;
        }
        .signature-line {
          width: 45%;
          text-align: center;
        }
        .signature-line p {
          margin: 3px 0;
          text-align: center;
        }
        .contract-footer {
          margin-top: 60px;
          border-top: 1px solid #ddd;
          padding-top: 8px;
          font-size: 8pt;
          text-align: center;
          color: #777;
          font-family: Arial, sans-serif;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      ${contentHTML}
    </body>
    </html>
  `);
  doc.close();

  // Executa o comando de impressão nativo
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
}

// Exporta o contrato atual editado como arquivo Word (.doc) compatível com MS Word / Google Docs
function exportarWord() {
  const editor = document.getElementById('contract-editor');
  if (!editor) return;

  // Clona o editor para limpar estilos auxiliares (highlight azul/tracejado das variáveis)
  const clone = editor.cloneNode(true);
  clone.querySelectorAll('.contract-var').forEach(span => {
    span.removeAttribute('style');
    span.style.backgroundColor = 'transparent';
    span.style.borderBottom = 'none';
    span.style.fontWeight = 'bold';
    span.style.color = '#000000';
  });

  // Remove contenteditable das tags internas do clone
  clone.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
  });

  clone.removeAttribute('contenteditable');

  const htmlContent = clone.innerHTML;
  const clienteNome = document.getElementById('input-cliente-nome')?.value || 'Cliente';
  const filename = `${clienteNome}.doc`;

  // HTML estruturado com XML do Microsoft Office para abrir nativamente como layout de impressão formatado
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${clienteNome}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: A4;
          margin: 0cm; /* Permite que a faixa cinza vá até o topo */
        }
        @page WordSection1 {
          size: A4;
          margin: 0cm;
        }
        body {
          font-family: Arial, sans-serif;
          color: #000000;
          margin: 0;
          padding: 0;
        }
        .header-rectangle {
          background-color: #3A3838;
          height: 2.09cm;
          width: 100%;
        }
        .document-content {
          padding: 40px 70px;
          text-align: justify;
        }
        h1 {
          font-size: 14pt;
          font-weight: bold;
          text-align: center;
          margin-top: 0;
          margin-bottom: 40px;
        }
        h2 {
          font-size: 9pt;
          font-weight: bold;
          text-decoration: underline;
          margin-top: 25px;
          margin-bottom: 10px;
        }
        p {
          font-size: 9pt;
          font-weight: normal;
          margin-bottom: 15px;
          line-height: 1.5;
        }
        .signature-block {
          margin-top: 80px;
          display: table;
          width: 100%;
        }
        .signature-line {
          display: table-cell;
          width: 45%;
          text-align: center;
        }
        .signature-line p {
          margin: 3px 0;
          text-align: center;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + header], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────
//  PÁGINA E CICLO DE VIDA DO ROTEADOR
// ─────────────────────────────────────────────────────────────────

export default {
  render() {
    return `
      <div class="page-header">
        <div class="page-title-block">
          <h1>Gerador de Contratos</h1>
          <p>Criação simplificada de termos contratuais com visualização em tempo real</p>
        </div>
      </div>

      <div class="contratos-container">
        
        <!-- Formulário de Inputs (Esquerda) -->
        <div class="contratos-form-pane">
          
          <div>
            <h3 class="form-section-title">
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Dados do Cliente
            </h3>
            
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
              <div class="form-group">
                <label for="input-cliente-nome">Nome do Cliente</label>
                <input type="text" id="input-cliente-nome" class="form-input" placeholder="Ex: Acme Corp Ltda" value="Nome da Contratante">
              </div>
            </div>
          </div>

          <div style="border-top: 1px solid var(--border-light); padding-top: 15px;">
            <h3 class="form-section-title">
              <svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              Serviços Adicionais
            </h3>
            
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
              <div class="form-group">
                <label for="select-adicional">Item Adicional</label>
                <select id="select-adicional" class="form-select">
                  <option value="nenhum">Nenhum</option>
                  <option value="sdr">Serviço de SDR (pré-vendedor)</option>
                  <option value="ml">Gestão de Mercado Livre</option>
                  <option value="sm">Gestão de Social Media</option>
                </select>
              </div>

              <div class="form-group" id="wrap-val-adicional" style="display: none;">
                <label for="input-val-adicional">Valor do Adicional (R$)</label>
                <input type="number" id="input-val-adicional" class="form-input" value="0" step="50">
              </div>
            </div>
          </div>

          <div style="border-top: 1px solid var(--border-light); padding-top: 15px;">
            <h3 class="form-section-title">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Prazos e Datas
            </h3>
            
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
              <div class="form-group">
                <label for="input-contrato-duracao">Duração Inicial Mínima</label>
                <input type="text" id="input-contrato-duracao" class="form-input" value="03 (três) meses" placeholder="Ex: 03 (três) meses">
              </div>
              
              <div class="form-group">
                <label for="input-data-contrato">Dia de Hoje</label>
                <input type="text" id="input-data-contrato" class="form-input" value="25 de Julho de 2026" placeholder="Ex: 25 de Julho de 2026">
              </div>
            </div>
          </div>

          <div style="display: none;">
            <!-- Dados estáticos em hidden inputs apenas para referência de sync se necessário -->
            <input type="hidden" id="input-contratada-nome" value="VISI ASSESSORIA LTDA">
            <input type="hidden" id="input-contratada-cnpj" value="50.174.894/0001-04">
            <input type="hidden" id="input-cliente-cnpj" value="65.639.046/0001-09">
            <input type="hidden" id="input-dia-vencimento" value="10">
            <input type="hidden" id="input-foro-comarca" value="Várzea Paulista/SP">
          </div>

        </div>

        <!-- Visualização Interativa / Preview A4 (Direita) -->
        <div class="contratos-preview-pane">
          
          <div class="preview-controls">
            <div class="preview-controls-left">
              <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: var(--black); display: flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--cyan)" fill="none" stroke-width="2" style="margin-right: 4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Modelo de Contrato
              </h3>
            </div>
            
            <div class="preview-actions">
              <!-- Botão para entrar no modo de edição do modelo padrão -->
              <button id="btn-toggle-edit-template" class="btn btn-ghost" style="border-color: #6366f1; color: #6366f1;" title="Editar modelo padrão oficial">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar Modelo Padrão
              </button>

              <!-- Botões normais -->
              <button id="btn-download-pdf" class="btn btn-ghost" style="border-color: var(--cyan); color: var(--cyan);" title="Salvar como PDF">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Salvar PDF
              </button>

              <button id="btn-download-contract" class="btn btn-primary" title="Baixar arquivo Word para envio">
                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Baixar Word
              </button>

              <!-- Botões exibidos durante o Modo de Edição do Modelo -->
              <button id="btn-save-template" class="btn btn-primary" style="display: none; background: #10B981; border-color: #10B981;" title="Gravar alterações no modelo padrão">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Salvar Modelo
              </button>

              <button id="btn-cancel-edit-template" class="btn btn-ghost" style="display: none;" title="Descartar alterações e sair">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Cancelar
              </button>

              <button id="btn-restore-template" class="btn btn-ghost" style="display: none; border-color: #EF4444; color: #EF4444;" title="Redefinir para o contrato original de fábrica">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                Restaurar Padrão de Fábrica
              </button>
            </div>
          </div>

          <div class="paper-scroll-container">
            
            <!-- Banner informativo do Modo de Edição -->
            <div id="contract-edit-banner" class="contract-edit-banner" style="display: none;">
              <div class="contract-edit-banner-text">
                <b>Modo Edição de Modelo Padrão:</b> Altere livremente os textos fixos, títulos e parágrafos do contrato. As variáveis destacadas em <b>chips ciano</b> e os blocos de adicionais em <b>roxo</b> estão protegidos contra edições internas acidentais.
              </div>
            </div>

            <div class="a4-paper" id="contract-editor" contenteditable="true" spellcheck="false">
              
              <!-- Faixa cinza superior -->
              <div class="header-rectangle" contenteditable="false"></div>

              <div class="document-content">
                <!-- Conteúdo dinâmico injetado por _carregarTemplate() -->
              </div>

            </div>

          </div>

        </div>

      </div>
    `;
  },

  async onMount() {
    console.log('[Contratos] Página montada.');

    // 1. Carrega o template (Supabase / LocalStorage / Default)
    await _carregarTemplate();

    // 2. Sincroniza dados do formulário com o template carregado
    syncAllInputs();

    // 3. Liga os eventos do formulário e botões
    bindFormEvents();
  },

  onDestroy() {
    _isEditingTemplate = false;
    console.log('[Contratos] Página destruída.');
  }
};

