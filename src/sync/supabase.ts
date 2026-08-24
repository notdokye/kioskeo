import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TablaSync } from "../db/db";
import type { BackendSync, FilaRemota } from "./sync";

// Conector Supabase. Sin credenciales configuradas (.env.local), la app
// funciona 100% local: el sync simplemente no arranca.

const TABLAS: { local: TablaSync; remota: string }[] = [
  { local: "ventas", remota: "ventas" },
  { local: "anulaciones", remota: "anulaciones" },
  { local: "productos", remota: "productos" },
  { local: "clientes", remota: "clientes" },
  { local: "pagosFiado", remota: "pagos_fiado" },
  { local: "cajas", remota: "cajas" },
];

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (cliente) return cliente;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !clave) return null;
  cliente = createClient(url, clave);
  return cliente;
}

export function backendSupabase(): BackendSync | null {
  const sb = supabase();
  if (!sb) return null;

  const aRemota = new Map(TABLAS.map((t) => [t.local, t.remota]));
  const aLocal = new Map(TABLAS.map((t) => [t.remota, t.local]));

  return {
    async subir(tabla, registros) {
      const { error } = await sb
        .from(aRemota.get(tabla)!)
        .upsert(registros.map((r) => ({ id: r.id, datos: r.datos })));
      if (error) throw new Error(`Subiendo ${tabla}: ${error.message}`);
    },

    async bajar(tabla, cursor, limite) {
      const remota = aRemota.get(tabla)!;
      // gte (no gt): un lote subido comparte la misma fecha de actualización;
      // si una página corta justo ahí, la siguiente vuelve a traer esas filas
      // (put idempotente) en vez de saltearlas. Nunca se pierde nada.
      let consulta = sb
        .from(remota)
        .select("id, datos, actualizado_en")
        .order("actualizado_en", { ascending: true })
        .order("id", { ascending: true })
        .limit(limite);
      if (cursor) consulta = consulta.gte("actualizado_en", cursor);
      const { data, error } = await consulta;
      if (error) throw new Error(`Bajando ${remota}: ${error.message}`);
      const filas: FilaRemota[] = (data ?? []).map((fila) => ({
        tabla: aLocal.get(remota)!,
        id: fila.id,
        datos: fila.datos,
        actualizadoEn: fila.actualizado_en,
      }));
      const ultimo = filas[filas.length - 1]?.actualizadoEn ?? cursor;
      return { filas, cursor: ultimo };
    },
  };
}
