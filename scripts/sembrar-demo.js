// Siembra la cuenta DEMO "Kiosco El Faro". Se ejecuta en la consola del
// navegador con la app corriendo en localhost (npm run dev) y la sesión de
// la cuenta demo abierta. Usa los mismos módulos que la app, así que todo
// pasa por la matemática real y sube por la outbox.
//
//   const s = await import('/scripts/sembrar-demo.js') ← NO: este archivo no
//   se sirve; copiar el contenido entero en la consola y ejecutarlo.

(async () => {
  const db = await import("/src/db/db.ts");
  const core = await import("/src/core/index.ts");
  const emp = await import("/src/empleados.ts");
  const { buscarEnOpenFoodFacts } = await import("/src/import/openfoodfacts.ts");
  const { sincronizar } = await import("/src/sync/sync.ts");
  const { backendSupabase } = await import("/src/sync/supabase.ts");

  const $ = (pesos) => core.pesos(pesos);
  const azar = (n) => Math.floor(Math.random() * n);
  const elegir = (arr) => arr[azar(arr.length)];

  // ---------- productos ----------
  const base = [
    ["7790895000997", "Coca-Cola 500 ml", 1900, 1200, "Bebidas"],
    ["7790895001246", "Villavicencio 1,5 L", 1500, 900, "Bebidas"],
    ["7790895067310", "Monster verde 473 ml", 3200, 2100, "Bebidas"],
    ["7790580660100", "Alfajor Guaymallén triple", 700, 420, "Golosinas"],
    ["7790380016405", "Beldent menta", 900, 550, "Golosinas"],
    ["7790040113224", "Lay's clásicas 85 g", 2400, 1500, "Snacks"],
    ["7622300862073", "Oreo 118 g", 1800, 1100, "Galletitas"],
    ["7790387012345", "Encendedor BIC chico", 1400, 850, "Varios"],
    ["7790742345608", "Sedita blanca", 800, 450, "Cigarrillos"],
    ["7791234567890", "Marlboro Box 20", 4900, 4300, "Cigarrillos"],
    ["7790070410191", "Don Satur bizcochos 200 g", 1900, 1200, "Galletitas"],
    ["7790310000328", "Bon o Bon", 600, 350, "Golosinas"],
    ["7790580135041", "Turrón Arcor", 700, 400, "Golosinas"],
    ["7790895000263", "Sprite 500 ml", 1900, 1200, "Bebidas"],
    ["7790895000270", "Fanta 500 ml", 1900, 1200, "Bebidas"],
    ["7793360450020", "Quilmes lata 473 ml", 2200, 1500, "Bebidas"],
    ["7790387000106", "Chicles Topline", 800, 480, "Golosinas"],
    ["7790580128203", "Rhodesia", 900, 550, "Golosinas"],
    ["7790310004425", "Tofi 5 unidades", 1300, 800, "Golosinas"],
    ["7790040921009", "Doritos 90 g", 2500, 1600, "Snacks"],
    ["7790040123458", "Pehuamar maní salado 100 g", 1600, 1000, "Snacks"],
    ["7790150000120", "Yerba Playadito 500 g", 4900, 3600, "Almacén"],
    ["7790590000315", "Azúcar Ledesma 1 kg", 3700, 2900, "Almacén"],
    ["7790580000056", "Galletitas Sonrisas", 4000, 2800, "Galletitas"],
    ["7790895002212", "Aquarius pomelo 1,5 L", 2600, 1700, "Bebidas"],
    ["7798093770019", "Pañuelos Elegante", 1100, 650, "Varios"],
    ["7790310005019", "Chocolate Milka 100 g", 3900, 2700, "Golosinas"],
    ["7790580000032", "Caramelos Sugus surtidos", 3500, 2400, "Golosinas"],
    ["7790040200203", "Cheetos 60 g", 1900, 1200, "Snacks"],
    ["7790895000546", "Agua Bonaqua 500 ml", 1100, 650, "Bebidas"],
  ];
  const productos = [];
  for (const [ean, nombre, precio, costo, rubro] of base) {
    let imagen;
    try {
      const off = await buscarEnOpenFoodFacts(ean);
      imagen = off?.imagenUrl;
    } catch {}
    const p = { id: crypto.randomUUID(), ean, nombre, precio: $(precio), costo: $(costo), rubro, stock: 10 + azar(50), imagen };
    await db.agregarProducto(p);
    productos.push(p);
  }
  // uno por peso
  const pesados = { id: crypto.randomUUID(), nombre: "Caramelos sueltos", precio: $(500), costo: $(300), rubro: "Golosinas", unidad: "peso", stock: 3000 };
  await db.agregarProducto(pesados);

  // ---------- clientes y empleados ----------
  const clientes = [
    { id: crypto.randomUUID(), nombre: "Doña Rosa" },
    { id: crypto.randomUUID(), nombre: "Marcelo (taxi)" },
  ];
  for (const c of clientes) await db.agregarCliente(c);
  const empleados = [
    { id: crypto.randomUUID(), nombre: "Belén", turnos: [{ dias: [1, 2, 3, 4, 5, 6], desde: "08:00", hasta: "14:00" }] },
    { id: crypto.randomUUID(), nombre: "Marcos", turnos: [{ dias: [1, 2, 3, 4, 5, 6], desde: "14:00", hasta: "21:00" }] },
  ];
  await emp.guardarEmpleados(empleados);

  // ---------- 30 días de ventas y cajas ----------
  const DISP = db.dispositivoId();
  const hoy = new Date();
  let totalVentas = 0;
  for (let d = 30; d >= 1; d--) {
    const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d);
    const esDomingo = dia.getDay() === 0;
    const cantidad = esDomingo ? 6 + azar(5) : 12 + azar(12);
    const ventasDia = [];
    for (let i = 0; i < cantidad; i++) {
      const hora = elegir([8, 9, 10, 11, 12, 12, 13, 16, 17, 18, 18, 19, 19, 20, 21]);
      const fecha = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, azar(60), azar(60));
      const n = 1 + azar(3);
      const lineas = [];
      for (let j = 0; j < n; j++) {
        const p = elegir(productos);
        if (lineas.some((l) => l.productoId === p.id)) continue;
        lineas.push({ productoId: p.id, nombre: p.nombre, cantidad: 1 + azar(2), precioUnitario: p.precio });
      }
      const total = core.totalLineas(lineas);
      const r = Math.random();
      let pagos, clienteId;
      if (r < 0.7) pagos = core.pagoUnico("efectivo", total);
      else if (r < 0.95) pagos = core.pagoUnico("transferencia", total);
      else { pagos = core.pagoUnico("fiado", total); clienteId = elegir(clientes).id; }
      const venta = core.crearVenta({ id: crypto.randomUUID(), dispositivoId: DISP, fecha: fecha.toISOString(), lineas, pagos, clienteId });
      await db.guardarVenta(venta);
      ventasDia.push(venta);
      totalVentas++;
    }
    // caja del día: abre Belén a la mañana (a veces tarde), cierra a la noche
    const efectivo = ventasDia.reduce((s, v) => s + core.montoPorMedio(v, "efectivo"), 0);
    const tardanza = elegir([0, 0, 0, 5, 12, 25, 45]);
    const abiertaEn = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 8, tardanza);
    const retiro = Math.random() < 0.3 ? $(elegir([5000, 10000, 20000])) : 0;
    const movimientos = retiro ? [{ tipo: "retiro", monto: retiro, motivo: "proveedor" }] : [];
    const esperado = $(10000) + efectivo - retiro;
    const diferencia = elegir([0, 0, 0, 0, -500, -1200, 300]);
    await db.guardarCaja({
      id: crypto.randomUUID(), apertura: $(10000), abiertaEn: abiertaEn.toISOString(),
      cerradaEn: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 21, 30 + azar(25)).toISOString(),
      movimientos, esperado, contado: esperado + $(diferencia), diferencia: $(diferencia),
      empleadoId: empleados[0].id, empleadoNombre: "Belén", tardanzaMin: tardanza,
    });
  }
  // un pago de fiado
  await db.guardarPagoFiado({ id: crypto.randomUUID(), clienteId: clientes[0].id, fecha: new Date(hoy.getTime() - 3 * 86400000).toISOString(), monto: $(3000), tipo: "pago" });

  await sincronizar(backendSupabase());
  return { productos: productos.length + 1, ventas: totalVentas, pendientes: await db.db.outbox.count() };
})();
