import { useEffect, useRef, useState } from "react";
import { formatearARS } from "../core";
import { supabase } from "../sync/supabase";
import { describirVencimiento } from "../suscripcion";
import "./Pantallas.css";
import "./Ajustes.css";
import "./Caja.css";
import "./Admin.css";

// Panel de administración de Kioskeo (solo admins): quién usa la app,
// cuándo vence cada uno, y los errores que reportaron los celulares.
// El servidor vuelve a verificar que seas admin en cada función.

interface Negocio {
  negocio_id: string;
  email: string;
  nombre: string | null;
  plan: string | null;
  vence_el: string | null;
  gracia_dias: number | null;
  creado_en: string;
  ventas: number;
  ultima_venta: string | null;
  ventas_hoy?: number;
  monto_hoy?: number;
  ventas_semana?: number;
  monto_semana?: number;
  productos?: number;
}

interface ProductoAdmin {
  id: string;
  datos: { nombre: string; precio: number; costo?: number; stock?: number; rubro?: string; unidad?: string };
}

interface VentaAdmin {
  id: string;
  datos: { fecha: string; total: number; lineas: { nombre: string; cantidad: number; gramos?: number }[]; pagos: { medio: string; monto: number }[] };
  actualizado_en: string;
  anulada: boolean;
}

interface ErrorReportado {
  id: number;
  negocio_id: string | null;
  mensaje: string;
  detalle: string | null;
  url: string | null;
  agente: string | null;
  creado_en: string;
}

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return null;
  const vence = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((vence.getTime() - hoy.getTime()) / 86400000);
}

export function Admin({ onVolver }: { onVolver: () => void }) {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [errores, setErrores] = useState<ErrorReportado[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [actividadDe, setActividadDe] = useState<Negocio | null>(null);
  const [ventas, setVentas] = useState<VentaAdmin[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [productosDe, setProductosDe] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [borrando, setBorrando] = useState<Negocio | null>(null);
  const [emailConfirmacion, setEmailConfirmacion] = useState("");
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const detalleRef = useRef<HTMLDivElement>(null);

  function mostrarDetalle() {
    setTimeout(() => detalleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function verProductos(n: Negocio) {
    const sb = supabase();
    if (!sb) return;
    setProductosDe(n);
    setActividadDe(null);
    setCargandoDetalle(true);
    mostrarDetalle();
    const { data, error } = await sb.rpc("admin_productos", { p_negocio: n.negocio_id });
    if (error) setMensaje(error.message);
    setProductos((data ?? []) as ProductoAdmin[]);
    setCargandoDetalle(false);
  }

  async function borrarNegocio(n: Negocio) {
    const sb = supabase();
    if (!sb) return;
    const { data, error } = await sb.rpc("admin_borrar_negocio", { p_negocio: n.negocio_id, p_email: emailConfirmacion.trim() });
    if (error) setMensaje(error.message);
    else setMensaje(`Cuenta ${String(data)}`);
    setBorrando(null);
    setEmailConfirmacion("");
    if (actividadDe?.negocio_id === n.negocio_id) setActividadDe(null);
    if (productosDe?.negocio_id === n.negocio_id) setProductosDe(null);
    cargar();
  }

  async function verActividad(n: Negocio) {
    const sb = supabase();
    if (!sb) return;
    setActividadDe(n);
    setProductosDe(null);
    setConfirmando(null);
    setCargandoDetalle(true);
    mostrarDetalle();
    const { data, error } = await sb.rpc("admin_ventas", { p_negocio: n.negocio_id, p_limite: 60 });
    if (error) setMensaje(error.message);
    setVentas((data ?? []) as VentaAdmin[]);
    setCargandoDetalle(false);
  }

  async function anularVenta(n: Negocio, ventaId: string) {
    const sb = supabase();
    if (!sb) return;
    const { error } = await sb.rpc("admin_anular_venta", { p_negocio: n.negocio_id, p_venta_id: ventaId, p_motivo: "anulada por soporte (prueba)" });
    if (error) setMensaje(error.message);
    else setMensaje("Venta anulada: el celular del negocio la baja en el próximo sync");
    setConfirmando(null);
    verActividad(n);
  }

  async function cargar() {
    const sb = supabase();
    if (!sb) {
      setMensaje("Sin Supabase configurado");
      return;
    }
    const [{ data: n, error: e1 }, { data: e }] = await Promise.all([
      sb.rpc("admin_negocios"),
      sb.from("errores").select("*").order("creado_en", { ascending: false }).limit(30),
    ]);
    if (e1) setMensaje(e1.message);
    setNegocios((n ?? []) as Negocio[]);
    setErrores((e ?? []) as ErrorReportado[]);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function extender(negocio: Negocio, dias: number) {
    const sb = supabase();
    if (!sb) return;
    setOcupado(negocio.negocio_id);
    const { data, error } = await sb.rpc("admin_extender", {
      p_negocio: negocio.negocio_id,
      p_dias: dias,
      p_plan: "mensual",
    });
    setOcupado(null);
    if (error) {
      setMensaje(error.message);
      return;
    }
    setMensaje(`${negocio.nombre ?? negocio.email}: vence el ${describirVencimiento(String(data))}`);
    cargar();
  }

  // Las cuentas demo (plan "demo") no cuentan en los totales.
  const reales = negocios.filter((n) => n.plan !== "demo");

  return (
    <div className="pantalla pantalla-ancha pantalla-aire">
      <header className="encabezado">
        <button className="aj-volver" onClick={onVolver}>
          ← Volver
        </button>
        <span className="migaja">Administración · {reales.length} negocios</span>
      </header>

      {mensaje && <p className="admin-mensaje">{mensaje}</p>}

      <div className="caja-cajas admin-resumen">
        <div className="caja-cajita">
          <span>Negocios reales</span>
          <strong>{reales.length}</strong>
        </div>
        <div className="caja-cajita">
          <span>Vendieron hoy</span>
          <strong>{reales.filter((n) => (n.ventas_hoy ?? 0) > 0).length}</strong>
        </div>
        <div className="caja-cajita">
          <span>Vendido hoy (todos)</span>
          <strong>{formatearARS(reales.reduce((s, n) => s + (n.monto_hoy ?? 0), 0))}</strong>
        </div>
        <div className="caja-cajita">
          <span>Vendido esta semana</span>
          <strong>{formatearARS(reales.reduce((s, n) => s + (n.monto_semana ?? 0), 0))}</strong>
        </div>
      </div>

      {actividadDe && (
        <section className="aj-seccion" ref={detalleRef}>
          <div className="aj-fila">
            <span>
              <span className="aj-etiqueta">Actividad de {actividadDe.nombre ?? actividadDe.email}</span>
              <span className="aj-nota">Últimas {ventas.length} ventas · solo para soporte</span>
            </span>
            <button className="aj-accion" onClick={() => setActividadDe(null)}>
              Cerrar
            </button>
          </div>
          <div className="admin-lista">
            {cargandoDetalle ? <p className="aj-nota">Cargando…</p> : ventas.length === 0 && <p className="aj-nota">Sin ventas todavía.</p>}
            {ventas.map((v) => {
              const d = new Date(v.datos.fecha);
              const resumen = v.datos.lineas
                .map((l) => `${l.nombre} ${l.gramos !== undefined ? `${l.gramos}g` : `x${l.cantidad}`}`)
                .join(", ");
              return (
                <div key={v.id} className={`admin-fila ${v.anulada ? "admin-anulada" : ""}`}>
                  <div className="admin-datos">
                    <strong>
                      {d.toLocaleDateString("es-AR")} {d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                      {formatearARS(v.datos.total)}
                      {v.anulada && " · ANULADA"}
                    </strong>
                    <span>{resumen}</span>
                    <span>{v.datos.pagos.map((p) => `${p.medio} ${formatearARS(p.monto)}`).join(" · ")}</span>
                  </div>
                  {!v.anulada && (
                    <div className="admin-acciones">
                      {confirmando === v.id ? (
                        <>
                          <button onClick={() => anularVenta(actividadDe, v.id)}>Sí, anular</button>
                          <button className="admin-secundario" onClick={() => setConfirmando(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <button className="admin-secundario" onClick={() => setConfirmando(v.id)}>
                          Anular
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {productosDe && (
        <section className="aj-seccion" ref={detalleRef}>
          <div className="aj-fila">
            <span>
              <span className="aj-etiqueta">Productos de {productosDe.nombre ?? productosDe.email}</span>
              <span className="aj-nota">{productos.length} cargados · solo para soporte</span>
            </span>
            <button className="aj-accion" onClick={() => setProductosDe(null)}>
              Cerrar
            </button>
          </div>
          <div className="admin-lista">
            {cargandoDetalle ? <p className="aj-nota">Cargando…</p> : productos.length === 0 && <p className="aj-nota">Todavía no cargó productos.</p>}
            {productos.map((p) => (
              <div key={p.id} className="admin-fila">
                <div className="admin-datos">
                  <strong>{p.datos.nombre}</strong>
                  <span>
                    Precio {formatearARS(p.datos.precio)}
                    {p.datos.unidad === "peso" && " cada 100 g"}
                    {p.datos.costo !== undefined && p.datos.costo > 0
                      ? ` · costo ${formatearARS(p.datos.costo)} · margen ${Math.round(((p.datos.precio - p.datos.costo) / p.datos.precio) * 100)} %`
                      : " · costo: sin cargar"}
                    {p.datos.stock !== undefined ? ` · stock ${p.datos.stock}` : " · stock: sin cargar"}
                    {p.datos.rubro && ` · ${p.datos.rubro}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="aj-seccion">
        <p className="aj-titulo">Negocios</p>
        <div className="admin-lista">
          {negocios.map((n) => {
            const dias = diasHasta(n.vence_el);
            const clase = dias === null ? "" : dias < 0 ? "admin-vencido" : dias <= 5 ? "admin-por-vencer" : "";
            return (
              <div key={n.negocio_id} className={`admin-fila ${clase}`}>
                <div className="admin-datos">
                  <strong>
                    {n.nombre ?? "(sin nombre)"}
                    {n.plan === "demo" && <span className="admin-etiqueta-demo">DEMO</span>}
                  </strong>
                  <span>{n.email}</span>
                  <span>
                    {n.plan ?? "sin plan"} · vence {n.vence_el ? describirVencimiento(n.vence_el) : "—"}
                    {dias !== null && ` (${dias >= 0 ? `faltan ${dias}` : `venció hace ${-dias}`} días)`}
                  </span>
                  <span className="admin-actividad">
                    Hoy <b>{n.ventas_hoy ?? 0}</b> ventas · <b>{formatearARS(n.monto_hoy ?? 0)}</b>
                    {" · "}Semana <b>{n.ventas_semana ?? 0}</b> · <b>{formatearARS(n.monto_semana ?? 0)}</b>
                  </span>
                  <span>
                    {n.productos ?? 0} productos · {n.ventas} ventas en total
                    {n.ultima_venta && ` · última ${new Date(n.ultima_venta).toLocaleDateString("es-AR")}`}
                    {` · alta ${new Date(n.creado_en).toLocaleDateString("es-AR")}`}
                  </span>
                </div>
                <div className="admin-acciones">
                  <button className="admin-secundario" onClick={() => verActividad(n)}>
                    Actividad
                  </button>
                  <button className="admin-secundario" onClick={() => verProductos(n)}>
                    Productos
                  </button>
                  <button className="admin-peligro" onClick={() => { setBorrando(n); setEmailConfirmacion(""); }}>
                    Borrar
                  </button>
                  <button disabled={ocupado === n.negocio_id} onClick={() => extender(n, 30)}>
                    +30 días
                  </button>
                  <button disabled={ocupado === n.negocio_id} onClick={() => extender(n, 90)}>
                    +90
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {borrando && (
        <div className="hoja-fondo" role="dialog" aria-label="Borrar cuenta">
          <div className="hoja">
            <p className="hoja-titulo">Borrar {borrando.nombre ?? borrando.email}</p>
            <p className="hoja-nota">
              Se borra la cuenta y TODO lo suyo: productos, ventas, clientes, cajas. No se puede deshacer. Para
              confirmar, escribí el email exacto: <strong>{borrando.email}</strong>
            </p>
            <input
              className="campo"
              placeholder="Escribí el email para confirmar"
              value={emailConfirmacion}
              onChange={(e) => setEmailConfirmacion(e.target.value)}
              autoFocus
            />
            <div className="acciones-fila">
              <button className="hoja-cancelar" onClick={() => setBorrando(null)}>
                Cancelar
              </button>
              <button
                className="boton-principal"
                disabled={emailConfirmacion.trim().toLowerCase() !== borrando.email.toLowerCase()}
                onClick={() => void borrarNegocio(borrando)}
              >
                BORRAR CUENTA
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="aj-seccion">
        <p className="aj-titulo">Errores reportados ({errores.length})</p>
        {errores.length === 0 ? (
          <p className="aj-nota">Ninguno. Qué lindo.</p>
        ) : (
          <div className="admin-lista">
            {errores.map((e) => (
              <details key={e.id} className="admin-error">
                <summary>
                  <span>{new Date(e.creado_en).toLocaleString("es-AR")}</span>
                  <strong>{e.mensaje}</strong>
                </summary>
                <p className="aj-nota">
                  {negocios.find((n) => n.negocio_id === e.negocio_id)?.email ?? e.negocio_id} · {e.url}
                </p>
                <p className="aj-nota">{e.agente}</p>
                {e.detalle && <pre>{e.detalle}</pre>}
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
