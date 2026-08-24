-- Esquema de Kioskeo en Supabase.
-- Pegar completo en el SQL Editor de Supabase y ejecutar una sola vez.
--
-- Diseño: cada tabla espeja una tabla local del dispositivo. Las filas
-- guardan el registro completo en `datos` (jsonb) con su id de texto como
-- clave. `negocio_id` es el usuario dueño (auth.uid()): la seguridad por
-- filas (RLS) garantiza que cada negocio ve SOLO lo suyo.

create or replace function public.marcar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['ventas','anulaciones','productos','clientes','pagos_fiado','cajas']
  loop
    execute format($f$
      create table if not exists public.%I (
        id text not null,
        negocio_id uuid not null default auth.uid(),
        datos jsonb not null,
        actualizado_en timestamptz not null default now(),
        primary key (negocio_id, id)
      )
    $f$, t);

    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      drop policy if exists "cada negocio ve solo lo suyo" on public.%I;
      create policy "cada negocio ve solo lo suyo" on public.%I
        for all using (negocio_id = auth.uid())
        with check (negocio_id = auth.uid())
    $f$, t, t);

    execute format($f$
      drop trigger if exists trg_actualizado on public.%I;
      create trigger trg_actualizado before update on public.%I
        for each row execute function public.marcar_actualizado()
    $f$, t, t);

    execute format(
      'create index if not exists %I on public.%I (negocio_id, actualizado_en)',
      t || '_sync_idx', t
    );
  end loop;
end $$;
