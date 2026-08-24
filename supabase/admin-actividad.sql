-- Actividad de un negocio para el panel de administración (solo admins).
-- Pegar en el SQL Editor y ejecutar una vez. Idempotente.

-- Últimas ventas + anulaciones de un negocio (solo lectura).
create or replace function public.admin_ventas(p_negocio uuid, p_limite int default 50)
returns table (id text, datos jsonb, actualizado_en timestamptz, anulada boolean)
language sql stable security definer set search_path = public as $$
  select v.id, v.datos, v.actualizado_en,
         exists (select 1 from public.anulaciones a
                  where a.negocio_id = v.negocio_id and a.datos ->> 'ventaId' = v.id) as anulada
  from public.ventas v
  where public.es_admin() and v.negocio_id = p_negocio
  order by (v.datos ->> 'fecha') desc
  limit p_limite;
$$;

-- Anula una venta desde el admin: inserta el evento de anulación (jamás se
-- borra la venta). El celular del negocio lo baja en el próximo sync y la
-- venta queda tachada y fuera de todos los totales.
create or replace function public.admin_anular_venta(p_negocio uuid, p_venta_id text, p_motivo text default 'anulada por soporte')
returns text language plpgsql security definer set search_path = public as $$
declare
  nuevo_id text := gen_random_uuid()::text;
begin
  if not public.es_admin() then
    raise exception 'solo administradores';
  end if;
  if not exists (select 1 from public.ventas where negocio_id = p_negocio and id = p_venta_id) then
    raise exception 'esa venta no existe';
  end if;
  if exists (select 1 from public.anulaciones where negocio_id = p_negocio and datos ->> 'ventaId' = p_venta_id) then
    return 'ya estaba anulada';
  end if;
  insert into public.anulaciones (id, negocio_id, datos)
  values (nuevo_id, p_negocio, jsonb_build_object(
    'id', nuevo_id,
    'ventaId', p_venta_id,
    'dispositivoId', 'soporte-kioskeo',
    'fecha', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'motivo', p_motivo
  ));
  return nuevo_id;
end $$;

-- Tablero: ventas de hoy y de la semana por negocio (excluye anuladas).
-- Cambia el tipo de retorno de admin_negocios: hay que recrearla.
drop function if exists public.admin_negocios();
create function public.admin_negocios()
returns table (
  negocio_id uuid, email text, nombre text, plan text, vence_el date, gracia_dias int,
  creado_en timestamptz, ventas bigint, ultima_venta timestamptz,
  ventas_hoy bigint, monto_hoy bigint, ventas_semana bigint, monto_semana bigint
)
language sql stable security definer set search_path = public as $$
  select
    u.id, u.email::text, u.raw_user_meta_data ->> 'nombre_negocio', s.plan, s.vence_el, s.gracia_dias, u.created_at,
    (select count(*) from public.ventas v where v.negocio_id = u.id),
    (select max(v.actualizado_en) from public.ventas v where v.negocio_id = u.id),
    (select count(*) from public.ventas v where v.negocio_id = u.id
       and (v.datos ->> 'fecha')::timestamptz >= (public.hoy_ar()::timestamp at time zone 'America/Argentina/Buenos_Aires')
       and not exists (select 1 from public.anulaciones a where a.negocio_id = v.negocio_id and a.datos ->> 'ventaId' = v.id)),
    (select coalesce(sum((v.datos ->> 'total')::bigint), 0) from public.ventas v where v.negocio_id = u.id
       and (v.datos ->> 'fecha')::timestamptz >= (public.hoy_ar()::timestamp at time zone 'America/Argentina/Buenos_Aires')
       and not exists (select 1 from public.anulaciones a where a.negocio_id = v.negocio_id and a.datos ->> 'ventaId' = v.id)),
    (select count(*) from public.ventas v where v.negocio_id = u.id
       and (v.datos ->> 'fecha')::timestamptz >= ((public.hoy_ar() - 6)::timestamp at time zone 'America/Argentina/Buenos_Aires')
       and not exists (select 1 from public.anulaciones a where a.negocio_id = v.negocio_id and a.datos ->> 'ventaId' = v.id)),
    (select coalesce(sum((v.datos ->> 'total')::bigint), 0) from public.ventas v where v.negocio_id = u.id
       and (v.datos ->> 'fecha')::timestamptz >= ((public.hoy_ar() - 6)::timestamp at time zone 'America/Argentina/Buenos_Aires')
       and not exists (select 1 from public.anulaciones a where a.negocio_id = v.negocio_id and a.datos ->> 'ventaId' = v.id))
  from auth.users u
  left join public.suscripciones s on s.negocio_id = u.id
  where public.es_admin()
  order by u.created_at desc;
$$;

-- Productos de un negocio (solo lectura, admins).
create or replace function public.admin_productos(p_negocio uuid)
returns table (id text, datos jsonb, actualizado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.datos, p.actualizado_en from public.productos p
  where public.es_admin() and p.negocio_id = p_negocio
  order by (p.datos ->> 'nombre');
$$;

-- Borra una cuenta y TODO lo suyo. Exige el email exacto y nunca borra admins.
create or replace function public.admin_borrar_negocio(p_negocio uuid, p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.es_admin() then raise exception 'solo administradores'; end if;
  select email into v_email from auth.users where id = p_negocio;
  if v_email is null then raise exception 'esa cuenta no existe'; end if;
  if lower(v_email) <> lower(p_email) then raise exception 'el email no coincide'; end if;
  if exists (select 1 from public.admins where lower(email) = lower(v_email)) then
    raise exception 'no se puede borrar una cuenta administradora';
  end if;
  delete from public.ventas where negocio_id = p_negocio;
  delete from public.anulaciones where negocio_id = p_negocio;
  delete from public.productos where negocio_id = p_negocio;
  delete from public.clientes where negocio_id = p_negocio;
  delete from public.pagos_fiado where negocio_id = p_negocio;
  delete from public.cajas where negocio_id = p_negocio;
  delete from public.errores where negocio_id = p_negocio;
  delete from public.suscripciones where negocio_id = p_negocio;
  delete from auth.users where id = p_negocio;
  return 'borrada ' || v_email;
end $$;

-- admin_negocios() también devuelve `productos bigint` (recreada el 22/8 con esa columna extra;
-- misma consulta que arriba más: (select count(*) from public.productos p where p.negocio_id = u.id)).
