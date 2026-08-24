// Función serverless (corre en Vercel, nunca en el navegador): recibe una
// muestra de la planilla y le pide a Claude el mapeo de columnas.
// La API key vive en las variables de entorno de Vercel — jamás en la página.

// La función corre en Node (Vercel); este declare evita depender de @types/node.
declare const process: { env: Record<string, string | undefined> };

const PROMPT = `Sos el detector de columnas del importador de planillas de Kioskeo, un punto de venta para kioscos argentinos.
Recibís las primeras filas de una planilla de productos como matriz JSON (filas de celdas).
Respondé SOLO un objeto JSON, sin explicación ni markdown, con esta forma exacta:
{"filaEncabezado": n, "nombre": n, "precio": n, "ean": n, "rubro": n}

Reglas:
- Los índices son de columna, base 0. Usá -1 cuando la columna no exista.
- "filaEncabezado" es el índice de la fila de títulos; -1 si los datos empiezan directo sin títulos.
- "nombre": la columna con el nombre/descripción del producto.
- "precio": SIEMPRE el precio de VENTA al público. Nunca costo, compra, mayorista ni margen.
- "ean": código de barras (8-14 dígitos) si hay.
- "rubro": categoría/familia/sección si hay.

Matriz:
`;

export default async function handler(
  req: { method?: string; body?: { muestra?: unknown } },
  res: {
    status: (n: number) => { json: (b: unknown) => void };
    setHeader: (k: string, v: string) => void;
  },
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) {
    return res.status(503).json({ error: "La detección con IA no está configurada" });
  }
  const muestra = req.body?.muestra;
  if (!Array.isArray(muestra) || muestra.length === 0) {
    return res.status(400).json({ error: "Falta la muestra de la planilla" });
  }
  // Recorte defensivo: 15 filas x 15 columnas, celdas como texto corto.
  const recortada = muestra
    .slice(0, 15)
    .map((fila) =>
      Array.isArray(fila)
        ? fila.slice(0, 15).map((c) => String(c ?? "").slice(0, 80))
        : [],
    );

  try {
    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": clave,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          { role: "user", content: PROMPT + JSON.stringify(recortada) },
        ],
      }),
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      return res.status(502).json({ error: `IA no disponible (${respuesta.status})`, detalle: detalle.slice(0, 200) });
    }
    const datos = (await respuesta.json()) as {
      content?: { type: string; text?: string }[];
    };
    const texto = datos.content?.find((c) => c.type === "text")?.text ?? "";
    const json = texto.match(/\{[^}]+\}/)?.[0];
    if (!json) return res.status(502).json({ error: "La IA no devolvió un mapeo" });

    const crudo = JSON.parse(json) as Record<string, unknown>;
    const indice = (v: unknown) =>
      typeof v === "number" && Number.isInteger(v) && v >= -1 && v < 15 ? v : -1;
    const mapeo = {
      filaEncabezado: indice(crudo.filaEncabezado),
      nombre: indice(crudo.nombre),
      precio: indice(crudo.precio),
      ean: indice(crudo.ean),
      rubro: indice(crudo.rubro),
    };
    if (mapeo.nombre === -1 || mapeo.precio === -1) {
      return res.status(422).json({ error: "La IA no encontró columnas de nombre y precio" });
    }
    return res.status(200).json(mapeo);
  } catch (e) {
    return res.status(502).json({
      error: "No pudimos consultar la IA",
      detalle: e instanceof Error ? e.message.slice(0, 200) : "desconocido",
    });
  }
}
