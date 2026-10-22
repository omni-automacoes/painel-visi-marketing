-- Data em que o SDR marcou o lead como qualificado (MQL).
-- Preenchida ao marcar o botão de qualificação, ao marcar reunião ou ao ganhar
-- o lead (sem sobrescrever uma data já registrada); limpa ao desmarcar.

alter table public.negocios
  add column if not exists negocio_lead_qualificado_em timestamptz;
