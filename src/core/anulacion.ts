import type { Venta } from "./venta";

// Los errores no se corrigen editando el pasado: se anula la venta con un
// evento nuevo (inmutable, con id propio) y se cobra de nuevo. La venta
// original y su anulación quedan a la vista — ahí vive el control
// anti robo hormiga: el panel del dueño muestra quién anuló, cuándo y cuánto.

export interface Anulacion {
  id: string;
  ventaId: string;
  dispositivoId: string;
  /** ISO 8601, la provee el llamador. */
  fecha: string;
  turnoPin?: string;
  motivo?: string;
}

export function crearAnulacion(input: Anulacion): Anulacion {
  if (!input.id) throw new Error("La anulación necesita un id único");
  if (!input.ventaId) throw new Error("La anulación necesita la venta que anula");
  if (!input.dispositivoId) throw new Error("La anulación necesita dispositivoId");
  if (!input.fecha) throw new Error("La anulación necesita fecha");
  return Object.freeze({ ...input });
}

/** Deduplica por id, igual que las ventas. Reintentos de sync no duplican. */
export function aplicarAnulaciones(
  anulaciones: readonly Anulacion[],
): Anulacion[] {
  const vistas = new Set<string>();
  const resultado: Anulacion[] = [];
  for (const a of anulaciones) {
    if (vistas.has(a.id)) continue;
    vistas.add(a.id);
    resultado.push(a);
  }
  return resultado;
}

/** Las ventas que cuentan: todas menos las anuladas. */
export function ventasVigentes(
  ventas: readonly Venta[],
  anulaciones: readonly Anulacion[],
): Venta[] {
  const anuladas = new Set(aplicarAnulaciones(anulaciones).map((a) => a.ventaId));
  return ventas.filter((v) => !anuladas.has(v.id));
}
