/**
 * api/v1.js — API pública Visi Marketing (somente leitura)
 *
 * Atende https://api.visimarketing.com.br/v1/<recurso> (e /api/v1/<recurso>
 * no domínio do painel) via rewrites do vercel.json, que repassam o caminho
 * em ?raw=<caminho>.
 *
 * Autenticação: cabeçalho `x-api-key` (ou `Authorization: Bearer <chave>`).
 * A validação da chave, o escopo (geral | admin) e as consultas ficam na
 * função `api_v1` do banco — este arquivo só repassa e devolve a resposta.
 */

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://mnoknmzkmqbkbyobjzuh.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ub2tubXprbXFia2J5b2JqenVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTIyOTIsImV4cCI6MjA5MTU4ODI5Mn0.TVWh8Dr5Y-4AKjLxL-8Hcs-GocgAXLBjBDPzdALgAM8';

const PARAMS_ACEITOS = ['limit', 'offset', 'id', 'status', 'pipeline_id', 'desde', 'ate'];

const RECURSOS = {
  geral: ['resumo', 'negocios', 'clientes', 'tarefas', 'pipelines'],
  admin: ['metricas', 'financeiro/resumo', 'financeiro/receitas', 'financeiro/despesas', 'usuarios'],
};

function enviar(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-api-key, Authorization, Content-Type');

  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') {
    return enviar(res, 405, { erro: 'metodo_nao_permitido', mensagem: 'A API é somente leitura: use GET.' });
  }

  const url    = new URL(req.url, 'http://localhost');
  const raw    = (url.searchParams.get('raw') || '').replace(/^\/+|\/+$/g, '');
  const partes = raw.split('/').filter(Boolean);

  // Raiz da API: apresentação, sem exigir chave
  if (partes.length === 0 || (partes.length === 1 && partes[0] === 'v1')) {
    return enviar(res, 200, { api: 'Visi Marketing', versao: 'v1', recursos: RECURSOS });
  }
  if (partes[0] !== 'v1') {
    return enviar(res, 404, { erro: 'rota_inexistente', mensagem: 'Use /v1/<recurso>.' });
  }

  const auth  = req.headers['authorization'] || '';
  const chave = (req.headers['x-api-key'] || auth.replace(/^Bearer\s+/i, '')).trim();

  const params = {};
  for (const nome of PARAMS_ACEITOS) {
    const valor = url.searchParams.get(nome);
    if (valor !== null && valor !== '') params[nome] = valor;
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/api_v1`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_chave: chave, p_recurso: partes.slice(1).join('/'), p_params: params }),
    });

    if (!resp.ok) {
      console.error('[api/v1] Falha no banco:', resp.status, await resp.text());
      return enviar(res, 500, { erro: 'erro_interno', mensagem: 'Não foi possível processar a requisição.' });
    }

    const { status, body } = await resp.json();
    return enviar(res, status, body);
  } catch (e) {
    console.error('[api/v1] Erro:', e);
    return enviar(res, 500, { erro: 'erro_interno', mensagem: 'Não foi possível processar a requisição.' });
  }
};
