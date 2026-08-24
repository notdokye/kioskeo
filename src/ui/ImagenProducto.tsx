import { inicialesDe, tonoDe } from "./imagen";
import "./ImagenProducto.css";

// La imagen de un producto, o su placeholder: iniciales sobre un color
// pastel estable derivado del nombre — nada de cuadrados grises tristes.

interface Props {
  nombre: string;
  imagen?: string;
  /** Lado en px. */
  tam?: number;
}

export function ImagenProducto({ nombre, imagen, tam = 40 }: Props) {
  if (imagen) {
    return (
      <img
        className="imagen-producto"
        src={imagen}
        alt=""
        width={tam}
        height={tam}
        loading="lazy"
        style={{ width: tam, height: tam }}
      />
    );
  }
  const tono = tonoDe(nombre);
  return (
    <span
      className="imagen-placeholder"
      aria-hidden
      style={{
        width: tam,
        height: tam,
        fontSize: tam * 0.38,
        background: `hsl(${tono} 70% 92%)`,
        color: `hsl(${tono} 45% 38%)`,
      }}
    >
      {inicialesDe(nombre)}
    </span>
  );
}
