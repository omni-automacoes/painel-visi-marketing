/**
 * recontato.js — Regras da data de recontato dos negócios (compartilhadas por
 * Kanban, Lista, filtro com calendário e painel do negócio).
 *
 * Só negócios ABERTOS com data_recontado entram nas regras.
 * Estados: 'feito' | 'atrasado' | 'hoje' | 'futuro'
 * Os dias são sempre comparados como 'YYYY-MM-DD' no fuso de Brasília.
 */
const TZ = 'America/Sao_Paulo';

// ── Datas (chaves 'YYYY-MM-DD') ───────────────────────────────

export function diaKey(valor) {
  return new Date(valor).toLocaleDateString('en-CA', { timeZone: TZ });
}

export function hojeKey() {
  return diaKey(new Date());
}

function _utc(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function _key(date) {
  return date.toISOString().slice(0, 10);
}

export function addDias(key, n) {
  const d = _utc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return _key(d);
}

export function diffDias(keyA, keyB) {
  return Math.round((_utc(keyA) - _utc(keyB)) / 86400000);
}

/** Fim da semana (sábado) — a semana do calendário começa no domingo. */
export function fimDaSemana(key) {
  return addDias(key, 6 - _utc(key).getUTCDay());
}

export function fimDoMes(key) {
  const d = _utc(key);
  return _key(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
}

export function formatDiaCurto(key) {
  const d   = _utc(key);
  const mes = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${d.getUTCDate()} ${mes}`;
}

// ── Estado do recontato de um negócio ─────────────────────────

export function estadoRecontato(neg, hoje = hojeKey()) {
  if (!neg || neg.negocio_status !== 'Aberto' || !neg.data_recontado) return null;
  const key = diaKey(neg.data_recontado);
  if (neg.recontado_feito_em) return { estado: 'feito', key };
  if (key < hoje)   return { estado: 'atrasado', key, diasAtraso: diffDias(hoje, key) };
  if (key === hoje) return { estado: 'hoje', key };
  return { estado: 'futuro', key };
}

// ── Filtros ───────────────────────────────────────────────────
// { tipo: 'hoje'|'amanha'|'semana'|'mes'|'atrasados'|'concluidos' }
// { tipo: 'dia', de }   { tipo: 'intervalo', de, ate }

export function matchRecontato(neg, filtro, hoje = hojeKey()) {
  if (!filtro) return true;
  const info = estadoRecontato(neg, hoje);
  if (!info) return false;
  const pendente = info.estado !== 'feito';

  switch (filtro.tipo) {
    case 'hoje':       return pendente && info.key === hoje;
    case 'amanha':     return pendente && info.key === addDias(hoje, 1);
    case 'semana':     return pendente && info.key >= hoje && info.key <= fimDaSemana(hoje);
    case 'mes':        return pendente && info.key >= hoje && info.key <= fimDoMes(hoje);
    case 'atrasados':  return info.estado === 'atrasado';
    case 'concluidos': return info.estado === 'feito';
    case 'dia':        return info.key === filtro.de;
    case 'intervalo':  return info.key >= filtro.de && info.key <= filtro.ate;
    default:           return true;
  }
}

export function rotuloFiltro(filtro) {
  if (!filtro) return null;
  switch (filtro.tipo) {
    case 'hoje':       return 'Hoje';
    case 'amanha':     return 'Amanhã';
    case 'semana':     return 'Esta semana';
    case 'mes':        return 'Este mês';
    case 'atrasados':  return 'Atrasados';
    case 'concluidos': return 'Concluídos';
    case 'dia':        return formatDiaCurto(filtro.de);
    case 'intervalo':  return `${formatDiaCurto(filtro.de)} – ${formatDiaCurto(filtro.ate)}`;
  }
  return null;
}

// ── Contagens (resumo + calendário) ───────────────────────────

export function calcularContagens(negocios, hoje = hojeKey()) {
  const c = { hoje: 0, amanha: 0, semana: 0, mes: 0, atrasados: 0, concluidos: 0, porDia: {} };
  const amanha = addDias(hoje, 1);
  const fimSemana = fimDaSemana(hoje);
  const fimMes = fimDoMes(hoje);

  negocios.forEach(neg => {
    const info = estadoRecontato(neg, hoje);
    if (!info) return;

    const dia = (c.porDia[info.key] ??= { pend: 0, atras: 0, feito: 0 });
    if (info.estado === 'feito') {
      c.concluidos++;
      dia.feito++;
      return;
    }
    if (info.estado === 'atrasado') {
      c.atrasados++;
      dia.atras++;
      return;
    }
    dia.pend++;
    if (info.key === hoje)   c.hoje++;
    if (info.key === amanha) c.amanha++;
    if (info.key <= fimSemana) c.semana++;
    if (info.key <= fimMes)    c.mes++;
  });

  return c;
}

// ── Badge do card / lista ─────────────────────────────────────

export function badgeRecontato(neg, hoje = hojeKey()) {
  const info = estadoRecontato(neg, hoje);
  if (!info) return null;

  switch (info.estado) {
    case 'feito':
      return { estado: 'feito', cls: 'opp-recontado--done', label: `✓ Recontatado · ${formatDiaCurto(info.key)}`, title: 'Recontato concluído' };
    case 'atrasado':
      return {
        estado: 'atrasado', cls: 'opp-recontado--overdue',
        label: `⚠ Atrasado · ${formatDiaCurto(info.key)}`,
        title: `Recontato atrasado há ${info.diasAtraso} dia${info.diasAtraso !== 1 ? 's' : ''}`,
      };
    case 'hoje':
      return { estado: 'hoje', cls: 'opp-recontado--today', label: '🔔 Hoje', title: 'Recontato agendado para hoje' };
    default: {
      const amanha = info.key === addDias(hoje, 1);
      return {
        estado: 'futuro', cls: 'opp-recontado--future',
        label: `📅 ${amanha ? 'Amanhã' : formatDiaCurto(info.key)}`,
        title: `Recontato agendado para ${formatDiaCurto(info.key)}`,
      };
    }
  }
}
