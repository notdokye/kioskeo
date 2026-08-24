import { useEffect, useState } from "react";
import "./Instalar.css";

// "Instalala en tu celular": en iPhone no hay botón de instalar, hay que
// explicarlo; en Android Chrome se captura el evento y se ofrece el botón.

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let promptDiferido: EventoInstalacion | null = null;
const oyentes = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptDiferido = e as EventoInstalacion;
    oyentes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    promptDiferido = null;
    oyentes.forEach((f) => f());
  });
}

export function estaInstalada(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function esIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function esCelular(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
}

const IconoCompartir = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v13M7 8l5-5 5 5M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </svg>
);

interface Props {
  /** Tarjeta chica con "Después" (Panel) o bloque completo (Ajustes). */
  compacto?: boolean;
  onDespues?: () => void;
}

export function Instalar({ compacto = false, onDespues }: Props) {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  }, []);

  if (estaInstalada()) {
    return compacto ? null : (
      <p className="instalar-ok">Ya está instalada en este dispositivo.</p>
    );
  }

  const ios = esIOS();
  const celular = esCelular();

  async function instalar() {
    if (!promptDiferido) return;
    await promptDiferido.prompt();
    await promptDiferido.userChoice;
    promptDiferido = null;
    refrescar((n) => n + 1);
  }

  return (
    <div className={`instalar ${compacto ? "instalar-compacta" : ""}`}>
      <p className="instalar-titulo">
        {celular ? "Instalá Kioskeo en tu celular" : "Instalá Kioskeo en esta compu"}
      </p>
      <p className="instalar-nota">
        Queda como una app más, con su ícono, abre al toque y anda sin internet.
      </p>
      {promptDiferido ? (
        <button className="boton-principal instalar-boton" onClick={instalar}>
          INSTALAR
        </button>
      ) : ios ? (
        <ol className="instalar-pasos">
          <li>
            Abrí esta página en <strong>Safari</strong> y tocá <strong>Compartir</strong> {IconoCompartir}
          </li>
          <li>
            Elegí <strong>"Agregar a pantalla de inicio"</strong>
          </li>
          <li>
            Tocá <strong>Agregar</strong>. Listo.
          </li>
        </ol>
      ) : celular ? (
        <ol className="instalar-pasos">
          <li>
            Tocá el menú <strong>⋮</strong> del navegador
          </li>
          <li>
            Elegí <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla principal"</strong>
          </li>
        </ol>
      ) : (
        <p className="instalar-nota">
          En Chrome o Edge, tocá el ícono de instalar que aparece a la derecha de la barra de direcciones.
        </p>
      )}
      {compacto && onDespues && (
        <button className="instalar-despues" onClick={onDespues}>
          Después
        </button>
      )}
    </div>
  );
}
