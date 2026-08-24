import { describe, expect, it } from "vitest";
import { pesos } from "../money";
import { aumentarPrecio, margenPorcentaje } from "../pricing";

describe("margenPorcentaje", () => {
  it("compro a 800, vendo a 1000: 20% de margen", () => {
    expect(margenPorcentaje(pesos(1000), pesos(800))).toBeCloseTo(20);
  });

  it("vender a pérdida da margen negativo, no explota", () => {
    expect(margenPorcentaje(pesos(800), pesos(1000))).toBeCloseTo(-25);
  });

  it("sin costo o sin precio no hay margen que calcular", () => {
    expect(margenPorcentaje(pesos(1000), 0)).toBeNull();
    expect(margenPorcentaje(0, pesos(800))).toBeNull();
  });
});

describe("aumentarPrecio", () => {
  it("aplica el porcentaje y redondea a $100 por defecto (siempre redondo)", () => {
    // $2.200 + 8% = $2.376 → $2.400
    expect(aumentarPrecio(pesos(2200), 8)).toBe(pesos(2400));
    // $2.750 + 7% = $2.942,50 → $2.900, nunca $2.950
    expect(aumentarPrecio(pesos(2750), 7)).toBe(pesos(2900));
    // $2.980 + 2% = $3.039,60 → $3.000
    expect(aumentarPrecio(pesos(2980), 2)).toBe(pesos(3000));
  });

  it("redondea hacia arriba cuando el kiosquero lo pide", () => {
    // $1.000 + 1% = $1.010 → arriba al múltiplo de $50 = $1.050
    expect(
      aumentarPrecio(pesos(1000), 1, { multiplo: pesos(50), modo: "arriba" }),
    ).toBe(pesos(1050));
  });

  it("sin redondeo devuelve el cálculo exacto", () => {
    expect(
      aumentarPrecio(pesos(2200), 8, { multiplo: 0, modo: "ninguno" }),
    ).toBe(pesos(2376));
  });

  it("acepta bajas de precio", () => {
    expect(aumentarPrecio(pesos(2000), -10)).toBe(pesos(1800));
  });

  it("un aumento de 0% no cambia el precio ya redondo", () => {
    expect(aumentarPrecio(pesos(2500), 0)).toBe(pesos(2500));
  });

  it("rechaza porcentajes sin sentido", () => {
    expect(() => aumentarPrecio(pesos(100), -100)).toThrow();
    expect(() => aumentarPrecio(pesos(100), Number.NaN)).toThrow();
  });

  it("el resultado siempre es un monto entero en centavos", () => {
    for (const pct of [3, 7.5, 12.34, 21]) {
      const resultado = aumentarPrecio(pesos(1234.56), pct, {
        multiplo: 0,
        modo: "ninguno",
      });
      expect(Number.isInteger(resultado)).toBe(true);
    }
  });
});
