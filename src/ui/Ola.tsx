import "./Ola.css";

// La ola salmón de las transiciones ceremoniales, en dos fases:
// 1) "entrando": barre hasta cubrir la pantalla por completo y ahí dispara
//    onCubierta — ese es el momento seguro para cambiar la vista, porque
//    ocurre cuando la animación REALMENTE terminó de cubrir (evento del
//    navegador), no cuando un cronómetro cree que terminó.
// 2) "saliendo": sigue de largo revelando la pantalla nueva.

export type FaseOla = "entrando" | "saliendo";

interface Props {
  fase: FaseOla;
  onCubierta: () => void;
  onFin: () => void;
}

export function Ola({ fase, onCubierta, onFin }: Props) {
  return (
    <div className="ola" aria-hidden>
      <div
        className={`ola-capa ola-${fase}`}
        onAnimationEnd={fase === "entrando" ? onCubierta : onFin}
      >
        <svg
          className="ola-borde"
          viewBox="0 0 100 800"
          preserveAspectRatio="none"
        >
          <path
            d="M100 0 L100 800 L58 800 C 30 740, 88 690, 62 610 C 36 530, 92 470, 60 380 C 30 300, 90 230, 58 150 C 34 90, 80 50, 60 0 Z"
            fill="var(--salmon)"
          />
        </svg>
        <div className="ola-medio" />
        <svg
          className="ola-borde"
          viewBox="0 0 100 800"
          preserveAspectRatio="none"
        >
          <path
            d="M0 0 L0 800 L42 800 C 70 740, 12 690, 38 610 C 64 530, 8 470, 40 380 C 70 300, 10 230, 42 150 C 66 90, 20 50, 40 0 Z"
            fill="var(--salmon)"
          />
        </svg>
      </div>
    </div>
  );
}
