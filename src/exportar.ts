import * as XLSX from "xlsx";
import { montoPorMedio, type Anulacion, type Venta } from "./core";
import type { Producto } from "./ui/catalogo";

// Exportar a Excel: el respaldo que el kiosquero entiende y el que le pide
// el contador. Montos en pesos (número), nunca en centavos.

const aPesos = (centavos: number) => centavos / 100;

function nombreArchivo(base: string): string {
  const d = new Date();
  const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${base}-${fecha}.xlsx`;
}

async function descargar(libro: XLSX.WorkBook, nombre: string): Promise<void> {
  const bytes = XLSX.write(libro, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const archivo = new File([bytes], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  // En celular, compartir (WhatsApp, Drive, Archivos) es más útil que "descargar".
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return;
    } catch {
      // canceló o no se pudo: se descarga
    }
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportarVentas(ventas: Venta[], anulaciones: Anulacion[], titulo: string): Promise<void> {
  const anuladas = new Set(anulaciones.map((a) => a.ventaId));
  const filas = [...ventas]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((v) => {
      const d = new Date(v.fecha);
      return {
        Fecha: d.toLocaleDateString("es-AR"),
        Hora: d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        Productos: v.lineas
          .map((l) => (l.gramos !== undefined ? `${l.nombre} ${l.gramos}g` : `${l.nombre} x${l.cantidad}`))
          .join(", "),
        Total: aPesos(v.total),
        Efectivo: aPesos(montoPorMedio(v, "efectivo")),
        Transferencia: aPesos(montoPorMedio(v, "transferencia")),
        Fiado: aPesos(montoPorMedio(v, "fiado")),
        Estado: anuladas.has(v.id) ? "Anulada" : "Cobrada",
      };
    });
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [{ wch: 11 }, { wch: 7 }, { wch: 50 }, { wch: 11 }, { wch: 11 }, { wch: 13 }, { wch: 10 }, { wch: 9 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Ventas");
  await descargar(libro, nombreArchivo(`kioskeo-ventas-${titulo}`));
}

export async function exportarProductos(productos: Producto[]): Promise<void> {
  const filas = [...productos]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((p) => ({
      Producto: p.nombre,
      Rubro: p.rubro,
      Codigo: p.ean ?? "",
      Precio: aPesos(p.precio),
      Costo: p.costo !== undefined ? aPesos(p.costo) : "",
      Stock: p.stock ?? "",
      Unidad: p.unidad === "peso" ? "por 100 g" : "unidad",
    }));
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 7 }, { wch: 10 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Productos");
  await descargar(libro, nombreArchivo("kioskeo-productos"));
}
