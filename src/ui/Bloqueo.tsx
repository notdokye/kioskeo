import { enlaceWhatsApp, PRECIO_MENSUAL } from "../contacto";
import { describirVencimiento, type Resumen } from "../suscripcion";
import "./Pantallas.css";
import "./Bloqueo.css";

// Pantalla de suscripción vencida. Amable y clara: los datos están, se
// renueva por WhatsApp, y "Ya pagué" vuelve a consultar al servidor.

interface Props {
  resumen: Resumen;
  email: string;
  nombreNegocio: string;
  onReintentar: () => Promise<void>;
  onSalir: () => void;
}

export function Bloqueo({ resumen, email, nombreNegocio, onReintentar, onSalir }: Props) {
  const mensaje = `Hola, quiero ${resumen.prueba ? "contratar" : "renovar"} Kioskeo para ${nombreNegocio} (${email}).`;
  return (
    <div className="bloqueo">
      <div className="bloqueo-caja">
        <span className="bloqueo-isotipo">K</span>
        <h1>{resumen.prueba ? "Se terminó tu prueba gratis" : "Tu suscripción venció"}</h1>
        <p className="bloqueo-sub">
          {resumen.venceEl && `Venció el ${describirVencimiento(resumen.venceEl)}. `}
          Tus productos, ventas y fiados están guardados tal cual los dejaste: apenas renovás, seguís
          desde donde estabas.
        </p>
        <div className="bloqueo-precio">
          <span>Plan mensual</span>
          <strong>$ {PRECIO_MENSUAL.toLocaleString("es-AR")}</strong>
          <span>por mes, por negocio</span>
        </div>
        <a className="boton-principal bloqueo-boton" href={enlaceWhatsApp(mensaje)} target="_blank" rel="noreferrer">
          RENOVAR POR WHATSAPP
        </a>
        <button className="bloqueo-secundario" onClick={() => void onReintentar()}>
          Ya pagué, actualizar
        </button>
        <button className="bloqueo-salir" onClick={onSalir}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
