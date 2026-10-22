-- Investimento mensal por canal de aquisição (Relatórios > Setor Comercial).
-- Uma linha por (mês, canal). O total do mês continua espelhado em
-- relatorios_investimentos para não quebrar CAC/LTV das demais abas.

create table if not exists public.relatorios_investimentos_canal (
  periodo       text        not null,                -- 'YYYY-MM'
  canal         text        not null,                -- chave do canal (js/canais.js)
  valor         numeric     not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (periodo, canal)
);

alter table public.relatorios_investimentos_canal enable row level security;

create policy "Usuarios autenticados acesso completo relatorios_investimentos_canal"
  on public.relatorios_investimentos_canal
  for all
  to authenticated
  using (true)
  with check (true);
