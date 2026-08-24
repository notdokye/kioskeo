import { useEffect, useState } from "react";
import "./Landing.css";

// Landing v2 (diseño de Claude design): datos duros con íconos salmón,
// tarjetas de funciones que se expanden con una ola al pasar el mouse
// (o al tocarlas en el celular), sección "Del cuaderno a Kioskeo",
// CTA final oscuro y botón flotante de WhatsApp.

interface Props {
  onEmpezar: () => void;
  onEntrar: () => void;
}

const WHATSAPP = "https://wa.me/5493884979972";

interface Tarjeta {
  titulo: string;
  teaser: string;
  expandido: string;
  icono: React.ReactNode;
  ilustracion: React.ReactNode;
}

const TARJETAS: Tarjeta[] = [
  {
    titulo: "La cámara es tu lector",
    teaser: "Escaneás el código de barras con el celu y listo. Sin pistola, sin aparatos, sin cables.",
    expandido:
      "Escaneás el código de barras con el celu y listo. Funciona con envases arrugados, con poca luz y con el mostrador lleno.",
    icono: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="13" rx="3" stroke="#F4573F" strokeWidth="2" />
        <circle cx="12" cy="12.5" r="3.5" stroke="#F4573F" strokeWidth="2" />
        <path d="M8 6l1.2-2h5.6L16 6" stroke="#F4573F" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    ilustracion: (
      <div className="fn-ilu">
        <div className="fn-celu">
          <div className="fn-celu-visor">
            <i style={{ width: 2 }} />
            <i style={{ width: 4 }} />
            <i style={{ width: 2 }} />
            <i style={{ width: 5 }} />
          </div>
        </div>
        <svg width="30" height="20" viewBox="0 0 30 20" fill="none" stroke="var(--salmon)" strokeWidth="2" strokeLinecap="round">
          <path d="M2 10h22" />
          <path d="M18 4l6 6-6 6" />
        </svg>
        <div className="fn-chip">
          <span>Código leído</span>
          <strong>7790895 000201</strong>
        </div>
      </div>
    ),
  },
  {
    titulo: "Aumentos en un toque",
    teaser: "¿Subieron los cigarrillos? Aumentá todo el rubro de una: +8% y quedó. Sin remarcar uno por uno.",
    expandido:
      "Elegís el porcentaje y se aplica a todo el rubro o a un proveedor entero, con el redondeo que usás en el mostrador.",
    icono: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 17l5-5 4 4 7-8" stroke="#F4573F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 8v5M20 8h-5" stroke="#F4573F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    ilustracion: (
      <div className="fn-ilu">
        <div className="fn-chip">
          <span>Cigarrillos</span>
          <strong>$ 2.200</strong>
        </div>
        <span className="fn-pill">+8%</span>
        <div className="fn-chip fn-chip-ok">
          <span>quedó en</span>
          <strong>$ 2.400</strong>
        </div>
      </div>
    ),
  },
  {
    titulo: "Fiados sin cuaderno",
    teaser: "Cada fiado queda a nombre del cliente. Sabés cuánto te deben sin buscar la hoja.",
    expandido:
      "Anotás el fiado dentro de la misma venta y queda en la cuenta del cliente. Ves quién debe, cuánto y desde cuándo.",
    icono: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4573F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="3" width="14" height="18" rx="2.5" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
    ilustracion: (
      <div className="fn-ilu">
        <div className="fn-chip">
          <span>Doña Rosa</span>
          <strong className="fn-debe">Debe $ 4.900</strong>
        </div>
        <span className="fn-pill">Cobrar</span>
      </div>
    ),
  },
  {
    titulo: "Cierre de caja por turno",
    teaser: "Abrís y cerrás caja en cada turno. Si falta plata, lo ves al toque y sabés en qué turno fue.",
    expandido:
      "Cada empleado abre y cierra su turno: efectivo contado, diferencia y ventas quedan registradas con nombre y hora.",
    icono: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4573F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="12" rx="2.5" />
        <path d="M3 13h7c0 1.5 1 2.4 2 2.4s2-.9 2-2.4h7" />
      </svg>
    ),
    ilustracion: (
      <div className="fn-ilu">
        <div className="fn-chip">
          <span>Esperado</span>
          <strong>$ 20.600</strong>
        </div>
        <div className="fn-chip">
          <span>Contado</span>
          <strong>$ 20.600</strong>
        </div>
        <span className="fn-pill fn-pill-verde">$ 0 · cerró bien</span>
      </div>
    ),
  },
  {
    titulo: "Tu kiosco, desde el sillón",
    teaser: "Mirá cuánto vendiste hoy desde tu casa, en tiempo real. Aunque atienda otro.",
    expandido:
      "Ventas del día, caja abierta y stock crítico en vivo desde tu celular. No hace falta llamar para preguntar cómo viene la mano.",
    icono: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4573F" strokeWidth="2" strokeLinecap="round">
        <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
      </svg>
    ),
    ilustracion: (
      <div className="fn-ilu">
        <div className="fn-chip">
          <span>Hoy vendiste</span>
          <strong>$ 19.500</strong>
        </div>
        <span className="fn-pill fn-pill-verde">12% más que ayer</span>
      </div>
    ),
  },
  {
    titulo: "¿Y si me quedo sin señal?",
    teaser: "Seguís vendiendo igual. Kioskeo guarda todo en el celular y sincroniza cuando vuelve internet.",
    expandido:
      "Seguís vendiendo igual. Kioskeo guarda todo en el celular y sincroniza solo cuando vuelve internet — sin perder ni una venta.",
    icono: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4573F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 10.5a10.5 10.5 0 0 1 15 0" />
        <path d="M7.5 14a6.5 6.5 0 0 1 9 0" />
        <circle cx="12" cy="18" r="1.2" fill="#F4573F" stroke="none" />
        <path d="M4 20 20 4" />
      </svg>
    ),
    ilustracion: (
      <div className="fn-ilu">
        <div className="fn-chip">
          <span>Sin señal</span>
          <strong>3 ventas guardadas</strong>
        </div>
        <svg width="30" height="20" viewBox="0 0 30 20" fill="none" stroke="var(--salmon)" strokeWidth="2" strokeLinecap="round">
          <path d="M2 10h22" />
          <path d="M18 4l6 6-6 6" />
        </svg>
        <span className="fn-pill fn-pill-verde">Sincronizadas</span>
      </div>
    ),
  },
];

export function Landing({ onEmpezar, onEntrar }: Props) {
  const [hov, setHov] = useState<number | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);

  // En el celular las tarjetas se abren con un toque; tocar afuera las cierra.
  useEffect(() => {
    function alClickear(e: MouseEvent) {
      if ((e.target as HTMLElement | null)?.closest?.("[data-fn-card]")) return;
      setAbierta(null);
    }
    document.addEventListener("click", alClickear);
    return () => document.removeEventListener("click", alClickear);
  }, []);

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-logo">
          <span className="landing-isotipo">K</span>
          <span className="landing-marca">kioskeo</span>
        </div>
        <div className="landing-links">
          <a href="#funciones">Funciones</a>
          <a href="#migrar">Migrá tu cuaderno</a>
        </div>
        <div className="landing-nav-acciones">
          <button className="landing-entrar" onClick={onEntrar}>
            Entrar
          </button>
          <button className="landing-cta-chico" onClick={onEmpezar}>
            Empezá gratis
          </button>
        </div>
      </nav>

      <header className="landing-hero">
        <div className="landing-hero-texto">
          <span className="landing-chip">PUNTO DE VENTA PARA KIOSCOS</span>
          <h1>
            Tu kiosco,
            <br />
            sin cuaderno.
          </h1>
          <p>
            Cobrás, fiás y cerrás la caja desde el celular. Anda sin internet y
            son 30 días gratis, sin tarjeta.
          </p>
          <div className="landing-hero-botones">
            <button className="landing-cta" onClick={onEmpezar}>
              Empezá gratis
            </button>
          </div>
          <p className="landing-letra-chica">
            Sin tarjeta de crédito. Sin permanencia. Sin manual de 40 páginas.
          </p>
        </div>

        <div className="landing-telefono" aria-hidden>
          <div className="landing-ticket">
            <div className="landing-ticket-buscador">
              <span>Buscar producto…</span>
              <span className="landing-ticket-escaner" />
            </div>
            <ul>
              <li>
                <em>×2</em> Coca-Cola 500ml <strong>$ 3.600</strong>
              </li>
              <li>
                <em>×3</em> Alfajor Guaymallén <strong>$ 1.800</strong>
              </li>
              <li>
                <em>×1</em> Marlboro Box 20 <strong>$ 4.900</strong>
              </li>
              <li>
                <em>×1</em> Beldent Menta <strong>$ 800</strong>
              </li>
            </ul>
            <div className="landing-ticket-total">
              <span>TOTAL</span>
              <strong>$ 11.100</strong>
            </div>
            <div className="landing-ticket-cobrar">COBRAR</div>
          </div>
        </div>
      </header>

      <section className="landing-datos">
        <div>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--salmon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 16.5a19 19 0 0 1 27 0" />
            <path d="M12 22a12 12 0 0 1 16 0" />
            <path d="M16.6 27.2a5.5 5.5 0 0 1 6.8 0" />
            <circle cx="20" cy="32" r="1.4" fill="var(--salmon)" stroke="none" />
            <path d="M8.5 33.5 32 8" />
          </svg>
          <strong>Sin internet</strong>
          <span>funciona igual, con o sin señal</span>
        </div>
        <div>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--salmon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.5 14a8.5 8.5 0 0 1 17 0" />
            <path d="M17 13.5a2.5 2.5 0 0 1 5 0V22.5a1.9 1.9 0 0 1 3.8 0v1.1a1.9 1.9 0 0 1 3.8 0v1.1a1.9 1.9 0 0 1 3.8 0v5.8a6.5 6.5 0 0 1-6.5 6.5h-7.1a5 5 0 0 1-4.1-2.1l-4.4-6.3a2.5 2.5 0 0 1 3.9-3.1L17 28.6z" />
          </svg>
          <strong>2 toques</strong>
          <span>para cobrar una venta</span>
        </div>
        <div>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--salmon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="20" cy="20" r="14.5" />
            <path d="M20 11.2v17.6" />
            <path d="M24.4 16.2c0-1.9-2-3-4.4-3s-4.4 1.1-4.4 3 1.6 2.7 4.4 3.3 4.4 1.4 4.4 3.4-2 3.3-4.4 3.3-4.4-1.3-4.4-3.3" />
          </svg>
          <strong>$ 0</strong>
          <span>30 días gratis, después $ 18.900 por mes</span>
        </div>
      </section>

      <section className="landing-funciones" id="funciones">
        <h2>
          Hace lo que hacías con el cuaderno.
          <br />
          Pero solo.
        </h2>
        <p className="landing-funciones-sub">
          Seis cosas que vas a usar todos los días.
        </p>
        <div className="landing-grilla-fn">
          {TARJETAS.map((t, i) => {
            const activa = abierta === i || hov === i;
            return (
              <article
                key={i}
                data-fn-card
                className={`fn-tarjeta ${activa ? "fn-activa" : ""}`}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov((h) => (h === i ? null : h))}
                onClick={(e) => {
                  e.stopPropagation();
                  setAbierta((a) => (a === i ? null : i));
                }}
              >
                <div className="fn-ola" aria-hidden>
                  <svg viewBox="0 0 60 420" preserveAspectRatio="none">
                    <path
                      d="M3 0C31 64-9 138 17 210c22 62-10 136-14 210H0V0z"
                      fill="var(--salmon-suave)"
                    />
                    <path
                      d="M3 0C31 64-9 138 17 210c22 62-10 136-14 210"
                      fill="none"
                      stroke="var(--salmon)"
                      strokeWidth="4"
                    />
                  </svg>
                </div>
                <div className="fn-contenido">
                  <div className="fn-icono">{t.icono}</div>
                  <h3>{t.titulo}</h3>
                  <div className="fn-teaser">
                    <div>
                      <p>{t.teaser}</p>
                    </div>
                  </div>
                  <div className="fn-expandido">
                    <div>
                      <p>{t.expandido}</p>
                      {t.ilustracion}
                    </div>
                  </div>
                </div>
                {abierta === i && (
                  <button
                    className="fn-cerrar"
                    aria-label="Cerrar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAbierta(null);
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" stroke="var(--salmon-presionado)" strokeWidth="2" strokeLinecap="round">
                      <path d="M2 2l8 8M10 2l-8 8" />
                    </svg>
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-migrar" id="migrar">
        <h2>
          Del cuaderno a Kioskeo
          <br />
          en 15 minutos
        </h2>
        <p className="landing-funciones-sub">
          Tenés los precios en un Excel, en el cuaderno o en la cabeza.
          Cualquiera sirve.
        </p>
        <div className="landing-pasos">
          {[
            ["1", "Pasanos tu lista", "Un Excel, una foto del cuaderno o lo que tengas. Lo mandás por WhatsApp y listo."],
            ["2", "Kioskeo carga todo solo", "Productos, precios y rubros quedan armados. Vos solo revisás que esté bien."],
            ["3", "Empezás a cobrar", "Primera venta el mismo día. El cuaderno queda de recuerdo en el cajón."],
          ].map(([n, titulo, texto]) => (
            <div key={n} className="landing-paso">
              <span className="landing-paso-numero">{n}</span>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-final-oscuro">
        <h2>Dejá el cuaderno hoy.</h2>
        <p>30 días gratis, después $ 18.900 por mes. Si te trabás, te ayudamos por WhatsApp.</p>
        <div className="landing-final-botones">
          <button className="landing-cta" onClick={onEmpezar}>
            Crear mi cuenta
          </button>
          <a className="landing-cta-wa" href={WHATSAPP} target="_blank" rel="noreferrer">
            Escribinos por WhatsApp
          </a>
        </div>
      </section>

      <footer className="landing-pie">kioskeo · hecho en Argentina</footer>

      <a
        className="landing-wa-flotante"
        href={WHATSAPP}
        target="_blank"
        rel="noreferrer"
        aria-label="Escribinos por WhatsApp"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z" />
        </svg>
      </a>
    </div>
  );
}
