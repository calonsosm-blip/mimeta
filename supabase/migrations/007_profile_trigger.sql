-- ============================================================
-- 007_profile_trigger.sql
-- Trigger para crear perfil automáticamente al registrarse
-- ============================================================

-- Política INSERT para que usuarios puedan crear su propio perfil
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- Función que crea el perfil al registrarse un nuevo usuario
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- Trigger que se ejecuta al crear un usuario en auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
