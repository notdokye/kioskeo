import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { pesos } from "../../core";
import { parsearPlanilla, parsearPrecio } from "../excel";

function planilla(filas: unknown[][]): ArrayBuffer {
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Productos");
  return XLSX.write(libro, { type: "array", bookType: "xlsx" });
}

describe("parsearPlanilla", () => {
  it("detecta encabezados típicos de un Excel de kiosco", () => {
    const { filas, errores } = parsearPlanilla(
      planilla([
        ["Producto", "Precio Venta", "Código de barras", "Rubro"],
        ["Coca-Cola 500ml", 1800, "7790895000997", "Bebidas"],
        ["Alfajor Guaymallén", "600", 7790580660100, "Golosinas"],
      ]),
    );
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toEqual({
      nombre: "Coca-Cola 500ml",
      precio: pesos(1800),
      ean: "7790895000997",
      rubro: "Bebidas",
    });
    expect(filas[1].ean).toBe("7790580660100");
  });

  it("con Precio Costo y Precio Venta, importa SIEMPRE el de venta", () => {
    const { filas } = parsearPlanilla(
      planilla([
        ["Artículo", "Precio Costo", "Precio Venta"],
        ["Coca-Cola 500ml", 1200, 1800],
      ]),
    );
    expect(filas[0].precio).toBe(pesos(1800));
  });

  it("y de paso captura el costo para los insights de margen", () => {
    const { filas } = parsearPlanilla(
      planilla([
        ["Artículo", "Precio Costo", "Precio Venta"],
        ["Coca-Cola 500ml", 1200, 1800],
      ]),
    );
    expect(filas[0].costo).toBe(pesos(1200));
  });

  it("evita la columna de costo aunque venga primera y sin la palabra venta", () => {
    const { filas } = parsearPlanilla(
      planilla([
        ["Producto", "Precio Compra", "Importe"],
        ["Alfajor", 400, 600],
      ]),
    );
    expect(filas[0].precio).toBe(pesos(600));
  });

  it("sin encabezado asume nombre y precio en las dos primeras columnas", () => {
    const { filas } = parsearPlanilla(
      planilla([
        ["Marlboro Box 20", 4900],
        ["Beldent menta", 800],
      ]),
    );
    expect(filas).toHaveLength(2);
    expect(filas[0].precio).toBe(pesos(4900));
  });

  it("informa filas con precio ilegible sin frenar el resto", () => {
    const { filas, errores } = parsearPlanilla(
      planilla([
        ["Nombre", "Precio"],
        ["Bueno", 100],
        ["Malo", "consultar"],
        ["Otro bueno", "1.500,50"],
      ]),
    );
    expect(filas).toHaveLength(2);
    expect(filas[1].precio).toBe(pesos(1500.5));
    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain("Malo");
  });

  it("saltea filas vacías", () => {
    const { filas, errores } = parsearPlanilla(
      planilla([
        ["Nombre", "Precio"],
        [null, null],
        ["Único", 200],
        [null, null],
      ]),
    );
    expect(filas).toHaveLength(1);
    expect(errores).toEqual([]);
  });
});

describe("parsearPrecio", () => {
  it("entiende los formatos que aparecen en Excels reales", () => {
    expect(parsearPrecio(1234)).toBe(pesos(1234));
    expect(parsearPrecio("1234")).toBe(pesos(1234));
    expect(parsearPrecio("$ 1.234,50")).toBe(pesos(1234.5));
    expect(parsearPrecio("1,234.50")).toBe(pesos(1234.5));
    expect(parsearPrecio("1234.5")).toBe(pesos(1234.5));
    expect(parsearPrecio(1234.56)).toBe(pesos(1234.56));
  });

  it("rechaza lo que no es un precio", () => {
    expect(parsearPrecio("consultar")).toBeNull();
    expect(parsearPrecio("")).toBeNull();
    expect(parsearPrecio(null)).toBeNull();
  });
});
