import { describe, expect, it } from "vitest";
import { ventasVigentes } from "../anulacion";
import { cerrarCaja, efectivoEsperado } from "../caja";
import { pesos } from "../money";
import { crearVenta, pagoUnico, type Pago } from "../venta";

const venta = (id: string, pagos: Pago[], monto: number) =>
  crearVenta({
    id,
    dispositivoId: "caja-1",
    fecha: "2026-08-18T10:00:00.000Z",
    pagos,
    clienteId: pagos.some((p) => p.medio === "fiado") ? "cliente-x" : undefined,
    lineas: [{ productoId: "p", nombre: "Producto", cantidad: 1, precioUnitario: pesos(monto) }],
  });

describe("efectivoEsperado", () => {
  it("suma solo el efectivo; la transferencia no está en el cajón", () => {
    const esperado = efectivoEsperado(pesos(10000), [
      venta("v1", pagoUnico("efectivo", pesos(5000)), 5000),
      venta("v2", pagoUnico("transferencia", pesos(9999)), 9999),
      venta("v3", pagoUnico("efectivo", pesos(2500)), 2500),
    ]);
    expect(esperado).toBe(pesos(17500));
  });

  it("de una venta mixta solo entra al cajón la parte en efectivo", () => {
    const mixta = venta(
      "v1",
      [
        { medio: "efectivo", monto: pesos(4000) },
        { medio: "transferencia", monto: pesos(7100) },
      ],
      11100,
    );
    expect(efectivoEsperado(pesos(0), [mixta])).toBe(pesos(4000));
  });

  it("el fiado no aporta efectivo al cajón", () => {
    const fiada = venta("v1", pagoUnico("fiado", pesos(3000)), 3000);
    expect(efectivoEsperado(pesos(1000), [fiada])).toBe(pesos(1000));
  });

  it("aplica retiros e ingresos de caja", () => {
    const esperado = efectivoEsperado(
      pesos(10000),
      [venta("v1", pagoUnico("efectivo", pesos(5000)), 5000)],
      [
        { tipo: "retiro", monto: pesos(3000), motivo: "proveedor" },
        { tipo: "ingreso", monto: pesos(1000) },
      ],
    );
    expect(esperado).toBe(pesos(13000));
  });

  it("una venta anulada no suma al cajón (flujo con ventasVigentes)", () => {
    const ventas = [
      venta("v1", pagoUnico("efectivo", pesos(5000)), 5000),
      venta("v2", pagoUnico("efectivo", pesos(2000)), 2000),
    ];
    const vigentes = ventasVigentes(ventas, [
      { id: "a1", ventaId: "v2", dispositivoId: "caja-1", fecha: "2026-08-18T11:00:00.000Z" },
    ]);
    expect(efectivoEsperado(pesos(0), vigentes)).toBe(pesos(5000));
  });
});

describe("cerrarCaja", () => {
  it("informa faltante como diferencia negativa", () => {
    const cierre = cerrarCaja(pesos(17500), pesos(17000));
    expect(cierre.diferencia).toBe(pesos(-500));
  });

  it("caja perfecta: diferencia cero", () => {
    expect(cerrarCaja(pesos(17500), pesos(17500)).diferencia).toBe(0);
  });
});
