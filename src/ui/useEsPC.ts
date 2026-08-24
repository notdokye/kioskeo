import { useEffect, useState } from "react";

const CONSULTA = "(min-width: 900px)";

/** true en pantallas anchas (barra lateral); false en celular. */
export function useEsPC(): boolean {
  const [esPC, setEsPC] = useState(() => window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const alCambiar = () => setEsPC(mq.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  return esPC;
}
