import { describe, expect, it } from "vitest";
import { ventasVigentes } from "../anulacion";
import { deudasDesdeVentas, registrarPago, saldoCliente, saldosPorCliente, type MovimientoFiado } from "../fiado";
import { pesos } from "../money";
import { crearVenta } from "../venta";

const movimientos: MovimientoFiado[] = [
  { id: "f1", clienteId: "juan", tipo: "deuda", monto: pesos(5000), fecha: "2026-08-10", ventaId: "v9" },
  { id: "f2", clienteId: "juan", tipo: "deuda", monto: pesos(3000), fecha: "2026-08-12" },
  { id: "f3", clienteId: "maria", tipo: "deuda", monto: pesos(2000), fecha: "2026-08-13" },
  { id: "f4", clienteId: "juan", tipo: "pago", monto: pesos(4000), fecha: "2026-08-15" },
];

describe("saldoCliente", () => {
  it("deuda menos pagos, positivo = debe", () => {
    expect(saldoCliente("juan", movimientos)).toBe(pesos(4000));
    expect(saldoCliente("maria", movimientos)).toBe(pesos(2000));
  });

  it("cliente sin movimientos debe cero", () => {
    expect(saldoCliente("pedro", movimientos)).toBe(0);
  });
});

describe("saldosPorCliente", () => {
  it("arma el resumen de todos los clientes", () => {
    const saldos = saldosPorCliente(movimientos);
    expect(saldos.get("juan")).toBe(pesos(4000));
    expect(saldos.get("maria")).toBe(pesos(2000));
  });
});

describe("deudasDesdeVentas", () => {
  const ventaFiada = (id: string, clienteId: string, monto: number) =>
    crearVenta({
      id,
      dispositivoId: "caja-1",
      fecha: "2026-08-18T10:00:00.000Z",
      clienteId,
      pagos: [{ medio: "fiado", monto: pesos(monto) }],
      lineas: [{ productoId: "p", nombre: "Producto", cantidad: 1, precioUnitario: pesos(monto) }],
    });

  it("cada venta fiada vigente genera su deuda; el saldo cierra con los pagos", () => {
    const ventas = [ventaFiada("v1", "juan", 3000), ventaFiada("v2", "juan", 2000)];
    const deudas = deudasDesdeVentas(ventas);
    const pagos: MovimientoFiado[] = [
      { id: "p1", clienteId: "juan", tipo: "pago", monto: pesos(1000), fecha: "2026-08-18" },
    ];
    expect(saldoCliente("juan", [...deudas, ...pagos])).toBe(pesos(4000));
  });

  it("anular una venta fiada corrige la deuda sola", () => {
    const ventas = [ventaFiada("v1", "juan", 3000), ventaFiada("v2", "juan", 2000)];
    const vigentes = ventasVigentes(ventas, [
      { id: "a1", ventaId: "v1", dispositivoId: "caja-1", fecha: "2026-08-18T11:00:00.000Z" },
    ]);
    expect(saldoCliente("juan", deudasDesdeVentas(vigentes))).toBe(pesos(2000));
  });

  it("de una venta mixta solo la parte fiada es deuda", () => {
    const mixta = crearVenta({
      id: "v9",
      dispositivoId: "caja-1",
      fecha: "2026-08-18T10:00:00.000Z",
      clienteId: "maria",
      pagos: [
        { medio: "efectivo", monto: pesos(1000) },
        { medio: "fiado", monto: pesos(4000) },
      ],
      lineas: [{ productoId: "p", nombre: "Producto", cantidad: 1, precioUnitario: pesos(5000) }],
    });
    const deudas = deudasDesdeVentas([mixta]);
    expect(deudas).toHaveLength(1);
    expect(deudas[0].monto).toBe(pesos(4000));
  });

  it("recalcular las deudas no duplica: los ids son determinísticos", () => {
    const ventas = [ventaFiada("v1", "juan", 3000)];
    const dosVeces = [...deudasDesdeVentas(ventas), ...deudasDesdeVentas(ventas)];
    const idsUnicos = new Set(dosVeces.map((d) => d.id));
    expect(idsUnicos.size).toBe(1);
  });
});

describe("registrarPago", () => {
  it("agrega el pago al libro", () => {
    const conPago = registrarPago(movimientos, {
      id: "f5",
      clienteId: "maria",
      monto: pesos(2000),
      fecha: "2026-08-18",
    });
    expect(saldoCliente("maria", conPago)).toBe(0);
  });

  it("el mismo pago reintentado no se duplica", () => {
    const pago = { id: "f5", clienteId: "maria", monto: pesos(2000), fecha: "2026-08-18" };
    const unaVez = registrarPago(movimientos, pago);
    const dosVeces = registrarPago(unaVez, pago);
    expect(dosVeces).toHaveLength(unaVez.length);
    expect(saldoCliente("maria", dosVeces)).toBe(0);
  });

  it("rechaza pagos de cero o negativos", () => {
    expect(() =>
      registrarPago(movimientos, { id: "f6", clienteId: "juan", monto: 0, fecha: "2026-08-18" }),
    ).toThrow();
  });
});
