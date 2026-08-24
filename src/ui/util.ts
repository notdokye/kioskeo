import type { Centavos, Venta } from "../core";
import { pesos } from "../core";

/** "14:41" en hora argentina local. */
export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Coca ×2, Alfajor ×3, Marlboro" para tablas de ventas. */
export function resumenLineas(venta: Venta, max = 3): string {
  const partes = venta.lineas.map((l) => {
    const nombre = l.nombre.split(" ").slice(0, 2).join(" ");
    return l.cantidad > 1 ? `${nombre} ×${l.cantidad}` : nombre;
  });
  return partes.length > max
    ? `${partes.slice(0, max).join(", ")} +${partes.length - max}`
    : partes.join(", ");
}

/** Parseo tolerante de montos escritos a mano ("1.500", "1500,50"). */
export function parsearPesos(texto: string): Centavos | null {
  const limpio = texto.trim().replace(/\./g, "").replace(",", ".");
  if (limpio === "") return null;
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return pesos(numero);
}

export function etiquetaMedio(medio: string): string {
  if (medio === "efectivo") return "Efectivo";
  if (medio === "transferencia") return "Transf.";
  return "Fiado";
}
