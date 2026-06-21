-- ============================================================
-- 005_budget_templates.sql
-- Plantillas de presupuesto para carga rápida
-- ============================================================

create table budget_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table budget_templates enable row level security;

create policy "budget_templates_own" on budget_templates
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_budget_templates_user on budget_templates(user_id);
