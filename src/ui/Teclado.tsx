import { useEffect, useRef } from "react";
import { pesos, type Centavos } from "../core";
import "./Teclado.css";

// Teclado numérico propio: el del celular tapa media pantalla y cambia según
// el teléfono. Se escriben pesos enteros (la caja no maneja centavos).

interface Props {
  valor: Centavos;
  onCambio: (valor: Centavos) => void;
}

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "borrar"];
const MAXIMO = 99_999_999; // pesos

export function Teclado({ valor, onCambio }: Props) {
  // Se parte del último valor emitido, no de la prop: dos toques muy
  // seguidos (antes de que React vuelva a renderizar) no se pisan.
  const ultimo = useRef<Centavos>(valor);
  useEffect(() => {
    ultimo.current = valor;
  }, [valor]);

  function emitir(enteros: number) {
    const centavos = pesos(enteros);
    ultimo.current = centavos;
    onCambio(centavos);
  }

  // Teclado físico (PC): números, Backspace. No interfiere si hay un campo de texto con foco.
  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      const activo = document.activeElement;
      if (activo && (activo.tagName === "INPUT" || activo.tagName === "TEXTAREA")) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        tocar(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        tocar("borrar");
      }
    }
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tocar(tecla: string) {
    const enteros = Math.round(ultimo.current / 100);
    if (tecla === "borrar") {
      emitir(Math.floor(enteros / 10));
      return;
    }
    const nuevo = Number(`${enteros}${tecla}`);
    if (!Number.isFinite(nuevo) || nuevo > MAXIMO) return;
    emitir(nuevo);
  }

  return (
    <div className="teclado" role="group" aria-label="Teclado numérico">
      {TECLAS.map((t) => (
        <button
          key={t}
          type="button"
          className={`teclado-tecla ${t === "borrar" ? "teclado-borrar" : ""}`}
          aria-label={t === "borrar" ? "Borrar" : t}
          onClick={() => tocar(t)}
        >
          {t === "borrar" ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z" />
              <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
            </svg>
          ) : (
            t
          )}
        </button>
      ))}
    </div>
  );
}
