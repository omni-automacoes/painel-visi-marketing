-- Normaliza negocios.negocio_origem para os 7 canais de aquisição
-- (Meta Ads, Google Ads, ACE, BNI, Base ativa, Indicação, Prospecção).
-- O valor original de cada negócio fica guardado em negocios_origem_backup,
-- então a migração pode ser revertida. Origens que não casam com nenhum canal
-- (ex.: Evento, Pakto, Orgânico) permanecem como estão.

create table if not exists public.negocios_origem_backup (
  negocio_id bigint primary key,
  negocio_origem_original text,
  migrado_em timestamptz not null default now()
);
alter table public.negocios_origem_backup enable row level security;

insert into public.negocios_origem_backup (negocio_id, negocio_origem_original)
select negocio_id, negocio_origem from public.negocios
where negocio_origem is not null and trim(negocio_origem) <> ''
on conflict (negocio_id) do nothing;

update public.negocios n
set negocio_origem = c.canal
from (
  select negocio_id,
    case
      when t ~ '(camp|camap|capm|meta|trafego)' then 'Meta Ads'
      when t ~ 'google' then 'Google Ads'
      when t ~ 'bni' then 'BNI'
      when t ~ '\mace\M' then 'ACE'
      when t ~ '(base ativa|reativ)' then 'Base ativa'
      when t ~ 'indica' then 'Indicação'
      when t ~ '(prospec|social selling|instagram|rede social)' then 'Prospecção'
    end as canal
  from (
    select negocio_id, translate(lower(trim(negocio_origem)),'áàâãéêíóôõúç','aaaaeeiooouc') as t
    from public.negocios
    where negocio_origem is not null and trim(negocio_origem) <> ''
  ) s
) c
where n.negocio_id = c.negocio_id and c.canal is not null;

-- Reverter:
--   update public.negocios n set negocio_origem = b.negocio_origem_original
--   from public.negocios_origem_backup b where b.negocio_id = n.negocio_id;
