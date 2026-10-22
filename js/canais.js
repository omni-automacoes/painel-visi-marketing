/**
 * canais.js — Canais de aquisição de leads.
 *
 * Lista única usada no cadastro do negócio (origem) e nos Relatórios
 * (investimento por canal, desempenho por canal). O valor gravado em
 * negocios.negocio_origem é o próprio rótulo do canal.
 */

export const CANAIS = [
  { key: 'meta_ads',    label: 'Meta Ads'   },
  { key: 'google_ads',  label: 'Google Ads' },
  { key: 'ace',         label: 'ACE'        },
  { key: 'bni',         label: 'BNI'        },
  { key: 'base_ativa',  label: 'Base ativa' },
  { key: 'indicacao',   label: 'Indicação'  },
  { key: 'prospeccao',  label: 'Prospecção' },
];

/** Origem que não se encaixa em nenhum dos canais acima */
export const CANAL_OUTROS = { key: 'outros', label: 'Outros' };

function _normalizar(txt) {
  return String(txt ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function _escapar(txt) {
  return String(txt).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

/** Retorna a chave do canal de uma origem; 'outros' quando não casa com nenhum */
export function canalDaOrigem(origem) {
  const alvo = _normalizar(origem);
  if (!alvo) return CANAL_OUTROS.key;
  const canal = CANAIS.find(c => _normalizar(c.label) === alvo);
  return canal ? canal.key : CANAL_OUTROS.key;
}

/**
 * <option>s do seletor de origem do negócio.
 * Um valor antigo que não é canal (ex.: "Evento") continua selecionável
 * para não ser perdido ao editar o negócio.
 */
export function opcoesOrigemHTML(valorAtual = '') {
  const atual = String(valorAtual ?? '').trim();
  const rotulos = [...CANAIS.map(c => c.label), CANAL_OUTROS.label];
  const selecionado = rotulos.find(r => _normalizar(r) === _normalizar(atual)) ?? '';
  const legado = atual && !selecionado ? atual : '';

  const opcoes = [
    `<option value=""${atual ? '' : ' selected'}>Selecione o canal…</option>`,
    ...rotulos.map(r => `<option value="${_escapar(r)}"${r === selecionado ? ' selected' : ''}>${_escapar(r)}</option>`),
  ];
  if (legado) {
    opcoes.push(`<option value="${_escapar(legado)}" selected>${_escapar(legado)} (antigo)</option>`);
  }
  return opcoes.join('');
}
