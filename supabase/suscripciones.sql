-- Suscripciones, administración y reporte de errores de Kioskeo.
-- Pegar completo en el SQL Editor de Supabase y ejecutar una sola vez
-- (después de schema.sql). Se puede volver a correr: es idempotente.
--
-- Regla de oro: la app SOLO LEE su suscripción. Nadie puede escribirla
-- desde el cliente; la única forma de extenderla es admin_extender(),
-- que exige que el que llama esté en la tabla admins.

-- ---------- suscripciones ----------
create table if not exists public.suscripciones (
  negocio_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'prueba',
  vence_el date not null,
  gracia_dias int not null default 3,
  nota text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.suscripciones enable row level security;

drop policy if exists "cada negocio lee su suscripcion" on public.suscripciones;
create policy "cada negocio lee su suscripcion" on public.suscripciones
  for select using (negocio_id = auth.uid());
-- (sin políticas de insert/update/delete: desde la app no se escribe)

-- Hoy en Argentina, para que el vencimiento sea a medianoche local.
create or replace function public.hoy_ar()
returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- Toda cuenta nueva arranca con 30 días de prueba.
create or replace function public.crear_suscripcion_prueba()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.suscripciones (negocio_id, plan, vence_el)
  values (new.id, 'prueba', public.hoy_ar() + 30)
  on conflict (negocio_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_suscripcion_prueba on auth.users;
create trigger trg_suscripcion_prueba
  after insert on auth.users
  for each row execute function public.crear_suscripcion_prueba();

-- Cuentas que ya existían: también 30 días desde hoy.
insert into public.suscripciones (negocio_id, plan, vence_el)
select id, 'prueba', public.hoy_ar() + 30 from auth.users
on conflict (negocio_id) do nothing;

-- Vigente = hoy <= vencimiento + gracia. Sin fila (falla del sistema) se
-- considera vigente: nunca se castiga al cliente por un error nuestro.
create or replace function public.suscripcion_vigente(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select public.hoy_ar() <= vence_el + gracia_dias
       from public.suscripciones where negocio_id = uid),
    true
  );
$$;

-- Lo que la app consulta: su vencimiento + la hora del servidor (para que
-- atrasar el reloj del celular no sirva de nada).
create or replace function public.estado_suscripcion()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'vence_el', vence_el,
    'gracia_dias', gracia_dias,
    'plan', plan,
    'ahora', now()
  )
  from public.suscripciones where negocio_id = auth.uid();
$$;

-- Candado del lado del servidor: con la suscripción vencida (pasada la
-- gracia) el servidor rechaza escrituras. La outbox local las guarda y
-- las reintenta cuando se renueva.
do $$
declare
  t text;
begin
  foreach t in array array['ventas','anulaciones','productos','clientes','pagos_fiado','cajas']
  loop
    execute format($f$
      drop policy if exists "cada negocio ve solo lo suyo" on public.%I;
      drop policy if exists "lee lo suyo" on public.%I;
      drop policy if exists "escribe lo suyo si esta vigente" on public.%I;
      drop policy if exists "actualiza lo suyo si esta vigente" on public.%I;
      drop policy if exists "borra lo suyo" on public.%I;
      create policy "lee lo suyo" on public.%I
        for select using (negocio_id = auth.uid());
      create policy "escribe lo suyo si esta vigente" on public.%I
        for insert with check (negocio_id = auth.uid() and public.suscripcion_vigente(auth.uid()));
      create policy "actualiza lo suyo si esta vigente" on public.%I
        for update using (negocio_id = auth.uid())
        with check (negocio_id = auth.uid() and public.suscripcion_vigente(auth.uid()));
      create policy "borra lo suyo" on public.%I
        for delete using (negocio_id = auth.uid());
    $f$, t, t, t, t, t, t, t, t, t);
  end loop;
end $$;

-- ---------- administración ----------
create table if not exists public.admins (email text primary key);
insert into public.admins (email) values ('worklmdok@gmail.com') on conflict do nothing;
alter table public.admins enable row level security;
-- (sin políticas: solo se lee desde funciones security definer)

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email');
$$;

create or replace function public.admin_negocios()
returns table (
  negocio_id uuid,
  email text,
  nombre text,
  plan text,
  vence_el date,
  gracia_dias int,
  creado_en timestamptz,
  ventas bigint,
  ultima_venta timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    u.id,
    u.email::text,
    u.raw_user_meta_data ->> 'nombre_negocio',
    s.plan,
    s.vence_el,
    s.gracia_dias,
    u.created_at,
    (select count(*) from public.ventas v where v.negocio_id = u.id),
    (select max(v.actualizado_en) from public.ventas v where v.negocio_id = u.id)
  from auth.users u
  left join public.suscripciones s on s.negocio_id = u.id
  where public.es_admin()
  order by u.created_at desc;
$$;

-- Suma días al vencimiento (desde hoy si ya venció, desde el vencimiento
-- si sigue vigente: pagar antes no regala días ni los quita).
create or replace function public.admin_extender(p_negocio uuid, p_dias int, p_plan text default 'mensual')
returns date language plpgsql security definer set search_path = public as $$
declare
  nuevo date;
begin
  if not public.es_admin() then
    raise exception 'solo administradores';
  end if;
  insert into public.suscripciones (negocio_id, plan, vence_el)
  values (p_negocio, p_plan, public.hoy_ar() + p_dias)
  on conflict (negocio_id) do update
    set vence_el = greatest(public.suscripciones.vence_el, public.hoy_ar()) + p_dias,
        plan = p_plan,
        actualizado_en = now()
  returning vence_el into nuevo;
  return nuevo;
end $$;

-- ---------- errores que reporta la app ----------
create table if not exists public.errores (
  id bigserial primary key,
  negocio_id uuid default auth.uid(),
  mensaje text not null,
  detalle text,
  url text,
  agente text,
  version text,
  creado_en timestamptz not null default now()
);

alter table public.errores enable row level security;

drop policy if exists "cada negocio reporta lo suyo" on public.errores;
create policy "cada negocio reporta lo suyo" on public.errores
  for insert with check (negocio_id = auth.uid());

drop policy if exists "admins leen errores" on public.errores;
create policy "admins leen errores" on public.errores
  for select using (public.es_admin());
