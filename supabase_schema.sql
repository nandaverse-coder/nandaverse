-- Execute este SQL no Supabase → SQL Editor

-- 1. Lançamentos
create table lancamentos (
  id uuid default gen_random_uuid() primary key,
  tipo text not null check (tipo in ('receita', 'despesa')),
  valor numeric(10,2) not null,
  descricao text not null,
  data date not null,
  grupo text not null,
  cat text not null,
  obs text default '',
  created_at timestamptz default now()
);

-- 2. Metas por grupo
create table metas (
  id uuid default gen_random_uuid() primary key,
  grupo text not null unique,
  valor numeric(10,2) not null,
  updated_at timestamptz default now()
);

-- 3. Categorias personalizadas
create table categorias (
  id uuid default gen_random_uuid() primary key,
  grupo text not null,
  nome text not null,
  unique(grupo, nome)
);

-- Permissões: libera acesso público (só você usa)
alter table lancamentos enable row level security;
alter table metas enable row level security;
alter table categorias enable row level security;

create policy "allow all" on lancamentos for all using (true) with check (true);
create policy "allow all" on metas for all using (true) with check (true);
create policy "allow all" on categorias for all using (true) with check (true);
