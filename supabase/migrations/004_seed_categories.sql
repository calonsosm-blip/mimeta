-- ============================================================
-- 004_seed_categories.sql
-- Trigger y función para sembrar categorías y datos de ejemplo
-- al registrarse un nuevo usuario
-- ============================================================

-- ============================================================
-- FUNCIÓN: seed_default_categories
-- Crea categorías predeterminadas + datos de ejemplo ficticios
-- ============================================================
create or replace function seed_default_categories(p_user_id uuid)
returns void
language plpgsql security definer as $$
declare
  -- IDs de categorías de ingreso
  cat_sueldo uuid := gen_random_uuid();
  cat_extras uuid := gen_random_uuid();
  -- IDs de categorías de egreso (nivel 1)
  cat_casa uuid := gen_random_uuid();
  cat_personales uuid := gen_random_uuid();
  cat_pasajes uuid := gen_random_uuid();
  cat_servicios uuid := gen_random_uuid();
  cat_deudas uuid := gen_random_uuid();
  cat_salud uuid := gen_random_uuid();
  cat_educacion uuid := gen_random_uuid();
  cat_inversion uuid := gen_random_uuid();
  -- IDs subcategorías de Servicios
  cat_telefono uuid := gen_random_uuid();
  cat_internet uuid := gen_random_uuid();
  -- Mes actual para datos de ejemplo
  v_year integer := extract(year from now())::integer;
  v_month integer := extract(month from now())::integer;
  v_first_day date := make_date(v_year, v_month, 1);
begin

  -- ============================================================
  -- CATEGORÍAS DE INGRESO
  -- ============================================================
  insert into categories (id, user_id, name, type, sort_order) values
    (cat_sueldo, p_user_id, 'Sueldo', 'income', 1),
    (cat_extras, p_user_id, 'Extras', 'income', 2);

  -- ============================================================
  -- CATEGORÍAS DE EGRESO
  -- ============================================================
  insert into categories (id, user_id, name, type, sort_order) values
    (cat_casa, p_user_id, 'Casa/Comida', 'expense', 1),
    (cat_personales, p_user_id, 'Gastos Personales', 'expense', 2),
    (cat_pasajes, p_user_id, 'Pasajes', 'expense', 3),
    (cat_servicios, p_user_id, 'Servicios', 'expense', 4),
    (cat_deudas, p_user_id, 'Deudas', 'expense', 5),
    (cat_salud, p_user_id, 'Salud', 'expense', 6),
    (cat_educacion, p_user_id, 'Educación', 'expense', 7),
    (cat_inversion, p_user_id, 'Inversión', 'expense', 8);

  -- Subcategorías de Servicios
  insert into categories (id, user_id, name, type, parent_id, sort_order) values
    (cat_telefono, p_user_id, 'Teléfono', 'expense', cat_servicios, 1),
    (cat_internet, p_user_id, 'Internet', 'expense', cat_servicios, 2);

  -- ============================================================
  -- DATOS DE EJEMPLO — TRANSACCIONES DEL MES ACTUAL
  -- ============================================================
  insert into transactions (user_id, date, type, category_id, concept, amount, currency, amount_pen) values
    -- Ingreso
    (p_user_id, v_first_day + 0, 'income', cat_sueldo, 'Sueldo del mes', 3000, 'PEN', 3000),
    -- Egresos
    (p_user_id, v_first_day + 1, 'expense', cat_casa, 'Mercado de la semana', 180, 'PEN', 180),
    (p_user_id, v_first_day + 3, 'expense', cat_telefono, 'Recarga Claro', 60, 'PEN', 60),
    (p_user_id, v_first_day + 4, 'expense', cat_internet, 'Internet del hogar', 80, 'PEN', 80),
    (p_user_id, v_first_day + 7, 'expense', cat_casa, 'Supermercado Wong', 220, 'PEN', 220),
    (p_user_id, v_first_day + 10, 'expense', cat_personales, 'Ropa', 150, 'PEN', 150),
    (p_user_id, v_first_day + 11, 'expense', cat_pasajes, 'Pasajes de la semana', 40, 'PEN', 40),
    (p_user_id, v_first_day + 14, 'expense', cat_deudas, 'Cuota tarjeta ejemplo', 300, 'PEN', 300),
    (p_user_id, v_first_day + 15, 'expense', cat_salud, 'Consulta médica', 100, 'PEN', 100),
    (p_user_id, v_first_day + 16, 'expense', cat_educacion, 'Curso online', 150, 'PEN', 150),
    (p_user_id, v_first_day + 20, 'expense', cat_casa, 'Mercado quincenal', 200, 'PEN', 200),
    (p_user_id, v_first_day + 21, 'expense', cat_pasajes, 'Uber semanal', 35, 'PEN', 35);

  -- ============================================================
  -- PRESUPUESTO DE EJEMPLO
  -- ============================================================
  insert into budgets (user_id, year, month, category_id, amount) values
    (p_user_id, v_year, v_month, cat_casa, 900),
    (p_user_id, v_year, v_month, cat_personales, 200),
    (p_user_id, v_year, v_month, cat_pasajes, 100),
    (p_user_id, v_year, v_month, cat_servicios, 160),
    (p_user_id, v_year, v_month, cat_salud, 150),
    (p_user_id, v_year, v_month, cat_educacion, 200);

  -- ============================================================
  -- DEUDA DE EJEMPLO
  -- ============================================================
  insert into debts (user_id, creditor, initial_balance, current_balance, monthly_payment, payment_day) values
    (p_user_id, 'Tarjeta ejemplo', 2000, 2000, 300, 15);

  -- ============================================================
  -- RECORDATORIO DE EJEMPLO
  -- ============================================================
  insert into payment_reminders (user_id, concept, day_of_month, amount) values
    (p_user_id, 'Pago tarjeta', 15, 300),
    (p_user_id, 'Mensualidades', 23, null);

end;
$$;

-- ============================================================
-- TRIGGER: crear perfil y sembrar datos al registrarse
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  perform seed_default_categories(new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
