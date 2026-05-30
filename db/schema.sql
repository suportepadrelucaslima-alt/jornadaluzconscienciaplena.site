-- Tabela de compradores (Supabase)
create table if not exists compradores (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  produto_id text not null,
  ativo boolean default true,
  criado_em timestamptz default now(),
  ultimo_acesso timestamptz,
  unique(email, produto_id)
);

-- Index para busca por email
create index if not exists compradores_email_idx on compradores(email);

-- RLS desabilitado (acesso via service key no backend)
alter table compradores disable row level security;
