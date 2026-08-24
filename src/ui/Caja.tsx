import { useEffect, useMemo, useState } from "react";
import {
  cerrarCaja,
  efectivoEsperado,
  formatearARS,
  montoPorMedio,
  ventasVigentes,
  type Anulacion,
  type Centavos,
  type CierreCaja,
  type MovimientoCaja,
  type Venta,
} from "../core";
import {
  anulacionesDesde,
  cajaAbierta,
  escribirConfig,
  guardarCaja,
  leerConfig,
  todasLasCajas,
  ventasDesde,
  type CajaSesion,
} from "../db/db";
import {
  leerEmpleados,
  minutosDeTardanza,
  semaforoTardanza,
  type Empleado,
} from "../empleados";
import { estaDesbloqueado, hayPin } from "../pin";
import { EmpleadosSetup } from "./EmpleadosSetup";
import { PinHoja } from "./PinHoja";
import { Teclado } from "./Teclado";
import { horaCorta } from "./util";
import "./Pantallas.css";
import "./Caja.css";

// La Caja habla solo de TURNOS: quién abrió, cuándo, cuánto debería haber y
// cómo cerraron los anteriores. El detalle movimiento por movimiento vive en
// la pestaña Movimientos. Los números son grandes porque acá se decide si
// falta plata.

type Hoja =
  | null
  | { tipo: "movimiento"; clase: "retiro" | "ingreso" }
  | { tipo: "cierre" }
  | { tipo: "resultado"; cierre: CierreCaja }
  | { tipo: "empleados" }
  | { tipo: "pin" };

const CLAVE_SETUP_VISTO = "empleados-setup-visto";

export function textoDemora(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return "Sin turno programado";
  if (minutos <= 0) return "Abrió al horario";
  return `${minutos} min de demora`;
}

/** "Mié 20/8" */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d.getDate()}/${d.getMonth() + 1}`;
}

function describirDiferencia(diferencia: Centavos | undefined): { texto: string; clase: string } {
  if (diferencia === undefined) return { texto: "Sin cerrar", clase: "caja-dif-pendiente" };
  if (diferencia === 0) return { texto: "Cerró bien", clase: "caja-dif-bien" };
  if (diferencia < 0) return { texto: `Faltaron ${formatearARS(-diferencia)}`, clase: "caja-dif-falta" };
  return { texto: `Sobraron ${formatearARS(diferencia)}`, clase: "caja-dif-sobra" };
}

export function Caja() {
  const [caja, setCaja] = useState<CajaSesion | null | "cargando">("cargando");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [anulaciones, setAnulaciones] = useState<Anulacion[]>([]);
  const [historial, setHistorial] = useState<CajaSesion[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [apertura, setApertura] = useState<Centavos>(0);
  const [quienAbre, setQuienAbre] = useState<string | null>(null);
  const [hoja, setHoja] = useState<Hoja>(null);
  const [esperadoVisible, setEsperadoVisible] = useState(estaDesbloqueado());

  async function recargar() {
    const [abierta, todas, emps] = await Promise.all([
      cajaAbierta(),
      todasLasCajas(),
      leerEmpleados(),
    ]);
    setCaja(abierta ?? null);
    setHistorial(todas.filter((c) => c.cerradaEn).slice(0, 14));
    setEmpleados(emps);
    if (abierta) {
      const [v, a] = await Promise.all([
        ventasDesde(abierta.abiertaEn),
        anulacionesDesde(abierta.abiertaEn),
      ]);
      setVentas(v);
      setAnulaciones(a);
    }
    // Primera vez en Caja sin empleados cargados: el cuestionario, una sola vez.
    if (emps.length === 0 && !abierta) {
      const visto = await leerConfig(CLAVE_SETUP_VISTO);
      if (!visto) {
        await escribirConfig(CLAVE_SETUP_VISTO, "1");
        setHoja({ tipo: "empleados" });
      }
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  const vigentes = useMemo(
    () => ventasVigentes(ventas, anulaciones),
    [ventas, anulaciones],
  );

  if (caja === "cargando") return <div className="pantalla" />;

  const hojaEmpleados = hoja?.tipo === "empleados" && (
    <EmpleadosSetup
      empleados={empleados}
      onGuardar={(lista) => {
        setEmpleados(lista);
        setHoja(null);
      }}
      onCerrar={() => setHoja(null)}
    />
  );

  const enlaceEmpleados = (
    <button className="caja-enlace" onClick={() => setHoja({ tipo: "empleados" })}>
      {empleados.length > 0 ? "Empleados y turnos" : "Cargar empleados y turnos"}
    </button>
  );

  // ---------- turno cerrado: abrir ----------
  if (caja === null) {
    const necesitaQuien = empleados.length > 0 && quienAbre === null;
    return (
      <div className="pantalla pantalla-ancha pantalla-aire caja">
        <div className="caja-abrir">
          {empleados.length > 0 && (
            <section className="caja-tarjeta caja-quien">
              <h2 className="caja-pregunta">¿Quién abre?</h2>
              {empleados.map((e) => (
                <button
                  key={e.id}
                  className={`caja-empleado ${quienAbre === e.id ? "caja-empleado-activo" : ""}`}
                  onClick={() => setQuienAbre(e.id)}
                >
                  {e.nombre}
                </button>
              ))}
            </section>
          )}
          <section className="caja-tarjeta caja-apertura">
            <span className="caja-etiqueta-centro">Monto de apertura</span>
            <span className="caja-monto-gigante">{formatearARS(apertura)}</span>
            <Teclado valor={apertura} onCambio={setApertura} />
          </section>
          <button
            className="boton-principal caja-boton-grande"
            disabled={necesitaQuien}
            onClick={async () => {
              const ahora = new Date();
              const empleado = empleados.find((e) => e.id === quienAbre);
              await guardarCaja({
                id: crypto.randomUUID(),
                apertura,
                abiertaEn: ahora.toISOString(),
                movimientos: [],
                empleadoId: empleado?.id,
                empleadoNombre: empleado?.nombre,
                tardanzaMin: empleado ? minutosDeTardanza(empleado, ahora) : null,
              });
              setApertura(0);
              setQuienAbre(null);
              recargar();
            }}
          >
            ABRIR TURNO
          </button>
          {enlaceEmpleados}
        </div>

        {historial.length > 0 && <HistorialTurnos cajas={historial} />}
        {hojaEmpleados}
      </div>
    );
  }

  // ---------- turno abierto ----------
  const efectivoVendido = vigentes.reduce((s, v) => s + montoPorMedio(v, "efectivo"), 0);
  const transferido = vigentes.reduce((s, v) => s + montoPorMedio(v, "transferencia"), 0);
  const retiros = caja.movimientos.filter((m) => m.tipo === "retiro").reduce((s, m) => s + m.monto, 0);
  const ingresos = caja.movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const esperado = efectivoEsperado(caja.apertura, vigentes, caja.movimientos);
  const semaforo = semaforoTardanza(caja.tardanzaMin ?? null);

  const botonCerrar = (
    <button className="caja-boton-negro" onClick={() => setHoja({ tipo: "cierre" })}>
      CERRAR TURNO
    </button>
  );

  return (
    <div className="pantalla pantalla-ancha pantalla-aire caja caja-abierta">
      <button className="caja-banner" onClick={() => setHoja({ tipo: "empleados" })} title="Empleados y turnos">
        <span className={`caja-punto caja-punto-${semaforo}`} aria-hidden />
        <span className="caja-banner-textos">
          <strong>
            {caja.empleadoNombre
              ? `${caja.empleadoNombre} abrió a las ${horaCorta(caja.abiertaEn)}`
              : `Turno abierto a las ${horaCorta(caja.abiertaEn)}`}
          </strong>
          <span>{caja.empleadoNombre ? textoDemora(caja.tardanzaMin) : `Abrió con ${formatearARS(caja.apertura)}`}</span>
        </span>
      </button>

      <div className="caja-cajas">
        <div className="caja-cajita">
          <span>Apertura</span>
          <strong>{formatearARS(caja.apertura)}</strong>
        </div>
        <div className="caja-cajita">
          <span>Efectivo</span>
          <strong>{formatearARS(efectivoVendido)}</strong>
        </div>
        <div className="caja-cajita">
          <span>Transferencias</span>
          <strong>{formatearARS(transferido)}</strong>
        </div>
        <div className="caja-cajita">
          <span>Retiros</span>
          <strong>{formatearARS(retiros)}</strong>
          {ingresos > 0 && <small>+ {formatearARS(ingresos)} de ingresos</small>}
        </div>
        {esperadoVisible || !hayPin() ? (
          <div className="caja-cajita caja-cajita-esperado">
            <span>Esperado en caja</span>
            <strong>{formatearARS(esperado)}</strong>
          </div>
        ) : (
          <button className="caja-cajita caja-cajita-esperado caja-esperado-oculto" onClick={() => setHoja({ tipo: "pin" })}>
            <span>Esperado en caja</span>
            <strong>Tocá para ver</strong>
            <small>Pide el PIN del dueño</small>
          </button>
        )}
      </div>

      <div className="caja-cuerpo">
        <div className="caja-acciones">
          <button className="caja-secundario" onClick={() => setHoja({ tipo: "movimiento", clase: "retiro" })}>
            Retiro
          </button>
          <button className="caja-secundario" onClick={() => setHoja({ tipo: "movimiento", clase: "ingreso" })}>
            Ingreso
          </button>
          <div className="caja-cerrar-pc">{botonCerrar}</div>
          <div className="caja-enlace-pc">{enlaceEmpleados}</div>
        </div>
        {historial.length > 0 && <HistorialTurnos cajas={historial} />}
      </div>

      <div className="caja-cerrar-fijo">{botonCerrar}</div>

      {hoja?.tipo === "movimiento" && (
        <MovimientoHoja
          clase={hoja.clase}
          onGuardar={async (mov) => {
            await guardarCaja({ ...caja, movimientos: [...caja.movimientos, mov] });
            setHoja(null);
            recargar();
          }}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja?.tipo === "cierre" && (
        <CierreHoja
          onContado={(contado) => setHoja({ tipo: "resultado", cierre: cerrarCaja(esperado, contado) })}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja?.tipo === "resultado" && (
        <ResultadoHoja
          cierre={hoja.cierre}
          onConfirmar={async () => {
            await guardarCaja({
              ...caja,
              cerradaEn: new Date().toISOString(),
              contado: hoja.cierre.contado,
              esperado: hoja.cierre.esperado,
              diferencia: hoja.cierre.diferencia,
            });
            setHoja(null);
            recargar();
          }}
          onVolver={() => setHoja({ tipo: "cierre" })}
        />
      )}
      {hoja?.tipo === "pin" && (
        <PinHoja
          modo="verificar"
          onOk={() => {
            setEsperadoVisible(true);
            setHoja(null);
          }}
          onCancelar={() => setHoja(null)}
        />
      )}
      {hojaEmpleados}
    </div>
  );
}

function HistorialTurnos({ cajas }: { cajas: CajaSesion[] }) {
  return (
    <section className="caja-historial">
      <p className="caja-seccion">Turnos anteriores</p>
      <div className="caja-tarjeta caja-historial-lista">
        {cajas.map((c) => {
          const sem = semaforoTardanza(c.tardanzaMin ?? null);
          const dif = describirDiferencia(c.diferencia);
          const esperado = c.esperado === undefined ? "—" : formatearARS(c.esperado);
          const contado = c.contado === undefined ? "—" : formatearARS(c.contado);
          return (
            <div key={c.id} className="caja-turno">
              <span className="caja-turno-nombre">
                {c.empleadoNombre ?? "Turno"}
                {c.empleadoNombre && sem !== "verde" && (
                  <span className={`caja-punto caja-punto-${sem}`} title={textoDemora(c.tardanzaMin)} />
                )}
              </span>
              <span className="caja-turno-dia">{fechaCorta(c.abiertaEn)}</span>
              <span className="caja-turno-dato">
                Esperado <strong>{esperado}</strong>
              </span>
              <span className="caja-turno-dato">
                Contado <strong>{contado}</strong>
              </span>
              <span className="caja-turno-sub">
                {fechaCorta(c.abiertaEn)} · Esperado {esperado} · Contado {contado}
              </span>
              <span className={`caja-turno-dif ${dif.clase}`}>{dif.texto}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MovimientoHoja({
  clase,
  onGuardar,
  onCerrar,
}: {
  clase: "retiro" | "ingreso";
  onGuardar: (m: MovimientoCaja) => void;
  onCerrar: () => void;
}) {
  const [monto, setMonto] = useState<Centavos>(0);
  const [motivo, setMotivo] = useState("");
  return (
    <div className="hoja-fondo" role="dialog" aria-label={clase}>
      <div className="hoja caja-hoja">
        <p className="hoja-titulo">{clase === "retiro" ? "Retiro de plata" : "Ingreso de plata"}</p>
        <p className="hoja-nota">
          {clase === "retiro"
            ? "Plata que sale del cajón: pagarle al proveedor, llevarte efectivo."
            : "Plata que entra al cajón sin ser una venta: cambio, aporte."}
        </p>
        <span className="caja-monto-gigante">{formatearARS(monto)}</span>
        <Teclado valor={monto} onCambio={setMonto} />
        <input
          className="campo"
          placeholder="Motivo (opcional)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-label="Motivo"
        />
        <div className="acciones-fila">
          <button className="hoja-cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="boton-principal"
            disabled={monto <= 0}
            onClick={() => onGuardar({ tipo: clase, monto, motivo: motivo.trim() || undefined })}
          >
            GUARDAR
          </button>
        </div>
      </div>
    </div>
  );
}

function CierreHoja({ onContado, onCerrar }: { onContado: (contado: Centavos) => void; onCerrar: () => void }) {
  const [contado, setContado] = useState<Centavos>(0);
  return (
    <div className="hoja-fondo" role="dialog" aria-label="Cierre de caja">
      <div className="hoja caja-hoja">
        <p className="hoja-titulo">¿Cuánto hay en la caja?</p>
        <p className="hoja-nota">
          Contá todo el efectivo del cajón y cargá el total. Recién después se revela la diferencia.
        </p>
        <span className="caja-monto-gigante">{formatearARS(contado)}</span>
        <Teclado valor={contado} onCambio={setContado} />
        <div className="acciones-fila">
          <button className="hoja-cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="boton-principal" onClick={() => onContado(contado)}>
            VER RESULTADO
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultadoHoja({
  cierre,
  onConfirmar,
  onVolver,
}: {
  cierre: CierreCaja;
  onConfirmar: () => void;
  onVolver: () => void;
}) {
  const dif = describirDiferencia(cierre.diferencia);
  return (
    <div className="hoja-fondo" role="dialog" aria-label="Resultado del cierre">
      <div className="hoja caja-hoja">
        <p className="hoja-titulo">
          {cierre.diferencia === 0 ? "Caja perfecta" : cierre.diferencia < 0 ? "Falta plata" : "Sobra plata"}
        </p>
        <div className="caja-cajas caja-cajas-2">
          <div className="caja-cajita">
            <span>Esperado</span>
            <strong>{formatearARS(cierre.esperado)}</strong>
          </div>
          <div className="caja-cajita">
            <span>Contado</span>
            <strong>{formatearARS(cierre.contado)}</strong>
          </div>
        </div>
        <span className={`caja-resultado ${dif.clase}`}>{dif.texto}</span>
        <div className="acciones-fila">
          <button className="hoja-cancelar" onClick={onVolver}>
            Recontar
          </button>
          <button className="boton-principal" onClick={onConfirmar}>
            CERRAR TURNO
          </button>
        </div>
      </div>
    </div>
  );
}
