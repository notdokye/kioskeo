// Open Food Facts: base colaborativa mundial de productos indexada por
// código de barras. Gratis y sin clave. Al escanear un producto desconocido
// intentamos traer nombre, marca y foto para precargar el alta.

export interface ProductoOFF {
  nombre?: string;
  imagenUrl?: string;
}

const CAMPOS = "product_name,product_name_es,brands,image_front_small_url,image_front_url";

export async function buscarEnOpenFoodFacts(
  ean: string,
): Promise<ProductoOFF | null> {
  try {
    const respuesta = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=${CAMPOS}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        product_name_es?: string;
        brands?: string;
        image_front_small_url?: string;
        image_front_url?: string;
      };
    };
    if (datos.status !== 1 || !datos.product) return null;

    const p = datos.product;
    const base = (p.product_name_es || p.product_name || "").trim();
    const marca = (p.brands || "").split(",")[0]?.trim();
    // "Coca-Cola" + "Coca Cola Original" → sin duplicar la marca: se compara
    // ignorando mayúsculas, guiones y espacios.
    const plano = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
    const nombre =
      marca && base && !plano(base).includes(plano(marca))
        ? `${marca} ${base}`
        : base || marca;

    return {
      nombre: nombre || undefined,
      imagenUrl: p.image_front_small_url || p.image_front_url || undefined,
    };
  } catch {
    return null; // sin internet o sin respuesta: el alta sigue manual
  }
}
