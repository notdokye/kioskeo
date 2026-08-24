import { type Centavos, assertMonto } from "./money";
import { montoPorMedio, type Venta } from "./venta";

// Regla de oro del cierre ciego: el sistema calcula el efectivo esperado
// y el kiosquero cuenta el cajón sin ver ese número. La diferencia se
// informa, nunca se oculta ni se ajusta sola.

export interface MovimientoCaja {
  tipo: "retiro" | "ingreso";
  monto: Centavos;
  motivo?: string;
}

export interface CierreCaja {
  esperado: Centavos;
  contado: Centavos;
  /** contado - esperado: negativo = falta plata, positivo = sobra. */
  diferencia: Centavos;
}

export function efectivoEsperado(
  apertura: Centavos,
  ventas: readonly Venta[],
  movimientos: readonly MovimientoCaja[] = [],
): Centavos {
  assertMonto(apertura, "apertura de caja");
  // Solo la parte en efectivo de cada venta está en el cajón: una venta
  // mixta (mitad transferencia) aporta solo su mitad en efectivo.
  // El llamador pasa las ventas VIGENTES (ya filtradas las anuladas).
  const ventasEfectivo = ventas.reduce(
    (suma, v) => suma + montoPorMedio(v, "efectivo"),
    0,
  );
  const netoMovimientos = movimientos.reduce(
    (suma, m) => suma + (m.tipo === "ingreso" ? m.monto : -m.monto),
    0,
  );
  return apertura + ventasEfectivo + netoMovimientos;
}

export function cerrarCaja(esperado: Centavos, contado: Centavos): CierreCaja {
  assertMonto(esperado, "esperado en cierre");
  assertMonto(contado, "contado en cierre");
  return Object.freeze({ esperado, contado, diferencia: contado - esperado });
}
