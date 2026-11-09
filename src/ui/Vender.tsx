import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AjustesContext } from "../ajustes";
import {
  crearAnulacion,
  crearVenta,
  formatearARS,
  montoPorMedio,
  pagoUnico,
  subtotalLinea,
  totalLineas,
  ventasVigentes,
  type Anulacion,
  type LineaVenta,
  type Pago,
  type Venta,
} from "../core";
import {
  agregarProducto,
  anulacionesDesde,
  buscarPorEAN,
  cajaAbierta,
  dispositivoId,
  guardarAnulacion,
  guardarVenta,
  inicializarDB,
  inicioDeHoyISO,
  listarProductos,
  todasLasVentas,
  ventasDesde,
  type CajaSesion,
  type Cliente,
} from "../db/db";
import { AltaRapida } from "./AltaRapida";
import { buscarProductos, type Producto } from "./catalogo";
import { ClientePicker } from "./ClientePicker";
import { Escaner } from "./Escaner";
import { ImagenProducto } from "./ImagenProducto";
import { exitoVenta } from "./sonidos";
import { parsearPesos } from "./util";
import "./Vender.css";

const DISPOSITIVO_ID = dispositivoId();

// EAN-8, UPC-A (12), EAN-13 y GTIN-14: solo dígitos. Nadie busca un
// producto por nombre tipeando 8 números seguidos.
const PARECE_CODIGO = /^\d{8,14}$/;

// Vista de la pantalla: vendiendo → pago (medios gigantes) → cobrada.
type Vista =
  | { tipo: "vender" }
  | { tipo: "pago" }
  | { tipo: "mixto" }
  | { tipo: "cobrada"; venta: Venta };

interface Props {
  irA?: (pestana: "vender" | "productos" | "caja" | "fiados" | "movimientos" | "panel") => void;
  nombreNegocio?: string;
}

// Texto del comprobante para mandar por WhatsApp (no es factura: es el
// detalle de lo que se llevó, como el papelito del cuaderno pero prolijo).
function textoComprobante(venta: Venta, negocio: string, pagos: string): string {
  const d = new Date(venta.fecha);
  const lineas = venta.lineas.map((l) => {
    const cantidad = l.gramos !== undefined ? `${l.gramos} g` : `x${l.cantidad}`;
    return `- ${l.nombre} ${cantidad}: ${formatearARS(subtotalLinea(l))}`;
  });
  return [
    `${negocio}`,
    `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
    "",
    ...lineas,
    "",
    `TOTAL: ${formatearARS(venta.total)}`,
    `Pago: ${pagos}`,
    "",
    "Enviado con Kioskeo",
  ].join("\n");
}

async function compartirComprobante(venta: Venta, negocio: string, pagos: string): Promise<void> {
  const texto = textoComprobante(venta, negocio, pagos);
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return;
    } catch {
      // canceló: no pasa nada
      return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
}

export function Vender({ irA, nombreNegocio = "Kioskeo" }: Props) {
  const ajustes = useContext(AjustesContext);
  const [consulta, setConsulta] = useState("");
  const [lineas, setLineas] = useState<LineaVenta[]>([]);
  const [vista, setVista] = useState<Vista>({ tipo: "vender" });
  const [ticketAbierto, setTicketAbierto] = useState(false);
  const [ventasDelDia, setVentasDelDia] = useState<Venta[]>([]);
  const [anulacionesDelDia, setAnulacionesDelDia] = useState<Anulacion[]>([]);
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [frecuentesIds, setFrecuentesIds] = useState<string[]>([]);
  const [ventasHistoricas, setVentasHistoricas] = useState<number | null>(null);
  const [caja, setCaja] = useState<CajaSesion | null>(null);
  const [eligiendoCliente, setEligiendoCliente] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [altaManual, setAltaManual] = useState(false);
  const [pasosOcultos, setPasosOcultos] = useState(() => localStorage.getItem("kioskeo-pasos-ocultos") === "1");
  const [eanDesconocido, setEanDesconocido] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [efectivoMixto, setEfectivoMixto] = useState("");
  const [pesando, setPesando] = useState<Producto | null>(null);
  const [gramosTexto, setGramosTexto] = useState("");
  const [pagaronTexto, setPagaronTexto] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const altaDesdeBuscador = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      await inicializarDB();
      const hoy = inicioDeHoyISO();
      const [productos, ventasHoy, anulacionesHoy, historicas, cajaHoy] =
        await Promise.all([
          listarProductos(),
          ventasDesde(hoy),
          anulacionesDesde(hoy),
          todasLasVentas(),
          cajaAbierta(),
        ]);
      if (!activo) return;
      setCatalogo(productos);
      setVentasDelDia(ventasHoy);
      setAnulacionesDelDia(anulacionesHoy);
      setCaja(cajaHoy ?? null);
      setVentasHistoricas(historicas.length);
      const conteo = new Map<string, number>();
      for (const v of historicas) {
        for (const l of v.lineas) {
          conteo.set(l.productoId, (conteo.get(l.productoId) ?? 0) + l.cantidad);
        }
      }
      setFrecuentesIds(
        [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
      );
    })();
    return () => {
      activo = false;
    };
  }, []);

  const total = totalLineas(lineas);
  const vigentesHoy = useMemo(
    () => ventasVigentes(ventasDelDia, anulacionesDelDia),
    [ventasDelDia, anulacionesDelDia],
  );

  // La búsqueda manda: escribiendo se filtra TODO el catálogo; sin escribir,
  // el mostrador muestra los más vendidos.
  const mosaicos = useMemo(() => {
    if (consulta.trim() !== "") return buscarProductos(consulta, catalogo).slice(0, 24);
    const porId = new Map(catalogo.map((p) => [p.id, p]));
    const top = frecuentesIds
      .map((id) => porId.get(id))
      .filter((p): p is Producto => Boolean(p));
    for (const p of catalogo) {
      if (top.length >= 12) break;
      if (!top.includes(p)) top.push(p);
    }
    return top.slice(0, 12);
  }, [consulta, catalogo, frecuentesIds]);

  const lineaDe = (productoId: string) =>
    lineas.find((l) => l.productoId === productoId);

  function avisar(mensaje: string) {
    setToast(mensaje);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }

  const agregar = useCallback((producto: Producto) => {
    if (producto.unidad === "peso") {
      setPesando(producto);
      setGramosTexto("100");
      setConsulta("");
      return;
    }
    setLineas((previas) => {
      const existente = previas.find((l) => l.productoId === producto.id);
      if (existente) {
        return previas.map((l) =>
          l.productoId === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [
        ...previas,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          precioUnitario: producto.precio,
        },
      ];
    });
    setConsulta("");
  }, []);

  function agregarPesado(gramos: number) {
    if (!pesando || !Number.isInteger(gramos) || gramos <= 0) return;
    const producto = pesando;
    setLineas((previas) => {
      const sinEste = previas.filter((l) => l.productoId !== producto.id);
      return [
        ...sinEste,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          precioUnitario: producto.precio,
          gramos,
        },
      ];
    });
    setPesando(null);
    setGramosTexto("");
  }

  function sumar(producto: Producto) {
    const linea = lineaDe(producto.id);
    if (producto.unidad === "peso") {
      if (linea?.gramos !== undefined) {
        setLineas((prev) =>
          prev.map((l) =>
            l === linea ? { ...l, gramos: (l.gramos ?? 0) + 50 } : l,
          ),
        );
      }
      return;
    }
    setLineas((prev) =>
      prev.map((l) =>
        l.productoId === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
      ),
    );
  }

  function restar(producto: Producto) {
    const linea = lineaDe(producto.id);
    if (!linea) return;
    if (linea.gramos !== undefined) {
      const g = linea.gramos - 50;
      setLineas((prev) =>
        g > 0
          ? prev.map((l) => (l === linea ? { ...l, gramos: g } : l))
          : prev.filter((l) => l !== linea),
      );
      return;
    }
    setLineas((prev) =>
      linea.cantidad > 1
        ? prev.map((l) => (l === linea ? { ...l, cantidad: l.cantidad - 1 } : l))
        : prev.filter((l) => l !== linea),
    );
  }

  async function codigoEscaneado(ean: string) {
    const producto =
      catalogo.find((p) => p.ean === ean) ?? (await buscarPorEAN(ean));
    if (producto) {
      agregar(producto);
      avisar(`✓ ${producto.nombre}`);
    } else {
      setEscaneando(false);
      setEanDesconocido(ean);
    }
  }

  // Un lector USB/bluetooth "tipea" el código en el buscador y manda Enter.
  // Código conocido: se agrega. Código nuevo: se abre el alta con el código
  // ya puesto. Texto común: se agrega el primer resultado, como siempre.
  function enterEnBuscador() {
    const q = consulta.trim();
    if (q === "") return;
    const porCodigo = catalogo.find((p) => p.ean === q);
    if (porCodigo) {
      agregar(porCodigo);
      return;
    }
    if (PARECE_CODIGO.test(q) && mosaicos.length === 0) {
      setConsulta("");
      altaDesdeBuscador.current = true;
      setEanDesconocido(q);
      return;
    }
    if (mosaicos.length > 0) agregar(mosaicos[0]);
  }

  // Tras un alta abierta desde el buscador, el foco vuelve ahí para que el
  // lector pueda seguir leyendo sin tocar la pantalla.
  function cerrarAltaPorCodigo() {
    setEanDesconocido(null);
    if (altaDesdeBuscador.current) {
      altaDesdeBuscador.current = false;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function guardarProductoNuevo(producto: Producto) {
    await agregarProducto(producto);
    setCatalogo((c) => [...c, producto]);
    agregar(producto);
    cerrarAltaPorCodigo();
    avisar(`✓ ${producto.nombre}`);
  }

  const cobrar = useCallback(
    async (pagos: Pago[], clienteId?: string) => {
      if (lineas.length === 0) return;
      const venta = crearVenta({
        id: crypto.randomUUID(),
        dispositivoId: DISPOSITIVO_ID,
        fecha: new Date().toISOString(),
        pagos,
        clienteId,
        lineas,
      });
      // Se persiste ANTES de la confirmación: la venta ya está a salvo.
      await guardarVenta(venta);
      exitoVenta();
      setVentasDelDia((v) => [...v, venta]);
      setVista({ tipo: "cobrada", venta });
      setEligiendoCliente(false);
      setEfectivoMixto("");
      setTicketAbierto(false);
      setLineas([]);
    },
    [lineas],
  );

  function cobrarMixto() {
    const efectivo = parsearPesos(efectivoMixto);
    if (efectivo === null || efectivo <= 0 || efectivo >= total) return;
    cobrar([
      { medio: "efectivo", monto: efectivo },
      { medio: "transferencia", monto: total - efectivo },
    ]);
  }

  async function corregir(venta: Venta) {
    const anulacion = crearAnulacion({
      id: crypto.randomUUID(),
      ventaId: venta.id,
      dispositivoId: DISPOSITIVO_ID,
      fecha: new Date().toISOString(),
      motivo: "corrección en el mostrador",
    });
    await guardarAnulacion(anulacion);
    setAnulacionesDelDia((a) => [...a, anulacion]);
    setLineas(venta.lineas.map((l) => ({ ...l })));
    setVista({ tipo: "vender" });
    setPagaronTexto("");
  }

  function nuevaVenta() {
    setConsulta("");
    setPagaronTexto("");
    setVista({ tipo: "vender" });
    inputRef.current?.focus();
  }

  // Atajos de teclado (escritorio): Enter agrega/cobra, Esc vacía, F2 escáner.
  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      const enHoja =
        eligiendoCliente || escaneando || altaManual || eanDesconocido !== null || pesando !== null;
      if (enHoja) return;
      if (e.key === "F2") {
        e.preventDefault();
        setEscaneando(true);
        return;
      }
      // Escribir (o pasar el lector) con el foco fuera del buscador lleva el
      // foco al buscador: la tecla y el resto del código caen ahí.
      if (vista.tipo === "vender" && e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activo = document.activeElement;
        const enCampo =
          activo instanceof HTMLInputElement ||
          activo instanceof HTMLTextAreaElement ||
          (activo instanceof HTMLElement && activo.isContentEditable);
        if (!enCampo) inputRef.current?.focus();
        return;
      }
      if (vista.tipo === "cobrada") {
        if (e.key === "Enter") nuevaVenta();
        return;
      }
      if (e.key === "Escape") {
        if (vista.tipo === "pago" || vista.tipo === "mixto") setVista({ tipo: "vender" });
        else if (lineas.length > 0) setLineas([]);
        return;
      }
      // Pantalla de pago: Enter o E efectivo, T transferencia, F fiado, M mixto.
      if (vista.tipo === "pago") {
        const k = e.key.toLowerCase();
        if (k === "enter" || k === "e") {
          e.preventDefault();
          cobrar(pagoUnico("efectivo", total));
        } else if (k === "t") {
          cobrar(pagoUnico("transferencia", total));
        } else if (k === "f" && ajustes.fiados) {
          setEligiendoCliente(true);
        } else if (k === "m") {
          setVista({ tipo: "mixto" });
        }
        return;
      }
      const enBuscador = document.activeElement === inputRef.current;
      if (
        e.key === "Enter" &&
        vista.tipo === "vender" &&
        lineas.length > 0 &&
        (!enBuscador || consulta.trim() === "")
      ) {
        setVista({ tipo: "pago" });
      }
    }
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, lineas, consulta, eligiendoCliente, escaneando, altaManual, eanDesconocido, pesando, total, ajustes.fiados]);

  function describirPagos(venta: Venta): string {
    const partes: string[] = [];
    const efectivo = montoPorMedio(venta, "efectivo");
    const transferencia = montoPorMedio(venta, "transferencia");
    const fiado = montoPorMedio(venta, "fiado");
    if (efectivo > 0) partes.push(`Efectivo ${formatearARS(efectivo)}`);
    if (transferencia > 0) partes.push(`Transferencia ${formatearARS(transferencia)}`);
    if (fiado > 0) partes.push(`Fiado ${formatearARS(fiado)}`);
    if (partes.length === 1) return partes[0].split(" $")[0];
    return partes.join(" + ");
  }

  const mixtoEfectivo = parsearPesos(efectivoMixto);
  const mixtoValido =
    mixtoEfectivo !== null && mixtoEfectivo > 0 && mixtoEfectivo < total;
  const gramosN = Number.isInteger(Number(gramosTexto)) ? Number(gramosTexto) : 0;

  // ---------- venta cobrada ----------
  if (vista.tipo === "cobrada") {
    const totalHoy = vigentesHoy.reduce((s, v) => s + v.total, 0);
    const cobradoEnEfectivo = montoPorMedio(vista.venta, "efectivo");
    const pagaron = parsearPesos(pagaronTexto);
    const vuelto =
      pagaron !== null && pagaron >= cobradoEnEfectivo
        ? pagaron - cobradoEnEfectivo
        : null;
    return (
      <div className="vender cobrada-pantalla">
        <div className="cobrada-check" aria-hidden>
          ✓
        </div>
        <p className="cobrada-titulo">Venta cobrada</p>
        <p className="cobrada-monto">{formatearARS(vista.venta.total)}</p>
        <p className="cobrada-medio">{describirPagos(vista.venta)}</p>

        {cobradoEnEfectivo > 0 && (
          <div className="vuelto">
            <div className="vuelto-billetes">
              {[500000, 1000000, 2000000].map((monto) => (
                <button key={monto} onClick={() => setPagaronTexto(String(monto / 100))}>
                  {formatearARS(monto)}
                </button>
              ))}
            </div>
            <label className="vuelto-campo">
              <span>¿Con cuánto te pagaron?</span>
              <input
                inputMode="decimal"
                placeholder="—"
                value={pagaronTexto}
                onChange={(e) => setPagaronTexto(e.target.value)}
                aria-label="Con cuánto pagaron"
              />
            </label>
            {vuelto !== null && (
              <p className={`vuelto-resultado ${vuelto === 0 ? "vuelto-justo" : ""}`}>
                {vuelto === 0 ? "Pago justo, sin vuelto" : `Vuelto: ${formatearARS(vuelto)}`}
              </p>
            )}
            {pagaron !== null && pagaron < cobradoEnEfectivo && (
              <p className="vuelto-resultado vuelto-falta">
                Te faltan {formatearARS(cobradoEnEfectivo - pagaron)}
              </p>
            )}
          </div>
        )}

        <button className="cobrar-boton" onClick={nuevaVenta}>
          NUEVA VENTA
        </button>
        <div className="cobrada-enlaces">
          <button className="cobrada-corregir" onClick={() => void compartirComprobante(vista.venta, nombreNegocio, describirPagos(vista.venta))}>
            Mandar comprobante
          </button>
          <button className="cobrada-corregir" onClick={() => corregir(vista.venta)}>
            Corregir esta venta
          </button>
        </div>
        <p className="cobrada-dia">
          Hoy: {vigentesHoy.length} venta{vigentesHoy.length === 1 ? "" : "s"} ·{" "}
          {formatearARS(totalHoy)}
        </p>
      </div>
    );
  }

  // ---------- pantalla de pago (medios gigantes) ----------
  if (vista.tipo === "pago" || vista.tipo === "mixto") {
    return (
      <div className="vender pago-pantalla">
        <button className="pago-volver" onClick={() => setVista({ tipo: "vender" })}>
          ← Volver
        </button>
        <p className="pago-total-etiqueta">Total a cobrar</p>
        <p className="pago-total">{formatearARS(total)}</p>

        {vista.tipo === "mixto" ? (
          <div className="mixto pago-mixto">
            <label className="mixto-campo">
              <span>¿Cuánto en efectivo?</span>
              <input
                autoFocus
                inputMode="decimal"
                placeholder="0"
                value={efectivoMixto}
                onChange={(e) => setEfectivoMixto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && cobrarMixto()}
                aria-label="Monto en efectivo"
              />
            </label>
            <p className="mixto-resto">
              {mixtoValido
                ? `Transferencia: ${formatearARS(total - (mixtoEfectivo ?? 0))}`
                : "El resto va por transferencia"}
            </p>
            <button className="cobrar-boton" disabled={!mixtoValido} onClick={cobrarMixto}>
              COBRAR MIXTO
            </button>
            <button className="pago-volver-chico" onClick={() => setVista({ tipo: "pago" })}>
              Elegir otro medio
            </button>
          </div>
        ) : (
          <div className={`pago-medios ${!ajustes.fiados ? "pago-medios-tres" : ""}`}>
            <button
              className="pago-medio pago-efectivo"
              onClick={() => cobrar(pagoUnico("efectivo", total))}
            >
              EFECTIVO
              <kbd className="atajo">Enter</kbd>
            </button>
            <button
              className="pago-medio"
              onClick={() => cobrar(pagoUnico("transferencia", total))}
            >
              TRANSFERENCIA
              <kbd className="atajo">T</kbd>
            </button>
            <button className="pago-medio" onClick={() => setVista({ tipo: "mixto" })}>
              MIXTO
            </button>
            {ajustes.fiados && (
              <button className="pago-medio" onClick={() => setEligiendoCliente(true)}>
                FIADO
                <kbd className="atajo">F</kbd>
              </button>
            )}
          </div>
        )}

        {eligiendoCliente && (
          <ClientePicker
            onElegir={(cliente: Cliente) => cobrar(pagoUnico("fiado", total), cliente.id)}
            onCerrar={() => setEligiendoCliente(false)}
          />
        )}
      </div>
    );
  }

  // ---------- mostrador (vender) ----------
  return (
    <div className="vender">
      {toast && <div className="escaner-toast">{toast}</div>}

      <header className="vender-cabecera">
        <div className="vender-fila-superior">
          <span className="vender-titulo">
            <button
              className="vender-logo"
              title="Ver el panel del negocio"
              aria-label="Ir al panel del negocio"
              onClick={() => irA?.("panel")}
            >
              K
            </button>
            <span className="vender-migaja">VENDER</span>
          </span>
          {caja ? (
            <span className="chip-verde">Caja abierta · {formatearARS(caja.apertura)}</span>
          ) : (
            <span className="chip-gris">Caja cerrada</span>
          )}
        </div>
        <div className="buscador">
          <div className="buscador-pastilla">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--salmon)" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4.2-4.2" />
            </svg>
            <input
              ref={inputRef}
              autoFocus
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => {
                // Enter con texto agrega y nada más: sin cortar la propagación,
                // el atajo global lo tomaba como "cobrar" y el Enter del lector
                // saltaba a la pantalla de pago (y el siguiente cobraba).
                if (e.key === "Enter" && consulta.trim() !== "") {
                  e.stopPropagation();
                  enterEnBuscador();
                }
              }}
              placeholder="Buscá un producto…"
              aria-label="Buscar producto"
            />
          </div>
          <button
            className="boton-escaner"
            title="Escanear código de barras (F2)"
            aria-label="Escanear código de barras"
            onClick={() => setEscaneando(true)}
          >
            <ScanIcon />
          </button>
        </div>
        {consulta.trim() === "" && catalogo.length > 0 && <p className="mosaicos-etiqueta">Los más vendidos</p>}
      </header>

      <main className="mosaicos" data-vacio={mosaicos.length === 0 || undefined}>
        {catalogo.length === 0 && consulta.trim() === "" ? (
          <div className="mostrador-vacio">
            <p className="mostrador-vacio-titulo">Tu mostrador está vacío</p>
            <p className="mostrador-vacio-sub">
              Cargá tus productos y en dos minutos estás cobrando. Elegí cómo:
            </p>
            <button className="boton-principal mostrador-vacio-boton" onClick={() => irA?.("productos")}>
              IMPORTAR MI EXCEL
            </button>
            <button className="mostrador-vacio-secundario" onClick={() => setEscaneando(true)}>
              Escanear con la cámara
            </button>
            <button className="mostrador-vacio-secundario" onClick={() => setAltaManual(true)}>
              Cargar uno a mano
            </button>
          </div>
        ) : mosaicos.length === 0 ? (
          <div className="mostrador-vacio mostrador-vacio-busqueda">
            <p className="mosaicos-nada">No hay nada con ese nombre</p>
            <button className="mostrador-vacio-secundario" onClick={() => setAltaManual(true)}>
              Cargarlo ahora
            </button>
          </div>
        ) : (
          <>
      {ventasHistoricas !== null &&
        !pasosOcultos &&
        catalogo.length > 0 &&
        (!caja || ventasHistoricas === 0) &&
        consulta.trim() === "" && (
          <div className="primeros-pasos primeros-pasos-inline">
            <div className="pasos-cabecera">
              <p className="pasos-titulo">Primeros pasos</p>
              <button
                className="pasos-ocultar"
                aria-label="Ocultar primeros pasos"
                onClick={() => {
                  localStorage.setItem("kioskeo-pasos-ocultos", "1");
                  setPasosOcultos(true);
                }}
              >
                Ocultar
              </button>
            </div>
            <div className={`paso ${catalogo.length > 0 ? "paso-listo" : ""}`}>
              <span className="paso-check" aria-hidden>
                {catalogo.length > 0 ? "✓" : "1"}
              </span>
              <span className="paso-texto">Cargá tus productos</span>
              {catalogo.length === 0 && (
                <span className="paso-acciones">
                  <button onClick={() => irA?.("productos")}>Importar</button>
                  <button onClick={() => setEscaneando(true)}>Escanear</button>
                </span>
              )}
            </div>
            <div className={`paso ${caja ? "paso-listo" : ""}`}>
              <span className="paso-check" aria-hidden>
                {caja ? "✓" : "2"}
              </span>
              <span className="paso-texto">Abrí la caja</span>
              {!caja && (
                <span className="paso-acciones">
                  <button onClick={() => irA?.("caja")}>Abrir</button>
                </span>
              )}
            </div>
            <div className={`paso ${(ventasHistoricas ?? 0) > 0 ? "paso-listo" : ""}`}>
              <span className="paso-check" aria-hidden>
                {(ventasHistoricas ?? 0) > 0 ? "✓" : "3"}
              </span>
              <span className="paso-texto">Cobrá tu primera venta</span>
            </div>
          </div>
        )}
          <div className="mosaicos-grilla">
            {mosaicos.map((p) => {
              const linea = lineaDe(p.id);
              const elegido = Boolean(linea);
              return (
                <div
                  key={p.id}
                  className={`mosaico ${elegido ? "mosaico-elegido" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-noadd]")) return;
                    agregar(p);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && agregar(p)}
                >
                  <div className="mosaico-imagen">
                    <ImagenProducto nombre={p.nombre} imagen={p.imagen} tam={108} />
                  </div>
                  <span className="mosaico-nombre">{p.nombre}</span>
                  <span className="mosaico-precio">
                    {formatearARS(p.precio)}
                    {p.unidad === "peso" && <i> /100g</i>}
                  </span>
                  {elegido && linea && (
                    <div className="mosaico-controles" data-noadd>
                      <button aria-label={`Restar ${p.nombre}`} onClick={() => restar(p)}>
                        −
                      </button>
                      <span>{formatearARS(subtotalLinea(linea))}</span>
                      <button
                        className="mosaico-mas"
                        aria-label={`Sumar ${p.nombre}`}
                        onClick={() => sumar(p)}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {elegido && linea && (
                    <span className="mosaico-globo" aria-hidden>
                      {linea.gramos !== undefined ? `${linea.gramos}g` : `×${linea.cantidad}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </main>

      <footer className="pie-oscuro">
        <button
          className="pie-ticket-toggle"
          onClick={() => lineas.length > 0 && setTicketAbierto((a) => !a)}
        >
          {lineas.length === 0
            ? "Ticket vacío"
            : `${lineas.length} ítem${lineas.length === 1 ? "" : "s"} · ${ticketAbierto ? "ocultar detalle ▾" : "ver qué se lleva ▴"}`}
        </button>
        {lineas.length > 0 && (
          <ul className={`pie-ticket-lineas ${ticketAbierto ? "" : "pie-ticket-cerrado"}`}>
            {lineas.map((l) => (
              <li key={l.productoId + (l.gramos !== undefined ? "-g" : "")}>
                <span className="pie-linea-detalle">
                  {l.gramos !== undefined ? `${l.gramos}g` : `×${l.cantidad}`}
                </span>
                <span className="pie-linea-nombre">{l.nombre}</span>
                <span className="pie-linea-monto">{formatearARS(subtotalLinea(l))}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="pie-total">
          <span>TOTAL</span>
          <strong>{formatearARS(total)}</strong>
        </div>
        <button
          className="cobrar-boton"
          disabled={lineas.length === 0}
          onClick={() => setVista({ tipo: "pago" })}
        >
          COBRAR
        </button>
      </footer>

      {pesando && (
        <div className="hoja-fondo" role="dialog" aria-label="Cuántos gramos">
          <div className="hoja">
            <p className="hoja-titulo">{pesando.nombre}</p>
            <p className="hoja-nota">{formatearARS(pesando.precio)} cada 100g</p>
            <div className="gramos-rapidos">
              {[50, 100, 150, 200, 300, 500].map((g) => (
                <button
                  key={g}
                  className={gramosN === g ? "gramo-activo" : ""}
                  onClick={() => setGramosTexto(String(g))}
                >
                  {g}g
                </button>
              ))}
            </div>
            <input
              className="campo"
              inputMode="numeric"
              placeholder="Otros gramos (ej: 112)"
              value={gramosTexto}
              onChange={(e) => setGramosTexto(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && agregarPesado(gramosN)}
              aria-label="Gramos"
            />
            <button
              className="cobrar-boton"
              disabled={gramosN <= 0}
              onClick={() => agregarPesado(gramosN)}
            >
              {gramosN > 0
                ? `AGREGAR ${gramosN}g — ${formatearARS(
                    subtotalLinea({
                      productoId: pesando.id,
                      nombre: pesando.nombre,
                      cantidad: 1,
                      precioUnitario: pesando.precio,
                      gramos: gramosN,
                    }),
                  )}`
                : "AGREGAR"}
            </button>
            <button className="hoja-cancelar" onClick={() => setPesando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {escaneando && (
        <Escaner onDetectado={codigoEscaneado} onCerrar={() => setEscaneando(false)} />
      )}
      {eanDesconocido && (
        <AltaRapida
          ean={eanDesconocido}
          onGuardar={guardarProductoNuevo}
          onCancelar={cerrarAltaPorCodigo}
        />
      )}
      {altaManual && (
        <AltaRapida
          onGuardar={(p) => {
            setAltaManual(false);
            guardarProductoNuevo(p);
          }}
          onCancelar={() => setAltaManual(false)}
        />
      )}
    </div>
  );
}

function ScanIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8" />
      <path d="M20 3h3.5A1.5 1.5 0 0 1 25 4.5V8" />
      <path d="M25 20v3.5a1.5 1.5 0 0 1-1.5 1.5H20" />
      <path d="M8 25H4.5A1.5 1.5 0 0 1 3 23.5V20" />
      <path d="M8 10v8M12 10v8M16 10v8M20 10v8" />
    </svg>
  );
}
