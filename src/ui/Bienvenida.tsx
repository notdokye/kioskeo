import { useRef, useState } from "react";
import { guardarAjustes, type Ajustes } from "../ajustes";
import { confirmarConCodigo, crearCuenta, iniciarSesion, reenviarConfirmacion, type Sesion } from "../auth";
import { borrarPendiente, guardarPendiente } from "../pendiente";
import { llegadaBienvenida, notaBienvenida } from "./sonidos";
import "./Bienvenida.css";

// El camino de bienvenida (diseño de Claude design): una pregunta gigante
// por pantalla, fondos alternados blanco/salmón, y cada respuesta abre la
// siguiente con una onda circular que nace del punto exacto del toque.
// Las preguntas van ANTES de crear la cuenta: el usuario se compromete
// respondiendo sobre SU negocio, y recién al final pone el email.

interface Pregunta {
  q: string;
  sub?: string;
  icono: string;
  opciones: { texto: string; icono?: string }[];
}

const PREGUNTAS: Pregunta[] = [
  {
    q: "¿Vendés fiado?",
    icono: "libreta",
    opciones: [
      { texto: "Sí, tengo clientes que anotan" },
      { texto: "No, en mi negocio no se fía" },
    ],
  },
  {
    q: "¿Contás la plata del cajón al cerrar?",
    icono: "cajon",
    opciones: [
      { texto: "Sí, hago cierre de caja" },
      { texto: "No, no cuento el cajón" },
    ],
  },
  {
    q: "¿Cómo vas a cargar tus productos?",
    icono: "",
    opciones: [
      { texto: "Tengo una lista en Excel", icono: "planilla" },
      { texto: "Los escaneo con la cámara", icono: "escanear" },
      { texto: "Los cargo a mano", icono: "lapiz" },
    ],
  },
  {
    q: "¿Querés que Kioskeo te cuente secretos de tu negocio?",
    sub: "Qué se vende más, en qué horario entra más gente, qué te deja más ganancia.",
    icono: "lamparita",
    opciones: [{ texto: "Sí, contame todo" }, { texto: "No, solo quiero cobrar" }],
  },
];

function respuestasAAjustes(r: number[]): Ajustes {
  return {
    fiados: r[0] === 0,
    caja: r[1] === 0,
    carga: (["excel", "escanear", "mano"] as const)[r[2]] ?? "mano",
    sonidos: true,
    secretos: r[3] === 0,
  };
}

interface Props {
  onListo: (sesion: Sesion, ajustes: Ajustes) => void;
  onVolver: () => void;
  onYaTengoCuenta: () => void;
}

type Fase =
  | { tipo: "pregunta"; indice: number }
  | { tipo: "cuenta" }
  | { tipo: "esperando-email" };

export function Bienvenida({ onListo, onVolver, onYaTengoCuenta }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: "pregunta", indice: 0 });
  const [respuestas, setRespuestas] = useState<number[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  const [onda, setOnda] = useState<{ x: number; y: number; clave: number } | null>(null);
  const [negocio, setNegocio] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [codigo, setCodigo] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const indice = fase.tipo === "pregunta" ? fase.indice : PREGUNTAS.length;
  const esSalmon = fase.tipo === "pregunta" && fase.indice % 2 === 1;

  function avanzar(desdeX: number, desdeY: number, opcion: number) {
    if (fase.tipo !== "pregunta" || elegida !== null) return;
    const i = fase.indice;
    setElegida(opcion);
    notaBienvenida(i);
    setRespuestas((r) => {
      const nuevo = [...r];
      nuevo[i] = opcion;
      return nuevo;
    });
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const espera = reducido ? 120 : 420;
    setTimeout(() => {
      setOnda({ x: desdeX, y: desdeY, clave: Date.now() });
      setTimeout(() => {
        const esUltima = i + 1 >= PREGUNTAS.length;
        setFase(esUltima ? { tipo: "cuenta" } : { tipo: "pregunta", indice: i + 1 });
        setElegida(null);
        if (esUltima) llegadaBienvenida();
      }, reducido ? 0 : 380);
      setTimeout(() => setOnda(null), reducido ? 50 : 900);
    }, espera);
  }

  function volverAtras() {
    if (fase.tipo === "cuenta") {
      setFase({ tipo: "pregunta", indice: PREGUNTAS.length - 1 });
      return;
    }
    if (fase.tipo === "pregunta" && fase.indice > 0) {
      setFase({ tipo: "pregunta", indice: fase.indice - 1 });
    } else {
      onVolver();
    }
  }

  function saltar() {
    if (fase.tipo !== "pregunta") return;
    const i = fase.indice;
    setRespuestas((r) => {
      const nuevo = [...r];
      nuevo[i] = nuevo[i] ?? 0; // el valor por defecto es la primera opción
      return nuevo;
    });
    setFase(i + 1 < PREGUNTAS.length ? { tipo: "pregunta", indice: i + 1 } : { tipo: "cuenta" });
  }

  const ajustesElegidos = () => respuestasAAjustes(respuestas);

  async function crear() {
    setError(null);
    setCargando(true);
    try {
      const resultado = await crearCuenta(email, contrasena, negocio);
      if (resultado === "confirmar-email") {
        guardarPendiente({ email: email.trim().toLowerCase(), ajustes: ajustesElegidos() });
        setFase({ tipo: "esperando-email" });
        pollRef.current = setInterval(async () => {
          try {
            const sesion = await iniciarSesion(email, contrasena);
            if (pollRef.current) clearInterval(pollRef.current);
            const ajustes = ajustesElegidos();
            await guardarAjustes(ajustes);
            borrarPendiente();
            onListo(sesion, ajustes);
          } catch {
            // sigue sin confirmar
          }
        }, 4000);
        return;
      }
      const ajustes = ajustesElegidos();
      await guardarAjustes(ajustes);
      onListo(resultado, ajustes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal, probá de nuevo");
    } finally {
      setCargando(false);
    }
  }

  const resumen = (() => {
    const a = respuestasAAjustes(respuestas);
    return [
      a.fiados ? "Fiado activado" : "Sin fiados (lo podés prender cuando quieras)",
      a.caja ? "Cierre de caja activado" : "Sin cierre de caja",
      a.carga === "excel"
        ? "Carga de productos desde Excel"
        : a.carga === "escanear"
          ? "Carga de productos con la cámara"
          : "Carga de productos a mano",
      a.secretos ? "Secretos del negocio activados" : "Panel simple, sin análisis",
    ];
  })();

  async function confirmarCodigo() {
    if (codigo.length < 6) return;
    setError(null);
    setCargando(true);
    try {
      const sesion = await confirmarConCodigo(email, codigo);
      if (pollRef.current) clearInterval(pollRef.current);
      const ajustes = ajustesElegidos();
      await guardarAjustes(ajustes);
      borrarPendiente();
      onListo(sesion, ajustes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código incorrecto");
    } finally {
      setCargando(false);
    }
  }

  // --- pantalla de espera de confirmación de email ---
  if (fase.tipo === "esperando-email") {
    return (
      <div className="bienvenida bienvenida-clara">
        <div className="bien-cuenta bien-espera">
          <span className="bien-k bien-k-flota">K</span>
          <h1>Revisá tu correo</h1>
          <p className="bien-sub">
            Te mandamos un email a <strong>{email.trim()}</strong> con un código de 6 dígitos.
            Escribilo acá (o tocá el botón del email: esta pantalla avanza sola).
          </p>
          <input
            className="campo login-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(e) => e.key === "Enter" && confirmarCodigo()}
            aria-label="Código de 6 dígitos"
            autoFocus
          />
          <button className="boton-principal" disabled={codigo.length < 6 || cargando} onClick={confirmarCodigo}>
            CONFIRMAR
          </button>
          <div className="login-esperando" aria-hidden>
            <span className="login-punto" />
            <span className="login-punto" />
            <span className="login-punto" />
          </div>
          {aviso && <p className="bien-aviso">{aviso}</p>}
          {error && <p className="bien-error">{error}</p>}
          <button
            className="bien-link"
            onClick={async () => {
              try {
                await reenviarConfirmacion(email);
                setAviso("Listo, reenviado. Mirá también en spam.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "No pudimos reenviarlo");
              }
            }}
          >
            No me llegó — reenviar email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={contenedorRef}
      className={`bienvenida ${esSalmon ? "bienvenida-salmon" : "bienvenida-clara"}`}
    >
      {/* barra de progreso: el camino recorrido */}
      <div className="bien-progreso" aria-hidden>
        <div
          className="bien-progreso-linea"
          style={{ width: `${(Math.min(indice, 4) / 4) * 100}%` }}
        />
        {fase.tipo === "pregunta" && (
          <span className="bien-progreso-texto">{fase.indice + 1} de 4</span>
        )}
      </div>

      <div className="bien-topbar">
        <button className="bien-volver" aria-label="Volver" onClick={volverAtras}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <polyline
              points="13,4 6,11 13,18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {fase.tipo === "pregunta" ? (
          <button className="bien-saltar" onClick={saltar}>
            Saltar
          </button>
        ) : (
          <button className="bien-saltar" onClick={onYaTengoCuenta}>
            Ya tengo cuenta
          </button>
        )}
      </div>

      {fase.tipo === "pregunta" && (
        <div className="bien-pregunta" key={fase.indice}>
          <div className="bien-enunciado">
            {PREGUNTAS[fase.indice].icono && (
              <IconoBienvenida nombre={PREGUNTAS[fase.indice].icono} />
            )}
            <h1 className={fase.indice === 3 ? "bien-titulo-chico" : ""}>
              {PREGUNTAS[fase.indice].q}
            </h1>
            {PREGUNTAS[fase.indice].sub && (
              <p className="bien-sub">{PREGUNTAS[fase.indice].sub}</p>
            )}
          </div>
          <div className="bien-opciones">
            {PREGUNTAS[fase.indice].opciones.map((o, j) => (
              <button
                key={j}
                className={`bien-opcion ${elegida === j ? "bien-opcion-elegida" : ""} ${respuestas[fase.indice] === j && elegida === null ? "bien-opcion-previa" : ""}`}
                style={{ animationDelay: `${0.4 + j * 0.14}s` }}
                onClick={(e) => avanzar(e.clientX, e.clientY, j)}
              >
                {o.icono && <IconoBienvenida nombre={o.icono} chico />}
                {o.texto}
              </button>
            ))}
          </div>
        </div>
      )}

      {fase.tipo === "cuenta" && (
        <div className="bien-cuenta-layout">
          <div className="bien-cuenta">
            <span className="bien-k bien-k-flota">K</span>
            <h1>Último paso</h1>
            <p className="bien-sub">Kioskeo ya quedó armado para tu negocio.</p>
            <label className="bien-campo">
              <span>Nombre del negocio</span>
              <input
                autoFocus
                placeholder="Kiosco El Trébol"
                value={negocio}
                onChange={(e) => setNegocio(e.target.value)}
              />
            </label>
            <label className="bien-campo">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="bien-campo">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && crear()}
              />
            </label>
            {error && <p className="bien-error">{error}</p>}
            <button className="bien-crear" disabled={cargando} onClick={crear}>
              CREAR MI CUENTA
            </button>
            <p className="bien-letrachica">Sin tarjeta. Sin permanencia.</p>
          </div>

          <aside className="bien-resumen">
            <h2>Tu Kioskeo quedó así</h2>
            {resumen.map((texto) => (
              <div key={texto} className="bien-check">
                <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
                  <circle cx="11" cy="11" r="10" fill="var(--verde)" />
                  <polyline
                    points="6.5,11.5 9.5,14.5 15.5,8"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{texto}</span>
              </div>
            ))}
            <p className="bien-letrachica">
              Sin tarjeta. Sin permanencia. Podés cambiar todo cuando quieras.
            </p>
          </aside>
        </div>
      )}

      {onda && (
        <span
          key={onda.clave}
          className="bien-onda"
          style={{ left: onda.x, top: onda.y }}
          aria-hidden
        />
      )}
    </div>
  );
}

function IconoBienvenida({ nombre, chico }: { nombre: string; chico?: boolean }) {
  const s = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const cuerpo: Record<string, React.ReactNode> = {
    libreta: (
      <g {...s}>
        <rect x="7" y="5" width="16" height="22" rx="2.5" />
        <line x1="11" y1="11" x2="19" y2="11" />
        <line x1="11" y1="16" x2="19" y2="16" />
        <line x1="11" y1="21" x2="16" y2="21" />
        <line x1="4.5" y1="9" x2="7" y2="9" />
        <line x1="4.5" y1="16" x2="7" y2="16" />
        <line x1="4.5" y1="23" x2="7" y2="23" />
      </g>
    ),
    cajon: (
      <g {...s}>
        <rect x="4" y="10" width="24" height="14" rx="2.5" />
        <path d="M4 16 h9 c0 2 2 3.4 3 3.4 s3-1.4 3-3.4 h9" />
        <circle cx="11" cy="7" r="2.6" />
        <circle cx="17" cy="6" r="2.6" />
      </g>
    ),
    planilla: (
      <g {...s}>
        <rect x="6" y="5" width="20" height="22" rx="2.5" />
        <line x1="6" y1="12" x2="26" y2="12" />
        <line x1="6" y1="19" x2="26" y2="19" />
        <line x1="13" y1="5" x2="13" y2="27" />
      </g>
    ),
    escanear: (
      <g {...s}>
        <path d="M5 10 V7 a2 2 0 0 1 2-2 h3 M22 5 h3 a2 2 0 0 1 2 2 v3 M27 22 v3 a2 2 0 0 1-2 2 h-3 M10 27 H7 a2 2 0 0 1-2-2 v-3" />
        <line x1="8" y1="16" x2="24" y2="16" />
      </g>
    ),
    lapiz: (
      <g {...s}>
        <path d="M8 24 l-2 6 6-2 L26 14 a3 3 0 0 0-4-4 Z" />
        <line x1="18" y1="13" x2="23" y2="18" />
      </g>
    ),
    lamparita: (
      <g {...s}>
        <path d="M16 4 a8 8 0 0 1 5 14.2 c-1.2 1-1.8 2-1.8 3.3 h-6.4 c0-1.3-.6-2.3-1.8-3.3 A8 8 0 0 1 16 4 Z" />
        <line x1="13" y1="25.5" x2="19" y2="25.5" />
        <line x1="14" y1="28.5" x2="18" y2="28.5" />
      </g>
    ),
  };
  return (
    <svg
      width={chico ? 26 : 36}
      height={chico ? 26 : 36}
      viewBox="0 0 32 32"
      className={chico ? "bien-icono-chico" : "bien-icono"}
      aria-hidden
    >
      {cuerpo[nombre]}
    </svg>
  );
}
