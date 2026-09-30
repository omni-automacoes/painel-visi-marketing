-- ════════════════════════════════════════════════════════════════════════════
-- API pública Visi Marketing (v1) — somente leitura
--
-- api_chaves  : chaves de API (guarda apenas o hash SHA-256, nunca a chave)
-- api_v1()    : valida a chave, aplica o escopo (geral | admin) e devolve
--               { status, body } já formatado. Chamada pelo endpoint
--               /api/v1 na Vercel (api.visimarketing.com.br/v1/...).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.api_chaves (
  chave_id      bigint generated always as identity primary key,
  chave_nome    text        not null,
  chave_escopo  text        not null check (chave_escopo in ('geral', 'admin')),
  chave_hash    text        not null unique,
  chave_prefixo text        not null,
  chave_ativa   boolean     not null default true,
  criado_em     timestamptz not null default now(),
  ultimo_uso    timestamptz
);

-- Sem policies: a tabela só é acessível pela função abaixo (security definer).
alter table public.api_chaves enable row level security;
revoke all on public.api_chaves from anon, authenticated;


create or replace function public.api_v1(p_chave text, p_recurso text, p_params jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
set "TimeZone" = 'America/Sao_Paulo'
as $$
declare
  v_chave    api_chaves;
  v_admin    boolean;
  v_recurso  text := trim(both '/' from lower(coalesce(p_recurso, '')));
  v_limit    int;
  v_offset   int;
  v_desde    timestamptz;
  v_ate      timestamptz;
  v_id       bigint;
  v_pipeline bigint;
  v_status   text := nullif(trim(p_params->>'status'), '');
  v_total    bigint;
  v_dados    jsonb;
  v_ativos   bigint;
  v_mrr      numeric;
begin
  -- ─── Autenticação ──────────────────────────────────────────────────────
  if coalesce(p_chave, '') = '' then
    return jsonb_build_object('status', 401, 'body', jsonb_build_object(
      'erro', 'chave_ausente', 'mensagem', 'Envie sua chave de API no cabeçalho x-api-key.'));
  end if;

  select * into v_chave
    from api_chaves
   where chave_hash = encode(sha256(convert_to(p_chave, 'UTF8')), 'hex')
     and chave_ativa;

  if not found then
    return jsonb_build_object('status', 401, 'body', jsonb_build_object(
      'erro', 'chave_invalida', 'mensagem', 'Chave de API inválida ou revogada.'));
  end if;

  v_admin := v_chave.chave_escopo = 'admin';
  update api_chaves set ultimo_uso = now() where chave_id = v_chave.chave_id;

  -- ─── Parâmetros ────────────────────────────────────────────────────────
  begin
    v_limit    := least(greatest(coalesce((p_params->>'limit')::int, 50), 1), 500);
    v_offset   := greatest(coalesce((p_params->>'offset')::int, 0), 0);
    v_id       := (p_params->>'id')::bigint;
    v_pipeline := (p_params->>'pipeline_id')::bigint;
    v_desde    := (p_params->>'desde')::timestamptz;
    -- "ate" só com data (AAAA-MM-DD) inclui o dia inteiro
    v_ate      := case when length(p_params->>'ate') = 10
                       then ((p_params->>'ate')::date + 1)::timestamptz
                       else (p_params->>'ate')::timestamptz end;
  exception when others then
    return jsonb_build_object('status', 400, 'body', jsonb_build_object(
      'erro', 'parametro_invalido',
      'mensagem', 'Verifique limit, offset, id, pipeline_id, desde e ate (datas no formato AAAA-MM-DD).'));
  end;

  -- ─── Escopo ────────────────────────────────────────────────────────────
  if v_recurso in ('financeiro/receitas', 'financeiro/despesas', 'financeiro/resumo', 'metricas', 'usuarios')
     and not v_admin then
    return jsonb_build_object('status', 403, 'body', jsonb_build_object(
      'erro', 'acesso_negado', 'mensagem', 'Este recurso exige a chave de Administrador.'));
  end if;

  -- ─── Recursos ──────────────────────────────────────────────────────────
  case v_recurso

  when 'negocios' then
    with f as (
      select n.*, e.etapa_nome, p.pipeline_nome, u.user_nome
        from negocios n
        left join etapas_pipeline e on e.etapa_id = n.etapa_id
        left join pipelines p       on p.pipeline_id = n.pipeline_id
        left join usuarios u        on u.user_id = n.vendedor_id
       where (v_id is null or n.negocio_id = v_id)
         and (v_status is null or n.negocio_status::text ilike v_status)
         and (v_pipeline is null or n.pipeline_id = v_pipeline)
         and (v_desde is null or n.criado_em >= v_desde)
         and (v_ate is null or n.criado_em < v_ate)
    ), pg as (
      select * from f order by criado_em desc nulls last, negocio_id desc limit v_limit offset v_offset
    )
    select (select count(*) from f),
           coalesce((select jsonb_agg(jsonb_build_object(
             'id', negocio_id, 'titulo', negocio_titulo, 'valor', negocio_valor,
             'status', negocio_status, 'email', negocio_email, 'telefone', negocio_telefone,
             'instagram', link_instagram, 'origem', negocio_origem, 'segmento', negocio_segmento,
             'lead_qualificado', coalesce(negocio_lead_qualificado, false),
             'reuniao_realizada', coalesce(reuniao_realizada, false), 'no_show', coalesce(negocio_noshow, false),
             'pipeline_id', pipeline_id, 'pipeline', pipeline_nome, 'etapa_id', etapa_id, 'etapa', etapa_nome,
             'vendedor', user_nome, 'data_fechamento', data_fechamento,
             'criado_em', criado_em, 'atualizado_em', ultima_atualizacao
           ) order by criado_em desc nulls last, negocio_id desc) from pg), '[]'::jsonb)
      into v_total, v_dados;

  when 'clientes' then
    with f as (
      select * from clientes c
       where (v_id is null or c.cliente_id = v_id)
         and (v_status is null or c.cliente_status::text ilike v_status)
         and (v_desde is null or c.criado_em >= v_desde)
         and (v_ate is null or c.criado_em < v_ate)
    ), pg as (
      select * from f order by criado_em desc nulls last, cliente_id desc limit v_limit offset v_offset
    )
    select (select count(*) from f),
           coalesce((select jsonb_agg(jsonb_build_object(
             'id', cliente_id, 'nome', cliente_nome, 'email', cliente_email, 'telefone', cliente_telefone,
             'status', cliente_status, 'segmento', segmento, 'origem', cliente_origem,
             'satisfacao', cliente_satisfacao, 'risco_churn', cliente_risco_churn,
             'churn', coalesce(cliente_churn, false), 'contrato', coalesce(cliente_contrato, false),
             'negocio_id', negocio_id, 'criado_em', criado_em, 'atualizado_em', ultima_atualizacao
           ) || case when v_admin then jsonb_build_object(
             'mensalidade', cliente_mensalidade, 'investimento_midia', investimento_midia,
             'contrato_duracao_meses', contrato_duracao, 'data_churn', data_churn,
             'motivo_churn', motivo_churn, 'receita_perdida', receita_perdida
           ) else '{}'::jsonb end
           order by criado_em desc nulls last, cliente_id desc) from pg), '[]'::jsonb)
      into v_total, v_dados;

  when 'tarefas' then
    with f as (
      select t.*, u.user_nome
        from tarefas t
        left join usuarios u on u.user_id = t.vendedor_id
       where (v_id is null or t.tarefa_id = v_id)
         and (v_status is null
              or (lower(v_status) = 'pendente'  and not coalesce(t.tarefa_status, false))
              or (lower(v_status) = 'concluida' and coalesce(t.tarefa_status, false))
              or (lower(v_status) = 'atrasada'  and not coalesce(t.tarefa_status, false) and t.tarefa_vencimento < now()))
         and (v_desde is null or t.tarefa_vencimento >= v_desde)
         and (v_ate is null or t.tarefa_vencimento < v_ate)
    ), pg as (
      select * from f order by tarefa_vencimento desc nulls last, tarefa_id desc limit v_limit offset v_offset
    )
    select (select count(*) from f),
           coalesce((select jsonb_agg(jsonb_build_object(
             'id', tarefa_id, 'titulo', tarefa_titulo, 'descricao', tarefa_descricao,
             'prioridade', tarefa_prioridade, 'concluida', coalesce(tarefa_status, false),
             'inicio', data_inicio, 'vencimento', tarefa_vencimento, 'data_conclusao', data_conclusao,
             'negocio_id', negocio_id, 'responsavel', user_nome, 'criado_em', criado_em
           ) order by tarefa_vencimento desc nulls last, tarefa_id desc) from pg), '[]'::jsonb)
      into v_total, v_dados;

  when 'pipelines' then
    select count(*),
           coalesce(jsonb_agg(jsonb_build_object(
             'id', p.pipeline_id, 'nome', p.pipeline_nome, 'ativo', coalesce(p.pipeline_status, false),
             'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', e.etapa_id, 'nome', e.etapa_nome, 'ordem', e.etapa_ordem)
                                                  order by e.etapa_ordem)
                                   from etapas_pipeline e where e.pipeline_id = p.pipeline_id), '[]'::jsonb)
           ) order by p.pipeline_id), '[]'::jsonb)
      into v_total, v_dados
      from pipelines p
     where v_id is null or p.pipeline_id = v_id;

  when 'resumo' then
    return jsonb_build_object('status', 200, 'body', jsonb_build_object(
      'periodo', jsonb_build_object('desde', v_desde, 'ate', v_ate),
      'dados', jsonb_build_object(
        'negocios', (select jsonb_build_object(
            'abertos',  count(*) filter (where negocio_status = 'Aberto'),
            'ganhos',   count(*) filter (where negocio_status = 'Ganho'),
            'perdidos', count(*) filter (where negocio_status = 'Perdido'),
            'total',    count(*))
          from negocios
         where (v_desde is null or criado_em >= v_desde) and (v_ate is null or criado_em < v_ate)),
        'clientes', (select jsonb_build_object(
            'ativos', count(*) filter (where cliente_status in ('Ativado', 'Novo Cliente') and not coalesce(cliente_churn, false)),
            'total',  count(*))
          from clientes),
        'tarefas', (select jsonb_build_object(
            'pendentes', count(*) filter (where not coalesce(tarefa_status, false)),
            'atrasadas', count(*) filter (where not coalesce(tarefa_status, false) and tarefa_vencimento < now()))
          from tarefas)
      )));

  when 'usuarios' then
    select count(*),
           coalesce(jsonb_agg(jsonb_build_object(
             'id', user_id, 'nome', user_nome, 'email', user_email, 'cargo', user_cargo,
             'status', user_status, 'ultimo_login', ultimo_login
           ) order by user_nome), '[]'::jsonb)
      into v_total, v_dados
      from usuarios;

  when 'financeiro/receitas' then
    with f as (
      select r.*, c.cliente_nome
        from financeiro_receitas r
        left join clientes c on c.cliente_id = r.cliente_id
       where (v_id is null or r.receita_id = v_id)
         and (v_status is null or r.receita_status::text ilike v_status)
         and (v_desde is null or r.data_vencimento >= v_desde)
         and (v_ate is null or r.data_vencimento < v_ate)
    ), pg as (
      select * from f order by data_vencimento desc nulls last, receita_id desc limit v_limit offset v_offset
    )
    select (select count(*) from f),
           coalesce((select jsonb_agg(jsonb_build_object(
             'id', receita_id, 'nome', receita_nome, 'descricao', receita_descricao,
             'tipo', receita_tipo, 'valor', receita_valor, 'status', receita_status,
             'vencimento', data_vencimento, 'recebimento', data_recebimento,
             'cliente_id', cliente_id, 'cliente', cliente_nome, 'criado_em', criado_em
           ) order by data_vencimento desc nulls last, receita_id desc) from pg), '[]'::jsonb)
      into v_total, v_dados;

  when 'financeiro/despesas' then
    with f as (
      select * from financeiro_despesas d
       where (v_id is null or d.despesa_id = v_id)
         and (v_status is null or d.despesa_status::text ilike v_status)
         and (v_desde is null or d.data_vencimento >= v_desde)
         and (v_ate is null or d.data_vencimento < v_ate)
    ), pg as (
      select * from f order by data_vencimento desc nulls last, despesa_id desc limit v_limit offset v_offset
    )
    select (select count(*) from f),
           coalesce((select jsonb_agg(jsonb_build_object(
             'id', despesa_id, 'nome', despesa_nome, 'categoria', despesa_categoria,
             'tipo', despesa_tipo, 'valor', despesa_valor, 'status', despesa_status,
             'vencimento', data_vencimento, 'pagamento', data_pagamento, 'criado_em', criado_em
           ) order by data_vencimento desc nulls last, despesa_id desc) from pg), '[]'::jsonb)
      into v_total, v_dados;

  when 'financeiro/resumo', 'metricas' then
    -- Sem período informado: mês atual
    v_desde := coalesce(v_desde, date_trunc('month', now()));
    v_ate   := coalesce(v_ate, date_trunc('month', now()) + interval '1 month');

    select count(*), coalesce(sum(cliente_mensalidade), 0)
      into v_ativos, v_mrr
      from clientes
     where cliente_status in ('Ativado', 'Novo Cliente') and not coalesce(cliente_churn, false);

    if v_recurso = 'financeiro/resumo' then
      return jsonb_build_object('status', 200, 'body', jsonb_build_object(
        'periodo', jsonb_build_object('desde', v_desde, 'ate', v_ate),
        'dados', (
          with r as (select * from financeiro_receitas where data_vencimento >= v_desde and data_vencimento < v_ate),
               d as (select * from financeiro_despesas where data_vencimento >= v_desde and data_vencimento < v_ate)
          select jsonb_build_object(
            'receitas', (select jsonb_build_object(
                'previsto',  coalesce(sum(receita_valor) filter (where receita_status <> 'Cancelado'), 0),
                'recebido',  coalesce(sum(receita_valor) filter (where receita_status = 'Pago'), 0),
                'pendente',  coalesce(sum(receita_valor) filter (where receita_status = 'Pendente'), 0),
                'atrasado',  coalesce(sum(receita_valor) filter (where receita_status = 'Atrasado'), 0)) from r),
            'despesas', (select jsonb_build_object(
                'previsto',  coalesce(sum(despesa_valor), 0),
                'pago',      coalesce(sum(despesa_valor) filter (where despesa_status = 'Pago'), 0),
                'pendente',  coalesce(sum(despesa_valor) filter (where despesa_status = 'Pendente'), 0),
                'atrasado',  coalesce(sum(despesa_valor) filter (where despesa_status = 'Atrasado'), 0)) from d),
            'saldo_realizado',
                (select coalesce(sum(receita_valor) filter (where receita_status = 'Pago'), 0) from r)
              - (select coalesce(sum(despesa_valor) filter (where despesa_status = 'Pago'), 0) from d),
            'saldo_previsto',
                (select coalesce(sum(receita_valor) filter (where receita_status <> 'Cancelado'), 0) from r)
              - (select coalesce(sum(despesa_valor), 0) from d),
            'mrr', v_mrr,
            'clientes_ativos', v_ativos
          ))));
    end if;

    return jsonb_build_object('status', 200, 'body', jsonb_build_object(
      'periodo', jsonb_build_object('desde', v_desde, 'ate', v_ate),
      'dados', (
        with fech as (select * from negocios where data_fechamento >= v_desde and data_fechamento < v_ate),
             novos as (select * from negocios where criado_em >= v_desde and criado_em < v_ate),
             churn as (select * from clientes where data_churn >= v_desde and data_churn < v_ate)
        select jsonb_build_object(
          'novos_negocios',    (select count(*) from novos),
          'leads_qualificados',(select count(*) from novos where coalesce(negocio_lead_qualificado, false)),
          'negocios_ganhos',   (select count(*) from fech where negocio_status = 'Ganho'),
          'negocios_perdidos', (select count(*) from fech where negocio_status = 'Perdido'),
          'valor_ganho',       (select coalesce(sum(negocio_valor), 0) from fech where negocio_status = 'Ganho'),
          'ticket_medio',      (select coalesce(round(avg(negocio_valor), 2), 0) from fech where negocio_status = 'Ganho'),
          'taxa_conversao_pct',(select case when count(*) = 0 then 0
                                            else round(100.0 * count(*) filter (where negocio_status = 'Ganho') / count(*), 1) end
                                  from fech where negocio_status in ('Ganho', 'Perdido')),
          'meta_vendas',       (select coalesce(sum(meta_valor), 0) from meta_mensal where meta_data >= v_desde and meta_data < v_ate),
          'clientes_ativos',   v_ativos,
          'mrr',               v_mrr,
          'churns',            (select count(*) from churn),
          'receita_perdida_churn', (select coalesce(sum(receita_perdida), 0) from churn)
        ))));

  else
    return jsonb_build_object('status', 404, 'body', jsonb_build_object(
      'erro', 'recurso_inexistente', 'mensagem', format('Recurso "%s" não existe.', v_recurso)));
  end case;

  return jsonb_build_object('status', 200, 'body', jsonb_build_object(
    'dados', v_dados,
    'paginacao', jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset)));
end;
$$;

revoke all on function public.api_v1(text, text, jsonb) from public;
grant execute on function public.api_v1(text, text, jsonb) to anon, authenticated;
