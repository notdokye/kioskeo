import Dexie, { type EntityTable } from "dexie";
import type {
  Anulacion,
  Centavos,
  MedioPago,
  MovimientoCaja,
  MovimientoFiado,
  Venta,
} from "../core";
import { CATALOGO_DEMO, type Producto } from "../ui/catalogo";

export interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
}

export interface CajaSesion {
  id: string;
  apertura: Centavos;
  abiertaEn: string;
  /** Quién abrió el turno (si el negocio cargó empleados). */
  empleadoId?: string;
  empleadoNombre?: string;
  /** Minutos de tardanza al abrir (positivo = tarde); null si no tenía turno. */
  tardanzaMin?: number | null;
  movimientos: MovimientoCaja[];
  cerradaEn?: string;
  contado?: Centavos;
  esperado?: Centavos;
  diferencia?: Centavos;
}

// Capa de persistencia local (IndexedDB vía Dexie). Es la fuente de verdad
// del dispositivo: la app escribe acá primero y la sincronización con el
// servidor (cuando exista) lee de acá. Nada se pierde por cerrar la app.

/** Tablas que se sincronizan con el servidor. */
export type TablaSync =
  | "ventas"
  | "productos"
  | "anulaciones"
  | "clientes"
  | "pagosFiado"
  | "cajas";

/** Cola de salida: todo cambio local espera acá hasta subir al servidor. */
export interface ItemOutbox {
  seq?: number;
  tabla: TablaSync;
  registroId: string;
  creadoEn: string;
}

export interface Config {
  clave: string;
  valor: string;
}

export const db = new Dexie("kioskeo") as Dexie & {
  ventas: EntityTable<Venta, "id">;
  productos: EntityTable<Producto, "id">;
  anulaciones: EntityTable<Anulacion, "id">;
  clientes: EntityTable<Cliente, "id">;
  pagosFiado: EntityTable<MovimientoFiado, "id">;
  cajas: EntityTable<CajaSesion, "id">;
  outbox: EntityTable<ItemOutbox, "seq">;
  config: EntityTable<Config, "clave">;
};

db.version(1).stores({
  // Los índices habilitan las consultas del panel (por fecha) y el escáner (por ean).
  ventas: "id, fecha",
  productos: "id, ean, nombre",
});

// v4: cola de sincronización (outbox) y configuración local.
db.version(4).stores({
  ventas: "id, fecha",
  productos: "id, ean, nombre",
  anulaciones: "id, ventaId, fecha",
  clientes: "id, nombre",
  pagosFiado: "id, clienteId, fecha",
  cajas: "id, abiertaEn",
  outbox: "++seq, tabla",
  config: "clave",
});

// v3: clientes, pagos de fiado y sesiones de caja.
db.version(3).stores({
  ventas: "id, fecha",
  productos: "id, ean, nombre",
  anulaciones: "id, ventaId, fecha",
  clientes: "id, nombre",
  pagosFiado: "id, clienteId, fecha",
  cajas: "id, abiertaEn",
});

// v2: pagos múltiples (antes medioPago único) + tabla de anulaciones.
db.version(2)
  .stores({
    ventas: "id, fecha",
    productos: "id, ean, nombre",
    anulaciones: "id, ventaId, fecha",
  })
  .upgrade((tx) =>
    tx
      .table("ventas")
      .toCollection()
      .modify((v: Venta & { medioPago?: MedioPago | "qr" }) => {
        if (v.medioPago && !v.pagos) {
          const medio: MedioPago =
            v.medioPago === "qr" ? "transferencia" : v.medioPago;
          v.pagos = [{ medio, monto: v.total }];
          delete v.medioPago;
        }
      }),
  );

export async function inicializarDB(): Promise<void> {
  // Solo en modo desarrollo local (sin Supabase) se siembra el catálogo de
  // demostración. Un kiosco real arranca limpio: su catálogo entra por
  // import de Excel o escaneando productos.
  const esDesarrolloLocal = !import.meta.env.VITE_SUPABASE_URL;
  if (esDesarrolloLocal) {
    const cantidad = await db.productos.count();
    if (cantidad === 0) {
      await db.productos.bulkAdd(CATALOGO_DEMO);
    }
  }
}

/**
 * Escribe el registro Y su entrada de outbox en la MISMA transacción:
 * o quedan los dos, o ninguno. Así jamás existe un cambio local que la
 * sincronización no conozca.
 */
async function guardarYEncolar<T>(
  tabla: TablaSync,
  registroId: string,
  escribir: () => Promise<T>,
): Promise<void> {
  await db.transaction("rw", [db.table(tabla), db.outbox], async () => {
    await escribir();
    await db.outbox.add({
      tabla,
      registroId,
      creadoEn: new Date().toISOString(),
    });
  });
}

/**
 * Guarda una venta. `put` por id: reintentar con la misma venta no duplica.
 * Además descuenta stock de los productos por unidad que lo tengan cargado
 * (informativo: puede quedar negativo, jamás bloquea la venta).
 */
export async function guardarVenta(venta: Venta): Promise<void> {
  await db.transaction("rw", [db.ventas, db.productos, db.outbox], async () => {
    const ahora = new Date().toISOString();
    const yaExiste = await db.ventas.get(venta.id);
    await db.ventas.put(venta);
    await db.outbox.add({ tabla: "ventas", registroId: venta.id, creadoEn: ahora });
    if (yaExiste) return; // reintento: el stock ya se descontó
    for (const linea of venta.lineas) {
      if (linea.gramos !== undefined) continue;
      const producto = await db.productos.get(linea.productoId);
      if (!producto || producto.stock === undefined) continue;
      await db.productos.put({ ...producto, stock: producto.stock - linea.cantidad });
      await db.outbox.add({ tabla: "productos", registroId: producto.id, creadoEn: ahora });
    }
  });
}

export async function ventasDesde(fechaISO: string): Promise<Venta[]> {
  return db.ventas.where("fecha").aboveOrEqual(fechaISO).sortBy("fecha");
}

export function inicioDeHoyISO(ahora: Date = new Date()): string {
  const inicio = new Date(ahora);
  inicio.setHours(0, 0, 0, 0);
  return inicio.toISOString();
}

export async function listarProductos(): Promise<Producto[]> {
  return db.productos.toArray();
}

export async function agregarProducto(producto: Producto): Promise<void> {
  await guardarYEncolar("productos", producto.id, () =>
    db.productos.put(producto),
  );
}

/**
 * Importación masiva (Excel): todos los productos y sus entradas de outbox
 * en UNA transacción. Si un producto ya existe con el mismo EAN, se
 * actualiza su precio en lugar de duplicarlo.
 */
export async function importarProductos(
  nuevos: Producto[],
): Promise<{ agregados: number; actualizados: number }> {
  let agregados = 0;
  let actualizados = 0;
  await db.transaction("rw", [db.productos, db.outbox], async () => {
    const existentes = await db.productos.toArray();
    const porEan = new Map(
      existentes.filter((p) => p.ean).map((p) => [p.ean as string, p]),
    );
    const ahora = new Date().toISOString();
    for (const nuevo of nuevos) {
      const previo = nuevo.ean ? porEan.get(nuevo.ean) : undefined;
      const producto = previo
        ? { ...previo, nombre: nuevo.nombre, precio: nuevo.precio, rubro: nuevo.rubro }
        : nuevo;
      await db.productos.put(producto);
      await db.outbox.add({ tabla: "productos", registroId: producto.id, creadoEn: ahora });
      if (previo) actualizados++;
      else agregados++;
    }
  });
  return { agregados, actualizados };
}

export async function buscarPorEAN(ean: string): Promise<Producto | undefined> {
  return db.productos.where("ean").equals(ean).first();
}

/**
 * `put` por id: reintentar la misma anulación no duplica.
 * Devuelve al stock lo que la venta anulada había descontado.
 */
export async function guardarAnulacion(anulacion: Anulacion): Promise<void> {
  await db.transaction(
    "rw",
    [db.anulaciones, db.ventas, db.productos, db.outbox],
    async () => {
      const ahora = new Date().toISOString();
      const yaExiste = await db.anulaciones.get(anulacion.id);
      await db.anulaciones.put(anulacion);
      await db.outbox.add({ tabla: "anulaciones", registroId: anulacion.id, creadoEn: ahora });
      if (yaExiste) return;
      const venta = await db.ventas.get(anulacion.ventaId);
      if (!venta) return;
      for (const linea of venta.lineas) {
        if (linea.gramos !== undefined) continue;
        const producto = await db.productos.get(linea.productoId);
        if (!producto || producto.stock === undefined) continue;
        await db.productos.put({ ...producto, stock: producto.stock + linea.cantidad });
        await db.outbox.add({ tabla: "productos", registroId: producto.id, creadoEn: ahora });
      }
    },
  );
}

export async function anulacionesDesde(fechaISO: string): Promise<Anulacion[]> {
  return db.anulaciones.where("fecha").aboveOrEqual(fechaISO).toArray();
}

// --- clientes y fiados ---

export async function listarClientes(): Promise<Cliente[]> {
  return db.clientes.orderBy("nombre").toArray();
}

export async function agregarCliente(cliente: Cliente): Promise<void> {
  await guardarYEncolar("clientes", cliente.id, () => db.clientes.put(cliente));
}

export async function listarPagosFiado(): Promise<MovimientoFiado[]> {
  return db.pagosFiado.toArray();
}

/** `put` por id: reintentar el mismo pago no duplica. */
export async function guardarPagoFiado(pago: MovimientoFiado): Promise<void> {
  await guardarYEncolar("pagosFiado", pago.id, () => db.pagosFiado.put(pago));
}

/** Todas las ventas y anulaciones: el saldo de fiados es histórico, no del día. */
export async function todasLasVentas(): Promise<Venta[]> {
  return db.ventas.toArray();
}

export async function todasLasAnulaciones(): Promise<Anulacion[]> {
  return db.anulaciones.toArray();
}

// --- caja ---

export async function cajaAbierta(): Promise<CajaSesion | undefined> {
  const cajas = await db.cajas.toArray();
  return cajas.find((c) => !c.cerradaEn);
}

export async function todasLasCajas(): Promise<CajaSesion[]> {
  return db.cajas.orderBy("abiertaEn").reverse().toArray();
}

export async function guardarCaja(caja: CajaSesion): Promise<void> {
  await guardarYEncolar("cajas", caja.id, () => db.cajas.put(caja));
}

// --- identidad del dispositivo ---

const CLAVE_DISPOSITIVO = "kioskeo-dispositivo";

/**
 * Cada caja/celular tiene una identidad única generada la primera vez.
 * Con varias cajas vinculadas a la misma cuenta, esto permite saber qué
 * dispositivo hizo cada venta o anulación.
 */
export function dispositivoId(): string {
  let id = localStorage.getItem(CLAVE_DISPOSITIVO);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLAVE_DISPOSITIVO, id);
  }
  return id;
}

/**
 * Un dispositivo pertenece a UN negocio por vez. Si entra una cuenta
 * distinta a la última que usó este dispositivo, la base local se borra
 * entera antes de sincronizar: los datos del negocio anterior no deben
 * verse ni, mucho peor, subirse a la nube del negocio nuevo.
 */
export async function asegurarNegocioLocal(email: string): Promise<void> {
  const anterior = (await db.config.get("negocio-email"))?.valor ?? null;
  if (anterior !== null && anterior !== email) {
    await db.delete();
    await db.open();
    // Los ajustes cacheados también son del negocio anterior.
    localStorage.removeItem("kioskeo-ajustes");
  localStorage.removeItem("kioskeo-suscripcion");
  localStorage.removeItem("kioskeo-pin");
  localStorage.removeItem("kioskeo-empleados");
  }
  await db.config.put({ clave: "negocio-email", valor: email });
}

// --- configuración local (cursor de sync, etc.) ---

export async function leerConfig(clave: string): Promise<string | null> {
  return (await db.config.get(clave))?.valor ?? null;
}

export async function escribirConfig(clave: string, valor: string): Promise<void> {
  await db.config.put({ clave, valor });
}
