-- ============================================================
-- 001_initial_schema.sql
-- Esquema base de la plataforma de finanzas personales
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TIPOS ENUM
-- ============================================================
create type plan_type as enum ('free', 'premium');
create type plan_name as enum ('personal', 'pareja', 'familiar');
create type transaction_type as enum ('income', 'expense');
create type category_type as enum ('income', 'expense');
create type currency_type as enum ('PEN', 'USD');
create type payment_frequency as enum ('daily', 'weekly', 'biweekly', 'monthly', 'annual');
create type family_member_status as enum ('pending', 'active', 'removed');
create type challenge_status as enum ('active', 'completed', 'abandoned');

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency currency_type not null default 'PEN',
  plan plan_type not null default 'free',
  plan_type plan_name,
  plan_expires_at timestamptz,
  family_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- FAMILY GROUPS
-- ============================================================
create table family_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint fk_profiles_family_group
  foreign key (family_group_id) references family_groups(id) on delete set null;

-- ============================================================
-- FAMILY MEMBERS
-- ============================================================
create table family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  family_group_id uuid not null references family_groups(id) on delete cascade,
  invited_at timestamptz not null default now(),
  status family_member_status not null default 'pending',
  unique (user_id, family_group_id)
);

-- ============================================================
-- CATEGORIES
-- ============================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  type category_type not null,
  parent_id uuid references categories(id) on delete set null,
  icon text,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- EXCHANGE RATES
-- ============================================================
create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  usd_to_pen numeric(10, 4) not null,
  source text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  type transaction_type not null,
  category_id uuid references categories(id) on delete set null,
  concept text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency currency_type not null default 'PEN',
  amount_pen numeric(12, 2) not null check (amount_pen > 0),
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TRANSACTION DETAILS (gastos menores)
-- ============================================================
create table transaction_details (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PLANNED PAYMENTS
-- ============================================================
create table planned_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  concept text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency currency_type not null default 'PEN',
  category_id uuid references categories(id) on delete set null,
  frequency payment_frequency not null default 'monthly',
  next_due_date date not null,
  day_of_month integer check (day_of_month between 1 and 31),
  auto_register boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- BUDGETS
-- ============================================================
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  category_id uuid not null references categories(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, month, category_id)
);

-- ============================================================
-- DEBTS
-- ============================================================
create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  creditor text not null,
  initial_balance numeric(12, 2) not null check (initial_balance > 0),
  current_balance numeric(12, 2) not null check (current_balance >= 0),
  monthly_payment numeric(12, 2) not null check (monthly_payment > 0),
  payment_day integer not null check (payment_day between 1 and 31),
  interest_rate numeric(5, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SAVINGS SNAPSHOTS
-- ============================================================
create table savings_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  amount numeric(12, 2) not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, year, month)
);

-- ============================================================
-- PAYMENT REMINDERS
-- ============================================================
create table payment_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  concept text not null,
  day_of_month integer not null check (day_of_month between 1 and 31),
  amount numeric(12, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- HEALTH SCORES
-- ============================================================
create table health_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  score integer not null check (score between 1 and 100),
  breakdown jsonb not null default '{}',
  explanation text,
  created_at timestamptz not null default now(),
  unique (user_id, year, month)
);

-- ============================================================
-- CHALLENGES
-- ============================================================
create table challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  start_date date not null,
  end_date date not null,
  status challenge_status not null default 'active',
  saved_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SHARED SUMMARIES
-- ============================================================
create table shared_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'base64url'),
  year integer not null,
  month integer not null check (month between 1 and 12),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- AI INSIGHTS (cache)
-- ============================================================
create table ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  year integer not null,
  month integer not null,
  input_hash text not null,
  content text not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (user_id, type, year, month, input_hash)
);

-- ============================================================
-- BILLING EVENTS
-- ============================================================
create table billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  event_type text not null,
  plan plan_type,
  plan_type plan_name,
  amount numeric(10, 2),
  currency text,
  provider text,
  provider_event_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index idx_transactions_user_date on transactions(user_id, date desc);
create index idx_transactions_category on transactions(category_id);
create index idx_categories_user on categories(user_id, type);
create index idx_planned_payments_user_active on planned_payments(user_id, is_active, next_due_date);
create index idx_budgets_user_period on budgets(user_id, year, month);
create index idx_health_scores_user on health_scores(user_id, year, month);
create index idx_ai_insights_lookup on ai_insights(user_id, type, year, month);
create index idx_shared_summaries_token on shared_summaries(token);
create index idx_billing_events_user on billing_events(user_id, created_at desc);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_transactions_updated_at before update on transactions
  for each row execute function set_updated_at();
create trigger trg_planned_payments_updated_at before update on planned_payments
  for each row execute function set_updated_at();
create trigger trg_budgets_updated_at before update on budgets
  for each row execute function set_updated_at();
create trigger trg_debts_updated_at before update on debts
  for each row execute function set_updated_at();
create trigger trg_challenges_updated_at before update on challenges
  for each row execute function set_updated_at();
