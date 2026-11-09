import { useEffect, useMemo, useRef, useState } from "react";
import { aumentarPrecio, formatearARS, type Centavos, type Redondeo, type Venta } from "../core";
import { agregarProducto, buscarPorEAN, db, importarProductos, listarProductos, todasLasVentas } from "../db/db";
import {
  construirFilas,
  detectarColumnas,
  leerMatriz,
  type Celda,
  type MapeoColumnas,
  type ResultadoImportacion,
} from "../import/excel";
import { AltaRapida } from "./AltaRapida";
import type { Producto } from "./catalogo";
import { Escaner } from "./Escaner";
import { comprimirImagen } from "./imagen";
import { ImagenProducto } from "./ImagenProducto";
import { useEsPC } from "./useEsPC";
import { horaCorta, parsearPesos } from "./util";
import "./Pantallas.css";
import "./Productos.css";

// Productos (diseño "Kioskeo 1 Productos"): catálogo visual en tarjetas con
// foto, franja de stock y precio grande; detalle en lámina (hoja abajo en
// celular, panel derecho en PC) con ajustes de a $100 y de a 1 unidad; y
// aumento masivo eligiendo producto por producto, siempre a números redondos.

const STOCK_BAJO = 5;

// Siempre números redondos: nada de $2.950. De a $100 (2.900, 3.000, 3.100).
const REDONDEOS: { id: string; etiqueta: string; redondeo: Redondeo }[] = [
  { id: "cercano", etiqueta: "$ 100", redondeo: { multiplo: 10000, modo: "cercano" } },
  { id: "arriba", etiqueta: "$ 100 arriba", redondeo: { multiplo: 10000, modo: "arriba" } },
  { id: "quinientos", etiqueta: "$ 500", redondeo: { multiplo: 50000, modo: "cercano" } },
];

type Estado = "sin-stock" | "stock-bajo" | "sin-foto";

const CHIPS: { id: Estado; etiqueta: string }[] = [
  { id: "sin-stock", etiqueta: "Sin stock" },
  { id: "stock-bajo", etiqueta: "Stock bajo" },
  { id: "sin-foto", etiqueta: "Sin foto" },
];

function cumple(p: Producto, estado: Estado): boolean {
  if (estado === "sin-stock") return p.stock === 0;
  if (estado === "stock-bajo") return p.stock !== undefined && p.stock > 0 && p.stock <= STOCK_BAJO;
  return !p.imagen;
}

function franjaDe(p: Producto): string {
  if (p.stock === 0) return "prod-franja-roja";
  if (p.stock !== undefined && p.stock <= STOCK_BAJO) return "prod-franja-ambar";
  return "";
}

function subtituloDe(p: Producto): string {
  const partes: string[] = [];
  if (p.stock !== undefined) partes.push(p.stock === 0 ? "Sin stock" : `Stock ${p.stock}`);
  if (p.costo) partes.push(`Costo ${formatearARS(p.costo)}`);
  if (p.unidad === "peso") partes.push("cada 100 g");
  return partes.length > 0 ? partes.join(" · ") : p.rubro;
}

const IconoX = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export function Productos() {
  const esPC = useEsPC();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filtro, setFiltro] = useState("");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [aumentoAbierto, setAumentoAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [importacion, setImportacion] = useState<ResultadoImportacion | null>(null);
  const [matrizImportada, setMatrizImportada] = useState<Celda[][] | null>(null);
  const [ia, setIa] = useState<"quieta" | "pensando" | "uso" | "fallo">("quieta");
  const archivoRef = useRef<HTMLInputElement>(null);

  // La IA detecta las columnas cuando la heurística local no alcanza:
  // manda una muestra de la planilla a nuestra función en Vercel (la API
  // key nunca toca el navegador) y rearma el preview con el mapeo que vuelve.
  async function detectarConIA() {
    if (!matrizImportada || ia === "pensando") return;
    setIa("pensando");
    try {
      const respuesta = await fetch("/api/mapear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ muestra: matrizImportada.slice(0, 15) }),
      });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const mapeo = (await respuesta.json()) as MapeoColumnas;
      setImportacion(construirFilas(matrizImportada, mapeo));
      setIa("uso");
    } catch {
      setIa("fallo");
    }
  }

  async function recargar() {
    setProductos(await listarProductos());
  }

  useEffect(() => {
    recargar();
  }, []);

  const conteos = useMemo(
    () => ({
      "sin-stock": productos.filter((p) => cumple(p, "sin-stock")).length,
      "stock-bajo": productos.filter((p) => cumple(p, "stock-bajo")).length,
      "sin-foto": productos.filter((p) => cumple(p, "sin-foto")).length,
    }),
    [productos],
  );

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return productos
      .filter((p) => !estado || cumple(p, estado))
      .filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.ean === q)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [productos, filtro, estado]);

  const productoSeleccionado = productos.find((p) => p.id === seleccionado) ?? null;

  function avisar(mensaje: string) {
    setAviso(mensaje);
    setTimeout(() => setAviso(null), 2500);
  }

  async function guardarProducto(p: Producto) {
    await agregarProducto(p);
    recargar();
  }

  return (
    <div className="pantalla pantalla-ancha pantalla-aire prod">
      <header className="encabezado">
        <span className="migaja">Productos · {productos.length}</span>
        <div className="acciones-header">
          <button className="boton-outline" onClick={() => archivoRef.current?.click()}>
            Importar Excel
          </button>
          <button className="boton-tinte" disabled={productos.length === 0} onClick={() => setAumentoAbierto(true)}>
            Aumentar precios
          </button>
        </div>
        <input
          ref={archivoRef}
          type="file"
          accept=".xlsx,.xls,.csv,.ods"
          hidden
          onChange={async (e) => {
            const archivo = e.target.files?.[0];
            e.target.value = "";
            if (!archivo) return;
            setIa("quieta");
            try {
              const matriz = leerMatriz(await archivo.arrayBuffer());
              setMatrizImportada(matriz);
              if (matriz.length === 0) {
                setImportacion({ filas: [], errores: ["La planilla está vacía"] });
              } else {
                setImportacion(construirFilas(matriz, detectarColumnas(matriz)));
              }
            } catch {
              setMatrizImportada(null);
              setImportacion({ filas: [], errores: ["No pudimos leer ese archivo"] });
            }
          }}
        />
      </header>

      <div className="prod-barra">
        <label className="prod-buscador">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            placeholder="Buscar producto o código"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Buscar productos"
          />
          {filtro && (
            <button className="prod-limpiar" aria-label="Borrar búsqueda" onClick={() => setFiltro("")}>
              {IconoX}
            </button>
          )}
        </label>
        <div className="prod-chips">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              className={`prod-chip ${estado === c.id ? "prod-chip-activo" : ""}`}
              aria-pressed={estado === c.id}
              onClick={() => setEstado(estado === c.id ? null : c.id)}
            >
              <span>{c.etiqueta}</span>
              <strong>{conteos[c.id]}</strong>
            </button>
          ))}
        </div>
      </div>

      {aviso && <p className="prod-aviso">{aviso}</p>}

      {visibles.length === 0 ? (
        <p className="vacio">
          {productos.length === 0
            ? "Todavía no cargaste productos. Tocá el + para el primero, o importá tu planilla."
            : estado
              ? "Ningún producto en ese estado."
              : "Nada con ese nombre."}
        </p>
      ) : (
        <div className="prod-lista">
          {visibles.map((p) => (
            <button key={p.id} className={`prod-tarjeta ${franjaDe(p)}`} onClick={() => setSeleccionado(p.id)}>
              <span className="prod-franja" aria-hidden />
              <span className="prod-foto">
                <ImagenProducto nombre={p.nombre} imagen={p.imagen} tam={esPC ? 96 : 72} />
              </span>
              <span className="prod-textos">
                <span className="prod-nombre">{p.nombre}</span>
                <span className="prod-sub">{subtituloDe(p)}</span>
              </span>
              <span className="prod-precio">{formatearARS(p.precio)}</span>
            </button>
          ))}
        </div>
      )}

      <button className="prod-fab" aria-label="Nuevo producto" title="Nuevo producto" onClick={() => setAltaAbierta(true)}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {productoSeleccionado && (
        <DetalleProducto
          producto={productoSeleccionado}
          onGuardar={guardarProducto}
          onCerrar={() => setSeleccionado(null)}
        />
      )}

      {aumentoAbierto && (
        <AumentoPanel
          productos={productos}
          onAplicado={(cantidad) => {
            setAumentoAbierto(false);
            avisar(`${cantidad} precio${cantidad === 1 ? "" : "s"} actualizado${cantidad === 1 ? "" : "s"}`);
            recargar();
          }}
          onCerrar={() => setAumentoAbierto(false)}
        />
      )}

      {importacion && (
        <div className="hoja-fondo" role="dialog" aria-label="Importar planilla">
          <div className="hoja">
            <p className="hoja-titulo">Importar planilla</p>
            {importacion.filas.length > 0 ? (
              <>
                <p className="hoja-nota">
                  Encontramos <strong>{importacion.filas.length} productos</strong>
                  {importacion.errores.length > 0 &&
                    ` (y ${importacion.errores.length} fila${importacion.errores.length === 1 ? "" : "s"} ilegible${importacion.errores.length === 1 ? "" : "s"} que salteamos)`}
                  . Los primeros:
                </p>
                <div className="tabla">
                  {importacion.filas.slice(0, 5).map((f, i) => (
                    <div key={i} className="tabla-fila" style={{ gridTemplateColumns: "1fr auto" }}>
                      <span className="tabla-principal">
                        {f.nombre}
                        {f.rubro && <span className="tabla-detalle">{f.rubro}</span>}
                      </span>
                      <span className="tabla-monto">{formatearARS(f.precio)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="hoja-nota">{importacion.errores.join(" · ")}</p>
            )}

            {matrizImportada && ia !== "uso" && (
              <button
                className="hoja-cancelar"
                style={{ borderStyle: "dashed", color: "var(--salmon-presionado)" }}
                disabled={ia === "pensando"}
                onClick={detectarConIA}
              >
                {ia === "pensando"
                  ? "La IA está mirando la planilla…"
                  : ia === "fallo"
                    ? "La IA no está disponible ahora — reintentar"
                    : "¿Se ve mal? Detectar columnas con IA"}
              </button>
            )}
            {ia === "uso" && <p className="hoja-nota positivo">Columnas detectadas con IA</p>}

            <div className="acciones-fila">
              <button
                className="hoja-cancelar"
                onClick={() => {
                  setImportacion(null);
                  setMatrizImportada(null);
                }}
              >
                Cancelar
              </button>
              {importacion.filas.length > 0 && (
                <button
                  className="boton-principal"
                  onClick={async () => {
                    const nuevos = importacion.filas.map((f) => ({
                      id: crypto.randomUUID(),
                      nombre: f.nombre,
                      precio: f.precio,
                      costo: f.costo,
                      ean: f.ean,
                      rubro: f.rubro ?? "Sin rubro",
                    }));
                    const r = await importarProductos(nuevos);
                    setImportacion(null);
                    avisar(`${r.agregados} agregados${r.actualizados > 0 ? `, ${r.actualizados} actualizados` : ""}`);
                    recargar();
                  }}
                >
                  IMPORTAR {importacion.filas.length}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {altaAbierta && (
        <AltaRapida
          onGuardar={async (p) => {
            await agregarProducto(p);
            setAltaAbierta(false);
            recargar();
          }}
          onCancelar={() => setAltaAbierta(false)}
        />
      )}
    </div>
  );
}

// ---------- detalle de un producto ----------

const PASO_PRECIO: Centavos = 10000; // $100
const PRECIO_MINIMO: Centavos = 100; // $1

function DetalleProducto({
  producto,
  onGuardar,
  onCerrar,
}: {
  producto: Producto;
  onGuardar: (p: Producto) => Promise<void>;
  onCerrar: () => void;
}) {
  const esPC = useEsPC();
  const [nombreBorrador, setNombreBorrador] = useState<string | null>(null);
  const [precioBorrador, setPrecioBorrador] = useState<string | null>(null);
  const [stockBorrador, setStockBorrador] = useState<string | null>(null);
  const [eanBorrador, setEanBorrador] = useState<string | null>(null);
  const [eanError, setEanError] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [historial, setHistorial] = useState<Venta[] | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  function guardar(cambios: Partial<Producto>) {
    return onGuardar({ ...producto, ...cambios });
  }

  function ajustarPrecio(delta: Centavos) {
    const nuevo = producto.precio + delta;
    if (nuevo >= PRECIO_MINIMO) guardar({ precio: nuevo });
  }

  function ajustarStock(delta: number) {
    guardar({ stock: Math.max(0, (producto.stock ?? 0) + delta) });
  }

  function confirmarNombre() {
    const limpio = (nombreBorrador ?? "").trim();
    setNombreBorrador(null);
    if (limpio && limpio !== producto.nombre) guardar({ nombre: limpio });
  }

  function confirmarPrecio() {
    const precio = parsearPesos(precioBorrador ?? "");
    setPrecioBorrador(null);
    if (precio !== null && precio >= PRECIO_MINIMO && precio !== producto.precio) guardar({ precio });
  }

  function confirmarStock() {
    const n = Number((stockBorrador ?? "").trim());
    setStockBorrador(null);
    if (Number.isInteger(n) && n >= 0 && n !== producto.stock) guardar({ stock: n });
  }

  // El código se escribe a mano, con un lector USB (tipea y manda Enter) o
  // con la cámara. Vacío lo borra. Nunca dos productos con el mismo código:
  // al escanear se vendería siempre el primero.
  async function asignarEan(texto: string) {
    const codigo = texto.replace(/\s+/g, "");
    setEanBorrador(null);
    if (codigo === (producto.ean ?? "")) return;
    if (codigo === "") {
      setEanError(null);
      guardar({ ean: undefined });
      return;
    }
    const otro = await buscarPorEAN(codigo);
    if (otro && otro.id !== producto.id) {
      setEanError(`El código ${codigo} ya es de «${otro.nombre}»`);
      return;
    }
    setEanError(null);
    guardar({ ean: codigo });
  }

  async function verHistorial() {
    const todas = await todasLasVentas();
    setHistorial(
      todas
        .filter((v) => v.lineas.some((l) => l.productoId === producto.id))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 8),
    );
  }

  async function fotoElegida(archivo: File | undefined) {
    if (!archivo) return;
    try {
      await guardar({ imagen: await comprimirImagen(archivo) });
    } catch {
      // foto ilegible: no se cambia nada
    }
  }

  return (
    <>
      <div className="lamina-fondo" onClick={onCerrar}>
        <div className="lamina prod-detalle" role="dialog" aria-label={producto.nombre} onClick={(e) => e.stopPropagation()}>
          <div className="lamina-asa" />
          <div className="lamina-cabecera">
            <span className="migaja">Producto</span>
            <button className="lamina-cerrar" aria-label="Cerrar" onClick={onCerrar}>
              {IconoX}
            </button>
          </div>

          <button className="prod-detalle-foto" title="Sacar o cambiar la foto" onClick={() => fotoRef.current?.click()}>
            <ImagenProducto nombre={producto.nombre} imagen={producto.imagen} tam={esPC ? 140 : 120} />
            <span className="prod-detalle-foto-pie">{producto.imagen ? "Cambiar foto" : "Agregar foto"}</span>
          </button>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              fotoElegida(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {nombreBorrador === null ? (
            <button className="prod-detalle-nombre" title="Cambiar el nombre" onClick={() => setNombreBorrador(producto.nombre)}>
              <span>{producto.nombre}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 3l4 4L8 20l-5 1 1-5z" />
              </svg>
            </button>
          ) : (
            <input
              className="prod-detalle-nombre-input"
              autoFocus
              value={nombreBorrador}
              onChange={(e) => setNombreBorrador(e.target.value)}
              onBlur={confirmarNombre}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarNombre();
                if (e.key === "Escape") setNombreBorrador(null);
              }}
              aria-label="Nombre del producto"
            />
          )}

          <div className="prod-ajuste">
            <span className="prod-ajuste-etiqueta">{producto.unidad === "peso" ? "Precio cada 100 g" : "Precio de venta"}</span>
            <div className="prod-ajuste-fila">
              <button className="prod-ajuste-boton" onClick={() => ajustarPrecio(-PASO_PRECIO)} aria-label="Bajar $100">
                -100
              </button>
              {precioBorrador === null ? (
                <button className="prod-ajuste-valor prod-ajuste-precio" title="Escribir el precio" onClick={() => setPrecioBorrador(String(producto.precio / 100))}>
                  {formatearARS(producto.precio)}
                </button>
              ) : (
                <input
                  className="prod-ajuste-valor prod-ajuste-precio prod-ajuste-input"
                  autoFocus
                  inputMode="decimal"
                  value={precioBorrador}
                  onChange={(e) => setPrecioBorrador(e.target.value)}
                  onBlur={confirmarPrecio}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmarPrecio();
                    if (e.key === "Escape") setPrecioBorrador(null);
                  }}
                  aria-label="Precio"
                />
              )}
              <button className="prod-ajuste-boton" onClick={() => ajustarPrecio(PASO_PRECIO)} aria-label="Subir $100">
                +100
              </button>
            </div>
          </div>

          <div className="prod-ajuste">
            <span className="prod-ajuste-etiqueta">Stock</span>
            <div className="prod-ajuste-fila">
              <button className="prod-ajuste-boton prod-ajuste-boton-chico" onClick={() => ajustarStock(-1)} aria-label="Restar uno">
                -1
              </button>
              {stockBorrador === null ? (
                <button className="prod-ajuste-valor prod-ajuste-stock" title="Escribir el stock" onClick={() => setStockBorrador(String(producto.stock ?? 0))}>
                  {producto.stock ?? "—"}
                </button>
              ) : (
                <input
                  className="prod-ajuste-valor prod-ajuste-stock prod-ajuste-input"
                  autoFocus
                  inputMode="numeric"
                  value={stockBorrador}
                  onChange={(e) => setStockBorrador(e.target.value)}
                  onBlur={confirmarStock}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmarStock();
                    if (e.key === "Escape") setStockBorrador(null);
                  }}
                  aria-label="Stock"
                />
              )}
              <button className="prod-ajuste-boton prod-ajuste-boton-chico" onClick={() => ajustarStock(1)} aria-label="Sumar uno">
                +1
              </button>
            </div>
          </div>

          <div className="prod-ajuste">
            <span className="prod-ajuste-etiqueta">Código de barras</span>
            <div className="prod-ajuste-fila">
              {eanBorrador === null ? (
                <button
                  className={`prod-ajuste-valor prod-ajuste-ean ${producto.ean ? "" : "prod-ajuste-ean-vacio"}`}
                  title="Escribir el código o pasar el lector"
                  onClick={() => {
                    setEanError(null);
                    setEanBorrador(producto.ean ?? "");
                  }}
                >
                  {producto.ean ?? "Agregar código"}
                </button>
              ) : (
                <input
                  className="prod-ajuste-valor prod-ajuste-ean prod-ajuste-input"
                  autoFocus
                  inputMode="numeric"
                  placeholder="Escribilo o pasá el lector"
                  value={eanBorrador}
                  onChange={(e) => setEanBorrador(e.target.value)}
                  onBlur={() => asignarEan(eanBorrador)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") asignarEan(eanBorrador);
                    if (e.key === "Escape") setEanBorrador(null);
                  }}
                  aria-label="Código de barras"
                />
              )}
              <button
                className="prod-ajuste-boton prod-ajuste-boton-chico"
                title="Escanear con la cámara"
                aria-label="Escanear código con la cámara"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setEanBorrador(null);
                  setEanError(null);
                  setEscaneando(true);
                }}
              >
                <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8" />
                  <path d="M20 3h3.5A1.5 1.5 0 0 1 25 4.5V8" />
                  <path d="M25 20v3.5a1.5 1.5 0 0 1-1.5 1.5H20" />
                  <path d="M8 25H4.5A1.5 1.5 0 0 1 3 23.5V20" />
                  <path d="M8 10v8M12 10v8M16 10v8M20 10v8" />
                </svg>
              </button>
            </div>
            {eanError && <p className="prod-ajuste-error">{eanError}</p>}
          </div>

          <button className="prod-detalle-historial" onClick={() => (historial ? setHistorial(null) : verHistorial())}>
            {historial ? "OCULTAR HISTORIAL" : "VER HISTORIAL"}
          </button>

          {historial && (
            <div className="prod-historial">
              {historial.length === 0 ? (
                <p className="hoja-nota">Todavía no se vendió.</p>
              ) : (
                historial.map((v) => {
                  const linea = v.lineas.find((l) => l.productoId === producto.id)!;
                  const cantidad = linea.gramos !== undefined ? `${linea.gramos} g` : `×${linea.cantidad}`;
                  return (
                    <div key={v.id} className="prod-historial-fila">
                      <span>
                        {new Date(v.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · {horaCorta(v.fecha)}
                      </span>
                      <strong>{cantidad}</strong>
                      <span>{formatearARS(linea.precioUnitario)}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      {escaneando && (
        <Escaner
          onDetectado={(codigo) => {
            setEscaneando(false);
            asignarEan(codigo);
          }}
          onCerrar={() => setEscaneando(false)}
        />
      )}
    </>
  );
}

// ---------- aumento masivo ----------

const PASO_PCT = 5;

function AumentoPanel({
  productos,
  onAplicado,
  onCerrar,
}: {
  productos: Producto[];
  onAplicado: (cantidad: number) => void;
  onCerrar: () => void;
}) {
  const [pct, setPct] = useState(10);
  const [pctBorrador, setPctBorrador] = useState<string | null>(null);
  const [redondeoId, setRedondeoId] = useState("cercano");
  const [rubro, setRubro] = useState<string>("__todos__");
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());

  const redondeo = REDONDEOS.find((r) => r.id === redondeoId)!.redondeo;
  const rubros = useMemo(
    () => [...new Set(productos.map((p) => p.rubro))].sort((a, b) => a.localeCompare(b, "es")),
    [productos],
  );
  const candidatos = useMemo(
    () =>
      productos
        .filter((p) => rubro === "__todos__" || p.rubro === rubro)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [productos, rubro],
  );
  // Se puede destildar cualquiera: el aumento va solo a los marcados.
  const afectados = candidatos.filter((p) => !excluidos.has(p.id));
  const pctValido = Number.isFinite(pct) && pct > -100 && pct !== 0;

  function alternar(id: string) {
    setExcluidos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function confirmarPct() {
    const n = Number((pctBorrador ?? "").replace(",", ".").replace("%", "").trim());
    setPctBorrador(null);
    if (Number.isFinite(n) && n > -100) setPct(n);
  }

  async function aplicar() {
    if (!pctValido || afectados.length === 0) return;
    const actualizados = afectados.map((p) => ({
      ...p,
      precio: aumentarPrecio(p.precio, pct, redondeo),
    }));
    await db.productos.bulkPut(actualizados);
    onAplicado(actualizados.length);
  }

  const lista = (
    <div className="aum-lista">
      <div className="aum-lista-cabecera">
        <span className="aum-todos">
          <button onClick={() => setExcluidos(new Set())}>Todos</button>
          <button className="aum-ninguno" onClick={() => setExcluidos(new Set(candidatos.map((p) => p.id)))}>
            Ninguno
          </button>
        </span>
        <span className="aum-afecta">
          Afecta a {afectados.length} producto{afectados.length === 1 ? "" : "s"}
        </span>
      </div>
      {rubros.length > 1 && (
        <div className="aum-rubros">
          <button className={`aum-rubro ${rubro === "__todos__" ? "aum-rubro-activo" : ""}`} onClick={() => setRubro("__todos__")}>
            Todos los rubros
          </button>
          {rubros.map((r) => (
            <button key={r} className={`aum-rubro ${rubro === r ? "aum-rubro-activo" : ""}`} onClick={() => setRubro(r)}>
              {r}
            </button>
          ))}
        </div>
      )}
      <div className="aum-filas">
        {candidatos.map((p) => {
          const marcado = !excluidos.has(p.id);
          return (
            <button key={p.id} className={`aum-fila ${marcado ? "" : "aum-fila-apagada"}`} aria-pressed={marcado} onClick={() => alternar(p.id)}>
              <span className="aum-nombre">{p.nombre}</span>
              <span className="aum-antes">{formatearARS(p.precio)}</span>
              <span className="aum-flecha" aria-hidden>
                →
              </span>
              <span className="aum-despues">{pctValido ? formatearARS(aumentarPrecio(p.precio, pct, redondeo)) : formatearARS(p.precio)}</span>
              <span className={`aum-check ${marcado ? "aum-check-on" : ""}`} aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12l6 6L20 7" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const controles = (
    <div className="aum-controles">
      <span className="aum-etiqueta">Aumento</span>
      <div className="aum-pct-fila">
        <button className="prod-ajuste-boton" onClick={() => setPct((v) => Math.max(-95, v - PASO_PCT))} aria-label="Cinco menos">
          -5
        </button>
        {pctBorrador === null ? (
          <button className="aum-pct" title="Escribir el porcentaje" onClick={() => setPctBorrador(String(pct))}>
            {pct > 0 ? "+" : ""}
            {pct} %
          </button>
        ) : (
          <input
            className="aum-pct aum-pct-input"
            autoFocus
            inputMode="decimal"
            value={pctBorrador}
            onChange={(e) => setPctBorrador(e.target.value)}
            onBlur={confirmarPct}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmarPct();
              if (e.key === "Escape") setPctBorrador(null);
            }}
            aria-label="Porcentaje"
          />
        )}
        <button className="prod-ajuste-boton" onClick={() => setPct((v) => v + PASO_PCT)} aria-label="Cinco más">
          +5
        </button>
      </div>
      <span className="aum-etiqueta">Redondeo</span>
      <div className="aum-redondeos">
        {REDONDEOS.map((r) => (
          <button
            key={r.id}
            className={`aum-redondeo ${redondeoId === r.id ? "aum-redondeo-activo" : ""}`}
            aria-pressed={redondeoId === r.id}
            onClick={() => setRedondeoId(r.id)}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="lamina-fondo" onClick={onCerrar}>
      <div className="lamina lamina-ancha aum" role="dialog" aria-label="Aumentar precios" onClick={(e) => e.stopPropagation()}>
        <div className="lamina-asa" />
        <div className="lamina-cabecera">
          <span className="lamina-titulo">Aumentar precios</span>
          <button className="lamina-cerrar" aria-label="Cerrar" onClick={onCerrar}>
            {IconoX}
          </button>
        </div>
        <div className="aum-cuerpo">
          {controles}
          {lista}
        </div>
        <div className="aum-pie">
          <button className="boton-principal aum-aplicar" disabled={!pctValido || afectados.length === 0} onClick={aplicar}>
            APLICAR A {afectados.length} PRODUCTO{afectados.length === 1 ? "" : "S"}
          </button>
        </div>
      </div>
    </div>
  );
}
