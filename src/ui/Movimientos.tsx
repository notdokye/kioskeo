import { useContext, useEffect, useMemo, useState } from "react";
import { AjustesContext } from "../ajustes";
import {
  crearAnulacion,
  formatearARS,
  montoPorMedio,
  type Anulacion,
  type MovimientoFiado,
  type Venta,
} from "../core";
import {
  dispositivoId,
  guardarAnulacion,
  listarClientes,
  listarPagosFiado,
  todasLasAnulaciones,
  todasLasCajas,
  todasLasVentas,
  type CajaSesion,
  type Cliente,
} from "../db/db";
import { describirTardanza, semaforoTardanza } from "../empleados";
import { estaDesbloqueado, hayPin } from "../pin";
import { PinHoja } from "./PinHoja";
import { horaCorta, resumenLineas } from "./util";
import "./Pantallas.css";

// Movimientos: TODO lo que pasó, en orden, con la información a mano:
// a qué hora, cuánto, y en qué medio (efectivo / transferencia / fiado).
// Ventas, anulaciones, aperturas y cierres de turno, retiros, ingresos,
// pagos de fiado. Sin ocultar nada.

type Rango = "hoy" | "semana" | "mes";

interface Evento {
  fecha: string;
  hora: string;
  titulo: string;
  detalle?: string;
  monto?: number;
  signo?: "mas" | "menos" | "neutro";
  pagos?: { medio: string; monto: number }[];
  anulada?: boolean;
  semaforo?: "verde" | "amarillo" | "rojo";
  /** La venta detrás del evento (para poder anularla). */
  venta?: Venta;
}

function inicioDeRango(rango: Rango): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (rango === "semana") d.setDate(d.getDate() - 6);
  if (rango === "mes") d.setDate(d.getDate() - 29);
  return d.toISOString();
}

export function Movimientos() {
  const ajustes = useContext(AjustesContext);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [anulaciones, setAnulaciones] = useState<Anulacion[]>([]);
  const [cajas, setCajas] = useState<CajaSesion[]>([]);
  const [pagos, setPagos] = useState<MovimientoFiado[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [rango, setRango] = useState<Rango>("hoy");
  const [anulando, setAnulando] = useState<Venta | null>(null);
  const [pidiendoPin, setPidiendoPin] = useState<Venta | null>(null);
  const [motivo, setMotivo] = useState("");

  async function cargar() {
    const [v, a, c, p, cl] = await Promise.all([
      todasLasVentas(),
      todasLasAnulaciones(),
      todasLasCajas(),
      listarPagosFiado(),
      listarClientes(),
    ]);
    setVentas(v);
    setAnulaciones(a);
    setCajas(c);
    setPagos(p);
    setClientes(cl);
  }

  useEffect(() => {
    cargar();
  }, []);

  function pedirAnular(venta: Venta) {
    if (hayPin() && !estaDesbloqueado()) setPidiendoPin(venta);
    else setAnulando(venta);
  }

  async function anular(venta: Venta) {
    await guardarAnulacion(
      crearAnulacion({
        id: crypto.randomUUID(),
        ventaId: venta.id,
        dispositivoId: dispositivoId(),
        fecha: new Date().toISOString(),
        motivo: motivo.trim() || "anulada desde Movimientos",
      }),
    );
    setAnulando(null);
    setMotivo("");
    await cargar();
  }

  const desde = inicioDeRango(rango);
  const idsAnuladas = useMemo(() => new Set(anulaciones.map((a) => a.ventaId)), [anulaciones]);
  const nombreCliente = (id?: string) => clientes.find((c) => c.id === id)?.nombre ?? "cliente";

  const eventos = useMemo(() => {
    const lista: Evento[] = [];
    for (const v of ventas) {
      if (v.fecha < desde) continue;
      lista.push({
        fecha: v.fecha,
        hora: horaCorta(v.fecha),
        titulo: resumenLineas(v, 4),
        detalle: v.clienteId && montoPorMedio(v, "fiado") > 0 ? `fiado a ${nombreCliente(v.clienteId)}` : undefined,
        monto: v.total,
        signo: "mas",
        pagos: v.pagos.map((p) => ({ medio: p.medio, monto: p.monto })),
        anulada: idsAnuladas.has(v.id),
        venta: v,
      });
    }
    for (const a of anulaciones) {
      if (a.fecha < desde) continue;
      const venta = ventas.find((v) => v.id === a.ventaId);
      lista.push({
        fecha: a.fecha,
        hora: horaCorta(a.fecha),
        titulo: "Venta anulada",
        detalle: venta ? `${resumenLineas(venta, 3)} · ${a.motivo ?? ""}` : a.motivo,
        monto: venta?.total,
        signo: "menos",
      });
    }
    for (const c of cajas) {
      if (c.abiertaEn >= desde) {
        const sem = c.empleadoNombre ? semaforoTardanza(c.tardanzaMin ?? null) : undefined;
        lista.push({
          fecha: c.abiertaEn,
          hora: horaCorta(c.abiertaEn),
          titulo: c.empleadoNombre ? `${c.empleadoNombre} inició su turno` : "Apertura de caja",
          detalle: `arrancó con ${formatearARS(c.apertura)}${c.empleadoNombre ? ` · ${describirTardanza(c.tardanzaMin ?? null)}` : ""}`,
          signo: "neutro",
          semaforo: sem,
        });
      }
      if (c.cerradaEn && c.cerradaEn >= desde) {
        const dif = c.diferencia ?? 0;
        lista.push({
          fecha: c.cerradaEn,
          hora: horaCorta(c.cerradaEn),
          titulo: c.empleadoNombre ? `${c.empleadoNombre} cerró su turno` : "Cierre de caja",
          detalle: `esperado ${formatearARS(c.esperado ?? 0)} · contado ${formatearARS(c.contado ?? 0)}${dif === 0 ? " · cerró bien" : ""}`,
          monto: dif === 0 ? undefined : dif,
          signo: dif < 0 ? "menos" : dif > 0 ? "mas" : "neutro",
        });
      }
      for (const m of c.movimientos) {
        // los movimientos no tienen hora propia: van con la apertura del turno
        if (c.abiertaEn < desde) continue;
        lista.push({
          fecha: c.abiertaEn,
          hora: horaCorta(c.abiertaEn),
          titulo: m.tipo === "retiro" ? "Retiro de plata" : "Ingreso de plata",
          detalle: m.motivo,
          monto: m.monto,
          signo: m.tipo === "retiro" ? "menos" : "mas",
        });
      }
    }
    for (const p of pagos) {
      if (p.fecha < desde) continue;
      lista.push({
        fecha: p.fecha,
        hora: horaCorta(p.fecha),
        titulo: `${nombreCliente(p.clienteId)} pagó fiado`,
        monto: p.monto,
        signo: "mas",
      });
    }
    return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ventas, anulaciones, cajas, pagos, clientes, desde, idsAnuladas]);

  // Totales del rango (solo ventas vigentes)
  const vigentes = ventas.filter((v) => v.fecha >= desde && !idsAnuladas.has(v.id));
  const efectivo = vigentes.reduce((s, v) => s + montoPorMedio(v, "efectivo"), 0);
  const transferencia = vigentes.reduce((s, v) => s + montoPorMedio(v, "transferencia"), 0);
  const fiado = vigentes.reduce((s, v) => s + montoPorMedio(v, "fiado"), 0);

  // Agrupado por día
  const porDia = useMemo(() => {
    const grupos = new Map<string, Evento[]>();
    for (const e of eventos) {
      const clave = new Date(e.fecha).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(e);
    }
    return [...grupos.entries()];
  }, [eventos]);

  return (
    <div className="pantalla pantalla-ancha">
      <header className="encabezado">
        <span className="migaja">Movimientos · {eventos.length}</span>
        <div className="filtros">
          {(["hoy", "semana", "mes"] as Rango[]).map((r) => (
            <button key={r} className={`filtro ${rango === r ? "filtro-activo" : ""}`} onClick={() => setRango(r)}>
              {r === "hoy" ? "Hoy" : r === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </header>

      <div className="kpis" style={{ gridTemplateColumns: `repeat(${ajustes.fiados ? 3 : 2}, 1fr)` }}>
        <div className="kpi kpi-grande">
          <span className="kpi-etiqueta">Efectivo</span>
          <span className="kpi-valor positivo">{formatearARS(efectivo)}</span>
        </div>
        <div className="kpi kpi-grande">
          <span className="kpi-etiqueta">Transferencias</span>
          <span className="kpi-valor" style={{ color: "#1a4fb5" }}>{formatearARS(transferencia)}</span>
        </div>
        {ajustes.fiados && (
          <div className="kpi kpi-grande">
            <span className="kpi-etiqueta">Fiado</span>
            <span className="kpi-valor negativo">{formatearARS(fiado)}</span>
          </div>
        )}
      </div>

      <section className="tarjeta">
        {eventos.length === 0 ? (
          <p className="vacio">Todavía no hay movimientos en este período.</p>
        ) : (
          porDia.map(([dia, lista]) => (
            <div key={dia}>
              <p className="mov-dia">{dia}</p>
              {lista.map((e, i) => (
                <div key={i} className={`mov-fila ${e.anulada ? "mov-anulada" : ""}`}>
                  <span className="mov-hora">{e.hora}</span>
                  <span className="mov-titulo">
                    {e.semaforo ? (
                      <span className={`semaforo semaforo-${e.semaforo}`} style={{ marginRight: 6 }}>{e.titulo}</span>
                    ) : (
                      e.titulo
                    )}
                    {e.anulada && <span className="chip-anulada" style={{ marginLeft: 8 }}>anulada</span>}
                    {e.venta && !e.anulada && (
                      <button className="mov-anular" onClick={() => pedirAnular(e.venta!)}>
                        Anular
                      </button>
                    )}
                    {(e.detalle || e.pagos) && (
                      <span className="mov-detalle">
                        {e.detalle}
                        {e.pagos && (
                          <span className="mov-pagos" style={{ marginLeft: e.detalle ? 8 : 0 }}>
                            {e.pagos.map((p, j) => (
                              <span key={j} className={`mov-pago mov-pago-${p.medio}`}>
                                {p.medio === "efectivo" ? "Efectivo" : p.medio === "transferencia" ? "Transf." : "Fiado"} {formatearARS(p.monto)}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className={`mov-monto ${e.signo === "menos" ? "negativo" : e.signo === "mas" ? "" : ""}`}>
                    {e.monto !== undefined && (e.signo === "menos" ? "− " : "") + formatearARS(Math.abs(e.monto))}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      {pidiendoPin && (
        <PinHoja
          modo="verificar"
          onOk={() => {
            setAnulando(pidiendoPin);
            setPidiendoPin(null);
          }}
          onCancelar={() => setPidiendoPin(null)}
        />
      )}

      {anulando && (
        <div className="hoja-fondo" role="dialog" aria-label="Anular venta">
          <div className="hoja">
            <p className="hoja-titulo">¿Estás seguro?</p>
            <p className="hoja-nota">
              Vas a anular la venta de <strong>{resumenLineas(anulando, 4)}</strong> por{" "}
              <strong>{formatearARS(anulando.total)}</strong> ({horaCorta(anulando.fecha)}). Queda tachada,
              sale de todos los totales y el stock vuelve. No se puede deshacer.
            </p>
            <input
              className="campo"
              placeholder="Motivo (opcional): fue una prueba, se equivocó…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-label="Motivo"
            />
            <div className="acciones-fila">
              <button className="hoja-cancelar" onClick={() => setAnulando(null)}>
                No, dejarla
              </button>
              <button className="boton-principal" onClick={() => void anular(anulando)}>
                SÍ, ANULAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
