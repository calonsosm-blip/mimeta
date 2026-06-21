-- ============================================================
-- 003_views_and_functions.sql
-- Vistas y funciones para reportes y análisis
-- ============================================================

-- ============================================================
-- VISTA: monthly_summary
-- ============================================================
create or replace view monthly_summary as
select
  t.user_id,
  extract(year from t.date)::integer as year,
  extract(month from t.date)::integer as month,
  c.id as category_id,
  c.name as category_name,
  c.type,
  sum(t.amount_pen) as total
from transactions t
left join categories c on c.id = t.category_id
group by t.user_id, extract(year from t.date), extract(month from t.date), c.id, c.name, c.type;

-- ============================================================
-- VISTA: budget_vs_actual
-- ============================================================
create or replace view budget_vs_actual as
select
  b.user_id,
  b.year,
  b.month,
  b.category_id,
  c.name as category_name,
  b.amount as budget,
  coalesce(actual.total, 0) as actual,
  case
    when b.amount > 0 then round((coalesce(actual.total, 0) / b.amount * 100)::numeric, 1)
    else 0
  end as percentage
from budgets b
join categories c on c.id = b.category_id
left join (
  select
    user_id,
    category_id,
    extract(year from date)::integer as year,
    extract(month from date)::integer as month,
    sum(amount_pen) as total
  from transactions
  where type = 'expense'
  group by user_id, category_id, extract(year from date), extract(month from date)
) actual on actual.user_id = b.user_id
  and actual.category_id = b.category_id
  and actual.year = b.year
  and actual.month = b.month;

-- ============================================================
-- FUNCIÓN: get_monthly_balance
-- ============================================================
create or replace function get_monthly_balance(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
returns table (income numeric, expenses numeric, balance numeric)
language sql security definer as $$
  select
    coalesce(sum(case when type = 'income' then amount_pen else 0 end), 0) as income,
    coalesce(sum(case when type = 'expense' then amount_pen else 0 end), 0) as expenses,
    coalesce(sum(case when type = 'income' then amount_pen else -amount_pen end), 0) as balance
  from transactions
  where user_id = p_user_id
    and extract(year from date) = p_year
    and extract(month from date) = p_month;
$$;

-- ============================================================
-- FUNCIÓN: get_annual_summary
-- ============================================================
create or replace function get_annual_summary(
  p_user_id uuid,
  p_year integer
)
returns table (month integer, income numeric, expenses numeric, balance numeric)
language sql security definer as $$
  select
    extract(month from date)::integer as month,
    coalesce(sum(case when type = 'income' then amount_pen else 0 end), 0) as income,
    coalesce(sum(case when type = 'expense' then amount_pen else 0 end), 0) as expenses,
    coalesce(sum(case when type = 'income' then amount_pen else -amount_pen end), 0) as balance
  from transactions
  where user_id = p_user_id
    and extract(year from date) = p_year
  group by extract(month from date)
  order by month;
$$;

-- ============================================================
-- FUNCIÓN: calculate_health_score
-- Calcula los ratios para el score de salud financiera
-- ============================================================
create or replace function calculate_health_score(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
returns jsonb
language plpgsql security definer as $$
declare
  v_income numeric;
  v_expenses numeric;
  v_savings_ratio numeric;
  v_debt_ratio numeric;
  v_budget_compliance numeric;
  v_transaction_days integer;
  v_working_days integer;
  v_consistency numeric;
  v_result jsonb;
begin
  -- Balance del mes
  select
    coalesce(sum(case when type = 'income' then amount_pen else 0 end), 0),
    coalesce(sum(case when type = 'expense' then amount_pen else 0 end), 0)
  into v_income, v_expenses
  from transactions
  where user_id = p_user_id
    and extract(year from date) = p_year
    and extract(month from date) = p_month;

  -- Ratio ahorro/ingreso (peso 30%)
  v_savings_ratio := case
    when v_income > 0 then least((v_income - v_expenses) / v_income, 1)
    else 0
  end;

  -- Ratio deuda/ingreso mensual (peso 30%)
  select
    case
      when v_income > 0
      then least(coalesce(sum(monthly_payment), 0) / v_income, 1)
      else 0
    end
  into v_debt_ratio
  from debts
  where user_id = p_user_id and is_active = true;

  -- % presupuesto cumplido (peso 25%)
  select
    case
      when count(*) > 0
      then avg(case when actual <= budget then 1.0 else budget / nullif(actual, 0) end)
      else null
    end
  into v_budget_compliance
  from budget_vs_actual
  where user_id = p_user_id and year = p_year and month = p_month;

  -- Consistencia de registro (peso 15%) — días con transacciones vs días del mes
  select count(distinct date)
  into v_transaction_days
  from transactions
  where user_id = p_user_id
    and extract(year from date) = p_year
    and extract(month from date) = p_month;

  v_working_days := extract(days from
    date_trunc('month', make_date(p_year, p_month, 1)) +
    interval '1 month' - interval '1 day'
  )::integer;

  v_consistency := least(v_transaction_days::numeric / greatest(v_working_days / 2, 1), 1);

  v_result := jsonb_build_object(
    'savings_ratio', round(coalesce(v_savings_ratio, 0)::numeric, 4),
    'debt_ratio', round(coalesce(v_debt_ratio, 0)::numeric, 4),
    'budget_compliance', round(coalesce(v_budget_compliance, 0.5)::numeric, 4),
    'consistency', round(coalesce(v_consistency, 0)::numeric, 4),
    'income', v_income,
    'expenses', v_expenses
  );

  return v_result;
end;
$$;

-- ============================================================
-- FUNCIÓN: get_ant_expenses
-- Agrupa gastos hormiga con impacto anualizado
-- ============================================================
create or replace function get_ant_expenses(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
returns table (
  category_id uuid,
  category_name text,
  transaction_count bigint,
  total_pen numeric,
  avg_amount numeric,
  annual_projection numeric
)
language sql security definer as $$
  select
    t.category_id,
    c.name as category_name,
    count(*) as transaction_count,
    sum(t.amount_pen) as total_pen,
    avg(t.amount_pen) as avg_amount,
    sum(t.amount_pen) * 12 as annual_projection
  from transactions t
  left join categories c on c.id = t.category_id
  where t.user_id = p_user_id
    and t.type = 'expense'
    and extract(year from t.date) = p_year
    and extract(month from t.date) = p_month
    and t.amount_pen < 50  -- gastos menores a S/ 50
  group by t.category_id, c.name
  having count(*) >= 3     -- al menos 3 veces en el mes
  order by sum(t.amount_pen) desc;
$$;
