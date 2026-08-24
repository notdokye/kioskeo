import * as XLSX from "xlsx";
import { pesos, type Centavos } from "../core";

// Importador de planillas: el kiosquero trae SU Excel, como sea que lo tenga.
// Detectamos las columnas por el nombre del encabezado (nombre/precio/código/
// rubro y variantes), y si no hay encabezado asumimos: 1ª columna nombre,
// 2ª precio. Las filas ilegibles se informan, nunca se descartan en silencio.

export interface FilaImportada {
  nombre: string;
  precio: Centavos;
  costo?: Centavos;
  ean?: string;
  rubro?: string;
}

export interface ResultadoImportacion {
  filas: FilaImportada[];
  errores: string[];
}

const RE_NOMBRE = /nombre|producto|descripci|art[ií]culo|detalle/i;
const RE_PRECIO = /precio|venta|importe|valor|p\.?\s*u/i;
const RE_EAN = /ean|c[oó]digo|barra|cod\b/i;
const RE_RUBRO = /rubro|categor|familia|tipo|secci/i;

export type Celda = string | number | boolean | Date | null | undefined;

/** Mapeo de columnas: el que detecta la heurística o el que devuelve la IA. */
export interface MapeoColumnas {
  filaEncabezado: number;
  nombre: number;
  precio: number;
  costo?: number;
  ean: number;
  rubro: number;
}

/** Lee la primera hoja como matriz cruda (para la heurística y para la IA). */
export function leerMatriz(buffer: ArrayBuffer): Celda[][] {
  const libro = XLSX.read(buffer, { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) return [];
  return XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });
}

/** Heurística local: busca la fila de encabezados entre las primeras 10. */
export function detectarColumnas(matriz: Celda[][]): MapeoColumnas {
  for (let i = 0; i < Math.min(matriz.length, 10); i++) {
    const fila = matriz[i].map((c) => String(c ?? ""));
    const iNombre = fila.findIndex((c) => RE_NOMBRE.test(c));
    const iPrecio = elegirColumnaPrecio(fila);
    if (iNombre !== -1 && iPrecio !== -1) {
      // Si además hay una columna de costo/compra, la aprovechamos para
      // los insights de margen del panel.
      const iCosto = fila.findIndex(
        (c, idx) =>
          idx !== iPrecio && RE_PRECIO.test(c) && /costo|compra/i.test(c),
      );
      return {
        filaEncabezado: i,
        nombre: iNombre,
        precio: iPrecio,
        costo: iCosto === -1 ? undefined : iCosto,
        ean: fila.findIndex((c) => RE_EAN.test(c)),
        rubro: fila.findIndex((c) => RE_RUBRO.test(c)),
      };
    }
  }
  // Sin encabezado reconocible: 1ª columna nombre, 2ª precio.
  return { filaEncabezado: -1, nombre: 0, precio: 1, ean: -1, rubro: -1 };
}

export function parsearPlanilla(buffer: ArrayBuffer): ResultadoImportacion {
  const matriz = leerMatriz(buffer);
  if (matriz.length === 0) return { filas: [], errores: ["La planilla está vacía"] };
  return construirFilas(matriz, detectarColumnas(matriz));
}

/** Convierte la matriz en productos usando un mapeo (heurístico o de la IA). */
export function construirFilas(
  matriz: Celda[][],
  columnas: MapeoColumnas,
): ResultadoImportacion {
  const { filaEncabezado } = columnas;
  const desde = filaEncabezado + 1;
  const filas: FilaImportada[] = [];
  const errores: string[] = [];

  for (let i = desde; i < matriz.length; i++) {
    const fila = matriz[i];
    if (!fila || fila.every((c) => c === null || String(c).trim() === "")) continue;

    const nombre = String(fila[columnas.nombre] ?? "").trim();
    const precioCrudo = fila[columnas.precio];
    if (!nombre) {
      errores.push(`Fila ${i + 1}: sin nombre de producto`);
      continue;
    }
    const precio = parsearPrecio(precioCrudo);
    if (precio === null || precio <= 0) {
      errores.push(`Fila ${i + 1} (${nombre}): precio ilegible "${precioCrudo ?? ""}"`);
      continue;
    }

    const ean =
      columnas.ean !== -1 ? limpiarEAN(fila[columnas.ean]) : undefined;
    const rubro =
      columnas.rubro !== -1
        ? String(fila[columnas.rubro] ?? "").trim() || undefined
        : undefined;
    const costoCrudo =
      columnas.costo !== undefined && columnas.costo !== -1
        ? parsearPrecio(fila[columnas.costo])
        : null;

    filas.push({
      nombre,
      precio,
      costo: costoCrudo !== null && costoCrudo > 0 ? costoCrudo : undefined,
      ean,
      rubro,
    });
  }

  if (filas.length === 0 && errores.length === 0) {
    errores.push("No encontramos productos en la planilla");
  }
  return { filas, errores };
}

/**
 * Las listas de proveedor suelen traer "Precio Costo" Y "Precio Venta".
 * El precio que Kioskeo importa es SIEMPRE el de venta: se prefiere la
 * columna que diga "venta" y se evita la que diga costo/compra/mayorista.
 */
function elegirColumnaPrecio(fila: string[]): number {
  const candidatas = fila
    .map((celda, indice) => ({ celda, indice }))
    .filter(({ celda }) => RE_PRECIO.test(celda));
  if (candidatas.length === 0) return -1;
  const deVenta = candidatas.find(({ celda }) => /venta|p[uú]blico|final/i.test(celda));
  if (deVenta) return deVenta.indice;
  const noCosto = candidatas.find(
    ({ celda }) => !/costo|compra|mayorista|proveedor/i.test(celda),
  );
  return (noCosto ?? candidatas[0]).indice;
}

/** Acepta 1234, "1234", "$ 1.234,50", "1,234.50", "1234.5". */
export function parsearPrecio(celda: Celda): Centavos | null {
  if (typeof celda === "number") {
    return Number.isFinite(celda) ? pesos(celda) : null;
  }
  if (celda === null || celda === undefined) return null;
  let texto = String(celda).replace(/[^\d.,-]/g, "").trim();
  if (!texto) return null;
  const ultimaComa = texto.lastIndexOf(",");
  const ultimoPunto = texto.lastIndexOf(".");
  if (ultimaComa > ultimoPunto) {
    // formato argentino: punto de miles, coma decimal
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPunto > ultimaComa) {
    // formato inglés: coma de miles, punto decimal
    texto = texto.replace(/,/g, "");
  }
  const numero = Number(texto);
  return Number.isFinite(numero) ? pesos(numero) : null;
}

function limpiarEAN(celda: Celda): string | undefined {
  if (celda === null || celda === undefined) return undefined;
  // Excel suele convertir EANs a números (hasta en notación científica).
  const texto =
    typeof celda === "number"
      ? celda.toLocaleString("fullwide", { useGrouping: false })
      : String(celda).trim();
  const digitos = texto.replace(/\D/g, "");
  return digitos.length >= 8 && digitos.length <= 14 ? digitos : undefined;
}
