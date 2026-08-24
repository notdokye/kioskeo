import { useEffect, useMemo, useRef, useState } from "react";
import {
  guardarAjustes,
  AJUSTES_DEFAULT,
  AjustesContext,
  leerAjustes,
  type Ajustes,
} from "./ajustes";
import { alRecuperarContrasena, cerrarSesion, hayRecuperacionEnURL, sesionActual, type Sesion } from "./auth";
import { ADMIN_EMAILS } from "./contacto";
import { leerPendiente, type Pendiente } from "./pendiente";
import { bloquear, cargarPin, estaDesbloqueado } from "./pin";
import { calcularEstado, leerSuscripcionLocal, refrescarSuscripcion, type Suscripcion } from "./suscripcion";
import { asegurarNegocioLocal } from "./db/db";
import { backendSupabase } from "./sync/supabase";
import { iniciarSync } from "./sync/sync";
import { Bienvenida } from "./ui/Bienvenida";
import { Ola, type FaseOla } from "./ui/Ola";
import { woosh } from "./ui/sonidos";
import "./App.css";
import { Admin } from "./ui/Admin";
import { Ajustes as AjustesPantalla } from "./ui/Ajustes";
import { Bloqueo } from "./ui/Bloqueo";
import { Caja } from "./ui/Caja";
import { Fiados } from "./ui/Fiados";
import { Landing } from "./ui/Landing";
import { Login } from "./ui/Login";
import { Movimientos } from "./ui/Movimientos";
import { Panel } from "./ui/Panel";
import { PinHoja } from "./ui/PinHoja";
import { Productos } from "./ui/Productos";
import { Vender } from "./ui/Vender";

type Vista = "landing" | "bienvenida" | "login" | "app";
type Pestana = "vender" | "productos" | "caja" | "fiados" | "movimientos" | "panel" | "ajustes" | "admin";

const PESTANAS: { id: Pestana; etiqueta: string; etiquetaLarga?: string; icono: React.ReactNode }[] = [
  { id: "vender", etiqueta: "Vender", icono: <IconoVender /> },
  { id: "productos", etiqueta: "Productos", icono: <IconoProductos /> },
  { id: "caja", etiqueta: "Caja", icono: <IconoCaja /> },
  { id: "fiados", etiqueta: "Fiados", icono: <IconoFiados /> },
  { id: "movimientos", etiqueta: "Movim.", etiquetaLarga: "Movimientos", icono: <IconoMovimientos /> },
  { id: "panel", etiqueta: "Panel", icono: <IconoPanel /> },
];

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [vista, setVista] = useState<Vista | "cargando">("cargando");
  // La pestaña se recuerda: recargar la página no te manda a Vender.
  const [pestana, setPestana] = useState<Pestana>(() => {
    const guardada = localStorage.getItem("kioskeo-pestana");
    return (PESTANAS.some((p) => p.id === guardada) || guardada === "ajustes" || guardada === "admin"
      ? guardada
      : "vender") as Pestana;
  });
  useEffect(() => {
    localStorage.setItem("kioskeo-pestana", pestana);
  }, [pestana]);
  const [ola, setOla] = useState<{ fase: FaseOla; destino: Vista } | null>(null);
  const destinoRef = useRef<Vista | null>(null);
  const cubiertaRef = useRef(false);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_DEFAULT);
  const [recuperando, setRecuperando] = useState(() => hayRecuperacionEnURL());
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(() => leerSuscripcionLocal());
  const [minuto, setMinuto] = useState(0);
  const [pinOk, setPinOk] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  // Link de recuperación de contraseña: Supabase avisa cuando lo procesó.
  useEffect(() => alRecuperarContrasena(() => setRecuperando(true)), []);

  // Suscripción: se consulta al entrar y cada 15 minutos; el estado se
  // recalcula cada minuto por si cambia el día con la app abierta.
  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    const refrescar = async () => {
      const s = await refrescarSuscripcion();
      if (vivo) setSuscripcion(s);
    };
    refrescar();
    cargarPin();
    const cadaRato = setInterval(refrescar, 15 * 60 * 1000);
    const cadaMinuto = setInterval(() => setMinuto((m) => m + 1), 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(cadaRato);
      clearInterval(cadaMinuto);
    };
  }, [sesion]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resumenSuscripcion = useMemo(() => calcularEstado(suscripcion, new Date()), [suscripcion, minuto]);

  useEffect(() => {
    (async () => {
      const s = await sesionActual();
      // Antes de mostrar nada: si cambió la cuenta, se limpia lo local.
      if (s) await asegurarNegocioLocal(s.email);
      if (s) setAjustes(await leerAjustes());
      setSesion(s);
      // Registro a medio confirmar (volvió de Gmail y Safari recargó): directo
      // a la pantalla del código, sin pasar por la landing.
      const pend = s ? null : leerPendiente();
      setPendiente(pend);
      setVista(s ? "app" : pend ? "login" : "landing");
    })();
    return () => {
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
    };
  }, []);

  // Transición ceremonial en dos fases: la ola avisa cuando terminó de
  // cubrir (evento de animación), recién ahí se cambia la vista, y después
  // sale revelándola. La pantalla vieja jamás puede asomarse.
  // Red de seguridad: si el navegador pausó la animación (pestaña oculta),
  // un timer completa la transición igual — la app nunca queda tapada.
  function navegar(nueva: Vista) {
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducido || ola) {
      setVista(nueva);
      return;
    }
    destinoRef.current = nueva;
    cubiertaRef.current = false;
    setOla({ fase: "entrando", destino: nueva });
    woosh();
    fallbackRef.current = setTimeout(olaCubrio, 1000);
  }

  function olaCubrio() {
    if (cubiertaRef.current) return;
    cubiertaRef.current = true;
    if (fallbackRef.current) clearTimeout(fallbackRef.current);
    if (destinoRef.current) setVista(destinoRef.current);
    setOla((o) => (o ? { ...o, fase: "saliendo" } : null));
    fallbackRef.current = setTimeout(() => setOla(null), 1000);
  }

  function olaTermino() {
    if (fallbackRef.current) clearTimeout(fallbackRef.current);
    setOla(null);
  }

  const olaElemento = ola && (
    <Ola fase={ola.fase} onCubierta={olaCubrio} onFin={olaTermino} />
  );

  // La sincronización corre solo con sesión activa y Supabase configurado
  // (.env.local). Sin eso, la app es 100% local y no cambia nada.
  useEffect(() => {
    if (!sesion) return;
    const backend = backendSupabase();
    if (!backend) return;
    return iniciarSync(backend);
  }, [sesion]);

  if (vista === "cargando") return null;

  if (recuperando) {
    return (
      <Login
        modoInicial="nueva"
        onListo={async (s) => {
          setRecuperando(false);
          await asegurarNegocioLocal(s.email);
          setAjustes(await leerAjustes());
          setSesion(s);
          setPestana("vender");
          setVista("app");
        }}
        onVolver={() => setRecuperando(false)}
      />
    );
  }

  if (vista === "landing") {
    return (
      <>
        <Landing
          onEmpezar={() => navegar("bienvenida")}
          onEntrar={() => navegar("login")}
        />
        {olaElemento}
      </>
    );
  }

  if (vista === "bienvenida") {
    return (
      <>
        <Bienvenida
          onListo={async (s, a) => {
            await asegurarNegocioLocal(s.email);
            setSesion(s);
            setAjustes(a);
            // El primer paso depende de cómo dijo que carga sus productos.
            setPestana(a.carga === "excel" ? "productos" : "vender");
            navegar("app");
          }}
          onVolver={() => navegar("landing")}
          onYaTengoCuenta={() => navegar("login")}
        />
        {olaElemento}
      </>
    );
  }

  if (vista === "login" || !sesion) {
    return (
      <>
        <Login
          modoInicial={pendiente ? "esperando" : "crear"}
          emailInicial={pendiente?.email}
          onListo={async (s) => {
            await asegurarNegocioLocal(s.email);
            // Si venía del cuestionario, sus respuestas se aplican recién ahora.
            if (pendiente?.ajustes) {
              await guardarAjustes(pendiente.ajustes);
              setAjustes(pendiente.ajustes);
            } else {
              setAjustes(await leerAjustes());
            }
            setPendiente(null);
            setSesion(s);
            setPestana("vender");
            navegar("app");
          }}
          onVolver={() => {
            setPendiente(null);
            navegar("landing");
          }}
        />
        {olaElemento}
      </>
    );
  }

  async function salir() {
    await cerrarSesion();
    bloquear();
    setPinOk(false);
    setSuscripcion(null);
    setSesion(null);
    setAjustes(AJUSTES_DEFAULT);
    setVista("landing");
  }

  // Las pestañas obedecen los interruptores del negocio.
  const pestanasVisibles = PESTANAS.filter(
    (p) =>
      (p.id !== "caja" || ajustes.caja) && (p.id !== "fiados" || ajustes.fiados),
  );
  const esAdmin = ADMIN_EMAILS.includes(sesion.email);
  const pestanaActiva =
    pestanasVisibles.some((p) => p.id === pestana) || pestana === "ajustes" || (pestana === "admin" && esAdmin)
      ? pestana
      : "vender";

  if (resumenSuscripcion.estado === "bloqueada") {
    return (
      <Bloqueo
        resumen={resumenSuscripcion}
        email={sesion.email}
        nombreNegocio={sesion.nombreNegocio}
        onReintentar={async () => setSuscripcion(await refrescarSuscripcion())}
        onSalir={salir}
      />
    );
  }

  // El Panel y Ajustes piden el PIN del dueño (si hay uno) una vez por sesión.
  const protegida = pestanaActiva === "panel" || pestanaActiva === "ajustes" || pestanaActiva === "admin";
  const pedirPin = protegida && !estaDesbloqueado() && !pinOk;

  return (
    <AjustesContext.Provider value={ajustes}>
    <div className="app">
      <nav className="app-sidebar" aria-label="Secciones">
        <button
          className="app-logo"
          title="Ver el panel del negocio"
          aria-label="Ir al panel del negocio"
          onClick={() => setPestana("panel")}
        >
          <span className="app-k">K</span>
          <span>Kioskeo</span>
        </button>
        {pestanasVisibles.map((p) => (
          <button
            key={p.id}
            className={pestanaActiva === p.id ? "activa" : ""}
            onClick={() => setPestana(p.id)}
            aria-current={pestanaActiva === p.id ? "page" : undefined}
          >
            {p.icono}
            <span>{p.etiquetaLarga ?? p.etiqueta}</span>
          </button>
        ))}
      </nav>
      <div className="app-cuerpo">
        {pestanaActiva === "vender" && <Vender irA={(p: Pestana) => setPestana(p)} nombreNegocio={sesion.nombreNegocio} />}
        {pestanaActiva === "productos" && <Productos />}
        {pestanaActiva === "caja" && <Caja />}
        {pestanaActiva === "fiados" && <Fiados />}
        {pestanaActiva === "movimientos" && <Movimientos />}
        {pedirPin && (
          <PinHoja modo="verificar" onOk={() => setPinOk(true)} onCancelar={() => setPestana("vender")} />
        )}
        {pestanaActiva === "panel" && !pedirPin && (
          <Panel
            nombreNegocio={sesion.nombreNegocio}
            suscripcion={resumenSuscripcion}
            onAjustes={() => setPestana("ajustes")}
            onSalir={salir}
          />
        )}
        {pestanaActiva === "ajustes" && !pedirPin && (
          <AjustesPantalla
            sesion={sesion}
            ajustes={ajustes}
            suscripcion={resumenSuscripcion}
            esAdmin={esAdmin}
            onAjustes={setAjustes}
            onNombre={(nombre: string) => setSesion({ ...sesion, nombreNegocio: nombre })}
            onRefrescarSuscripcion={async () => setSuscripcion(await refrescarSuscripcion())}
            onAdmin={() => setPestana("admin")}
            onSalir={salir}
            onVolver={() => setPestana("panel")}
          />
        )}
        {pestanaActiva === "admin" && !pedirPin && <Admin onVolver={() => setPestana("ajustes")} />}
      </div>
      <nav className="app-nav" aria-label="Secciones">
        {pestanasVisibles.map((p) => (
          <button
            key={p.id}
            className={pestanaActiva === p.id ? "activa" : ""}
            onClick={() => setPestana(p.id)}
            aria-current={pestanaActiva === p.id ? "page" : undefined}
          >
            {p.icono}
            <span>{p.etiqueta}</span>
          </button>
        ))}
      </nav>
      {olaElemento}
    </div>
    </AjustesContext.Provider>
  );
}

function IconoVender() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 4h2l2.4 12.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.76L21 8H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20.4" r="1.4" fill="currentColor" />
      <circle cx="17.6" cy="20.4" r="1.4" fill="currentColor" />
    </svg>
  );
}

function IconoProductos() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 7l8 4 8-4M12 11v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCaja() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="8" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M3 13h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconoFiados() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8.5" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19.5c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6M16 4.6a3.4 3.4 0 0 1 0 7.8M17.5 15c1.7.6 2.8 2 3.3 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoMovimientos() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoPanel() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
