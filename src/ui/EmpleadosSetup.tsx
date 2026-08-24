import { useState } from "react";
import { guardarEmpleados, type Empleado, type Turno } from "../empleados";
import "./Pantallas.css";
import "./EmpleadosSetup.css";

// Cuestionario de empleados y turnos (diseño "Kioskeo 3 Empleados").
// Primera vez: ¿cuántos? → nombres → turnos. Si trabaja una sola persona,
// se saltea el paso de nombres y el empleado es "Vos". Después, la misma
// hoja sirve para agregar, quitar o cambiar horarios.

interface Props {
  empleados: Empleado[];
  onGuardar: (empleados: Empleado[]) => void;
  onCerrar: () => void;
}

type Paso = "cuantos" | "nombres" | "turnos";

// Días en orden argentino (lunes primero). Los valores siguen a Date.getDay.
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const LETRAS = ["L", "M", "M", "J", "V", "S", "D"];

const MANANA = { desde: "08:00", hasta: "14:00" };
const TARDE = { desde: "14:00", hasta: "21:00" };
const TODO_EL_DIA = { desde: "08:00", hasta: "21:00" };

function esManana(t: Turno): boolean {
  return t.desde === MANANA.desde && (t.hasta === MANANA.hasta || t.hasta === TARDE.hasta);
}

function esTarde(t: Turno): boolean {
  return t.hasta === TARDE.hasta && (t.desde === TARDE.desde || t.desde === MANANA.desde);
}

function nuevoTurno(horario = MANANA): Turno {
  return { dias: [1, 2, 3, 4, 5, 6], ...horario };
}

function nuevoEmpleado(nombre = ""): Empleado {
  return { id: crypto.randomUUID(), nombre, turnos: [nuevoTurno()] };
}

function clonar(lista: Empleado[]): Empleado[] {
  return lista.map((e) => ({ ...e, turnos: e.turnos.map((t) => ({ ...t, dias: [...t.dias] })) }));
}

const IconoX = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export function EmpleadosSetup({ empleados, onGuardar, onCerrar }: Props) {
  const primeraVez = empleados.length === 0;
  const [paso, setPaso] = useState<Paso>(primeraVez ? "cuantos" : "turnos");
  const [lista, setLista] = useState<Empleado[]>(() => clonar(empleados));
  const [solo, setSolo] = useState(false);
  // Turnos a los que se les abrió "Otro horario" (se muestran las horas).
  const [otros, setOtros] = useState<Set<string>>(new Set());

  function elegirCantidad(n: number) {
    if (n === 1) {
      setLista([nuevoEmpleado("Vos")]);
      setSolo(true);
      setPaso("turnos");
    } else {
      setLista(Array.from({ length: n }, () => nuevoEmpleado()));
      setSolo(false);
      setPaso("nombres");
    }
  }

  function actualizar(id: string, cambios: Partial<Empleado>) {
    setLista((l) => l.map((e) => (e.id === id ? { ...e, ...cambios } : e)));
  }

  function quitar(id: string) {
    setLista((l) => l.filter((e) => e.id !== id));
  }

  function agregarPersona() {
    setLista((l) => [...l, nuevoEmpleado()]);
    setSolo(false);
  }

  function actualizarTurno(id: string, indice: number, cambios: Partial<Turno>) {
    setLista((l) =>
      l.map((e) =>
        e.id === id
          ? { ...e, turnos: e.turnos.map((t, i) => (i === indice ? { ...t, ...cambios } : t)) }
          : e,
      ),
    );
  }

  function turnoDe(id: string, indice: number): Turno | undefined {
    return lista.find((e) => e.id === id)?.turnos[indice];
  }

  // Actualización funcional: dos toques seguidos nunca pisan el anterior.
  function alternarDia(id: string, indice: number, dia: number) {
    setLista((l) =>
      l.map((e) =>
        e.id === id
          ? {
              ...e,
              turnos: e.turnos.map((t, i) =>
                i === indice
                  ? { ...t, dias: t.dias.includes(dia) ? t.dias.filter((d) => d !== dia) : [...t.dias, dia].sort() }
                  : t,
              ),
            }
          : e,
      ),
    );
  }

  function cerrarOtro(clave: string) {
    setOtros((s) => {
      const n = new Set(s);
      n.delete(clave);
      return n;
    });
  }

  // Las píldoras son acumulables: Mañana + Tarde = todo el día (08 a 21).
  function alternarManana(id: string, indice: number) {
    const t = turnoDe(id, indice);
    if (!t) return;
    const m = esManana(t);
    const ta = esTarde(t);
    if (m && ta) actualizarTurno(id, indice, TARDE);
    else if (m) return;
    else if (ta) actualizarTurno(id, indice, TODO_EL_DIA);
    else actualizarTurno(id, indice, MANANA);
    cerrarOtro(`${id}-${indice}`);
  }

  function alternarTarde(id: string, indice: number) {
    const t = turnoDe(id, indice);
    if (!t) return;
    const m = esManana(t);
    const ta = esTarde(t);
    if (m && ta) actualizarTurno(id, indice, MANANA);
    else if (ta) return;
    else if (m) actualizarTurno(id, indice, TODO_EL_DIA);
    else actualizarTurno(id, indice, TARDE);
    cerrarOtro(`${id}-${indice}`);
  }

  function abrirOtro(id: string, indice: number) {
    const t = turnoDe(id, indice);
    if (!t) return;
    if (esManana(t) || esTarde(t)) actualizarTurno(id, indice, { desde: "09:00", hasta: "17:00" });
    setOtros((s) => new Set(s).add(`${id}-${indice}`));
  }

  function agregarTurno(id: string) {
    setLista((l) =>
      l.map((e) => (e.id === id ? { ...e, turnos: [...e.turnos, nuevoTurno(TARDE)] } : e)),
    );
  }

  function quitarTurno(id: string, indice: number) {
    setLista((l) =>
      l.map((e) => (e.id === id ? { ...e, turnos: e.turnos.filter((_, i) => i !== indice) } : e)),
    );
  }

  async function guardar() {
    const limpios = lista
      .map((e) => ({ ...e, nombre: e.nombre.trim(), turnos: e.turnos.filter((t) => t.dias.length > 0) }))
      .filter((e) => e.nombre.length > 0);
    await guardarEmpleados(limpios);
    onGuardar(limpios);
  }

  const nombresOk = lista.every((e) => e.nombre.trim().length > 0);
  const totalPasos = solo ? 2 : 3;
  const pasoActual = paso === "cuantos" ? 0 : paso === "nombres" ? 1 : totalPasos - 1;
  const ancho = paso === "turnos" && lista.length > 1;

  return (
    <div className="lamina-fondo">
      <div
        className={`lamina lamina-pantalla lamina-modal setup ${ancho ? "lamina-modal-ancha" : ""}`}
        role="dialog"
        aria-label="Empleados y turnos"
      >
        <div className="setup-cuerpo">
          {primeraVez && (
            <div className="setup-puntos" aria-hidden>
              {Array.from({ length: totalPasos }, (_, i) => (
                <span key={i} className={i === pasoActual ? "setup-punto-activo" : ""} />
              ))}
            </div>
          )}

          {paso === "cuantos" && (
            <>
              <div className="setup-titulos">
                <h2 className="setup-titulo">¿Cuántas personas trabajan en el kiosco?</h2>
                <p className="setup-sub">Contate a vos también.</p>
              </div>
              <div className="setup-numeros">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button key={n} className="setup-numero" onClick={() => elegirCantidad(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}

          {paso === "nombres" && (
            <>
              <h2 className="setup-titulo">¿Cómo se llaman?</h2>
              <div className="setup-nombres">
                {lista.map((e, i) => (
                  <div key={e.id} className="setup-nombre-pill">
                    <input
                      autoFocus={i === 0}
                      placeholder={`Persona ${i + 1}`}
                      value={e.nombre}
                      onChange={(ev) => actualizar(e.id, { nombre: ev.target.value })}
                      aria-label={`Nombre de la persona ${i + 1}`}
                    />
                    <button className="setup-x" aria-label="Quitar" onClick={() => quitar(e.id)}>
                      {IconoX}
                    </button>
                  </div>
                ))}
                <button className="setup-enlace" onClick={agregarPersona}>
                  Agregar otra persona
                </button>
              </div>
            </>
          )}

          {paso === "turnos" && (
            <>
              <div className="setup-titulos">
                <h2 className="setup-titulo">
                  {solo ? "¿Qué turnos hacés?" : primeraVez ? "¿Qué turnos hacen?" : "Empleados y turnos"}
                </h2>
                {solo && <p className="setup-sub">Trabajás solo, así que este es tu horario.</p>}
              </div>
              <div className="setup-personas">
                {lista.map((e) => (
                  <div key={e.id} className="setup-persona">
                    <div className="setup-persona-cabecera">
                      <input
                        className="setup-persona-nombre"
                        value={e.nombre}
                        placeholder="Nombre"
                        readOnly={solo}
                        onChange={(ev) => actualizar(e.id, { nombre: ev.target.value })}
                        aria-label="Nombre"
                      />
                      {!solo && (
                        <button className="setup-x" aria-label={`Quitar a ${e.nombre || "esta persona"}`} onClick={() => quitar(e.id)}>
                          {IconoX}
                        </button>
                      )}
                    </div>
                    {e.turnos.map((t, i) => {
                      const clave = `${e.id}-${i}`;
                      const manana = esManana(t);
                      const tarde = esTarde(t);
                      const otro = (!manana && !tarde) || otros.has(clave);
                      return (
                        <div key={i} className="setup-turno">
                          <div className="setup-dias" role="group" aria-label="Días">
                            {ORDEN_DIAS.map((dia, k) => (
                              <button
                                key={dia}
                                className={`setup-dia ${t.dias.includes(dia) ? "setup-dia-on" : ""}`}
                                aria-pressed={t.dias.includes(dia)}
                                onClick={() => alternarDia(e.id, i, dia)}
                              >
                                {LETRAS[k]}
                              </button>
                            ))}
                          </div>
                          <div className="setup-pills">
                            <button
                              className={`setup-pill ${manana && !otros.has(clave) ? "setup-pill-on" : ""}`}
                              onClick={() => alternarManana(e.id, i)}
                            >
                              Mañana 08 a 14
                            </button>
                            <button
                              className={`setup-pill ${tarde && !otros.has(clave) ? "setup-pill-on" : ""}`}
                              onClick={() => alternarTarde(e.id, i)}
                            >
                              Tarde 14 a 21
                            </button>
                            {!otro && (
                              <button className="setup-enlace setup-enlace-chico" onClick={() => abrirOtro(e.id, i)}>
                                Otro horario
                              </button>
                            )}
                          </div>
                          {otro && (
                            <div className="setup-horas">
                              <input
                                type="time"
                                value={t.desde}
                                onChange={(ev) => actualizarTurno(e.id, i, { desde: ev.target.value })}
                                aria-label="Desde"
                              />
                              <span>a</span>
                              <input
                                type="time"
                                value={t.hasta}
                                onChange={(ev) => actualizarTurno(e.id, i, { hasta: ev.target.value })}
                                aria-label="Hasta"
                              />
                              {e.turnos.length > 1 && (
                                <button className="setup-enlace setup-enlace-gris setup-enlace-chico" onClick={() => quitarTurno(e.id, i)}>
                                  Quitar
                                </button>
                              )}
                            </div>
                          )}
                          {!otro && e.turnos.length > 1 && (
                            <button className="setup-enlace setup-enlace-gris setup-enlace-chico setup-quitar-turno" onClick={() => quitarTurno(e.id, i)}>
                              Quitar este turno
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button className="setup-enlace setup-enlace-gris setup-enlace-chico" onClick={() => agregarTurno(e.id)}>
                      Agregar otro turno
                    </button>
                  </div>
                ))}
              </div>
              {!solo && (
                <button className="setup-enlace" onClick={agregarPersona}>
                  Agregar otra persona
                </button>
              )}
            </>
          )}
        </div>

        <div className="setup-pie">
          {paso === "cuantos" && (
            <button className="setup-enlace setup-enlace-gris" onClick={onCerrar}>
              Ahora no
            </button>
          )}
          {paso === "nombres" && (
            <button className="boton-principal setup-boton" disabled={!nombresOk || lista.length === 0} onClick={() => setPaso("turnos")}>
              SIGUIENTE
            </button>
          )}
          {paso === "turnos" && (
            <button className="boton-principal setup-boton" disabled={!nombresOk} onClick={guardar}>
              LISTO
            </button>
          )}
          {paso !== "cuantos" && (
            <button className="setup-enlace setup-enlace-gris" onClick={onCerrar}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
