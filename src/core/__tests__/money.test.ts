import { describe, expect, it } from "vitest";
import { formatearARS, pesos } from "../money";

describe("pesos", () => {
  it("convierte pesos a centavos enteros", () => {
    expect(pesos(3600)).toBe(360000);
    expect(pesos(0)).toBe(0);
    expect(pesos(10.5)).toBe(1050);
  });

  it("no deja pasar los clásicos errores de punto flotante", () => {
    expect(pesos(0.1) + pesos(0.2)).toBe(pesos(0.3));
  });
});

describe("formatearARS", () => {
  it("formatea montos enteros sin decimales", () => {
    expect(formatearARS(pesos(11100))).toBe("$ 11.100");
    expect(formatearARS(pesos(800))).toBe("$ 800");
  });

  it("muestra centavos solo cuando existen", () => {
    expect(formatearARS(pesos(10.5))).toBe("$ 10,50");
  });

  it("rechaza montos no enteros", () => {
    expect(() => formatearARS(100.5)).toThrow();
  });
});
