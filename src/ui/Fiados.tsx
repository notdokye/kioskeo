import { useEffect, useMemo, useState } from "react";
import {
  deudasDesdeVentas,
  formatearARS,
  montoPorMedio,
  saldosPorCliente,
  ventasVigentes,
  type MovimientoFiado,
  type Venta,
} from "../core";
import {
  agregarCliente,
  guardarPagoFiado,
  listarClientes,
  listarPagosFiado,
  todasLasAnulaciones,
  todasLasVentas,
  type Cliente,
} from "../db/db";
import { parsearPesos } from "./util";
import "./Pantallas.css";

export function Fiados() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vigentes, setVigentes] = useState<Venta[]>([]);
  const [pagos, setPagos] = useState<MovimientoFiado[]>([]);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [cobrando, setCobrando] = useState<Cliente | null>(null);

  async function recargar() {
    const [c, ventas, anulaciones, p] = await Promise.all([
      listarClientes(),
      todasLasVentas(),
      todasLasAnulaciones(),
      listarPagosFiado(),
    ]);
    setClientes(c);
    setVigentes(ventasVigentes(ventas, anulaciones));
    setPagos(p);
  }

  useEffect(() => {
    recargar();
  }, []);

  // Saldos SIEMPRE derivados: deudas de ventas vigentes + pagos registrados.
  const saldos = useMemo(
    () => saldosPorCliente([...deudasDesdeVentas(vigentes), ...pagos]),
    [vigentes, pagos],
  );

  const ultimaCompra = useMemo(() => {
    const porCliente = new Map<string, Venta>();
    for (const v of vigentes) {
      if (!v.clienteId || montoPorMedio(v, "fiado") === 0) continue;
      const previa = porCliente.get(v.clienteId);
      if (!previa || v.fecha > previa.fecha) porCliente.set(v.clienteId, v);
    }
    return porCliente;
  }, [vigentes]);

  const ordenados = useMemo(
    () => [...clientes].sort((a, b) => (saldos.get(b.id) ?? 0) - (saldos.get(a.id) ?? 0)),
    [clientes, saldos],
  );
  const mayorDeudorId = ordenados[0] && (saldos.get(ordenados[0].id) ?? 0) > 0 ? ordenados[0].id : null;

  const totalAdeudado = [...saldos.values()].filter((s) => s > 0).reduce((a, b) => a + b, 0);

  const inicioMes = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const fiadoMes = vigentes
    .filter((v) => v.fecha >= inicioMes)
    .reduce((s, v) => s + montoPorMedio(v, "fiado"), 0);
  const cobradoMes = pagos
    .filter((p) => p.fecha >= inicioMes)
    .reduce((s, p) => s + p.monto, 0);

  function describirUltima(clienteId: string): string {
    const venta = ultimaCompra.get(clienteId);
    if (!venta) return "—";
    const dia = new Date(venta.fecha);
    const hoy = new Date();
    const esHoy = dia.toDateString() === hoy.toDateString();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const esAyer = dia.toDateString() === ayer.toDateString();
    const cuando = esHoy
      ? `Hoy ${dia.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
      : esAyer
        ? `Ayer ${dia.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
        : dia.toLocaleDateString("es-AR", { weekday: "long" });
    const producto = venta.lineas[0]?.nombre.split(" ").slice(0, 2).join(" ") ?? "";
    return `${cuando} · ${producto}`;
  }

  return (
    <div className="pantalla pantalla-ancha">
      <header className="encabezado">
        <span className="migaja">
          Fiados · {clientes.length} cliente{clientes.length === 1 ? "" : "s"}
        </span>
        <button className="boton-outline" onClick={() => setNuevoAbierto(true)}>
          + Nuevo cliente
        </button>
      </header>

      <div className="kpis" style={{ maxWidth: 640 }}>
        <div className="kpi kpi-invertido">
          <span className="kpi-etiqueta">Total adeudado</span>
          <span className="kpi-valor">{formatearARS(totalAdeudado)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-etiqueta">Fiado este mes</span>
          <span className="kpi-valor">{formatearARS(fiadoMes)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-etiqueta">Cobrado este mes</span>
          <span className="kpi-valor positivo">{formatearARS(cobradoMes)}</span>
        </div>
      </div>

      <div className="tarjeta" style={{ padding: "2px 16px" }}>
        {ordenados.length === 0 ? (
          <p className="vacio">
            Sin clientes todavía. Se crean acá o directo al cobrar una venta como FIADO.
          </p>
        ) : (
          <div className="tabla">
            {ordenados.map((c) => {
              const saldo = saldos.get(c.id) ?? 0;
              return (
                <div
                  key={c.id}
                  className="tabla-fila"
                  style={{ gridTemplateColumns: "1fr auto auto", minHeight: 46 }}
                >
                  <span className="tabla-principal">
                    {c.nombre}
                    <span className="tabla-detalle">{describirUltima(c.id)}</span>
                  </span>
                  <span
                    className="tabla-monto"
                    style={{ color: saldo > 0 ? "var(--salmon-presionado)" : "var(--verde)" }}
                  >
                    {formatearARS(saldo)}
                  </span>
                  {saldo > 0 ? (
                    <button
                      className={c.id === mayorDeudorId ? "boton-solido" : "boton-tinte"}
                      onClick={() => setCobrando(c)}
                    >
                      Cobrar
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="hoja-nota">Cobrar acepta pago total o parcial.</p>

      {nuevoAbierto && (
        <div className="hoja-fondo" role="dialog" aria-label="Nuevo cliente">
          <div className="hoja">
            <p className="hoja-titulo">Nuevo cliente</p>
            <input
              className="campo"
              autoFocus
              placeholder="Nombre (ej: Doña Rosa)"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && nuevoNombre.trim()) {
                  await agregarCliente({ id: crypto.randomUUID(), nombre: nuevoNombre.trim() });
                  setNuevoNombre("");
                  setNuevoAbierto(false);
                  recargar();
                }
              }}
              aria-label="Nombre del cliente"
            />
            <div className="acciones-fila">
              <button className="hoja-cancelar" onClick={() => setNuevoAbierto(false)}>
                Cancelar
              </button>
              <button
                className="boton-principal"
                disabled={!nuevoNombre.trim()}
                onClick={async () => {
                  await agregarCliente({ id: crypto.randomUUID(), nombre: nuevoNombre.trim() });
                  setNuevoNombre("");
                  setNuevoAbierto(false);
                  recargar();
                }}
              >
                AGREGAR
              </button>
            </div>
          </div>
        </div>
      )}

      {cobrando && (
        <CobrarFiado
          cliente={cobrando}
          saldo={saldos.get(cobrando.id) ?? 0}
          onGuardar={async (monto) => {
            await guardarPagoFiado({
              id: crypto.randomUUID(),
              clienteId: cobrando.id,
              tipo: "pago",
              monto,
              fecha: new Date().toISOString(),
            });
            setCobrando(null);
            recargar();
          }}
          onCerrar={() => setCobrando(null)}
        />
      )}
    </div>
  );
}

function CobrarFiado({
  cliente,
  saldo,
  onGuardar,
  onCerrar,
}: {
  cliente: Cliente;
  saldo: number;
  onGuardar: (monto: number) => void;
  onCerrar: () => void;
}) {
  const [montoTexto, setMontoTexto] = useState("");
  const monto = parsearPesos(montoTexto);
  const valido = monto !== null && monto > 0;

  return (
    <div className="hoja-fondo" role="dialog" aria-label="Cobrar fiado">
      <div className="hoja">
        <p className="hoja-titulo">{cliente.nombre}</p>
        <p className="hoja-nota">
          Debe <strong className="negativo">{formatearARS(saldo)}</strong>
        </p>
        <input
          className="campo"
          inputMode="decimal"
          placeholder="¿Cuánto paga?"
          autoFocus
          value={montoTexto}
          onChange={(e) => setMontoTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valido && onGuardar(monto ?? 0)}
          aria-label="Monto del pago"
        />
        <div className="acciones-fila">
          <button className="hoja-cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="boton-outline" onClick={() => onGuardar(saldo)}>
            PAGA TODO
          </button>
          <button className="boton-principal" disabled={!valido} onClick={() => onGuardar(monto ?? 0)}>
            COBRAR
          </button>
        </div>
      </div>
    </div>
  );
}
