import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { iniciarReporteDeErrores } from "./errores";
import { prepararAudio } from "./ui/sonidos";

// Actualizaciones sin fricción: apenas hay una versión nueva publicada, el
// service worker la instala y la app se recarga sola en el próximo arranque
// (immediate: true evita quedar pegado a versiones viejas cacheadas).
const actualizarSW = registerSW({
  immediate: true,
  // Apenas hay versión nueva lista, se aplica y la página se recarga sola.
  onNeedRefresh() {
    actualizarSW(true);
  },
  // Safari en iPhone es perezoso para buscar actualizaciones: se le pide
  // cada vez que la app vuelve al frente y cada hora.
  onRegisteredSW(_url, registro) {
    if (!registro) return;
    const buscar = () => void registro.update();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") buscar();
    });
    setInterval(buscar, 60 * 60 * 1000);
  },
});
iniciarReporteDeErrores();
prepararAudio();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
