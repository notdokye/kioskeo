import { describe, expect, it } from "vitest";
import {
  aplicarAnulaciones,
  crearAnulacion,
  ventasVigentes,
} from "../anulacion";
import { pesos } from "../money";
import { crearVenta, pagoUnico } from "../venta";

const venta = (id: string, monto: number) =>
  crearVenta({
    id,
    dispositivoId: "caja-1",
    fecha: "2026-08-18T10:00:00.000Z",
    pagos: pagoUnico("efectivo", pesos(monto)),
    lineas: [{ productoId: "p", nombre: "Producto", cantidad: 1, precioUnitario: pesos(monto) }],
  });

const anulacion = (id: string, ventaId: string) =>
  crearAnulacion({
    id,
    ventaId,
    dispositivoId: "caja-1",
    fecha: "2026-08-18T11:00:00.000Z",
  });

describe("crearAnulacion", () => {
  it("queda congelada como todo evento", () => {
    expect(Object.isFrozen(anulacion("a1", "v1"))).toBe(true);
  });

  it("exige id y venta de referencia", () => {
    expect(() => anulacion("", "v1")).toThrow();
    expect(() => anulacion("a1", "")).toThrow();
  });
});

describe("ventasVigentes", () => {
  const ventas = [venta("v1", 1000), venta("v2", 2000), venta("v3", 3000)];

  it("excluye la venta anulada; el resto sigue contando", () => {
    const vigentes = ventasVigentes(ventas, [anulacion("a1", "v2")]);
    expect(vigentes.map((v) => v.id)).toEqual(["v1", "v3"]);
  });

  it("el flujo corregir = anular + nueva venta deja los totales perfectos", () => {
    // Venta errada de $3.000, se anula, se cobra bien por $300
    const conCorreccion = [...ventas, venta("v3-bis", 300)];
    const vigentes = ventasVigentes(conCorreccion, [anulacion("a1", "v3")]);
    const total = vigentes.reduce((s, v) => s + v.total, 0);
    expect(total).toBe(pesos(1000 + 2000 + 300));
  });

  it("anulación duplicada (reintento de sync) no cambia nada", () => {
    const dosVeces = [anulacion("a1", "v2"), anulacion("a1", "v2")];
    expect(aplicarAnulaciones(dosVeces)).toHaveLength(1);
    expect(ventasVigentes(ventas, dosVeces)).toHaveLength(2);
  });

  it("anulación de una venta desconocida no rompe nada", () => {
    expect(ventasVigentes(ventas, [anulacion("a1", "v-fantasma")])).toHaveLength(3);
  });
});
