-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security — cada usuario solo ve sus propios datos
-- ============================================================

-- Habilitar RLS en todas las tablas
alter table profiles enable row level security;
alter table family_groups enable row level security;
alter table family_members enable row level security;
alter table categories enable row level security;
alter table exchange_rates enable row level security;
alter table transactions enable row level security;
alter table transaction_details enable row level security;
alter table planned_payments enable row level security;
alter table budgets enable row level security;
alter table debts enable row level security;
alter table savings_snapshots enable row level security;
alter table payment_reminders enable row level security;
alter table health_scores enable row level security;
alter table challenges enable row level security;
alter table shared_summaries enable row level security;
alter table ai_insights enable row level security;
alter table billing_events enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- ============================================================
-- FAMILY GROUPS
-- ============================================================
create policy "family_groups_select" on family_groups
  for select using (
    owner_id = auth.uid() or
    exists (
      select 1 from family_members
      where family_group_id = family_groups.id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "family_groups_insert" on family_groups
  for insert with check (owner_id = auth.uid());

create policy "family_groups_delete" on family_groups
  for delete using (owner_id = auth.uid());

-- ============================================================
-- FAMILY MEMBERS
-- ============================================================
create policy "family_members_select" on family_members
  for select using (
    user_id = auth.uid() or
    exists (
      select 1 from family_groups
      where id = family_members.family_group_id
        and owner_id = auth.uid()
    )
  );

create policy "family_members_manage_owner" on family_members
  for all using (
    exists (
      select 1 from family_groups
      where id = family_members.family_group_id
        and owner_id = auth.uid()
    )
  );

-- ============================================================
-- CATEGORIES
-- ============================================================
create policy "categories_own" on categories
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- EXCHANGE RATES (lectura pública para todos los autenticados)
-- ============================================================
create policy "exchange_rates_select" on exchange_rates
  for select using (auth.uid() is not null);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create policy "transactions_own" on transactions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- TRANSACTION DETAILS
-- ============================================================
create policy "transaction_details_own" on transaction_details
  for all using (
    exists (
      select 1 from transactions
      where id = transaction_details.transaction_id
        and user_id = auth.uid()
    )
  );

-- ============================================================
-- PLANNED PAYMENTS
-- ============================================================
create policy "planned_payments_own" on planned_payments
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- BUDGETS
-- ============================================================
create policy "budgets_own" on budgets
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- DEBTS
-- ============================================================
create policy "debts_own" on debts
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- SAVINGS SNAPSHOTS
-- ============================================================
create policy "savings_snapshots_own" on savings_snapshots
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- PAYMENT REMINDERS
-- ============================================================
create policy "payment_reminders_own" on payment_reminders
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- HEALTH SCORES
-- ============================================================
create policy "health_scores_own" on health_scores
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- CHALLENGES
-- ============================================================
create policy "challenges_own" on challenges
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- SHARED SUMMARIES
-- ============================================================
create policy "shared_summaries_own" on shared_summaries
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Permitir lectura anónima por token (para links compartidos)
create policy "shared_summaries_public_token" on shared_summaries
  for select using (expires_at > now());

-- ============================================================
-- AI INSIGHTS
-- ============================================================
create policy "ai_insights_own" on ai_insights
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- BILLING EVENTS
-- ============================================================
create policy "billing_events_select_own" on billing_events
  for select using (user_id = auth.uid());

-- Solo service role puede insertar billing events (desde webhook)
