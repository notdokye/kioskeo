import { useContext, useEffect, useMemo, useState } from "react";
import { AjustesContext } from "../ajustes";
import {
  deudasDesdeVentas,
  formatearARS,
  margenPorcentaje,
  montoPorMedio,
  saldosPorCliente,
  ventasVigentes,
  type Anulacion,
  type MovimientoFiado,
  type Venta,
} from "../core";
import {
  listarPagosFiado,
  listarProductos,
  todasLasAnulaciones,
  todasLasCajas,
  todasLasVentas,
  inicioDeHoyISO,
  type CajaSesion,
} from "../db/db";
import { describirTardanza, semaforoTardanza } from "../empleados";
import type { Producto } from "./catalogo";
import { describirVencimiento, type Resumen } from "../suscripcion";
import { EstadoSyncChip } from "./EstadoSync";
import { estaInstalada, Instalar } from "./Instalar";
import { ImagenProducto } from "./ImagenProducto";
import { etiquetaMedio, horaCorta, resumenLineas } from "./util";
import "./Pantallas.css";

interface Props {
  nombreNegocio: string;
  suscripcion: Resumen;
  onAjustes: () => void;
  onSalir: () => void;
}

type Rango = "hoy" | "semana" | "mes";

function inicioDeRango(rango: Rango): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (rango === "semana") d.setDate(d.getDate() - 6);
  if (rango === "mes") d.setDate(d.getDate() - 29);
  return d.toISOString();
}

export function Panel({ nombreNegocio, suscripcion, onAjustes, onSalir }: Props) {
  const [instalarOculto, setInstalarOculto] = useState(localStorage.getItem("kioskeo-instalar-despues") === "1");
  const ajustes = useContext(AjustesContext);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [anulaciones, setAnulaciones] = useState<Anulacion[]>([]);
  const [pagosFiado, setPagosFiado] = useState<MovimientoFiado[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [turnosHoy, setTurnosHoy] = useState<CajaSesion[]>([]);
  const [rango, setRango] = useState<Rango>("hoy");

  useEffect(() => {
    (async () => {
      const [v, a, pf, p, cajas] = await Promise.all([
        todasLasVentas(),
        todasLasAnulaciones(),
        listarPagosFiado(),
        listarProductos(),
        todasLasCajas(),
      ]);
      setVentas(v);
      setAnulaciones(a);
      setPagosFiado(pf);
      setProductos(p);
      const hoy = inicioDeHoyISO();
      setTurnosHoy(cajas.filter((c) => c.abiertaEn >= hoy && c.empleadoNombre));
    })();
  }, []);

  const desde = inicioDeRango(rango);
  const delRango = useMemo(
    () => ventas.filter((v) => v.fecha >= desde),
    [ventas, desde],
  );
  const vigentes = useMemo(
    () => ventasVigentes(delRango, anulaciones),
    [delRango, anulaciones],
  );

  const total = vigentes.reduce((s, v) => s + v.total, 0);
  const efectivo = vigentes.reduce((s, v) => s + montoPorMedio(v, "efectivo"), 0);
  const transferencia = vigentes.reduce(
    (s, v) => s + montoPorMedio(v, "transferencia"),
    0,
  );
  const fiadoRango = vigentes.reduce((s, v) => s + montoPorMedio(v, "fiado"), 0);

  const idsAnuladas = useMemo(
    () => new Set(anulaciones.map((a) => a.ventaId)),
    [anulaciones],
  );
  const anuladas = delRango.filter((v) => idsAnuladas.has(v.id));

  const fiadoPendiente = useMemo(() => {
    const movimientos = [
      ...deudasDesdeVentas(ventasVigentes(ventas, anulaciones)),
      ...pagosFiado,
    ];
    return [...saldosPorCliente(movimientos).values()]
      .filter((s) => s > 0)
      .reduce((a, b) => a + b, 0);
  }, [ventas, anulaciones, pagosFiado]);

  // Barras de 8 a 22 h (la vida real de un kiosco).
  const porHora = useMemo(() => {
    const horas = Array.from({ length: 15 }, (_, i) => i + 8);
    const montos = new Map(horas.map((h) => [h, 0]));
    for (const v of vigentes) {
      const h = new Date(v.fecha).getHours();
      if (montos.has(h)) montos.set(h, (montos.get(h) ?? 0) + v.total);
    }
    const maximo = Math.max(1, ...montos.values());
    return horas.map((h) => ({
      hora: h,
      monto: montos.get(h) ?? 0,
      altura: ((montos.get(h) ?? 0) / maximo) * 100,
    }));
  }, [vigentes]);

  const topProductos = useMemo(() => {
    const porProducto = new Map<string, { unidades: number; monto: number }>();
    for (const v of vigentes) {
      for (const l of v.lineas) {
        const previo = porProducto.get(l.nombre) ?? { unidades: 0, monto: 0 };
        porProducto.set(l.nombre, {
          unidades: previo.unidades + l.cantidad,
          monto: previo.monto + l.cantidad * l.precioUnitario,
        });
      }
    }
    return [...porProducto.entries()].sort((a, b) => b[1].monto - a[1].monto).slice(0, 5);
  }, [vigentes]);

  const ultimas = useMemo(
    () => [...delRango].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8),
    [delRango],
  );

  // --- Insights amigables: el negocio contado en criollo ---

  const insights = useMemo(() => {
    const porId = new Map(productos.map((p) => [p.id, p]));

    // Ventas por producto en el rango
    const acumulado = new Map<string, { unidades: number; monto: number }>();
    for (const v of vigentes) {
      for (const l of v.lineas) {
        const previo = acumulado.get(l.productoId) ?? { unidades: 0, monto: 0 };
        acumulado.set(l.productoId, {
          unidades: previo.unidades + l.cantidad,
          monto: previo.monto + l.cantidad * l.precioUnitario,
        });
      }
    }
    const vendidos = [...acumulado.entries()]
      .map(([id, datos]) => ({ producto: porId.get(id), ...datos }))
      .filter((x): x is { producto: Producto; unidades: number; monto: number } =>
        Boolean(x.producto),
      );

    const estrella = [...vendidos].sort((a, b) => b.unidades - a.unidades)[0];
    const motor = [...vendidos].sort((a, b) => b.monto - a.monto)[0];

    // Márgenes: solo entre lo vendido en el rango que tenga costo cargado
    const conMargen = vendidos
      .map((x) => ({
        ...x,
        margen:
          x.producto.costo !== undefined
            ? margenPorcentaje(x.producto.precio, x.producto.costo)
            : null,
      }))
      .filter((x): x is typeof x & { margen: number } => x.margen !== null)
      .sort((a, b) => b.margen - a.margen);
    const mejorMargen = conMargen[0];
    const peorMargen =
      conMargen.length >= 2 ? conMargen[conMargen.length - 1] : undefined;

    // Hora pico del rango
    const pico = [...porHora].sort((a, b) => b.monto - a.monto)[0];

    const ticketPromedio =
      vigentes.length > 0 ? Math.round(total / vigentes.length) : 0;

    // Comparación con el período anterior de igual tamaño
    const inicioActual = new Date(desde).getTime();
    const largo =
      rango === "hoy" ? 86400000 : rango === "semana" ? 7 * 86400000 : 30 * 86400000;
    const desdePrevio = new Date(inicioActual - largo).toISOString();
    const previas = ventasVigentes(
      ventas.filter((v) => v.fecha >= desdePrevio && v.fecha < desde),
      anulaciones,
    );
    const totalPrevio = previas.reduce((s, v) => s + v.total, 0);
    const variacion =
      totalPrevio > 0 ? ((total - totalPrevio) / totalPrevio) * 100 : null;

    return { estrella, motor, mejorMargen, peorMargen, pico, ticketPromedio, variacion };
  }, [vigentes, productos, porHora, total, ventas, anulaciones, desde, rango]);

  const etiquetaPrevio =
    rango === "hoy" ? "ayer" : rango === "semana" ? "la semana pasada" : "el mes pasado";

  return (
    <div className="pantalla pantalla-ancha">
      <header className="encabezado">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="migaja">Panel · {nombreNegocio}</span>
          <EstadoSyncChip />
          <button className="panel-tuerca" title="Ajustes" aria-label="Ajustes" onClick={onAjustes}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
        </div>
        <div className="filtros">
          {(["hoy", "semana", "mes"] as Rango[]).map((r) => (
            <button
              key={r}
              className={`filtro ${rango === r ? "filtro-activo" : ""}`}
              onClick={() => setRango(r)}
            >
              {r === "hoy" ? "Hoy" : r === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </header>

      {(suscripcion.estado === "por_vencer" || suscripcion.estado === "gracia" || (suscripcion.estado === "activa" && suscripcion.prueba)) && (
        <button className={`sus-banner sus-banner-${suscripcion.estado}`} onClick={onAjustes}>
          <strong>
            {suscripcion.estado === "activa"
              ? `Te quedan ${suscripcion.dias} días de prueba gratis`
              : suscripcion.estado === "por_vencer"
                ? suscripcion.dias === 0
                  ? `${suscripcion.prueba ? "Tu prueba" : "Tu plan"} vence hoy`
                  : `${suscripcion.prueba ? "Tu prueba" : "Tu plan"} vence en ${suscripcion.dias} día${suscripcion.dias === 1 ? "" : "s"}`
                : `Venció el ${suscripcion.venceEl ? describirVencimiento(suscripcion.venceEl) : ""} · ${suscripcion.dias + 3} día${suscripcion.dias + 3 === 1 ? "" : "s"} para renovar`}
          </strong>
          <span>{suscripcion.estado === "activa" ? "Ver plan" : "Renovar"}</span>
        </button>
      )}

      {!instalarOculto && !estaInstalada() && (
        <Instalar
          compacto
          onDespues={() => {
            localStorage.setItem("kioskeo-instalar-despues", "1");
            setInstalarOculto(true);
          }}
        />
      )}

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-etiqueta">Vendido</span>
          <span className="kpi-valor" style={{ color: "var(--salmon-presionado)" }}>
            {formatearARS(total)}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-etiqueta">Ventas</span>
          <span className="kpi-valor">{vigentes.length}</span>
        </div>
        <div className="kpi">
          <span className="kpi-etiqueta">Efectivo</span>
          <span className="kpi-valor">{formatearARS(efectivo)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-etiqueta">Transferencias</span>
          <span className="kpi-valor">{formatearARS(transferencia)}</span>
        </div>
        {ajustes.fiados && (
          <div className="kpi">
            <span className="kpi-etiqueta">Fiado</span>
            <span className="kpi-valor">{formatearARS(fiadoRango)}</span>
          </div>
        )}
        {ajustes.fiados && (
          <div className="kpi kpi-invertido">
            <span className="kpi-etiqueta">Fiado pendiente</span>
            <span className="kpi-valor">{formatearARS(fiadoPendiente)}</span>
          </div>
        )}
      </div>

      {turnosHoy.length > 0 && (
        <section className="tarjeta">
          <p className="tarjeta-etiqueta">Turnos de hoy</p>
          <div className="tabla">
            {turnosHoy.map((c) => {
              const sem = semaforoTardanza(c.tardanzaMin ?? null);
              const tarde = (c.tardanzaMin ?? 0) > 20;
              return (
                <div key={c.id} className="tabla-fila" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span className="tabla-principal">
                    <span className={`semaforo semaforo-${sem}`}>
                      {c.empleadoNombre} inició su turno a las {horaCorta(c.abiertaEn)}
                    </span>
                    <span className="tabla-detalle">{describirTardanza(c.tardanzaMin ?? null)}{c.cerradaEn && ` · cerró ${horaCorta(c.cerradaEn)}`}</span>
                    {tarde && (
                      <span className={`aviso-demora ${sem === "rojo" ? "aviso-demora-rojo" : ""}`} style={{ display: "block", marginTop: 8 }}>
                        ¡Pueden haber ventas en el tiempo de demora, prestá atención a esto!
                      </span>
                    )}
                  </span>
                  <span className="tabla-monto">{c.diferencia === undefined ? "" : c.diferencia === 0 ? "cerró bien" : formatearARS(c.diferencia)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {ajustes.secretos && vigentes.length > 0 && (
        <>
          {insights.variacion !== null && (
            <div
              className={`insight-banner ${insights.variacion >= 0 ? "insight-arriba" : "insight-abajo"}`}
            >
              {insights.variacion >= 0 ? "Vas " : "Venís "}
              <strong>
                {Math.abs(Math.round(insights.variacion))}%{" "}
                {insights.variacion >= 0 ? "arriba" : "abajo"}
              </strong>{" "}
              de {etiquetaPrevio}
            </div>
          )}

          <div className="insights">
            {insights.estrella && (
              <div className="insight">
                <ImagenProducto
                  nombre={insights.estrella.producto.nombre}
                  imagen={insights.estrella.producto.imagen}
                  tam={44}
                />
                <div className="insight-textos">
                  <span className="insight-etiqueta">Tu producto estrella</span>
                  <span className="insight-valor">{insights.estrella.producto.nombre}</span>
                  <span className="insight-detalle">
                    se vendió {insights.estrella.unidades}{" "}
                    {insights.estrella.unidades === 1 ? "vez" : "veces"}
                  </span>
                </div>
              </div>
            )}

            {insights.motor && (
              <div className="insight">
                <ImagenProducto
                  nombre={insights.motor.producto.nombre}
                  imagen={insights.motor.producto.imagen}
                  tam={44}
                />
                <div className="insight-textos">
                  <span className="insight-etiqueta">El que más plata trae</span>
                  <span className="insight-valor">{insights.motor.producto.nombre}</span>
                  <span className="insight-detalle">
                    {formatearARS(insights.motor.monto)} en este período
                  </span>
                </div>
              </div>
            )}

            {insights.pico && insights.pico.monto > 0 && (
              <div className="insight">
                <span className="insight-icono" aria-hidden>
                  {insights.pico.hora}h
                </span>
                <div className="insight-textos">
                  <span className="insight-etiqueta">Tu hora pico</span>
                  <span className="insight-valor">
                    {insights.pico.hora}:00 a {insights.pico.hora + 1}:00
                  </span>
                  <span className="insight-detalle">
                    {formatearARS(insights.pico.monto)} vendidos en esa hora
                  </span>
                </div>
              </div>
            )}

            {insights.ticketPromedio > 0 && (
              <div className="insight">
                <span className="insight-icono" aria-hidden>
                  Ø
                </span>
                <div className="insight-textos">
                  <span className="insight-etiqueta">Ticket promedio</span>
                  <span className="insight-valor">
                    {formatearARS(insights.ticketPromedio)}
                  </span>
                  <span className="insight-detalle">por cada venta</span>
                </div>
              </div>
            )}

            {insights.mejorMargen && (
              <div className="insight insight-verde">
                <ImagenProducto
                  nombre={insights.mejorMargen.producto.nombre}
                  imagen={insights.mejorMargen.producto.imagen}
                  tam={44}
                />
                <div className="insight-textos">
                  <span className="insight-etiqueta">El que más margen te deja</span>
                  <span className="insight-valor">
                    {insights.mejorMargen.producto.nombre}
                  </span>
                  <span className="insight-detalle">
                    {Math.round(insights.mejorMargen.margen)}% de ganancia
                  </span>
                </div>
              </div>
            )}

            {insights.peorMargen && (
              <div className="insight insight-alerta">
                <ImagenProducto
                  nombre={insights.peorMargen.producto.nombre}
                  imagen={insights.peorMargen.producto.imagen}
                  tam={44}
                />
                <div className="insight-textos">
                  <span className="insight-etiqueta">Para revisar el precio</span>
                  <span className="insight-valor">
                    {insights.peorMargen.producto.nombre}
                  </span>
                  <span className="insight-detalle">
                    solo {Math.round(insights.peorMargen.margen)}% de margen
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="paneles-2">
        <section className="tarjeta">
          <p className="tarjeta-etiqueta">Ventas por hora</p>
          <div className="chart-horas" role="img" aria-label="Ventas por hora del día">
            {porHora.map((b) => (
              <div key={b.hora} className="chart-col">
                <div
                  className={`chart-barra ${b.monto > 0 ? "chart-barra-activa" : ""}`}
                  style={{ height: `${Math.max(b.altura, 3)}%` }}
                  title={`${b.hora}:00 · ${formatearARS(b.monto)}`}
                />
                <span className="chart-hora">{b.hora}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <p className="tarjeta-etiqueta">Lo más vendido</p>
          {topProductos.length === 0 ? (
            <p className="vacio">Sin ventas en este período.</p>
          ) : (
            <div className="tabla tabla-top">
              {topProductos.map(([nombre, d]) => (
                <div key={nombre} className="tabla-fila">
                  <span className="tabla-principal">{nombre}</span>
                  <span className="tabla-sec">
                    {d.unidades} u.
                  </span>
                  <span className="tabla-monto">{formatearARS(d.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="tarjeta">
        <p className="tarjeta-etiqueta">
          Últimas ventas
          {anuladas.length > 0 &&
            ` · ${anuladas.length} anulada${anuladas.length === 1 ? "" : "s"} (${formatearARS(
              anuladas.reduce((s, v) => s + v.total, 0),
            )})`}
        </p>
        {ultimas.length === 0 ? (
          <p className="vacio">Todavía no hay ventas.</p>
        ) : (
          <div className="tabla tabla-ventas">
            {ultimas.map((v) => {
              const anulada = idsAnuladas.has(v.id);
              return (
                <div key={v.id} className={`tabla-fila ${anulada ? "fila-anulada" : ""}`}>
                  <span className="tabla-sec">{horaCorta(v.fecha)}</span>
                  <span className="tabla-principal">{resumenLineas(v)}</span>
                  <span className="tabla-sec">
                    {v.pagos.length > 1 ? "Mixto" : etiquetaMedio(v.pagos[0].medio)}
                  </span>
                  <span className="tabla-monto">{formatearARS(v.total)}</span>
                  <span>
                    {anulada ? (
                      <span className="chip-anulada">Anulada</span>
                    ) : (
                      <span className="chip-cobrada">Cobrada</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <button className="salir" onClick={onSalir}>
        Cerrar sesión
      </button>
    </div>
  );
}
