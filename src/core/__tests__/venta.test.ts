import { describe, expect, it } from "vitest";
import { pesos } from "../money";
import {
  aplicarVentas,
  crearVenta,
  montoPorMedio,
  pagoUnico,
  subtotalLinea,
  totalLineas,
  type NuevaVenta,
} from "../venta";

// Total del ticket base: 2×$1.800 + 3×$600 = $5.400
const base: NuevaVenta = {
  id: "v-001",
  dispositivoId: "caja-1",
  fecha: "2026-08-18T14:30:00.000Z",
  pagos: pagoUnico("efectivo", pesos(5400)),
  lineas: [
    { productoId: "coca-500", nombre: "Coca-Cola 500ml", cantidad: 2, precioUnitario: pesos(1800) },
    { productoId: "alfajor-g", nombre: "Alfajor Guaymallén", cantidad: 3, precioUnitario: pesos(600) },
  ],
};

describe("crearVenta", () => {
  it("calcula el total desde las líneas", () => {
    const venta = crearVenta(base);
    expect(venta.total).toBe(pesos(5400));
  });

  it("la venta queda congelada: nadie puede modificarla después", () => {
    const venta = crearVenta(base);
    expect(Object.isFrozen(venta)).toBe(true);
    expect(Object.isFrozen(venta.lineas[0])).toBe(true);
    expect(Object.isFrozen(venta.pagos[0])).toBe(true);
  });

  it("rechaza ventas sin líneas o sin pagos", () => {
    expect(() => crearVenta({ ...base, lineas: [] })).toThrow();
    expect(() => crearVenta({ ...base, pagos: [] })).toThrow();
  });

  it("rechaza cantidades no enteras o negativas", () => {
    const conCantidad = (cantidad: number) => ({
      ...base,
      lineas: [{ ...base.lineas[0], cantidad }],
      pagos: pagoUnico("efectivo", pesos(1800) * cantidad),
    });
    expect(() => crearVenta(conCantidad(0))).toThrow();
    expect(() => crearVenta(conCantidad(-1))).toThrow();
    expect(() => crearVenta(conCantidad(1.5))).toThrow();
  });
});

describe("venta por peso (precio por 100g)", () => {
  const quesoPor100g = (gramos: number) => ({
    productoId: "queso",
    nombre: "Queso cremoso",
    cantidad: 1,
    precioUnitario: pesos(500), // $500 cada 100g
    gramos,
  });

  it("112g a $500/100g = $560 exactos", () => {
    expect(subtotalLinea(quesoPor100g(112))).toBe(pesos(560));
  });

  it("los gramos raros redondean al centavo, siempre entero", () => {
    // 333g × $500/100g = $1.665
    expect(subtotalLinea(quesoPor100g(333))).toBe(pesos(1665));
    // 1g × $99,99/100g = $1 (0,9999 redondea)
    expect(
      subtotalLinea({ ...quesoPor100g(1), precioUnitario: pesos(99.99) }),
    ).toBe(pesos(1));
    for (const g of [7, 51, 113, 249, 999]) {
      expect(Number.isInteger(subtotalLinea(quesoPor100g(g)))).toBe(true);
    }
  });

  it("50g es la mitad y 200g el doble, sin sorpresas", () => {
    expect(subtotalLinea(quesoPor100g(50))).toBe(pesos(250));
    expect(subtotalLinea(quesoPor100g(200))).toBe(pesos(1000));
  });

  it("una venta mezcla peso y unidad y el total cierra", () => {
    const venta = crearVenta({
      ...base,
      lineas: [
        quesoPor100g(150), // $750
        { productoId: "coca", nombre: "Coca 500ml", cantidad: 2, precioUnitario: pesos(1800) }, // $3.600
      ],
      pagos: pagoUnico("efectivo", pesos(4350)),
    });
    expect(venta.total).toBe(pesos(4350));
  });

  it("rechaza gramos inválidos", () => {
    const conGramos = (gramos: number) => ({
      ...base,
      lineas: [{ ...quesoPor100g(gramos) }],
      pagos: pagoUnico("efectivo", totalLineas([quesoPor100g(100)])),
    });
    expect(() => crearVenta(conGramos(0))).toThrow();
    expect(() => crearVenta(conGramos(-50))).toThrow();
    expect(() => crearVenta(conGramos(10.5))).toThrow();
  });
});

describe("pagos mixtos", () => {
  it("acepta efectivo + transferencia cuando suman exacto el total", () => {
    const venta = crearVenta({
      ...base,
      pagos: [
        { medio: "efectivo", monto: pesos(2000) },
        { medio: "transferencia", monto: pesos(3400) },
      ],
    });
    expect(montoPorMedio(venta, "efectivo")).toBe(pesos(2000));
    expect(montoPorMedio(venta, "transferencia")).toBe(pesos(3400));
    expect(montoPorMedio(venta, "fiado")).toBe(0);
  });

  it("REGLA DE HIERRO: pagos que no suman el total exacto, venta rechazada", () => {
    // un centavo de menos
    expect(() =>
      crearVenta({
        ...base,
        pagos: [
          { medio: "efectivo", monto: pesos(2000) },
          { medio: "transferencia", monto: pesos(3400) - 1 },
        ],
      }),
    ).toThrow();
    // un centavo de más
    expect(() =>
      crearVenta({
        ...base,
        pagos: [
          { medio: "efectivo", monto: pesos(2000) },
          { medio: "transferencia", monto: pesos(3400) + 1 },
        ],
      }),
    ).toThrow();
  });

  it("rechaza pagos en cero o negativos", () => {
    expect(() =>
      crearVenta({
        ...base,
        pagos: [
          { medio: "efectivo", monto: 0 },
          { medio: "transferencia", monto: pesos(5400) },
        ],
      }),
    ).toThrow();
    expect(() =>
      crearVenta({
        ...base,
        pagos: [
          { medio: "efectivo", monto: pesos(-100) },
          { medio: "transferencia", monto: pesos(5500) },
        ],
      }),
    ).toThrow();
  });

  it("cualquier pago fiado (total o parcial) exige cliente", () => {
    expect(() =>
      crearVenta({ ...base, pagos: pagoUnico("fiado", pesos(5400)) }),
    ).toThrow();
    expect(() =>
      crearVenta({
        ...base,
        pagos: [
          { medio: "efectivo", monto: pesos(2000) },
          { medio: "fiado", monto: pesos(3400) },
        ],
      }),
    ).toThrow();
    const venta = crearVenta({
      ...base,
      clienteId: "juan",
      pagos: [
        { medio: "efectivo", monto: pesos(2000) },
        { medio: "fiado", monto: pesos(3400) },
      ],
    });
    expect(venta.clienteId).toBe("juan");
  });
});

describe("aplicarVentas", () => {
  it("la misma venta recibida dos veces cuenta una sola vez", () => {
    const venta = crearVenta(base);
    const reintento = crearVenta(base);
    const aplicadas = aplicarVentas([venta, reintento, venta]);
    expect(aplicadas).toHaveLength(1);
    expect(aplicadas[0].total).toBe(venta.total);
  });

  it("ventas distintas se conservan en orden", () => {
    const v1 = crearVenta(base);
    const v2 = crearVenta({ ...base, id: "v-002" });
    expect(aplicarVentas([v1, v2, v1]).map((v) => v.id)).toEqual([
      "v-001",
      "v-002",
    ]);
  });
});
