import { useEffect, useRef, useState } from "react";
import {
  cambiarContrasena,
  confirmarConCodigo,
  crearCuenta,
  entrarConCodigoRecuperacion,
  iniciarSesion,
  pedirRecuperacion,
  reenviarConfirmacion,
  type Sesion,
} from "../auth";
import { borrarPendiente, guardarPendiente } from "../pendiente";
import "./Login.css";

interface Props {
  onListo: (sesion: Sesion) => void;
  onVolver: () => void;
  /** "nueva": la app se abrió desde el link de recuperación del email.
   *  "esperando": hay un registro pendiente de confirmar (emailInicial). */
  modoInicial?: "crear" | "entrar" | "nueva" | "esperando";
  emailInicial?: string;
}

type Modo = "crear" | "entrar" | "esperando" | "recuperar" | "enviado" | "nueva";

export function Login({ onListo, onVolver, modoInicial = "crear", emailInicial = "" }: Props) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [email, setEmail] = useState(emailInicial);
  const [contrasena, setContrasena] = useState("");
  const [contrasena2, setContrasena2] = useState("");
  const [negocio, setNegocio] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const onListoRef = useRef(onListo);
  onListoRef.current = onListo;

  async function enviar() {
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      if (modo === "crear") {
        const resultado = await crearCuenta(email, contrasena, negocio);
        if (resultado === "confirmar-email") {
          guardarPendiente({ email: email.trim().toLowerCase() });
          setModo("esperando");
          return;
        }
        onListo(resultado);
      } else if (modo === "entrar") {
        try {
          onListo(await iniciarSesion(email, contrasena));
        } catch (e) {
          // Cuenta creada pero nunca confirmada: directo a la pantalla del
          // código, con reenvío a mano (el código anterior puede haber vencido).
          if (e instanceof Error && e.message.includes("confirmaste")) {
            guardarPendiente({ email: email.trim().toLowerCase() });
            setCodigo("");
            setModo("esperando");
            setAviso("Tu cuenta todavía no está confirmada. Si el código venció, tocá reenviar.");
            return;
          }
          throw e;
        }
      } else if (modo === "recuperar") {
        await pedirRecuperacion(email);
        setModo("enviado");
      } else if (modo === "nueva") {
        if (contrasena !== contrasena2) throw new Error("Las contraseñas no coinciden");
        onListo(await cambiarContrasena(contrasena));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal, probá de nuevo");
    } finally {
      setCargando(false);
    }
  }

  async function confirmarCodigo() {
    if (codigo.length < 6) return;
    setError(null);
    setCargando(true);
    try {
      if (modo === "enviado") {
        await entrarConCodigoRecuperacion(email, codigo);
        setCodigo("");
        setContrasena("");
        setModo("nueva");
      } else {
        const sesion = await confirmarConCodigo(email, codigo);
        borrarPendiente();
        onListo(sesion);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código incorrecto");
    } finally {
      setCargando(false);
    }
  }

  // Mientras se espera la confirmación, se reintenta entrar cada 4 segundos:
  // apenas el usuario toca el botón del email, esta pantalla avanza sola.
  useEffect(() => {
    if (modo !== "esperando") return;
    const timer = setInterval(async () => {
      try {
        const sesion = await iniciarSesion(email, contrasena);
        clearInterval(timer);
        borrarPendiente();
        onListoRef.current(sesion);
      } catch {
        // sigue sin confirmar: se reintenta en el próximo tick
      }
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  if (modo === "esperando" || modo === "enviado") {
    const esRecuperacion = modo === "enviado";
    return (
      <div className="login">
        <div className="login-caja">
          <span className="login-isotipo">K</span>
          <h1>Revisá tu correo</h1>
          <p className="login-sub">
            Te mandamos un email a <strong>{email.trim()}</strong> con un código de 6 dígitos.
            Escribilo acá{esRecuperacion ? "" : " (o tocá el botón del email, esta pantalla avanza sola)"}.
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
            {esRecuperacion ? "CONTINUAR" : "CONFIRMAR"}
          </button>
          {!esRecuperacion && (
            <div className="login-esperando" aria-hidden>
              <span className="login-punto" />
              <span className="login-punto" />
              <span className="login-punto" />
            </div>
          )}
          {aviso && <p className="login-aviso">{aviso}</p>}
          {error && <p className="login-error">{error}</p>}
          <button
            className="login-cambio"
            onClick={async () => {
              setError(null);
              try {
                if (esRecuperacion) await pedirRecuperacion(email);
                else await reenviarConfirmacion(email);
                setAviso("Listo, te lo reenviamos. Mirá también en spam.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "No pudimos reenviarlo");
              }
            }}
          >
            No me llegó — reenviar email
          </button>
          <button
            className="login-cambio"
            onClick={() => {
              if (!esRecuperacion) borrarPendiente();
              setModo(esRecuperacion ? "entrar" : "crear");
            }}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const titulo =
    modo === "crear"
      ? "Creá tu cuenta"
      : modo === "entrar"
        ? "Hola de nuevo"
        : modo === "recuperar"
          ? "¿Olvidaste la contraseña?"
          : "Elegí una contraseña nueva";
  const subtitulo =
    modo === "crear"
      ? "30 días gratis, sin tarjeta."
      : modo === "entrar"
        ? "Entrá para seguir vendiendo."
        : modo === "recuperar"
          ? "Decinos tu email y te mandamos un link para cambiarla."
          : "Mínimo 6 caracteres. Después entrás directo.";

  return (
    <div className="login">
      {modo !== "nueva" && (
        <button
          className="login-volver"
          onClick={() => {
            if (modo === "recuperar") {
              setModo("entrar");
              setError(null);
            } else onVolver();
          }}
        >
          ← Volver
        </button>
      )}
      <div className="login-caja">
        <span className="login-isotipo">K</span>
        <h1>{titulo}</h1>
        <p className="login-sub">{subtitulo}</p>

        {modo === "crear" && (
          <input
            className="campo"
            placeholder="Nombre del negocio (ej: Kiosco El Tano)"
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
            aria-label="Nombre del negocio"
          />
        )}
        {modo !== "nueva" && (
          <input
            className="campo"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && modo === "recuperar" && enviar()}
            aria-label="Email"
          />
        )}
        {modo !== "recuperar" && (
          <input
            className="campo"
            type="password"
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            placeholder={modo === "nueva" ? "Contraseña nueva" : "Contraseña"}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && modo !== "nueva" && enviar()}
            aria-label="Contraseña"
          />
        )}
        {modo === "nueva" && (
          <input
            className="campo"
            type="password"
            autoComplete="new-password"
            placeholder="Repetila"
            value={contrasena2}
            onChange={(e) => setContrasena2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()}
            aria-label="Repetir contraseña"
          />
        )}

        {error && <p className="login-error">{error}</p>}
        {aviso && <p className="login-aviso">{aviso}</p>}

        <button className="boton-principal" disabled={cargando} onClick={enviar}>
          {modo === "crear"
            ? "EMPEZAR GRATIS"
            : modo === "entrar"
              ? "ENTRAR"
              : modo === "recuperar"
                ? "MANDAR EL LINK"
                : "GUARDAR Y ENTRAR"}
        </button>

        {modo === "entrar" && (
          <button
            className="login-cambio"
            onClick={() => {
              setModo("recuperar");
              setError(null);
            }}
          >
            Olvidé mi contraseña
          </button>
        )}
        {modo === "crear" && (
          <p className="login-legal">
            Al crear la cuenta aceptás los{" "}
            <a href="/terminos.html" target="_blank" rel="noreferrer">
              términos
            </a>{" "}
            y la{" "}
            <a href="/privacidad.html" target="_blank" rel="noreferrer">
              política de privacidad
            </a>
            .
          </p>
        )}
        {modo !== "nueva" && (
          <button
            className="login-cambio"
            onClick={() => {
              setModo(modo === "crear" ? "entrar" : "crear");
              setError(null);
            }}
          >
            {modo === "crear" ? "Ya tengo cuenta — entrar" : "No tengo cuenta — crear una gratis"}
          </button>
        )}
      </div>
    </div>
  );
}
