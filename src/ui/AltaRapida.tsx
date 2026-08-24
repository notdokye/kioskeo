import { useEffect, useRef, useState } from "react";
import { formatearARS, margenPorcentaje } from "../core";
import { buscarEnOpenFoodFacts } from "../import/openfoodfacts";
import type { Producto } from "./catalogo";
import { comprimirImagen, urlAImagenComprimida } from "./imagen";
import { ImagenProducto } from "./ImagenProducto";
import { parsearPesos } from "./util";
import "./AltaRapida.css";

// Alta de producto en segundos. Con código de barras, la base mundial de
// Open Food Facts precarga nombre y foto solos; la cámara del celular es el
// respaldo para lo que no esté. Sin ean funciona como alta manual.

interface Props {
  ean?: string;
  onGuardar: (producto: Producto) => void;
  onCancelar: () => void;
}

export function AltaRapida({ ean, onGuardar, onCancelar }: Props) {
  const [nombre, setNombre] = useState("");
  const [precioTexto, setPrecioTexto] = useState("");
  const [costoTexto, setCostoTexto] = useState("");
  const [stockTexto, setStockTexto] = useState("");
  const [unidad, setUnidad] = useState<"unidad" | "peso">("unidad");
  const [masOpciones, setMasOpciones] = useState(false);
  const [imagen, setImagen] = useState<string | undefined>(undefined);
  const [buscando, setBuscando] = useState(Boolean(ean));
  const [encontrado, setEncontrado] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  // Lookup automático por código: precarga nombre y foto si el producto
  // existe en la base. El kiosquero solo confirma el precio.
  useEffect(() => {
    if (!ean) return;
    let activo = true;
    (async () => {
      const resultado = await buscarEnOpenFoodFacts(ean);
      if (!activo) return;
      if (resultado?.nombre) {
        setNombre((previo) => previo || resultado.nombre!);
        setEncontrado(true);
      }
      if (resultado?.imagenUrl) {
        // Comprimimos la foto para que viva en el dispositivo (offline);
        // si el servidor de imágenes no coopera, usamos la URL remota.
        try {
          setImagen(await urlAImagenComprimida(resultado.imagenUrl));
        } catch {
          setImagen(resultado.imagenUrl);
        }
      }
      setBuscando(false);
    })();
    return () => {
      activo = false;
    };
  }, [ean]);

  const precio = parsearPesos(precioTexto);
  const costo = parsearPesos(costoTexto);
  const precioValido = precio !== null && precio > 0;
  const puedeGuardar = nombre.trim().length > 0 && precioValido;
  const margen =
    precioValido && costo !== null && costo > 0
      ? margenPorcentaje(precio, costo)
      : null;
  const stockNumero = Number(stockTexto);
  const stockValido =
    stockTexto.trim() !== "" && Number.isInteger(stockNumero) && stockNumero >= 0;

  async function fotoElegida(archivo: File | undefined) {
    if (!archivo) return;
    try {
      setImagen(await comprimirImagen(archivo));
    } catch {
      // foto ilegible: se queda como estaba
    }
  }

  function guardar() {
    if (!puedeGuardar || precio === null) return;
    onGuardar({
      id: crypto.randomUUID(),
      ean,
      nombre: nombre.trim(),
      precio,
      costo: costo !== null && costo > 0 ? costo : undefined,
      unidad,
      stock: unidad === "unidad" && stockValido ? stockNumero : undefined,
      rubro: "Sin rubro",
      imagen,
    });
  }

  return (
    <div className="alta-fondo" role="dialog" aria-label="Producto nuevo">
      <div className="alta">
        <p className="alta-titulo">Producto nuevo</p>
        {ean && (
          <p className="alta-ean">
            Código {ean}
            {buscando && " · buscando el producto…"}
            {!buscando && encontrado && " · ✓ encontrado"}
          </p>
        )}

        <div className="alta-imagen-fila">
          <button
            className="alta-imagen-boton"
            title="Sacar o elegir foto"
            onClick={() => fotoRef.current?.click()}
          >
            <ImagenProducto nombre={nombre || "?"} imagen={imagen} tam={64} />
            <span>{imagen ? "Cambiar foto" : "Sacar foto"}</span>
          </button>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              fotoElegida(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="alta-campos">
            <input
              autoFocus
              placeholder="Nombre (ej: Coca-Cola 500ml)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              aria-label="Nombre del producto"
            />
            <input
              inputMode="decimal"
              placeholder={unidad === "peso" ? "Precio por 100 gramos" : "Precio de venta"}
              value={precioTexto}
              onChange={(e) => setPrecioTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
              aria-label={unidad === "peso" ? "Precio por 100 gramos" : "Precio de venta"}
            />
          </div>
        </div>

        <div className="alta-unidad" role="radiogroup" aria-label="Cómo se vende">
          <button
            className={unidad === "unidad" ? "alta-unidad-activa" : ""}
            onClick={() => setUnidad("unidad")}
          >
            Por unidad
          </button>
          <button
            className={unidad === "peso" ? "alta-unidad-activa" : ""}
            onClick={() => setUnidad("peso")}
          >
            Por peso (100g)
          </button>
        </div>

        {precioValido && precio !== null && (
          <p className="alta-precio-preview">
            {formatearARS(precio)}
            {unidad === "peso" && <span className="alta-por100"> cada 100g</span>}
          </p>
        )}

        {!masOpciones ? (
          <button className="alta-mas" onClick={() => setMasOpciones(true)}>
            + Costo y stock (opcional)
          </button>
        ) : (
          <div className="alta-extras">
            <div className="alta-extra">
              <input
                inputMode="decimal"
                placeholder={unidad === "peso" ? "Costo por 100g" : "Costo de compra"}
                value={costoTexto}
                onChange={(e) => setCostoTexto(e.target.value)}
                aria-label="Costo"
              />
              {margen !== null && (
                <span className={`alta-margen ${margen < 0 ? "alta-margen-rojo" : ""}`}>
                  {margen >= 0 ? "ganás" : "PERDÉS"} {Math.abs(Math.round(margen))}%
                </span>
              )}
            </div>
            {unidad === "unidad" && (
              <div className="alta-extra">
                <input
                  inputMode="numeric"
                  placeholder="Stock (cuántos tenés)"
                  value={stockTexto}
                  onChange={(e) => setStockTexto(e.target.value)}
                  aria-label="Stock"
                />
              </div>
            )}
          </div>
        )}
        <div className="alta-acciones">
          <button className="alta-cancelar" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="alta-guardar" disabled={!puedeGuardar} onClick={guardar}>
            GUARDAR Y AGREGAR
          </button>
        </div>
      </div>
    </div>
  );
}
