/**
 * db.js — Camada de acesso a dados do CRM Visi Marketing
 *
 * Centraliza todas as queries ao Supabase.
 * Nenhuma página deve chamar `supabase` diretamente — use as funções daqui.
 *
 * Padrão de retorno: { data, error }
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TABELAS:
 *
 *   ✅ usuarios      — Perfis dos usuários do CRM (ATIVA)
 *   🔲 leads         — Leads/Contatos do pipeline
 *   🔲 clientes      — Clientes convertidos
 *   🔲 tarefas       — Tarefas e follow-ups
 *   🔲 oportunidades — Negócios no funil de vendas
 *   ✅ negocios       — Negócios cadastrados no CRM (ATIVA)
 * ─────────────────────────────────────────────────────────────────────────
 */


import { supabase } from './supabase.js';

/**
 * Retorna o timestamp atual no fuso horário de Brasília (UTC−3, America/Sao_Paulo).
 * Brasil não adota horário de verão desde 2019, logo sempre −3h.
 * Uso: nowBrasilia() → "2026-04-29T22:04:06-03:00"
 */
function nowBrasilia() {
  return new Date()
    .toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    .replace(' ', 'T') + '-03:00';
}

// ══════════════════════════════════════════════════════════════════
//  LEADS
// ══════════════════════════════════════════════════════════════════

export const Leads = {
  /** Retorna todos os leads, ordenados por data de criação */
  async getAll() {
    return supabase.from('leads').select('*').order('created_at', { ascending: false });
  },

  /** Retorna um lead pelo ID */
  async getById(id) {
    return supabase.from('leads').select('*').eq('id', id).single();
  },

  /** Cria um novo lead */
  async create(payload) {
    return supabase.from('leads').insert(payload).select().single();
  },

  /** Atualiza um lead pelo ID */
  async update(id, payload) {
    return supabase.from('leads').update(payload).eq('id', id).select().single();
  },

  /** Remove um lead pelo ID */
  async delete(id) {
    return supabase.from('leads').delete().eq('id', id);
  },
};

// ══════════════════════════════════════════════════════════════════
//  CLIENTES
// ══════════════════════════════════════════════════════════════════

export const Clientes = {
  async getAll() {
    return supabase.from('clientes').select('*').order('nome');
  },

  async getById(id) {
    return supabase.from('clientes').select('*').eq('id', id).single();
  },

  async create(payload) {
    return supabase.from('clientes').insert(payload).select().single();
  },

  async update(id, payload) {
    return supabase.from('clientes').update(payload).eq('cliente_id', id).select().single();
  },

  /**
   * Atualiza os dados de um cliente pelo cliente_id com timestamp automático.
   * Usado pelo drawer de edição da página de Clientes.
   */
  async updateCliente(clienteId, payload) {
    return supabase
      .from('clientes')
      .update({ ...payload, ultima_atualizacao: nowBrasilia() })
      .eq('cliente_id', clienteId)
      .select()
      .single();
  },

  async delete(id) {
    return supabase.from('clientes').delete().eq('cliente_id', id);
  },

  /**
   * Retorna todos os clientes com status 'Ativado' do usuário.
   * KPI: Clientes Ativos (Operações)
   */
  async getAtivos(userId) {
    return supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact' })
      .eq('cliente_status', 'Ativado')
      .eq('user_id', userId);
  },

  /**
   * Retorna clientes com cliente_otimizacao = FALSE do usuário.
   * KPI: Clientes para Otimizar (Operações)
   */
  async getParaOtimizar(userId) {
    return supabase
      .from('clientes')
      .select('cliente_id', { count: 'exact' })
      .eq('cliente_otimizacao', false)
      .eq('user_id', userId);
  },

  /**
   * Retorna as notas dos 3 pilares de saúde dos clientes Ativos do usuário.
   * Usado para calcular a Saúde Média com base em nota_comunicacao,
   * nota_entrega e nota_performance (todas numeric, 0–10).
   */
  async getSaudeMedia(userId) {
    return supabase
      .from('clientes')
      .select('nota_comunicacao, nota_entrega, nota_performance')
      .eq('cliente_status', 'Ativado')
      .eq('user_id', userId);
  },

  /**
   * Retorna todos os churns do usuário no ano atual.
   * Usado para montar o gráfico mensal de Churn.
   * Filtra por data_churn dentro do ano corrente.
   */
  async getChurnAnoAtual(userId) {
    const ano    = new Date().getUTCFullYear();
    const inicio = new Date(Date.UTC(ano, 0, 1)).toISOString();
    const fim    = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999)).toISOString();

    return supabase
      .from('clientes')
      .select('data_churn')
      .eq('user_id', userId)
      .eq('cliente_churn', true)
      .gte('data_churn', inicio)
      .lte('data_churn', fim);
  },

  /**
   * Retorna todos os novos clientes do usuário no ano atual.
   * Usado para montar o gráfico mensal de Novos Clientes.
   * Filtra por criado_em dentro do ano corrente.
   */
  async getNovosAnoAtual(userId) {
    const ano    = new Date().getUTCFullYear();
    const inicio = new Date(Date.UTC(ano, 0, 1)).toISOString();
    const fim    = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999)).toISOString();

    return supabase
      .from('clientes')
      .select('criado_em')
      .eq('user_id', userId)
      .gte('criado_em', inicio)
      .lte('criado_em', fim);
  },

  /**
   * Retorna todos os churns do ano atual — SEM filtro de usuário.
   * KPI global: Evolução da Carteira (Operações — visão de todos os usuários)
   */
  async getChurnAnoTodos() {
    const ano    = new Date().getUTCFullYear();
    const inicio = new Date(Date.UTC(ano, 0, 1)).toISOString();
    const fim    = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999)).toISOString();

    return supabase
      .from('clientes')
      .select('data_churn')
      .eq('cliente_churn', true)
      .gte('data_churn', inicio)
      .lte('data_churn', fim);
  },

  /**
   * Retorna todos os novos clientes do ano atual — SEM filtro de usuário.
   * KPI global: Evolução da Carteira (Operações — visão de todos os usuários)
   */
  async getNovosAnoTodos() {
    const ano    = new Date().getUTCFullYear();
    const inicio = new Date(Date.UTC(ano, 0, 1)).toISOString();
    const fim    = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999)).toISOString();

    return supabase
      .from('clientes')
      .select('criado_em')
      .gte('criado_em', inicio)
      .lte('criado_em', fim);
  },

  /**
   * Retorna todos os clientes do usuário logado, ordenados por nome.
   * Usado pela página de Clientes para listar a carteira completa.
   * @param {string} userId - UUID do usuário logado
   */
  async getAllPorUsuario(userId) {
    return supabase
      .from('clientes')
      .select(`
        cliente_id,
        negocio_id,
        user_id,
        cliente_nome,
        cliente_telefone,
        cliente_email,
        cliente_status,
        cliente_churn,
        cliente_risco_churn,
        cliente_otimizacao,
        cliente_satisfacao,
        cliente_campanha_status,
        nota_comunicacao,
        nota_entrega,
        nota_performance,
        investimento_midia,
        cliente_mensalidade,
        segmento,
        contexto_geral,
        descricao_empresa,
        criado_em,
        ultima_atualizacao,
        data_envio_nps,
        data_recontato,
        cliente_origem,
        data_churn,
        receita_perdida,
        motivo_churn,
        cliente_contrato,
        contrato_duracao
      `)
      .eq('user_id', userId)
      .order('cliente_nome', { ascending: true });
  },

  /**
   * Retorna TODOS os clientes sem filtro de user_id.
   * Exclusivo para usuários com cargo Administrador.
   */
  async getAllAdmin() {
    return supabase
      .from('clientes')
      .select(`
        cliente_id,
        negocio_id,
        user_id,
        cliente_nome,
        cliente_telefone,
        cliente_email,
        cliente_status,
        cliente_churn,
        cliente_risco_churn,
        cliente_otimizacao,
        cliente_satisfacao,
        cliente_campanha_status,
        nota_comunicacao,
        nota_entrega,
        nota_performance,
        investimento_midia,
        cliente_mensalidade,
        segmento,
        contexto_geral,
        descricao_empresa,
        criado_em,
        ultima_atualizacao,
        data_envio_nps,
        data_recontato,
        cliente_origem,
        data_churn,
        receita_perdida,
        motivo_churn,
        cliente_contrato,
        contrato_duracao
      `)
      .order('cliente_nome', { ascending: true });
  },

  /**
   * Busca dados complementares para a visão lista:
   * - Todos os registros de faturamento_cliente (para soma por cliente)
   * - Todos os registros de contato_clientes (para contagem por tipo e cliente)
   * Retorna { faturamentos: [], contatos: [] }
   */
  async getResumoLista() {
    const [fatRes, ctRes] = await Promise.all([
      supabase
        .from('faturamento_cliente')
        .select('cliente_id, faturamento_valor'),
      supabase
        .from('contato_clientes')
        .select('cliente_id, contato_tipo, contato_data'),
    ]);
    return {
      faturamentos: fatRes.data || [],
      contatos:     ctRes.data  || [],
    };
  },

  /**
   * Altera o status de um cliente para 'Ativado'.
   * Chamado automaticamente ao concluir todas as tarefas de onboarding.
   * @param {number} clienteId
   */
  async ativar(clienteId) {
    return supabase
      .from('clientes')
      .update({ cliente_status: 'Ativado', ultima_atualizacao: nowBrasilia() })
      .eq('cliente_id', clienteId);
  },

  /**
   * Retorna todos os clientes com campos relevantes para o ranking de gestores.
   * Sem filtro — visão global. Agrupamento por user_id é feito no client-side.
   */
  async getTodosParaRanking() {
    return supabase
      .from('clientes')
      .select('user_id, cliente_status, cliente_satisfacao, cliente_churn, data_churn, cliente_otimizacao');
  },

  /**
   * Retorna os valores distintos de cliente_origem já cadastrados,
   * para popular o autocomplete no GanhoModal.
   */
  async getOrigens() {
    return supabase
      .from('clientes')
      .select('cliente_origem')
      .not('cliente_origem', 'is', null)
      .neq('cliente_origem', '')
      .order('cliente_origem', { ascending: true });
  },

  /**
   * Registra o churn de um cliente:
   * seta cliente_churn=true, data_churn, receita_perdida e cliente_status='Desativado'.
   * @param {number} clienteId
   * @param {string} dataChurn   ISO date string (YYYY-MM-DD)
   * @param {number} receitaPerdida
   */
  async registrarChurn(clienteId, dataChurn, receitaPerdida, motivoChurn) {
    return supabase
      .from('clientes')
      .update({
        cliente_churn:    true,
        data_churn:       dataChurn,
        receita_perdida:  receitaPerdida ?? null,
        motivo_churn:     motivoChurn    || null,
        cliente_status:   'Desativado',
        ultima_atualizacao: nowBrasilia(),
      })
      .eq('cliente_id', clienteId);
  },

  /** Remove o cliente permanentemente da tabela clientes. */
  async delete(clienteId) {
    return supabase
      .from('clientes')
      .delete()
      .eq('cliente_id', clienteId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  FATURAMENTO DO CLIENTE (mensal)
// ══════════════════════════════════════════════════════════════════

export const FaturamentoCliente = {
  /** Retorna o histórico de faturamento de um cliente, mais recente primeiro. */
  async getByClienteId(clienteId) {
    return supabase
      .from('faturamento_cliente')
      .select('faturamento_id, cliente_id, faturamento_data, faturamento_valor')
      .eq('cliente_id', clienteId)
      .order('faturamento_data', { ascending: false });
  },

  /** Insere novo faturamento mensal. */
  async create(clienteId, faturamentoData, faturamentoValor) {
    return supabase
      .from('faturamento_cliente')
      .insert({ cliente_id: clienteId, faturamento_data: faturamentoData, faturamento_valor: faturamentoValor })
      .select()
      .single();
  },

  /** Remove um faturamento pelo ID. */
  async deleteById(faturamentoId) {
    return supabase.from('faturamento_cliente').delete().eq('faturamento_id', faturamentoId);
  },

  /**
   * Atualiza data e valor de um faturamento existente.
   * @param {number} faturamentoId
   * @param {string} faturamentoData  - nova data ISO
   * @param {number} faturamentoValor - novo valor
   */
  async updateById(faturamentoId, faturamentoData, faturamentoValor) {
    return supabase
      .from('faturamento_cliente')
      .update({ faturamento_data: faturamentoData, faturamento_valor: faturamentoValor })
      .eq('faturamento_id', faturamentoId)
      .select()
      .single();
  },

  /**
   * Busca todos os registros de faturamento (para montar mapa de total por cliente na view lista).
   */
  async getAllForList() {
    return supabase
      .from('faturamento_cliente')
      .select('cliente_id, faturamento_valor');
  },
};

// ══════════════════════════════════════════════════════════════════
//  CONTATOS COM CLIENTES
// ══════════════════════════════════════════════════════════════════

export const ContatoClientes = {
  /**
   * Retorna todos os contatos de um cliente, do mais recente ao mais antigo.
   * @param {number} clienteId
   */
  async getByClienteId(clienteId) {
    return supabase
      .from('contato_clientes')
      .select('contato_id, cliente_id, contato_tipo, contato_data')
      .eq('cliente_id', clienteId)
      .order('contato_data', { ascending: false });
  },

  /**
   * Cria um novo contato (tipo: 'Reunião' | 'Outro').
   * @param {number} clienteId
   * @param {'Reunião'|'Outro'} contatoTipo
   */
  async create(clienteId, contatoTipo) {
    return supabase
      .from('contato_clientes')
      .insert({
        cliente_id:   clienteId,
        contato_tipo: contatoTipo,
        contato_data: new Date().toISOString(),
      })
      .select()
      .single();
  },

  /**
   * Remove um contato pelo ID.
   * @param {number} contatoId
   */
  async deleteById(contatoId) {
    return supabase.from('contato_clientes').delete().eq('contato_id', contatoId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  FEEDBACK DE CAMPANHAS
// ══════════════════════════════════════════════════════════════════

export const FeedbackCampanhas = {
  /** Retorna todos os feedbacks de campanha de um cliente, mais recentes primeiro. */
  async getByClienteId(clienteId) {
    return supabase
      .from('feedback_campanhas')
      .select('feedback_id, cliente_id, feedback_texto, criado_em')
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: false });
  },

  /** Cria um novo feedback de campanha. */
  async create(clienteId, feedbackTexto) {
    const { data: { user } } = await supabase.auth.getUser();
    return supabase
      .from('feedback_campanhas')
      .insert({ cliente_id: clienteId, feedback_texto: feedbackTexto, user_id: user?.id ?? null })
      .select()
      .single();
  },

  /** Remove um feedback pelo ID. */
  async deleteById(feedbackId) {
    return supabase
      .from('feedback_campanhas')
      .delete()
      .eq('feedback_id', feedbackId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  REUNIÕES
// ══════════════════════════════════════════════════════════════════

export const Reunioes = {
  /** Retorna reuniões de um cliente, mais recentes primeiro. */
  async getByClienteId(clienteId) {
    return supabase
      .from('reunioes')
      .select('reuniao_id, reuniao_titulo, reuniao_data, reuniao_notas, cliente_id')
      .eq('cliente_id', clienteId)
      .order('reuniao_data', { ascending: false });
  },

  /** Cria uma nova reunião vinculada a um cliente. */
  async create(payload) {
    return supabase.from('reunioes').insert(payload).select().single();
  },

  /** Remove uma reunião pelo ID. */
  async delete(reuniaoId) {
    return supabase.from('reunioes').delete().eq('reuniao_id', reuniaoId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  FEEDBACK SEMANAL DE CLIENTES
// ══════════════════════════════════════════════════════════════════

export const ClienteFeedback = {
  /** Retorna todos os feedbacks de um cliente, mais recentes primeiro. */
  async getByClienteId(clienteId) {
    return supabase
      .from('clientes_feedback')
      .select('feedback_id, cliente_id, user_id, feedback_semana, feedback_humor, feedback_texto, criado_em')
      .eq('cliente_id', clienteId)
      .order('feedback_semana', { ascending: false });
  },

  /**
   * Verifica se já existe feedback para a semana atual.
   * @param {number} clienteId
   * @param {string} feedbackSemana  formato 'YYYY-MM-DD' (segunda-feira da semana)
   */
  async getBySemana(clienteId, feedbackSemana) {
    return supabase
      .from('clientes_feedback')
      .select('feedback_id')
      .eq('cliente_id', clienteId)
      .eq('feedback_semana', feedbackSemana)
      .maybeSingle();
  },

  /** Cria um novo feedback semanal. */
  async create(payload) {
    return supabase
      .from('clientes_feedback')
      .insert(payload)
      .select()
      .single();
  },
};

// ══════════════════════════════════════════════════════════════════
//  TAREFAS
// ══════════════════════════════════════════════════════════════════

export const Tarefas = {
  async getAll() {
    return supabase.from('tarefas').select('*').order('data_vencimento');
  },

  async getById(id) {
    return supabase.from('tarefas').select('*').eq('id', id).single();
  },

  async create(payload) {
    return supabase.from('tarefas').insert(payload).select('tarefa_id, tarefa_titulo, tarefa_descricao, tarefa_vencimento, tarefa_status, tarefa_prioridade, negocio_id, criado_em, data_inicio, data_conclusao, vendedor_id, usuarios(user_nome)').single();
  },

  /**
   * Insere múltiplas tarefas de uma só vez.
   * @param {Array<Object>} payloads - Array de objetos com os dados de cada tarefa
   */
  async createBulk(payloads) {
    return supabase.from('tarefas').insert(payloads).select('tarefa_id, tarefa_titulo, tarefa_descricao, tarefa_vencimento, tarefa_status, tarefa_prioridade, negocio_id, criado_em, data_inicio, data_conclusao, vendedor_id, usuarios(user_nome)');
  },


  async update(id, payload) {
    return supabase.from('tarefas').update(payload).eq('id', id).select().single();
  },

  async delete(id) {
    return supabase.from('tarefas').delete().eq('id', id);
  },

  /**
   * Retorna as tarefas do vendedor ordenadas da mais antiga para a mais nova
   * (tarefa_vencimento ASC). Filtrado pelo vendedor_id do usuário logado.
   *
   * @param {string} vendedorId
   * @param {number} limit - máximo de tarefas a retornar (padrão: 10)
   */
  async getRecentesPorVendedor(vendedorId, limit = 6) {
    return supabase
      .from('tarefas')
      .select('tarefa_id, tarefa_titulo, tarefa_vencimento, tarefa_status, tarefa_descricao, negocio_id')
      .eq('vendedor_id', vendedorId)
      .eq('tarefa_status', false)
      .order('tarefa_vencimento', { ascending: true })
      .limit(limit);
  },

  /**
   * Retorna tarefas pendentes (tarefa_status = false) para uma lista de negocio_ids.
   * Usado pelo KanbanBoard para exibir o badge de tarefas nos cards.
   * @param {number[]} negocioIds - array de IDs de negócios
   */
  async getPendentesPorNegocios(negocioIds) {
    if (!negocioIds?.length) return { data: [], error: null };
    return supabase
      .from('tarefas')
      .select('tarefa_id, negocio_id, usuarios(user_nome)')
      .in('negocio_id', negocioIds)
      .eq('tarefa_status', false);
  },

  /**
   * Retorna todas as tarefas de um negócio específico (para o painel de detalhes).
   * @param {number} negocioId
   */
  async getByNegocio(negocioId) {
    return supabase
      .from('tarefas')
      .select('tarefa_id, tarefa_titulo, tarefa_descricao, tarefa_vencimento, tarefa_status, usuarios(user_nome)')
      .eq('negocio_id', negocioId)
      .order('tarefa_vencimento', { ascending: true });
  },

  /**
   * Marca uma tarefa como concluída (tarefa_status = true).
   * Atualiza o tempo acumulado e registra data_conclusao.
   * @param {number} tarefaId
   * @param {number} tempoAcumulado - tempo total em milissegundos
   */
  async concluir(tarefaId, tempoAcumulado = 0) {
    return supabase
      .from('tarefas')
      .update({
        tarefa_status:  true,
        data_conclusao: nowBrasilia(),
        data_inicio:    null,
        tempo_acumulado_ms: tempoAcumulado
      })
      .eq('tarefa_id', tarefaId);
  },

  /**
   * Cria uma nova tarefa para um negócio.
   * @param {Object} payload - { tarefa_titulo, negocio_id, tarefa_status, vendedor_id, tarefa_vencimento? }
   */
  async criar(payload) {
    return supabase
      .from('tarefas')
      .insert(payload)
      .select('tarefa_id, tarefa_titulo, tarefa_descricao, tarefa_vencimento, tarefa_status')
      .single();
  },

  /**
   * Retorna as tarefas de onboarding de múltiplos negócios em uma única query.
   * Usado pela página de Clientes para carregar os checklists dos Novos Clientes.
   * @param {number[]} negocioIds - array de negocio_id
   */
  async getOnboardingByNegocios(negocioIds) {
    if (!negocioIds?.length) return { data: [], error: null };
    return supabase
      .from('tarefas')
      .select('tarefa_id, tarefa_titulo, tarefa_status, negocio_id, data_conclusao')
      .in('negocio_id', negocioIds)
      .order('tarefa_id', { ascending: true });
  },

  /**
   * Retorna TODAS as tarefas do vendedor (pendentes e concluídas), com join no negócio.
   * Usado pela página de Tarefas para listagem completa.
   * @param {string} vendedorId
   */
  async getAllPorVendedor(vendedorId) {
    return supabase
      .from('tarefas')
      .select('tarefa_id, tarefa_titulo, tarefa_descricao, tarefa_vencimento, tarefa_status, tarefa_prioridade, negocio_id, criado_em, data_inicio, data_conclusao, tempo_acumulado_ms, vendedor_id, usuarios(user_nome)')
      .eq('vendedor_id', vendedorId)
      .order('tarefa_vencimento', { ascending: true });
  },

  /**
   * Retorna TODAS as tarefas de todos os vendedores (para visão admin).
   */
  async getAllAdmin() {
    return supabase
      .from('tarefas')
      .select('tarefa_id, tarefa_titulo, tarefa_descricao, tarefa_vencimento, tarefa_status, tarefa_prioridade, negocio_id, criado_em, data_inicio, data_conclusao, tempo_acumulado_ms, vendedor_id, usuarios(user_nome)')
      .order('tarefa_vencimento', { ascending: true });
  },

  /**
   * Inicia o cronômetro de uma tarefa — registra data_inicio.
   * @param {number} tarefaId
   */
  async iniciar(tarefaId) {
    return supabase
      .from('tarefas')
      .update({ data_inicio: nowBrasilia() })
      .eq('tarefa_id', tarefaId);
  },

  /**
   * Pausa o cronômetro de uma tarefa.
   * Define data_inicio como null e salva o tempo acumulado.
   * @param {number} tarefaId
   * @param {number} tempoAcumulado
   */
  async pausar(tarefaId, tempoAcumulado) {
    return supabase
      .from('tarefas')
      .update({ 
        data_inicio: null, 
        tempo_acumulado_ms: tempoAcumulado 
      })
      .eq('tarefa_id', tarefaId);
  },

  /**
   * Reabre uma tarefa (tarefa_status = false).
   * Limpa data_inicio e data_conclusao para resetar o cronômetro.
   * @param {number} tarefaId
   */
  async reabrir(tarefaId) {
    return supabase
      .from('tarefas')
      .update({ tarefa_status: false, data_inicio: null, data_conclusao: null })
      .eq('tarefa_id', tarefaId);
  },

  /**
   * Exclui permanentemente uma tarefa da tabela.
   * @param {number} tarefaId
   */
  async excluir(tarefaId) {
    return supabase
      .from('tarefas')
      .delete()
      .eq('tarefa_id', tarefaId);
  },

  /**
   * Atualiza a prioridade de uma tarefa.
   * @param {number} tarefaId
   * @param {string} novaPrioridade
   */
  async atualizarPrioridade(tarefaId, novaPrioridade) {
    return supabase
      .from('tarefas')
      .update({ tarefa_prioridade: novaPrioridade })
      .eq('tarefa_id', tarefaId);
  },

  /**
   * Atualiza o título de uma tarefa.
   * @param {number} tarefaId
   * @param {string} novoTitulo
   */
  async atualizarTitulo(tarefaId, novoTitulo) {
    return supabase
      .from('tarefas')
      .update({ tarefa_titulo: novoTitulo })
      .eq('tarefa_id', tarefaId);
  }
};


// ══════════════════════════════════════════════════════════════════
//  OPORTUNIDADES (Pipeline)
// ══════════════════════════════════════════════════════════════════

export const Oportunidades = {
  async getAll() {
    return supabase.from('oportunidades').select('*, clientes(nome)').order('created_at', { ascending: false });
  },

  async getById(id) {
    return supabase.from('oportunidades').select('*, clientes(nome)').eq('id', id).single();
  },

  async create(payload) {
    return supabase.from('oportunidades').insert(payload).select().single();
  },

  async update(id, payload) {
    return supabase.from('oportunidades').update(payload).eq('id', id).select().single();
  },

  async delete(id) {
    return supabase.from('oportunidades').delete().eq('id', id);
  },
};

// ══════════════════════════════════════════════════════════════════
//  USUÁRIOS (perfis) ✅ TABELA ATIVA
//
//  Colunas reais da tabela `usuarios`:
//    user_id            UUID (PK)
//    user_nome          TEXT
//    user_email         TEXT
//    user_telefone      TEXT
//    user_cargo         TEXT
//    user_status        TEXT  (ex: 'Ativo')
//    user_avatar        TEXT  (URL pública do Supabase Storage)
//    ultima_atualizacao TIMESTAMPTZ
//    ultimo_login       TIMESTAMPTZ
//    criado_em          TIMESTAMPTZ
//    smtp_email         TEXT       ← remetente SMTP
//    smtp_senha         TEXT       ← senha/app password
//    smtp_host          TEXT       ← ex: smtp.gmail.com
//    smtp_port          TEXT       ← ex: 465
//    smtp_ssl           BOOLEAN    ← true/false
// ══════════════════════════════════════════════════════════════════

export const Usuarios = {
  /** Retorna todos os usuários */
  async getAll() {
    return supabase.from('usuarios').select('*').order('criado_em', { ascending: false });
  },

  /** Retorna o perfil de um usuário pelo user_id */
  async getMeu(userId) {
    return supabase
      .from('usuarios')
      .select('user_id, user_nome, user_email, user_telefone, user_cargo, user_status, user_avatar, criado_em, ultimo_login, nova_versao')
      .eq('user_id', userId)
      .single();
  },

  /**
   * Marca nova_versao = false após o usuário aceitar a atualização.
   * Chamado ao clicar no botão de aceite do popup de nova versão.
   */
  async aceitarAtualizacao(userId) {
    return supabase
      .from('usuarios')
      .update({ nova_versao: false })
      .eq('user_id', userId);
  },

  /** Retorna o primeiro usuário ativo (usado enquanto não há autenticação) */
  async getPrimeiro() {
    return supabase
      .from('usuarios')
      .select('user_id, user_nome, user_email, user_cargo, user_status, user_avatar')
      .eq('user_status', 'Ativo')
      .order('criado_em')
      .limit(1)
      .single();
  },

  /** Atualiza o perfil do usuário */
  async atualizar(userId, payload) {
    return supabase
      .from('usuarios')
      .update({ ...payload, ultima_atualizacao: nowBrasilia() })
      .eq('user_id', userId)
      .select()
      .single();
  },

  /** Registra o timestamp do último login */
  async registrarLogin(userId) {
    return supabase
      .from('usuarios')
      .update({ ultimo_login: nowBrasilia() })
      .eq('user_id', userId);
  },

  /** Retorna todos os usuários ativos para o ranking de Top Vendedores */
  async getVendedoresAtivos() {
    return supabase
      .from('usuarios')
      .select('user_id, user_nome')
      .eq('user_status', 'Ativo')
      .order('user_nome', { ascending: true });
  },

  /**
   * Retorna usuários com cargo 'Operações' ou 'Administrador' e status Ativo.
   * Usado no GanhoModal para o select de responsável pelo cliente.
   */
  async getGestores() {
    return supabase
      .from('usuarios')
      .select('user_id, user_nome, user_cargo, user_avatar')
      .in('user_cargo', ['Operações', 'Administrador'])
      .eq('user_status', 'Ativo')
      .order('user_nome', { ascending: true });
  },

  /**
   * Retorna somente usuários com cargo 'Operações' e status Ativo.
   * Usado no ranking "Top Gestores" da view de Operações na página Início.
   */
  async getOperacoes() {
    return supabase
      .from('usuarios')
      .select('user_id, user_nome, user_cargo, user_avatar')
      .eq('user_cargo', 'Operações')
      .eq('user_status', 'Ativo')
      .order('user_nome', { ascending: true });
  },

  /**
   * Retorna apenas as configurações SMTP do usuário.
   * @param {string} userId
   */
  async getSmtp(userId) {
    return supabase
      .from('usuarios')
      .select('smtp_email, smtp_senha, smtp_host, smtp_port, smtp_ssl')
      .eq('user_id', userId)
      .single();
  },

  /**
   * Persiste as configurações SMTP do usuário.
   * @param {string} userId
   * @param {{ smtp_email, smtp_senha, smtp_host, smtp_port, smtp_ssl }} payload
   */
  async salvarSmtp(userId, payload) {
    return supabase
      .from('usuarios')
      .update({ ...payload, ultima_atualizacao: nowBrasilia() })
      .eq('user_id', userId)
      .select('smtp_email, smtp_senha, smtp_host, smtp_port, smtp_ssl')
      .single();
  },

  /** Remove o registro do usuário da tabela usuarios */
  async deletar(userId) {
    return supabase.from('usuarios').delete().eq('user_id', userId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  METAS ✅ TABELA ATIVA
//
//  Colunas relevantes da tabela `metas`:
//    meta_id         INTEGER (PK)
//    meta_tipo       TEXT   (ex: 'Meta Mensal')
//    meta_principal  NUMERIC
//    meta_mes        TEXT   (ex: 'Abril', 'Maio', ...)
//    criado_em       TIMESTAMPTZ
// ══════════════════════════════════════════════════════════════════

export const Metas = {
  /**
   * Retorna a meta do mês atual, buscando pelo nome do mês em português.
   */
  async getMesAtual() {
    const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' })
      .format(new Date())
      .replace(/^\w/, c => c.toUpperCase());

    return supabase
      .from('metas')
      .select('meta_id, meta_tipo, meta_principal, meta_mes')
      .eq('meta_mes', nomeMes)
      .order('meta_id', { ascending: false })
      .limit(1)
      .maybeSingle();
  },

  /**
   * Retorna todas as metas cadastradas (para montar o gráfico anual).
   * O mapeamento de nome do mês → índice é feito no client-side.
   */
  async getAnoAtual() {
    return supabase
      .from('metas')
      .select('meta_principal, meta_mes')
      .order('meta_id', { ascending: true });
  },
};

// ══════════════════════════════════════════════════════════════════
//  ETAPAS DO PIPELINE ✅ TABELA ATIVA
//
//  Colunas da tabela `etapas_pipeline`:
//    etapa_id           INTEGER (PK)
//    etapa_nome         TEXT
//    etapa_ordem        INTEGER
//    pipeline_id        INTEGER → FK para pipelines.pipeline_id
//    criado_em          TIMESTAMPTZ
//    ultima_atualizacao TIMESTAMPTZ
// ══════════════════════════════════════════════════════════════════

export const EtapasPipeline = {
  /** Retorna as etapas de um funil específico, ordenadas por etapa_ordem. */
  async getByPipeline(pipelineId) {
    return supabase
      .from('etapas_pipeline')
      .select('etapa_id, etapa_nome, etapa_ordem')
      .eq('pipeline_id', pipelineId)
      .order('etapa_ordem', { ascending: true });
  },

  /** Cria uma nova etapa no funil. */
  async create(pipelineId, nome, ordem) {
    return supabase
      .from('etapas_pipeline')
      .insert({ pipeline_id: pipelineId, etapa_nome: nome, etapa_ordem: ordem })
      .select('etapa_id, etapa_nome, etapa_ordem')
      .single();
  },

  /** Atualiza nome e/ou ordem de uma etapa. */
  async update(etapaId, payload) {
    return supabase
      .from('etapas_pipeline')
      .update({ ...payload, ultima_atualizacao: new Date().toISOString() })
      .eq('etapa_id', etapaId);
  },

  /** Remove uma etapa pelo ID. */
  async delete(etapaId) {
    return supabase
      .from('etapas_pipeline')
      .delete()
      .eq('etapa_id', etapaId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  NEGÓCIOS ✅ TABELA ATIVA
//
//  Colunas relevantes da tabela `negocios`:
//    negocio_id         INTEGER (PK)
//    negocio_titulo     TEXT
//    negocio_valor      NUMERIC
//    negocio_status     TEXT  ('Aberto' | 'Ganho' | 'Perdido')
//    vendedor_id        UUID  → FK para usuarios.user_id
//    etapa_id           INTEGER → FK para etapas_pipeline.etapa_id
//    pipeline_id        INTEGER → FK para pipelines.pipeline_id
//    data_fechamento    TIMESTAMPTZ
//    motivo_perda       TEXT
//    criado_em          TIMESTAMPTZ
//    ultima_atualizacao TIMESTAMPTZ
// ══════════════════════════════════════════════════════════════════

export const Negocios = {
  /**
   * Busca negócios pelo título (para autocomplete).
   * @param {string} query - texto digitado pelo usuário
   * @param {number} limit - máximo de resultados
   */
  async buscarPorTitulo(query, limit = 8) {
    return supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, negocio_status')
      .ilike('negocio_titulo', `%${query}%`)
      .order('negocio_titulo', { ascending: true })
      .limit(limit);
  },

  /**
   * Retorna todos os negócios de um funil específico, com dados do vendedor.
   * Usado pelo KanbanBoard para montar as colunas em tempo real.
   * @param {number} pipelineId
   */
  async getByPipeline(pipelineId) {
    return supabase
      .from('negocios')
      .select(`
        negocio_id,
        negocio_titulo,
        negocio_valor,
        negocio_status,
        negocio_telefone,
        negocio_email,
        negocio_origem,
        negocio_segmento,
        data_recontado,
        etapa_id,
        pipeline_id,
        data_fechamento,
        motivo_perda,
        criado_em,
        vendedor_id,
        usuarios ( user_nome, user_avatar )
      `)
      .eq('pipeline_id', pipelineId)
      .order('criado_em', { ascending: false });
  },




  /**
   * Atualiza a etapa de um negócio (drag-and-drop no Kanban).
   */
  async updateEtapa(negocioId, novaEtapaId) {
    return supabase
      .from('negocios')
      .update({ etapa_id: novaEtapaId, ultima_atualizacao: nowBrasilia() })
      .eq('negocio_id', negocioId);
  },

  /**
   * Atualiza o status de um negócio ('Aberto' | 'Ganho' | 'Perdido').
   * Quando Ganho ou Perdido, registra data_fechamento automaticamente.
   * @param {number} negocioId
   * @param {string} novoStatus - 'Aberto' | 'Ganho' | 'Perdido'
   */
  async updateStatus(negocioId, novoStatus) {
    const payload = {
      negocio_status:    novoStatus,
      ultima_atualizacao: nowBrasilia(),
    };
    if (novoStatus === 'Ganho') {
      payload.data_fechamento   = nowBrasilia();
      payload.reuniao_realizada = true; // ganho implica reunião realizada
      payload.pipeline_id       = 1;   // move para o funil de clientes
      payload.etapa_id          = 12;  // etapa de entrada no funil de clientes
    } else if (novoStatus === 'Perdido') {
      payload.data_fechamento = nowBrasilia();
    } else {
      // Reabrir → limpa data de fechamento e motivo de perda
      payload.data_fechamento = null;
      payload.motivo_perda    = null;
    }
    return supabase
      .from('negocios')
      .update(payload)
      .eq('negocio_id', negocioId);
  },


  /**
   * Atualiza o campo reuniao_realizada de um negócio.
   * @param {number}  negocioId
   * @param {boolean} valor - true = reunião feita, false = não feita
   */
  async updateReuniaoRealizada(negocioId, valor) {
    return supabase
      .from('negocios')
      .update({ reuniao_realizada: valor, ultima_atualizacao: nowBrasilia() })
      .eq('negocio_id', negocioId);
  },

  /**
   * Atualiza o campo negocio_noshow de um negócio.
   * @param {number}  negocioId
   * @param {boolean} valor - true = no-show marcado
   */
  async updateNoShow(negocioId, valor) {
    return supabase
      .from('negocios')
      .update({ negocio_noshow: valor, ultima_atualizacao: nowBrasilia() })
      .eq('negocio_id', negocioId);
  },

  /**
   * Atualiza a data de recontato de um negócio.
   * @param {number}      negocioId
   * @param {string|null} dataIso - ISO string (timestamptz) ou null para limpar
   */
  async updateRecontado(negocioId, dataIso) {
    return supabase
      .from('negocios')
      .update({ data_recontado: dataIso, ultima_atualizacao: nowBrasilia() })
      .eq('negocio_id', negocioId);
  },

  async updateFaturamento(negocioId, valor) {
    return supabase
      .from('negocios')
      .update({ negocio_faturamento: valor, ultima_atualizacao: nowBrasilia() })
      .eq('negocio_id', negocioId);
  },

  async updateValor(negocioId, valor) {
    return supabase
      .from('negocios')
      .update({ negocio_valor: valor, ultima_atualizacao: nowBrasilia() })
      .eq('negocio_id', negocioId);
  },

  /**
   * Marca o negócio como Perdido e persiste o ID do motivo (FK bigint).
   * @param {number} negocioId
   * @param {number} motivoId - motivos_perda.motivo_id
   */
  async updatePerdido(negocioId, motivoId) {
    return supabase
      .from('negocios')
      .update({
        negocio_status:    'Perdido',
        data_fechamento:   nowBrasilia(),
        motivo_perda:      motivoId ? Number(motivoId) : null,
        ultima_atualizacao: nowBrasilia(),
      })
      .eq('negocio_id', negocioId);
  },

  /**
   * Retorna origens distintas de negócios de um funil (para popular filtro).
   * @param {number} pipelineId
   * @param {string|null} vendedorId - filtra por vendedor se informado
   */
  async getOrigensDisponiveis(pipelineId, vendedorId = null) {
    let q = supabase
      .from('negocios')
      .select('negocio_origem')
      .eq('pipeline_id', pipelineId)
      .not('negocio_origem', 'is', null)
      .neq('negocio_origem', '');
    if (vendedorId) q = q.eq('vendedor_id', vendedorId);
    return q;
  },

  /**
   * Cria um novo negócio.
   * @param {Object} payload - campos a inserir
   */
  async create(payload) {
    return supabase
      .from('negocios')
      .insert(payload)
      .select('negocio_id, negocio_titulo, negocio_status, etapa_id, pipeline_id, vendedor_id, criado_em')
      .single();
  },

  /**
   * Retorna um negócio completo com joins (para o painel de detalhes).
   * Inclui join com motivos_perda para exibir a descrição do motivo de perda.
   * @param {number} negocioId
   */
  async getById(negocioId) {
    return supabase
      .from('negocios')
      .select(`
        *,
        etapas_pipeline ( etapa_nome, etapa_ordem ),
        pipelines        ( pipeline_nome ),
        usuarios         ( user_nome, user_avatar ),
        motivos_perda    ( motivo_descricao )
      `)
      .eq('negocio_id', negocioId)
      .single();
  },

  /**
   * Conta todos os negócios ABERTOS do vendedor (sem filtro de data,
   * pois data_fechamento é null enquanto o negócio está em aberto).
   *
   * @param {string} vendedorId
   */
  async getAbertosPorVendedor(vendedorId) {
    return supabase
      .from('negocios')
      .select('negocio_id, negocio_status')
      .eq('vendedor_id', vendedorId)
      .eq('negocio_status', 'Aberto');
  },

  /**
   * Retorna negócios FECHADOS (Ganho ou Perdido) do vendedor no mês atual,
   * filtrando pela coluna data_fechamento (timestamptz).
   *
   * @param {string} vendedorId
   */
  async getFechadosMesAtual(vendedorId) {
    const agora     = new Date();
    // Usa UTC para não deslocar o intervalo por timezone do browser
    const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const fimMes    = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    return supabase
      .from('negocios')
      .select('negocio_id, negocio_status, negocio_valor, data_fechamento')
      .eq('vendedor_id', vendedorId)
      .in('negocio_status', ['Ganho', 'Perdido'])
      .gte('data_fechamento', inicioMes.toISOString())
      .lte('data_fechamento', fimMes.toISOString());
  },

  /**
   * Retorna negócios FECHADOS (Ganho ou Perdido) do vendedor no mês anterior.
   * Usado para calcular a variação % vs. mês atual.
   *
   * @param {string} vendedorId
   */
  async getFechadosMesAnterior(vendedorId) {
    const agora      = new Date();
    const inicioMes  = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1));
    const fimMes     = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 0, 23, 59, 59, 999));

    return supabase
      .from('negocios')
      .select('negocio_id, negocio_status')
      .eq('vendedor_id', vendedorId)
      .eq('negocio_status', 'Ganho')
      .gte('data_fechamento', inicioMes.toISOString())
      .lte('data_fechamento', fimMes.toISOString());
  },

  /**
   * Retorna todos os negócios FECHADOS do vendedor no ano atual.
   * Usado para montar o gráfico de barras mês a mês.
   *
   * @param {string} vendedorId
   */
  async getAnoAtualPorVendedor(vendedorId) {
    const ano    = new Date().getUTCFullYear();
    const inicio = new Date(Date.UTC(ano, 0, 1));
    const fim    = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999));

    return supabase
      .from('negocios')
      .select('negocio_status, negocio_valor, data_fechamento')
      .eq('vendedor_id', vendedorId)
      .in('negocio_status', ['Ganho', 'Perdido'])
      .gte('data_fechamento', inicio.toISOString())
      .lte('data_fechamento', fim.toISOString());
  },

  /**
   * Retorna todos os negócios GANHOS do mês atual de TODOS os vendedores.
   * Usado para montar o ranking "Top Vendedores".
   */
  async getGanhosMesAtualTodos() {
    const agora     = new Date();
    const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const fimMes    = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    return supabase
      .from('negocios')
      .select('vendedor_id, negocio_valor')
      .eq('negocio_status', 'Ganho')
      .gte('data_fechamento', inicioMes.toISOString())
      .lte('data_fechamento', fimMes.toISOString());
  },

  /**
   * Retorna negócios na etapa de Onboarding do vendedor:
   *   pipeline_id = 2  E  etapa_id ≠ 10
   * KPI: Clientes na Etapa de Onboarding (Operações)
   */
  async getOnboarding(vendedorId) {
    return supabase
      .from('negocios')
      .select('negocio_id', { count: 'exact' })
      .eq('pipeline_id', 2)
      .neq('etapa_id', 10)
      .eq('vendedor_id', vendedorId);
  },

  /**
   * Retorna negócios nas etapas 6 ou 7, com status "Aberto", do vendedor.
   * Inclui todas as tarefas vinculadas para calcular, no client-side,
   * se a última tarefa foi criada há mais de 48 horas.
   *
   * Usado pela Central de Notificações para gerar alertas críticos de
   * "negócio sem contato há X horas".
   *
   * @param {string} vendedorId
   */
  async getSemContato48h(vendedorId) {
    return supabase
      .from('negocios')
      .select(`
        negocio_id,
        negocio_titulo,
        negocio_status,
        etapa_id,
        tarefas ( tarefa_id, criado_em )
      `)
      .eq('vendedor_id', vendedorId)
      .eq('negocio_status', 'Aberto')
      .in('etapa_id', [6, 7])
      .order('criado_em', { ascending: false });
  },

  /**
   * Retorna negócios com reuniao_realizada = true do vendedor no mês atual.
   * Usado para calcular a Taxa de Conversão: Ganhos / Reuniões Realizadas.
   *
   * @param {string} vendedorId
   */
  async getReunioesMesAtual(vendedorId) {
    const agora     = new Date();
    const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const fimMes    = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    return supabase
      .from('negocios')
      .select('negocio_id')
      .eq('vendedor_id', vendedorId)
      .eq('reuniao_realizada', true)
      .gte('criado_em', inicioMes.toISOString())
      .lte('criado_em', fimMes.toISOString());
  },

  /**
   * Retorna negócios com negocio_email preenchido do vendedor.
   * Usado pela página de E-mail Marketing para listar os contatos disponíveis.
   * @param {string} vendedorId
   */
  async getComEmail(vendedorId) {
    return supabase
      .from('negocios')
      .select('negocio_id, negocio_titulo, negocio_email, negocio_status')
      .eq('vendedor_id', vendedorId)
      .not('negocio_email', 'is', null)
      .neq('negocio_email', '')
      .order('negocio_titulo', { ascending: true });
  },
};

// ══════════════════════════════════════════════════════════════════
//  TENTATIVAS DE CONTATO ✅ TABELA ATIVA
//
//  Colunas da tabela `contato_tentativas`:
//    tentativa_id    INTEGER (PK, gerado automaticamente)
//    negocio_id      INTEGER → FK para negocios.negocio_id
//    tentativa_tipo  TEXT    ('Ligação' | 'Email' | 'WhatsApp')
//    tentativa_data  TIMESTAMPTZ
// ══════════════════════════════════════════════════════════════════

export const ContatoTentativas = {
  /**
   * Retorna todas as tentativas de contato de um negócio, da mais recente para a mais antiga.
   * @param {number} negocioId
   */
  async getByNegocio(negocioId) {
    return supabase
      .from('contato_tentativas')
      .select('tentativa_id, negocio_id, tentativa_tipo, tentativa_data, status_contato')
      .eq('negocio_id', negocioId)
      .order('tentativa_data', { ascending: false });
  },

  /**
   * Registra uma nova tentativa de contato.
   * @param {number} negocioId
   * @param {'Ligação'|'Email'|'WhatsApp'} tipo
   */
  async create(negocioId, tipo) {
    return supabase
      .from('contato_tentativas')
      .insert({
        negocio_id:     negocioId,
        tentativa_tipo: tipo,
        tentativa_data: nowBrasilia(),
      })
      .select('tentativa_id, negocio_id, tentativa_tipo, tentativa_data, status_contato')
      .single();
  },

  /**
   * Atualiza o status de atendimento de uma tentativa de ligação.
   * @param {number} tentativaId
   * @param {'Atendido'|'Não Atendido'|null} status
   */
  async updateStatusContato(tentativaId, status) {
    return supabase
      .from('contato_tentativas')
      .update({ status_contato: status })
      .eq('tentativa_id', tentativaId);
  },

  /**
   * Remove uma tentativa de contato pelo ID.
   * @param {number} tentativaId
   */
  async delete(tentativaId) {
    return supabase
      .from('contato_tentativas')
      .delete()
      .eq('tentativa_id', tentativaId);
  },

  /**
   * Busca tentativas de uma lista de negocio_ids (para a view lista de clientes).
   * @param {number[]} negocioIds
   */
  async getByNegocioIds(negocioIds) {
    if (!negocioIds || negocioIds.length === 0) return { data: [], error: null };
    return supabase
      .from('contato_tentativas')
      .select('negocio_id, tentativa_tipo')
      .in('negocio_id', negocioIds);
  },
};

// ══════════════════════════════════════════════════════════════════
//  MOTIVOS DE PERDA ✅ TABELA ATIVA
//
//  Colunas da tabela `motivos_perda`:
//    motivo_id         INTEGER (PK, gerado automaticamente)
//    motivo_descricao  TEXT
//    motivo_status     BOOLEAN  (true = ativo / visível)
//    criado_em         TIMESTAMPTZ
// ══════════════════════════════════════════════════════════════════

export const MotivosPerdas = {
  /**
   * Retorna todos os motivos ativos, ordenados alfabética por descrição.
   */
  async getAll() {
    return supabase
      .from('motivos_perda')
      .select('motivo_id, motivo_descricao')
      .eq('motivo_status', true)
      .order('motivo_descricao', { ascending: true });
  },

  /**
   * Cria um novo motivo de perda (ativo por padrão).
   * @param {string} descricao
   */
  async create(descricao) {
    return supabase
      .from('motivos_perda')
      .insert({ motivo_descricao: descricao, motivo_status: true })
      .select('motivo_id, motivo_descricao, motivo_status')
      .single();
  },

  /** Retorna todos os motivos (ativos e inativos) para gerenciamento. */
  async getAllComStatus() {
    return supabase
      .from('motivos_perda')
      .select('motivo_id, motivo_descricao, motivo_status')
      .order('criado_em', { ascending: true });
  },

  /** Atualiza descrição e/ou status de um motivo. */
  async update(motivoId, payload) {
    return supabase
      .from('motivos_perda')
      .update({ ...payload, ultima_atualizacao: new Date().toISOString() })
      .eq('motivo_id', motivoId);
  },

  /** Remove permanentemente um motivo de perda. */
  async delete(motivoId) {
    return supabase
      .from('motivos_perda')
      .delete()
      .eq('motivo_id', motivoId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  PIPELINES (Funis) ✅ TABELA ATIVA
//
//  Colunas da tabela `pipelines`:
//    pipeline_id         INTEGER (PK)
//    pipeline_nome       TEXT
//    pipeline_status     BOOLEAN
//    criado_em           TIMESTAMPTZ
//    funil_visualizacao  TEXT  (ex: 'Comercial', 'Todos')
// ══════════════════════════════════════════════════════════════════

export const Pipelines = {
  /** Retorna todos os funis, ordenados por pipeline_id */
  async getAll() {
    return supabase
      .from('pipelines')
      .select('pipeline_id, pipeline_nome, pipeline_status, funil_visualizacao')
      .order('pipeline_id', { ascending: true });
  },

  /** Retorna apenas os funis ativos */
  async getAtivos() {
    return supabase
      .from('pipelines')
      .select('pipeline_id, pipeline_nome, funil_visualizacao')
      .eq('pipeline_status', true)
      .order('pipeline_id', { ascending: true });
  },

  /** Cria um novo funil. */
  async create(nome, visualizacao) {
    return supabase
      .from('pipelines')
      .insert({ pipeline_nome: nome, pipeline_status: true, funil_visualizacao: visualizacao })
      .select('pipeline_id, pipeline_nome, pipeline_status, funil_visualizacao')
      .single();
  },

  /** Atualiza dados de um funil (nome, status, visualizacao). */
  async update(pipelineId, payload) {
    return supabase
      .from('pipelines')
      .update(payload)
      .eq('pipeline_id', pipelineId);
  },

  /** Remove um funil (e suas etapas, via cascade no banco). */
  async delete(pipelineId) {
    return supabase
      .from('pipelines')
      .delete()
      .eq('pipeline_id', pipelineId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  ANOTAÇÕES ✅ TABELA ATIVA
//
//  Colunas da tabela `anotacoes`:
//    notacao_id   INTEGER (PK, auto)
//    nota         TEXT
//    negocio_id   INTEGER → FK para negocios.negocio_id
// ══════════════════════════════════════════════════════════════════

export const Anotacoes = {
  /** Retorna as anotações de um negócio, mais recentes primeiro. */
  async getByNegocio(negocioId) {
    return supabase
      .from('anotacoes')
      .select('notacao_id, nota, criado_em')
      .eq('negocio_id', negocioId)
      .order('notacao_id', { ascending: false });
  },

  /** Cria uma nova anotação. */
  async create(negocioId, nota) {
    return supabase
      .from('anotacoes')
      .insert({ negocio_id: negocioId, nota })
      .select('notacao_id, nota, criado_em')
      .single();
  },

  /** Atualiza o texto de uma anotação. */
  async update(notacaoId, nota) {
    return supabase
      .from('anotacoes')
      .update({ nota })
      .eq('notacao_id', notacaoId);
  },

  /** Remove uma anotação pelo ID. */
  async delete(notacaoId) {
    return supabase
      .from('anotacoes')
      .delete()
      .eq('notacao_id', notacaoId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  DOCUMENTOS ✅ TABELA ATIVA
//
//  Colunas da tabela `documentos`:
//    documento_id   INTEGER (PK, auto)
//    documento_link TEXT    (URL pública do arquivo)
//    negocio_id     INTEGER → FK para negocios.negocio_id
//
//  Storage: bucket "visi-marketing" / pasta "visi-marketing/{negocio_id}/"
// ══════════════════════════════════════════════════════════════════

const STORAGE_BUCKET = 'visi-marketing';

export const Documentos = {
  /** Retorna todos os documentos de um negócio. */
  async getByNegocio(negocioId) {
    return supabase
      .from('documentos')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('documento_id', { ascending: false });
  },

  /**
   * Faz upload do arquivo para o Storage e salva o link na tabela.
   * @param {number} negocioId
   * @param {File}   file
   */
  async upload(negocioId, file) {
    // Sanitiza o nome e cria um path único
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path     = `visi-marketing/${negocioId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (upErr) return { data: null, error: upErr };

    // Gera a URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    // Persiste na tabela documentos
    return supabase
      .from('documentos')
      .insert({ negocio_id: negocioId, documento_link: publicUrl })
      .select('*')
      .single();
  },

  /**
   * Remove o registro da tabela (o arquivo no Storage é mantido).
   * @param {number|string} documentoId
   */
  async delete(documentoId) {
    return supabase
      .from('documentos')
      .delete()
      .eq('documento_id', documentoId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  NOTIFICAÇÕES ✅ TABELA ATIVA
//
//  Colunas da tabela `notificacoes`:
//    notificacao_id        INTEGER (PK, auto)
//    notificacao_titulo    TEXT
//    notificacao_descricao TEXT
//    notificacao_leitura   BOOLEAN  (false = não lida, true = lida)
//    user_id               UUID → FK para usuarios.user_id
// ══════════════════════════════════════════════════════════════════

export const Notificacoes = {
  /**
   * Retorna todas as notificações do usuário, mais recentes primeiro.
   * @param {string} userId
   */
  async getByUser(userId) {
    return supabase
      .from('notificacoes')
      .select('notificacao_id, notificacao_titulo, notificacao_descricao, notificacao_leitura')
      .eq('user_id', userId)
      .order('notificacao_id', { ascending: false });
  },

  /**
   * Retorna apenas as notificações NÃO lidas do usuário.
   * @param {string} userId
   */
  async getNaoLidas(userId) {
    return supabase
      .from('notificacoes')
      .select('notificacao_id, notificacao_titulo, notificacao_descricao')
      .eq('user_id', userId)
      .eq('notificacao_leitura', false)
      .order('notificacao_id', { ascending: false });
  },

  /**
   * Conta notificações não lidas do usuário.
   * @param {string} userId
   */
  async contarNaoLidas(userId) {
    return supabase
      .from('notificacoes')
      .select('notificacao_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('notificacao_leitura', false);
  },

  /**
   * Marca uma notificação específica como lida.
   * @param {number} notificacaoId
   */
  async marcarComoLida(notificacaoId) {
    return supabase
      .from('notificacoes')
      .update({ notificacao_leitura: true })
      .eq('notificacao_id', notificacaoId);
  },

  /**
   * Marca TODAS as notificações do usuário como lidas.
   * @param {string} userId
   */
  async marcarTodasComoLidas(userId) {
    return supabase
      .from('notificacoes')
      .update({ notificacao_leitura: true })
      .eq('user_id', userId)
      .eq('notificacao_leitura', false);
  },

  /**
   * Cria uma nova notificacao para um usuario.
   * @param {string} userId
   * @param {string} titulo
   * @param {string} descricao
   */
  async criar(userId, titulo, descricao) {
    return supabase
      .from('notificacoes')
      .insert({
        user_id:               userId,
        notificacao_titulo:    titulo,
        notificacao_descricao: descricao,
        notificacao_leitura:   false,
      });
  },
};


// ══════════════════════════════════════════════════════════════════
//  EMAIL MARKETING ✅ TABELA ATIVA
//
//  Colunas da tabela `email_marketing`:
//    email_campanha_id  INTEGER (PK, auto)
//    email_campanha     TEXT    (assunto da campanha)
//    email_mensagem     TEXT    (corpo da mensagem)
//    email_negocios     NUMERIC (total de negócios selecionados)
//    email_progresso    NUMERIC (quantos e-mails já foram enviados)
//    user_id            UUID → FK para usuarios.user_id
// ══════════════════════════════════════════════════════════════════

export const EmailMarketing = {
  /**
   * Cria um novo registro de campanha.
   * @param {{ email_campanha, email_negocios, email_progresso, user_id }} payload
   */
  async criar(payload) {
    return supabase
      .from('email_marketing')
      .insert(payload)
      .select('email_campanha_id, email_campanha, email_negocios, email_progresso, user_id')
      .single();
  },

  /**
   * Retorna todas as campanhas do usuário, da mais recente à mais antiga.
   * @param {string} userId
   */
  async getByUsuario(userId) {
    return supabase
      .from('email_marketing')
      .select('email_campanha_id, email_campanha, email_mensagem, email_negocios, email_progresso, criado_em')
      .eq('user_id', userId)
      .order('criado_em', { ascending: false });
  },

  /**
   * Atualiza o progresso de uma campanha (quantos e-mails já foram enviados).
   * @param {number} campanhaId
   * @param {number} progresso
   */
  async atualizarProgresso(campanhaId, progresso) {
    return supabase
      .from('email_marketing')
      .update({ email_progresso: progresso })
      .eq('email_campanha_id', campanhaId);
  },
};

// ══════════════════════════════════════════════════════════════════
//  DIA FINALIZADO ✅ TABELA ATIVA
//
//  Colunas da tabela `dia_finalizado`:
//    id                            BIGINT (PK, gerado automaticamente)
//    user_id                       UUID → FK para usuarios.user_id
//    quantidade_contatos_realizados NUMERIC
//    quantidade_prospecao           NUMERIC
//    criado_em                      TIMESTAMPTZ (default now())
// ══════════════════════════════════════════════════════════════════

export const DiaFinalizado = {
  /**
   * Conta quantas tentativas de contato o vendedor fez HOJE
   * (via negocios.vendedor_id → contato_tentativas.negocio_id).
   * @param {string} userId - UUID do usuário logado
   */
  async contarContatosHoje(userId) {
    // Data de início e fim do dia atual em UTC (Supabase armazena em UTC)
    const agora   = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
    const fimDia    = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999).toISOString();

    // Busca os negocio_ids do vendedor
    const { data: negs, error: errNegs } = await supabase
      .from('negocios')
      .select('negocio_id')
      .eq('vendedor_id', userId);

    if (errNegs || !negs?.length) return { count: 0, error: errNegs };

    const ids = negs.map(n => n.negocio_id);

    const { count, error } = await supabase
      .from('contato_tentativas')
      .select('tentativa_id', { count: 'exact', head: true })
      .in('negocio_id', ids)
      .gte('tentativa_data', inicioDia)
      .lte('tentativa_data', fimDia);

    return { count: count ?? 0, error };
  },

  /**
   * Salva o registro de finalização do dia.
   * @param {string} userId
   * @param {number} qtdContatos
   * @param {number} qtdProspeccao
   */
  async salvar(userId, qtdContatos, qtdProspeccao) {
    return supabase
      .from('dia_finalizado')
      .insert({
        user_id:                        userId,
        quantidade_contatos_realizados: qtdContatos,
        quantidade_prospecao:           qtdProspeccao,
      });
  },

  /**
   * Busca o registro de dia finalizado de HOJE para um usuário.
   * Mantido para compatibilidade, mas o getEstatisticas é mais completo.
   * @param {string} userId
   */
  async getHoje(userId) {
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
    const fimDia    = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999).toISOString();

    return supabase
      .from('dia_finalizado')
      .select('*')
      .eq('user_id', userId)
      .gte('criado_em', inicioDia)
      .lte('criado_em', fimDia)
      .order('criado_em', { ascending: false })
      .limit(1);
  },

  /**
   * Busca as métricas consolidadas (soma) de um período (hoje, semana, mes).
   * @param {string} userId
   * @param {string} periodo - 'hoje', 'semana', 'mes'
   */
  async getEstatisticas(userId, periodo = 'hoje') {
    const agora = new Date();
    let inicio, fim;

    if (periodo === 'hoje') {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
      fim    = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
    } else if (periodo === 'semana') {
      const diaDaSemana = agora.getDay(); // 0 = Domingo, 1 = Segunda...
      // Vamos assumir que a semana começa na Segunda-feira (1)
      const diffParaSegunda = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
      inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diffParaSegunda, 0, 0, 0);
      fim    = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6, 23, 59, 59, 999);
    } else if (periodo === 'mes') {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0);
      fim    = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const { data, error } = await supabase
      .from('dia_finalizado')
      .select('quantidade_contatos_realizados, quantidade_prospecao')
      .eq('user_id', userId)
      .gte('criado_em', inicio.toISOString())
      .lte('criado_em', fim.toISOString());

    if (error) return { error, contatos: 0, prospeccoes: 0 };

    let contatos = 0;
    let prospeccoes = 0;

    (data || []).forEach(row => {
      contatos += (Number(row.quantidade_contatos_realizados) || 0);
      prospeccoes += (Number(row.quantidade_prospecao) || 0);
    });

    return { error: null, contatos, prospeccoes };
  },

  /**
   * Busca as métricas consolidadas (soma) de um período customizado (data de início a data de fim).
   * @param {string} userId
   * @param {string} dataInicio - 'YYYY-MM-DD'
   * @param {string} dataFim - 'YYYY-MM-DD'
   */
  async getEstatisticasCustom(userId, dataInicio, dataFim) {
    if (!dataInicio || !dataFim) return { error: 'Datas inválidas', contatos: 0, prospeccoes: 0 };

    // Adiciona o timezone zero (UTC) se vier só yyyy-mm-dd
    const inicio = new Date(`${dataInicio}T00:00:00`);
    const fim    = new Date(`${dataFim}T23:59:59.999`);

    const { data, error } = await supabase
      .from('dia_finalizado')
      .select('quantidade_contatos_realizados, quantidade_prospecao')
      .eq('user_id', userId)
      .gte('criado_em', inicio.toISOString())
      .lte('criado_em', fim.toISOString());

    if (error) return { error, contatos: 0, prospeccoes: 0 };

    let contatos = 0;
    let prospeccoes = 0;

    (data || []).forEach(row => {
      contatos += (Number(row.quantidade_contatos_realizados) || 0);
      prospeccoes += (Number(row.quantidade_prospecao) || 0);
    });

    return { error: null, contatos, prospeccoes };
  },
};

// ══════════════════════════════════════════════════════════════════
//  KANBAN — Projetos
// ══════════════════════════════════════════════════════════════════

export const KanbanColunas = {
  async getAll(tipoKanban) {
    return supabase
      .from('kanban_colunas')
      .select('coluna_id, coluna_nome, coluna_cor, coluna_ordem, tipo_kanban')
      .eq('tipo_kanban', tipoKanban)
      .order('coluna_ordem', { ascending: true });
  },
  async create(nome, cor, ordem, tipoKanban) {
    return supabase
      .from('kanban_colunas')
      .insert({ coluna_nome: nome, coluna_cor: cor, coluna_ordem: ordem, tipo_kanban: tipoKanban })
      .select('coluna_id, coluna_nome, coluna_cor, coluna_ordem, tipo_kanban')
      .single();
  },
  async update(id, payload) {
    return supabase.from('kanban_colunas').update(payload).eq('coluna_id', id);
  },
  async delete(id) {
    return supabase.from('kanban_colunas').delete().eq('coluna_id', id);
  },
};

export const KanbanCards = {
  async getByColuna(colunaId) {
    return supabase
      .from('kanban_cards')
      .select('card_id, coluna_id, card_titulo, card_descricao, card_prioridade, card_data_entrega, card_ordem, tipo_kanban, card_etiqueta')
      .eq('coluna_id', colunaId)
      .order('card_ordem', { ascending: true });
  },
  async create(payload) {
    return supabase
      .from('kanban_cards')
      .insert(payload)
      .select('card_id, coluna_id, card_titulo, card_descricao, card_prioridade, card_data_entrega, card_ordem, tipo_kanban, card_etiqueta')
      .single();
  },
  async update(id, payload) {
    return supabase
      .from('kanban_cards')
      .update({ ...payload, ultima_atualizacao: new Date().toISOString() })
      .eq('card_id', id);
  },
  async delete(id) {
    return supabase.from('kanban_cards').delete().eq('card_id', id);
  },
};

export const KanbanComentarios = {
  async getByCard(cardId) {
    return supabase
      .from('kanban_comentarios')
      .select('comentario_id, comentario_texto, criado_em, user_id')
      .eq('card_id', cardId)
      .order('criado_em', { ascending: true });
  },
  async create(cardId, userId, texto) {
    return supabase
      .from('kanban_comentarios')
      .insert({ card_id: cardId, user_id: userId, comentario_texto: texto })
      .select('comentario_id, comentario_texto, criado_em, user_id')
      .single();
  },
  async delete(id) {
    return supabase.from('kanban_comentarios').delete().eq('comentario_id', id);
  },
};

export const KanbanArquivos = {
  async getByCard(cardId) {
    return supabase
      .from('kanban_arquivos')
      .select('arquivo_id, arquivo_nome, arquivo_url, arquivo_tamanho, criado_em')
      .eq('card_id', cardId)
      .order('criado_em', { ascending: true });
  },
  async create(payload) {
    return supabase
      .from('kanban_arquivos')
      .insert(payload)
      .select('arquivo_id, arquivo_nome, arquivo_url, arquivo_tamanho, criado_em')
      .single();
  },
  async delete(id) {
    return supabase.from('kanban_arquivos').delete().eq('arquivo_id', id);
  },
};

