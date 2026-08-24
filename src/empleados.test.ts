import { describe, expect, it } from "vitest";
import {
  describirTardanza,
  minutosDeTardanza,
  minutosDesdeHHMM,
  semaforoTardanza,
  type Empleado,
} from "./empleados";

// Belén: mañana lunes, miércoles y viernes de 08:00 a 14:00
const belen: Empleado = {
  id: "b",
  nombre: "Belén",
  turnos: [{ dias: [1, 3, 5], desde: "08:00", hasta: "14:00" }],
};

// 2026-08-24 es lunes
const lunes = (h: number, m: number) => new Date(2026, 7, 24, h, m);
const martes = (h: number, m: number) => new Date(2026, 7, 25, h, m);

describe("minutosDesdeHHMM", () => {
  it("convierte horas y rechaza basura", () => {
    expect(minutosDesdeHHMM("08:05")).toBe(485);
    expect(minutosDesdeHHMM("8:05")).toBe(485);
    expect(minutosDesdeHHMM("25:00")).toBeNull();
    expect(minutosDesdeHHMM("ocho")).toBeNull();
  });
});

describe("minutosDeTardanza", () => {
  it("Belén abre 8:05 un lunes: 5 minutos tarde", () => {
    expect(minutosDeTardanza(belen, lunes(8, 5))).toBe(5);
  });

  it("llegar antes da negativo (no es tardanza)", () => {
    expect(minutosDeTardanza(belen, lunes(7, 50))).toBe(-10);
  });

  it("un día sin turno programado no se juzga", () => {
    expect(minutosDeTardanza(belen, martes(8, 30))).toBeNull();
  });
});

describe("semaforoTardanza (tolerancia 20/40)", () => {
  it("verde hasta 20, amarillo hasta 40, rojo después", () => {
    expect(semaforoTardanza(0)).toBe("verde");
    expect(semaforoTardanza(20)).toBe("verde");
    expect(semaforoTardanza(21)).toBe("amarillo");
    expect(semaforoTardanza(40)).toBe("amarillo");
    expect(semaforoTardanza(41)).toBe("rojo");
    expect(semaforoTardanza(-15)).toBe("verde");
    expect(semaforoTardanza(null)).toBe("verde");
  });

  it("describe en criollo", () => {
    expect(describirTardanza(-3)).toBe("a horario");
    expect(describirTardanza(12)).toBe("12 min tarde · a horario");
    expect(describirTardanza(45)).toBe("45 min tarde");
  });
});
