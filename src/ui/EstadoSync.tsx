import { useEffect, useState } from "react";
import { estadoSync, type EstadoSync as Estado } from "../sync/sync";
import { supabase } from "../sync/supabase";

// Chip de estado de la nube: el dueño tiene que poder confiar en que sus
// datos están respaldados, y enterarse si algo quedó pendiente de subir.

export function EstadoSyncChip() {
  const configurado = supabase() !== null;
  const [estado, setEstado] = useState<Estado>(estadoSync());

  useEffect(() => {
    if (!configurado) return;
    const timer = setInterval(() => setEstado(estadoSync()), 3000);
    return () => clearInterval(timer);
  }, [configurado]);

  if (!configurado) {
    return <span className="chip-gris">Modo local · sin nube</span>;
  }
  if (estado.error) {
    return (
      <span className="chip-gris">
        Sin conexión{estado.pendientes > 0 ? ` · ${estado.pendientes} por subir` : ""}
      </span>
    );
  }
  if (estado.pendientes > 0) {
    return <span className="chip-gris">Subiendo {estado.pendientes}…</span>;
  }
  if (estado.ultimoExito) {
    return <span className="chip-verde">Respaldado</span>;
  }
  return <span className="chip-gris">Conectando…</span>;
}
