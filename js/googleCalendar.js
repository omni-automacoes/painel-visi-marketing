/**
 * googleCalendar.js — Cliente dos webhooks n8n de integração com o Google Calendar
 *
 * O CRM nunca fala diretamente com a API do Google nem guarda tokens —
 * toda a troca OAuth e o proxy de chamadas à Calendar API vivem em
 * workflows n8n (ver guia de configuração em Configurações → Integrações):
 *
 *   - iniciar-conexao : gera a URL de autorização do Google (state opaco)
 *   - google-oauth-callback : recebido diretamente pelo Google (não é chamado daqui)
 *   - agenda-api      : endpoint único para status/listar/criar/editar/excluir/desconectar,
 *                       roteado internamente pelo campo `acao`
 */

const N8N_BASE = 'https://n8n.omniautomacoes.com.br/webhook';

const PATHS = {
  iniciarConexao: 'agenda-iniciar-conexao',
  api:            'agenda-api',
};

async function _post(path, body) {
  const res = await fetch(`${N8N_BASE}/${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Erro na integração com o Google Calendar (HTTP ${res.status})`);
  }
  return res.json();
}

function _api(acao, userId, extra = {}) {
  return _post(PATHS.api, { acao, user_id: userId, ...extra });
}

/** Pede ao n8n uma URL de autorização do Google pronta para o usuário. */
export async function iniciarConexao(userId) {
  const { url_autorizacao } = await _post(PATHS.iniciarConexao, { user_id: userId });
  return url_autorizacao;
}

/** Retorna { conectado, google_email } para o usuário informado. */
export async function getStatus(userId) {
  return _api('status', userId);
}

/** Revoga o acesso e remove os tokens salvos do usuário. */
export async function desconectar(userId) {
  return _api('desconectar', userId);
}

/**
 * Lista eventos do calendário "primary" do usuário num intervalo.
 * @returns {Promise<Array<{id, titulo, descricao, inicio, fim, diaInteiro, local}>>}
 */
export async function listarEventos(userId, dataInicio, dataFim) {
  const { eventos } = await _api('listar', userId, { data_inicio: dataInicio, data_fim: dataFim });
  return eventos || [];
}

/** Cria um evento na agenda do usuário. */
export async function criarEvento(userId, evento) {
  return _api('criar', userId, { evento });
}

/** Edita um evento existente (identificado pelo id do Google). */
export async function editarEvento(userId, googleEventId, evento) {
  return _api('editar', userId, { google_event_id: googleEventId, evento });
}

/** Exclui um evento (também remove do Google Calendar real do usuário). */
export async function excluirEvento(userId, googleEventId) {
  return _api('excluir', userId, { google_event_id: googleEventId });
}
