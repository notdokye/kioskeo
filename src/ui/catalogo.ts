import { type Centavos, pesos } from "../core";

// Catálogo de prueba para desarrollar la pantalla de venta.
// Desaparece cuando exista el alta de productos + import de Excel.

export interface Producto {
  id: string;
  ean?: string;
  nombre: string;
  /** Por unidad: precio de cada una. Por peso: precio por CADA 100 GRAMOS. */
  precio: Centavos;
  /** Costo de compra (opcional): habilita los insights de margen del panel. */
  costo?: Centavos;
  /** "unidad" (default) o "peso": se vende por gramos a precio por 100g. */
  unidad?: "unidad" | "peso";
  /** Existencias (opcional). Informa, nunca bloquea una venta. */
  stock?: number;
  rubro: string;
  /** Data URL comprimida (funciona offline) o URL remota de Open Food Facts. */
  imagen?: string;
}

export const CATALOGO_DEMO: Producto[] = [
  { id: "p1", ean: "7790895000997", nombre: "Coca-Cola 500ml", precio: pesos(1800), rubro: "Bebidas" },
  { id: "p2", ean: "7790580660100", nombre: "Alfajor Guaymallén triple", precio: pesos(600), rubro: "Golosinas" },
  { id: "p3", ean: "7791234567890", nombre: "Marlboro Box 20", precio: pesos(4900), rubro: "Cigarrillos" },
  { id: "p4", ean: "7790380016405", nombre: "Beldent menta", precio: pesos(800), rubro: "Golosinas" },
  { id: "p5", ean: "7790895001246", nombre: "Agua Villavicencio 1.5L", precio: pesos(1500), rubro: "Bebidas" },
  { id: "p6", ean: "7790040113224", nombre: "Papas Lays clásicas 85g", precio: pesos(2200), rubro: "Snacks" },
  { id: "p7", ean: "7622300862073", nombre: "Oreo x118g", precio: pesos(1700), rubro: "Galletitas" },
  { id: "p8", ean: "7790387012345", nombre: "Encendedor BIC chico", precio: pesos(1300), rubro: "Varios" },
  { id: "p9", ean: "7790742345608", nombre: "Sedita blanca", precio: pesos(700), rubro: "Cigarrillos" },
  { id: "p10", ean: "7790895067310", nombre: "Monster verde 473ml", precio: pesos(3200), rubro: "Bebidas" },
];

export function buscarProductos(consulta: string, catalogo: Producto[] = CATALOGO_DEMO): Producto[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [];
  return catalogo.filter(
    (p) => p.nombre.toLowerCase().includes(q) || p.ean === q,
  );
}
