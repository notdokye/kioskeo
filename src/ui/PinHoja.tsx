import { useEffect, useState } from "react";
import { pinValido, verificarPin } from "../pin";
import "./Pantallas.css";
import "./PinHoja.css";

// Hoja para pedir (o crear) el PIN del dueño: cuatro puntos y un teclado.
// modo "verificar": compara con el PIN guardado.
// modo "crear": pide el PIN dos veces y lo devuelve.

interface Props {
  modo: "verificar" | "crear";
  titulo?: string;
  onOk: (pin: string) => void;
  onCancelar: () => void;
}

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"];

export function PinHoja({ modo, titulo, onOk, onCancelar }: Props) {
  const [pin, setPin] = useState("");
  const [primero, setPrimero] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sacudir, setSacudir] = useState(false);

  function fallar(mensaje: string) {
    setError(mensaje);
    setPin("");
    setSacudir(true);
    setTimeout(() => setSacudir(false), 400);
  }

  async function completar(valor: string) {
    if (!pinValido(valor)) return;
    if (modo === "verificar") {
      if (await verificarPin(valor)) onOk(valor);
      else fallar("PIN incorrecto");
      return;
    }
    if (primero === null) {
      setPrimero(valor);
      setPin("");
      setError(null);
      return;
    }
    if (primero === valor) onOk(valor);
    else {
      setPrimero(null);
      fallar("No coincidieron, empezá de nuevo");
    }
  }

  function tocar(t: string) {
    if (t === "") return;
    setError(null);
    if (t === "borrar") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const nuevo = (pin + t).slice(0, 4);
    setPin(nuevo);
    if (nuevo.length === 4) void completar(nuevo);
  }

  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        tocar(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        tocar("borrar");
      } else if (e.key === "Escape") {
        onCancelar();
      }
    }
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, primero, modo]);

  const encabezado =
    titulo ?? (modo === "crear" ? (primero === null ? "Elegí un PIN de 4 dígitos" : "Repetilo") : "PIN del dueño");

  return (
    <div className="hoja-fondo" role="dialog" aria-label={encabezado}>
      <div className="hoja pin-hoja">
        <p className="hoja-titulo" style={{ textAlign: "center" }}>
          {modo === "crear" && primero !== null ? "Repetilo" : encabezado}
        </p>
        <div className={`pin-puntos ${sacudir ? "pin-sacudir" : ""}`} aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-punto ${i < pin.length ? "pin-punto-on" : ""}`} />
          ))}
        </div>
        <p className={`pin-error ${error ? "" : "pin-error-vacio"}`}>{error ?? " "}</p>
        <div className="teclado pin-teclado">
          {TECLAS.map((t, i) => (
            <button
              key={i}
              type="button"
              className={`teclado-tecla ${t === "" ? "pin-tecla-vacia" : ""} ${t === "borrar" ? "teclado-borrar" : ""}`}
              aria-label={t === "borrar" ? "Borrar" : t || undefined}
              disabled={t === ""}
              onClick={() => tocar(t)}
            >
              {t === "borrar" ? "⌫" : t}
            </button>
          ))}
        </div>
        <button className="hoja-cancelar" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
