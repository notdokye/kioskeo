import { useState } from "react";
import { guardarAjustes, type Ajustes as AjustesTipo } from "../ajustes";
import { actualizarNombreNegocio, type Sesion } from "../auth";
import { DIAS_PRUEBA, enlaceWhatsApp, PRECIO_MENSUAL } from "../contacto";
import { listarProductos, todasLasAnulaciones, todasLasVentas } from "../db/db";
import { leerEmpleados, type Empleado } from "../empleados";
import { exportarProductos, exportarVentas } from "../exportar";
import { guardarPin, hayPin } from "../pin";
import { describirVencimiento, type Resumen } from "../suscripcion";
import { EmpleadosSetup } from "./EmpleadosSetup";
import { Instalar } from "./Instalar";
import { PinHoja } from "./PinHoja";
import "./Pantallas.css";
import "./Ajustes.css";

// La tuerca: todo lo que el dueño configura una vez y vuelve a tocar poco.
// Cada fila es una acción clara; nada acá cambia un cálculo.

interface Props {
  sesion: Sesion;
  ajustes: AjustesTipo;
  suscripcion: Resumen;
  esAdmin: boolean;
  onAjustes: (a: AjustesTipo) => void;
  onNombre: (nombre: string) => void;
  onRefrescarSuscripcion: () => Promise<void>;
  onAdmin: () => void;
  onSalir: () => void;
  onVolver: () => void;
}

type Hoja = null | { tipo: "empleados"; lista: Empleado[] } | { tipo: "pin" };

export function Ajustes({
  sesion,
  ajustes,
  suscripcion,
  esAdmin,
  onAjustes,
  onNombre,
  onRefrescarSuscripcion,
  onAdmin,
  onSalir,
  onVolver,
}: Props) {
  const [nombre, setNombre] = useState(sesion.nombreNegocio);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hoja, setHoja] = useState<Hoja>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [tienePin, setTienePin] = useState(hayPin());

  function avisar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 2500);
  }

  async function cambiar(parcial: Partial<AjustesTipo>) {
    const nuevos = { ...ajustes, ...parcial };
    onAjustes(nuevos);
    await guardarAjustes(nuevos);
  }

  async function guardarNombre() {
    const limpio = nombre.trim();
    if (!limpio || limpio === sesion.nombreNegocio) return;
    try {
      await actualizarNombreNegocio(limpio);
      onNombre(limpio);
      avisar("Nombre guardado");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  async function exportar(que: "mes" | "todo" | "productos") {
    setOcupado(que);
    try {
      if (que === "productos") {
        await exportarProductos(await listarProductos());
      } else {
        const [ventas, anulaciones] = await Promise.all([todasLasVentas(), todasLasAnulaciones()]);
        const desde = new Date();
        desde.setDate(desde.getDate() - 30);
        const filtradas = que === "mes" ? ventas.filter((v) => v.fecha >= desde.toISOString()) : ventas;
        await exportarVentas(filtradas, anulaciones, que === "mes" ? "30-dias" : "todas");
      }
    } catch {
      avisar("No se pudo exportar");
    } finally {
      setOcupado(null);
    }
  }

  const mensajeRenovar = `Hola, quiero ${suscripcion.prueba ? "contratar" : "renovar"} Kioskeo para ${sesion.nombreNegocio} (${sesion.email}).`;

  const textoPlan = (() => {
    const vence = suscripcion.venceEl ? describirVencimiento(suscripcion.venceEl) : "";
    switch (suscripcion.estado) {
      case "desconocida":
        return "Sin información del plan todavía (se actualiza con internet).";
      case "activa":
        return suscripcion.prueba
          ? `Prueba gratis: te quedan ${suscripcion.dias} días (hasta el ${vence}).`
          : `Plan mensual activo hasta el ${vence}.`;
      case "por_vencer":
        return suscripcion.dias === 0
          ? `${suscripcion.prueba ? "La prueba" : "El plan"} vence hoy.`
          : `${suscripcion.prueba ? "La prueba" : "El plan"} vence en ${suscripcion.dias} día${suscripcion.dias === 1 ? "" : "s"} (el ${vence}).`;
      case "gracia":
        return `Venció el ${vence}. Tenés ${suscripcion.dias + 3} día${suscripcion.dias + 3 === 1 ? "" : "s"} para renovar antes del bloqueo.`;
      case "bloqueada":
        return `Venció el ${vence}.`;
    }
  })();

  return (
    <div className="pantalla pantalla-ancha pantalla-aire aj">
      <header className="encabezado">
        <button className="aj-volver" onClick={onVolver}>
          ← Volver
        </button>
        <span className="migaja">Ajustes</span>
      </header>

      {aviso && <p className="aj-aviso">{aviso}</p>}

      <section className="aj-seccion">
        <p className="aj-titulo">Tu kiosco</p>
        <div className="aj-fila aj-fila-columna">
          <label className="aj-etiqueta" htmlFor="aj-nombre">
            Nombre
          </label>
          <div className="aj-nombre">
            <input
              id="aj-nombre"
              className="campo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={guardarNombre}
              onKeyDown={(e) => e.key === "Enter" && guardarNombre()}
            />
          </div>
          <span className="aj-nota">{sesion.email}</span>
        </div>
      </section>

      <section className={`aj-seccion aj-plan aj-plan-${suscripcion.estado}`}>
        <p className="aj-titulo">Tu plan</p>
        <p className="aj-plan-texto">{textoPlan}</p>
        <p className="aj-nota">
          Después de los {DIAS_PRUEBA} días gratis, $ {PRECIO_MENSUAL.toLocaleString("es-AR")} por mes. Se paga por
          transferencia o Mercado Pago y se acredita en el día.
        </p>
        <div className="aj-botones">
          <a className="boton-principal aj-boton" href={enlaceWhatsApp(mensajeRenovar)} target="_blank" rel="noreferrer">
            {suscripcion.prueba ? "CONTRATAR POR WHATSAPP" : "RENOVAR POR WHATSAPP"}
          </a>
          <button className="aj-secundario" onClick={() => void onRefrescarSuscripcion().then(() => avisar("Plan actualizado"))}>
            Ya pagué, actualizar
          </button>
        </div>
      </section>

      <section className="aj-seccion">
        <p className="aj-titulo">Qué mostrar</p>
        <Interruptor
          etiqueta="Fiados"
          detalle="Botón FIADO al cobrar y pestaña Fiados"
          valor={ajustes.fiados}
          onCambio={(v) => cambiar({ fiados: v })}
        />
        <Interruptor
          etiqueta="Caja y turnos"
          detalle="Apertura, retiros y cierre ciego"
          valor={ajustes.caja}
          onCambio={(v) => cambiar({ caja: v })}
        />
        <Interruptor
          etiqueta="Sonidos"
          detalle="Bip al escanear y sonido al cobrar"
          valor={ajustes.sonidos}
          onCambio={(v) => cambiar({ sonidos: v })}
        />
        <Interruptor
          etiqueta="Secretos del negocio"
          detalle="Producto estrella, hora pico y márgenes en el Panel"
          valor={ajustes.secretos}
          onCambio={(v) => cambiar({ secretos: v })}
        />
      </section>

      <section className="aj-seccion">
        <p className="aj-titulo">Seguridad</p>
        <button className="aj-fila aj-fila-boton" onClick={() => setHoja({ tipo: "pin" })}>
          <span>
            <span className="aj-etiqueta">PIN del dueño</span>
            <span className="aj-nota">
              {tienePin
                ? "Activado: el Panel, Ajustes y el esperado en caja piden el PIN"
                : "Sin PIN: cualquiera que use la app ve el Panel y el esperado en caja"}
            </span>
          </span>
          <span className="aj-accion">{tienePin ? "Cambiar" : "Crear"}</span>
        </button>
        {tienePin && (
          <button
            className="aj-enlace"
            onClick={async () => {
              await guardarPin(null);
              setTienePin(false);
              avisar("PIN eliminado");
            }}
          >
            Sacar el PIN
          </button>
        )}
        <button
          className="aj-fila aj-fila-boton"
          onClick={async () => setHoja({ tipo: "empleados", lista: await leerEmpleados() })}
        >
          <span>
            <span className="aj-etiqueta">Empleados y turnos</span>
            <span className="aj-nota">Quién trabaja, qué días y en qué horario</span>
          </span>
          <span className="aj-accion">Editar</span>
        </button>
      </section>

      <section className="aj-seccion">
        <p className="aj-titulo">Tus datos</p>
        <p className="aj-nota">Se abren en Excel. En el celular podés mandarlos por WhatsApp o guardarlos en Drive.</p>
        <div className="aj-botones">
          <button className="aj-secundario" disabled={ocupado !== null} onClick={() => exportar("mes")}>
            {ocupado === "mes" ? "Armando…" : "Ventas de los últimos 30 días"}
          </button>
          <button className="aj-secundario" disabled={ocupado !== null} onClick={() => exportar("todo")}>
            {ocupado === "todo" ? "Armando…" : "Todas las ventas"}
          </button>
          <button className="aj-secundario" disabled={ocupado !== null} onClick={() => exportar("productos")}>
            {ocupado === "productos" ? "Armando…" : "Lista de productos"}
          </button>
        </div>
      </section>

      <section className="aj-seccion">
        <p className="aj-titulo">Instalar</p>
        <Instalar />
      </section>

      <section className="aj-seccion">
        <p className="aj-titulo">Ayuda</p>
        <a className="aj-fila aj-fila-boton" href={enlaceWhatsApp(`Hola, uso Kioskeo en ${sesion.nombreNegocio} y tengo una consulta: `)} target="_blank" rel="noreferrer">
          <span>
            <span className="aj-etiqueta">Escribinos por WhatsApp</span>
            <span className="aj-nota">Respondemos en el día</span>
          </span>
          <span className="aj-accion">Abrir</span>
        </a>
        <div className="aj-enlaces">
          <a href="/terminos.html" target="_blank" rel="noreferrer">
            Términos y condiciones
          </a>
          <a href="/privacidad.html" target="_blank" rel="noreferrer">
            Privacidad
          </a>
          <a href={enlaceWhatsApp(`Hola, quiero borrar mi cuenta de Kioskeo (${sesion.email}) y todos sus datos.`)} target="_blank" rel="noreferrer">
            Borrar mi cuenta
          </a>
        </div>
      </section>

      {esAdmin && (
        <button className="aj-secundario" onClick={onAdmin}>
          Panel de administración
        </button>
      )}

      <button className="salir" onClick={onSalir}>
        Cerrar sesión
      </button>

      {hoja?.tipo === "empleados" && (
        <EmpleadosSetup empleados={hoja.lista} onGuardar={() => setHoja(null)} onCerrar={() => setHoja(null)} />
      )}
      {hoja?.tipo === "pin" && (
        <PinHoja
          modo="crear"
          onOk={async (pin) => {
            await guardarPin(pin);
            setTienePin(true);
            setHoja(null);
            avisar("PIN guardado");
          }}
          onCancelar={() => setHoja(null)}
        />
      )}
    </div>
  );
}

function Interruptor({
  etiqueta,
  detalle,
  valor,
  onCambio,
}: {
  etiqueta: string;
  detalle: string;
  valor: boolean;
  onCambio: (v: boolean) => void;
}) {
  return (
    <label className="aj-fila">
      <span>
        <span className="aj-etiqueta">{etiqueta}</span>
        <span className="aj-nota">{detalle}</span>
      </span>
      <span className={`aj-switch ${valor ? "aj-switch-on" : ""}`}>
        <input type="checkbox" checked={valor} onChange={(e) => onCambio(e.target.checked)} />
        <span className="aj-switch-bola" />
      </span>
    </label>
  );
}
