// Utilidades de imagen de producto: compresión local (las fotos viven en el
// dispositivo y se sincronizan; tienen que pesar poco) y el color estable
// del placeholder para productos sin foto.

const LADO_MAX = 256;

/** Comprime cualquier imagen a un JPEG cuadrado-ish de ~15-30 KB (data URL). */
export async function comprimirImagen(fuente: Blob): Promise<string> {
  const bitmap = await createImageBitmap(fuente);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.max(1, Math.round(bitmap.width * escala));
  const alto = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sin canvas");
  ctx.fillStyle = "#ffffff"; // fondo blanco para PNGs transparentes
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Baja una imagen remota y la comprime. Lanza si la red o CORS lo impiden. */
export async function urlAImagenComprimida(url: string): Promise<string> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`Imagen no disponible (${respuesta.status})`);
  return comprimirImagen(await respuesta.blob());
}

/** Iniciales para el placeholder: "Coca-Cola 500ml" → "CC". */
export function inicialesDe(nombre: string): string {
  const palabras = nombre
    .split(/[\s-]+/)
    .filter((p) => /^[a-zA-ZÀ-ÿ0-9]/.test(p))
    .slice(0, 2);
  return palabras.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Tono estable derivado del nombre: el mismo producto siempre del mismo color. */
export function tonoDe(nombre: string): number {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = (hash * 31 + nombre.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}
