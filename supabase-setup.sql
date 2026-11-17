-- Control de Obra: estructura en Supabase (ejecutar UNA vez en SQL Editor → New query → Run)
-- Cada usuario solo puede ver y modificar sus propios datos (Row Level Security).

-- Marca de tiempo del servidor en cada cambio (para saber qué bajar en cada dispositivo)
create or replace function public.tocar_actualizado() returns trigger
language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end $$;

-- Pagos
create table if not exists public.registros (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  modificado  bigint not null default 0,
  eliminado   boolean not null default false,
  actualizado timestamptz not null default now()
);
create index if not exists registros_user_act on public.registros (user_id, actualizado);
drop trigger if exists t_registros on public.registros;
create trigger t_registros before insert or update on public.registros
  for each row execute function public.tocar_actualizado();

-- Compromisos (deudas y contratos)
create table if not exists public.compromisos (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  modificado  bigint not null default 0,
  eliminado   boolean not null default false,
  actualizado timestamptz not null default now()
);
create index if not exists compromisos_user_act on public.compromisos (user_id, actualizado);
drop trigger if exists t_compromisos on public.compromisos;
create trigger t_compromisos before insert or update on public.compromisos
  for each row execute function public.tocar_actualizado();

-- Ajustes (conceptos, pagos frecuentes, proveedores conocidos…)
create table if not exists public.config (
  user_id     uuid primary key default auth.uid() references auth.users on delete cascade,
  data        jsonb not null,
  modificado  bigint not null default 0
);

-- Seguridad: cada usuario solo accede a sus filas
alter table public.registros   enable row level security;
alter table public.compromisos enable row level security;
alter table public.config      enable row level security;

drop policy if exists "propios" on public.registros;
create policy "propios" on public.registros for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "propios" on public.compromisos;
create policy "propios" on public.compromisos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "propios" on public.config;
create policy "propios" on public.config for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.registros, public.compromisos, public.config to authenticated;

-- Archivos de soportes (fotos y PDF), privados, en carpeta por usuario
insert into storage.buckets (id, name, public)
values ('soportes', 'soportes', false)
on conflict (id) do nothing;

drop policy if exists "soportes leer" on storage.objects;
create policy "soportes leer" on storage.objects for select to authenticated
  using (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "soportes subir" on storage.objects;
create policy "soportes subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "soportes cambiar" on storage.objects;
create policy "soportes cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "soportes borrar" on storage.objects;
create policy "soportes borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text);
