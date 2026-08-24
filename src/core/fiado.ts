import { type Centavos, assertMonto } from "./money";
import { montoPorMedio, type Venta } from "./venta";

// El fiado es un libro mayor mínimo: deudas y pagos por cliente.
// Saldo positivo = el cliente debe. El saldo se deriva siempre de los
// movimientos; nunca se guarda un saldo editado a mano.

export interface MovimientoFiado {
  id: string;
  clienteId: string;
  tipo: "deuda" | "pago";
  monto: Centavos;
  fecha: string;
  ventaId?: string;
}

export function saldoCliente(
  clienteId: string,
  movimientos: readonly MovimientoFiado[],
): Centavos {
  return movimientos
    .filter((m) => m.clienteId === clienteId)
    .reduce((saldo, m) => saldo + (m.tipo === "deuda" ? m.monto : -m.monto), 0);
}

export function saldosPorCliente(
  movimientos: readonly MovimientoFiado[],
): Map<string, Centavos> {
  const saldos = new Map<string, Centavos>();
  for (const m of movimientos) {
    assertMonto(m.monto, `movimiento fiado ${m.id}`);
    const delta = m.tipo === "deuda" ? m.monto : -m.monto;
    saldos.set(m.clienteId, (saldos.get(m.clienteId) ?? 0) + delta);
  }
  return saldos;
}

/**
 * Las deudas NO se guardan: se derivan de las ventas vigentes con pago fiado.
 * Así, anular una venta fiada corrige la deuda sola — una única fuente de
 * verdad, imposible que el saldo y las ventas se contradigan.
 * El id derivado es determinístico: recalcular no duplica.
 */
export function deudasDesdeVentas(
  ventasVigentes: readonly Venta[],
): MovimientoFiado[] {
  return ventasVigentes
    .map((v) => ({ venta: v, fiado: montoPorMedio(v, "fiado") }))
    .filter(({ venta, fiado }) => fiado > 0 && venta.clienteId)
    .map(({ venta, fiado }) =>
      Object.freeze({
        id: `deuda-${venta.id}`,
        clienteId: venta.clienteId as string,
        tipo: "deuda" as const,
        monto: fiado,
        fecha: venta.fecha,
        ventaId: venta.id,
      }),
    );
}

export function registrarPago(
  movimientos: readonly MovimientoFiado[],
  pago: Omit<MovimientoFiado, "tipo">,
): MovimientoFiado[] {
  if (pago.monto <= 0) throw new Error("Un pago debe ser mayor a cero");
  if (movimientos.some((m) => m.id === pago.id)) return [...movimientos];
  return [...movimientos, Object.freeze({ ...pago, tipo: "pago" as const })];
}
