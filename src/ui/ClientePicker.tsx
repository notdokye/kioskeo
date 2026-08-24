import { useEffect, useMemo, useState } from "react";
import { agregarCliente, listarClientes, type Cliente } from "../db/db";
import "./Pantallas.css";

// Cobrar FIADO exige un cliente con nombre: acá se elige o se crea en el
// momento, sin salir del flujo de la venta.

interface Props {
  onElegir: (cliente: Cliente) => void;
  onCerrar: () => void;
}

export function ClientePicker({ onElegir, onCerrar }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    listarClientes().then(setClientes);
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q
      ? clientes.filter((c) => c.nombre.toLowerCase().includes(q))
      : clientes;
  }, [clientes, busqueda]);

  const puedeCrear =
    busqueda.trim().length > 0 &&
    !clientes.some((c) => c.nombre.toLowerCase() === busqueda.trim().toLowerCase());

  async function crear() {
    const cliente: Cliente = { id: crypto.randomUUID(), nombre: busqueda.trim() };
    await agregarCliente(cliente);
    onElegir(cliente);
  }

  return (
    <div className="hoja-fondo" role="dialog" aria-label="Elegir cliente">
      <div className="hoja">
        <p className="hoja-titulo">¿A quién se lo anotás?</p>
        <input
          className="campo"
          autoFocus
          placeholder="Buscar o escribir un nombre nuevo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar cliente"
        />
        <div className="tabla" style={{ maxHeight: "38vh", overflowY: "auto" }}>
          {filtrados.map((c) => (
            <button
              key={c.id}
              className="tabla-fila"
              style={{ width: "100%", textAlign: "left", gridTemplateColumns: "1fr" }}
              onClick={() => onElegir(c)}
            >
              <span className="tabla-principal">{c.nombre}</span>
            </button>
          ))}
          {filtrados.length === 0 && !puedeCrear && (
            <p className="vacio">Escribí un nombre para crear el cliente.</p>
          )}
        </div>
        {puedeCrear && (
          <button className="boton-principal" onClick={crear}>
            CREAR “{busqueda.trim()}” Y ANOTARLE
          </button>
        )}
        <button className="hoja-cancelar" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
