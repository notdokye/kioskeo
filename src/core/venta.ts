import { type Centavos, assertMonto } from "./money";

// La venta es el evento central del sistema: inmutable, con id único
// generado en el dispositivo. La sincronización depende de esa identidad:
// el servidor y el cliente pueden recibir la misma venta N veces y
// aplicarla exactamente una (ver aplicarVentas).
//
// Una venta puede cobrarse con varios medios a la vez (mitad efectivo,
// mitad transferencia). La regla de hierro: la suma de los pagos tiene
// que dar exactamente el total, o la venta no se crea.

export type MedioPago = "efectivo" | "transferencia" | "fiado";

export interface Pago {
  medio: MedioPago;
  monto: Centavos;
}

export interface LineaVenta {
  productoId: string;
  nombre: string;
  cantidad: number;
  /**
   * Para productos por unidad: precio de cada unidad.
   * Para productos por peso: precio por CADA 100 GRAMOS.
   */
  precioUnitario: Centavos;
  /** Solo productos por peso: gramos vendidos (112, 150, 50...). */
  gramos?: number;
}

/**
 * Subtotal de una línea. Por unidad: cantidad × precio. Por peso: el precio
 * es por 100g, así que 112g a $500/100g = $560 — redondeado al centavo,
 * siempre entero.
 */
export function subtotalLinea(linea: LineaVenta): Centavos {
  if (linea.gramos !== undefined) {
    return linea.cantidad * Math.round((linea.precioUnitario * linea.gramos) / 100);
  }
  return linea.cantidad * linea.precioUnitario;
}

export interface Venta {
  id: string;
  dispositivoId: string;
  /** ISO 8601. La provee el llamador: el core no lee el reloj. */
  fecha: string;
  turnoPin?: string;
  lineas: readonly LineaVenta[];
  pagos: readonly Pago[];
  /** Obligatorio cuando algún pago es "fiado". */
  clienteId?: string;
  total: Centavos;
}

export type NuevaVenta = Omit<Venta, "total">;

export function totalLineas(lineas: readonly LineaVenta[]): Centavos {
  return lineas.reduce((suma, l) => suma + subtotalLinea(l), 0);
}

/** Atajo para el caso común: un solo medio de pago por el total. */
export function pagoUnico(medio: MedioPago, monto: Centavos): Pago[] {
  return [{ medio, monto }];
}

export function montoPorMedio(venta: Venta, medio: MedioPago): Centavos {
  return venta.pagos
    .filter((p) => p.medio === medio)
    .reduce((suma, p) => suma + p.monto, 0);
}

export function crearVenta(input: NuevaVenta): Venta {
  if (!input.id) throw new Error("La venta necesita un id único");
  if (!input.dispositivoId) throw new Error("La venta necesita dispositivoId");
  if (!input.fecha) throw new Error("La venta necesita fecha");
  if (input.lineas.length === 0) {
    throw new Error("Una venta necesita al menos una línea");
  }
  for (const linea of input.lineas) {
    if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
      throw new Error(`Cantidad inválida en ${linea.nombre}: ${linea.cantidad}`);
    }
    assertMonto(linea.precioUnitario, `precio de ${linea.nombre}`);
    if (linea.precioUnitario < 0) {
      throw new Error(`Precio negativo en ${linea.nombre}`);
    }
    if (
      linea.gramos !== undefined &&
      (!Number.isInteger(linea.gramos) || linea.gramos <= 0)
    ) {
      throw new Error(`Gramos inválidos en ${linea.nombre}: ${linea.gramos}`);
    }
  }

  const total = totalLineas(input.lineas);

  if (input.pagos.length === 0) {
    throw new Error("Una venta necesita al menos un pago");
  }
  for (const pago of input.pagos) {
    assertMonto(pago.monto, `pago ${pago.medio}`);
    if (pago.monto <= 0) {
      throw new Error(`Un pago debe ser mayor a cero (${pago.medio})`);
    }
  }
  const sumaPagos = input.pagos.reduce((s, p) => s + p.monto, 0);
  if (sumaPagos !== total) {
    throw new Error(
      `Los pagos no cubren el total: pagos ${sumaPagos}, total ${total}`,
    );
  }
  if (input.pagos.some((p) => p.medio === "fiado") && !input.clienteId) {
    throw new Error("Una venta con fiado necesita clienteId");
  }

  const venta: Venta = {
    ...input,
    lineas: input.lineas.map((l) => Object.freeze({ ...l })),
    pagos: input.pagos.map((p) => Object.freeze({ ...p })),
    total,
  };
  return Object.freeze(venta);
}

/** Deduplica por id conservando la primera aparición. Idempotente por diseño. */
export function aplicarVentas(ventas: readonly Venta[]): Venta[] {
  const vistas = new Set<string>();
  const resultado: Venta[] = [];
  for (const v of ventas) {
    if (vistas.has(v.id)) continue;
    vistas.add(v.id);
    resultado.push(v);
  }
  return resultado;
}
