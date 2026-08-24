// Todo el dinero del sistema se representa en centavos enteros (ARS).
// Nunca usar floats para montos: los errores de redondeo fueron una
// fuente de bugs en sistemas anteriores y acá quedan prohibidos por tipo.

export type Centavos = number;

export function pesos(monto: number): Centavos {
  const centavos = Math.round(monto * 100);
  if (!Number.isFinite(centavos)) {
    throw new Error(`Monto inválido: ${monto}`);
  }
  return centavos;
}

export function esMontoValido(c: Centavos): boolean {
  return Number.isInteger(c) && Number.isFinite(c);
}

export function assertMonto(c: Centavos, contexto: string): void {
  if (!esMontoValido(c)) {
    throw new Error(`Monto inválido en ${contexto}: ${c}`);
  }
}

const formatoEntero = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatoConCentavos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatearARS(c: Centavos): string {
  assertMonto(c, "formatearARS");
  const tieneCentavos = c % 100 !== 0;
  const formato = tieneCentavos ? formatoConCentavos : formatoEntero;
  // Intl usa espacio no separable (U+00A0); lo normalizamos a espacio común.
  return formato.format(c / 100).replace(/ /g, " ");
}
