import { type Centavos, assertMonto } from "./money";

// Los precios de kiosco se redondean a números REDONDOS: de a $100 por
// defecto (2.900, 3.000, 3.100 — nunca 2.950). El modo "arriba" existe
// porque con inflación el kiosquero prefiere redondear a su favor.
export type ModoRedondeo = "cercano" | "arriba" | "ninguno";

export interface Redondeo {
  multiplo: Centavos;
  modo: ModoRedondeo;
}

export const REDONDEO_DEFAULT: Redondeo = { multiplo: 10000, modo: "cercano" };

export function redondear(monto: Centavos, redondeo: Redondeo): Centavos {
  assertMonto(monto, "redondear");
  if (redondeo.modo === "ninguno" || redondeo.multiplo <= 1) return monto;
  const { multiplo } = redondeo;
  if (redondeo.modo === "arriba") {
    return Math.ceil(monto / multiplo) * multiplo;
  }
  return Math.round(monto / multiplo) * multiplo;
}

/**
 * Margen sobre el precio de venta, en porcentaje (0-100).
 * "Compro a $800, vendo a $1.000" → 20%. Null si falta un dato con sentido.
 */
export function margenPorcentaje(
  precioVenta: Centavos,
  costo: Centavos,
): number | null {
  assertMonto(precioVenta, "margen precio");
  assertMonto(costo, "margen costo");
  if (precioVenta <= 0 || costo <= 0) return null;
  return ((precioVenta - costo) / precioVenta) * 100;
}

export function aumentarPrecio(
  precio: Centavos,
  porcentaje: number,
  redondeo: Redondeo = REDONDEO_DEFAULT,
): Centavos {
  assertMonto(precio, "aumentarPrecio");
  if (!Number.isFinite(porcentaje) || porcentaje <= -100) {
    throw new Error(`Porcentaje inválido: ${porcentaje}`);
  }
  const aumentado = Math.round(precio * (1 + porcentaje / 100));
  return redondear(aumentado, redondeo);
}
