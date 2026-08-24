# Handoff: Kioskeo — POS y gestión para kioscos (rediseño UI)

## Overview
Rediseño completo de la interfaz de **Kioskeo**, un punto de venta y sistema de gestión para kioscos/maxikioscos de Argentina. Incluye 5 pantallas de escritorio (1280px) y sus 5 equivalentes mobile (390px): Vender, Panel, Productos, Caja y Fiados. Dirección: producto profesional, denso y elegante (referencia: Stripe/Linear) con paleta cálida propia. Regla de oro del producto: **todo a 1–2 clicks, la información importante siempre visible**.

## About the Design Files
Los archivos de este paquete son **referencias de diseño creadas en HTML** — prototipos que muestran el look y el comportamiento buscado, no código de producción para copiar tal cual. La tarea es **recrear estos diseños en el entorno del codebase destino** (React, Vue, etc.) usando sus patrones y librerías; si todavía no hay entorno, elegir el framework más apropiado e implementarlos ahí.

`Kioskeo UI.dc.html` es el archivo fuente. Todas las pantallas están en un solo lienzo, tituladas A1–A5 (escritorio) y B1–B5 (celular). Todos los estilos son inline — cada valor exacto está en el markup.

## Fidelity
**High-fidelity (hifi).** Colores, tipografía, espaciado, copys y estados son finales. Recrear pixel-perfect con las librerías existentes del codebase.

## Design Tokens
Colores:
- Fondo app: `#FFFDFB` (blanco cálido) · Fondo lienzo/desk: `#F6F1EC`
- Superficie tarjetas: `#FFFFFF`
- Tinta principal: `#17181A` · Texto secundario: `#4B4F55` · Muted: `#8A8F96` · Deshabilitado/tachado: `#B9BDC3`
- Acento (único): `#FF6B5B` · Acento pressed/hover: `#F4573F` · Acento texto oscuro: `#D9432C`
- Tinte acento (fondos): `#FFF0ED` · Tinte acento fuerte: `#FFE0DA` · Barras chart inactivas: `#FFD3CC`
- Verde SOLO estados positivos: `#128A5C` · Tinte verde: `#E7F5EE`
- Hairlines: `#F1ECE7` (bordes de tarjeta/tabla) y `#F6F1EC` (separadores de fila internos) · Bordes de input: `#EDE8E2`
- Fondo hover sutil sidebar: `#FAF4EF` · KPI destacado invertido: fondo `#17181A`

Tipografía: **Archivo** (Google Fonts), pesos 400–900. Números SIEMPRE con `font-variant-numeric: tabular-nums`.
- Etiquetas uppercase: 9.5–12px, weight 800, letter-spacing 1–2px, color muted
- Cuerpo/tabla: 13–14.5px, weight 600 nombres / 800 montos
- KPIs: 21–22px weight 900 · Totales protagonistas: 34–44px weight 900, letter-spacing −1 a −1.5px

Radios: 100px pills · 24px marco celular · 16px marco desktop · 11–14px tarjetas/botones/inputs · 7–10px chips y celdas pequeñas.
Sombras: casi imperceptibles — marcos `0 1px 3px rgba(23,24,26,0.05)`; focus ring `0 0 0 3px #FFF0ED` + borde `1.5px solid #FF6B5B`.
Espaciado: padding de tarjeta 12–18px; gaps 6–14px; filas de tabla desktop ~38px; filas mobile 44–58px.

## Screens / Views

### Estructura común escritorio (1280px)
- **Sidebar fija de 64px**, fondo blanco, hairline derecha. Logo: cuadrado 34px radio 10px fondo `#FF6B5B` con "K" blanca 900. Debajo, 5 ítems (52px ancho): ícono SVG 19px stroke 2 + etiqueta 9px 700 uppercase. Orden: VENDER (rayo), PRODUCTOS (caja 3D), CAJA (caja registradora), FIADOS (persona), PANEL (barras). Activo: fondo `#FFF0ED`, ícono y texto `#F4573F`, weight 800. Inactivo: gris `#8A8F96`, hover fondo `#FAF4EF`.
- Contenido con header: etiqueta uppercase muted a la izquierda (ej. "VENDER · TURNO MAÑANA · MARTO") y estado/acciones a la derecha.

### A1 · Vender (escritorio)
Dos columnas: contenido flexible + panel de ticket fijo de 372px a la derecha (fondo blanco, hairline izquierda).
- **Izquierda**: buscador SIEMPRE enfocado (44px alto, borde 1.5px acento + focus ring, hint "ENTER = AGREGAR" a la derecha). Debajo, etiqueta "FRECUENTES" + grilla 4 columnas de celdas compactas clickeables (nombre 13px 600 + precio 14px 800 en acento; borde hairline, hover borde acento). Pie: atajos F2 escanear / F4 precio libre / Esc borrar.
- **Ticket**: header "TICKET · 4 ÍTEMS" + acción Vaciar. Líneas editables: stepper −/+ (22px, borde `#EDE8E2`) + cantidad + nombre + monto tabular. Separadores `#F6F1EC`.
- **Pie del ticket**: TOTAL 38px 900 tabular; botón COBRAR 52px fondo acento, texto blanco 900 tracking 1.5; debajo grilla 2×2 con los 4 medios (44px): EFECTIVO seleccionado (borde 1.5px acento + fondo tinte + texto `#D9432C`), TRANSF/MIXTO/FIADO outline con hover acento. **Sin modal** — los medios viven en la misma columna. Nota: "Enter confirma efectivo · un click cualquier otro medio".
- Datos: Coca-Cola 500ml ×2 $3.600, Alfajor Guaymallén ×3 $1.800, Marlboro Box 20 ×1 $4.900, Beldent Menta ×1 $800. Total $11.100. Chip verde "Caja abierta · $10.000" en el header.

### A2 · Panel (escritorio)
- Header con filtros pill: **Hoy** (activo: fondo `#17181A` texto blanco), Semana, Mes (outline).
- **Fila de 6 KPIs** (grid 6 col): VENDIDO HOY $19.500 (número en acento), VENTAS 8, EFECTIVO $12.600, TRANSFERENCIAS $5.000, FIADO HOY $1.900, FIADO PENDIENTE $11.300.
- **Gráfico de barras por hora** (8–22h): barras divs, altura % sobre contenedor de 96px, color `#FFD3CC` salvo el pico (12h) en `#FF6B5B` con etiqueta en acento. Anotación "pico 12h · $4.700".
- **Dos tablas lado a lado** (grid 1fr/1.5fr): "LO MÁS VENDIDO" (producto/un./monto: Coca 5 $9.000, Marlboro 1 $4.900, Alfajor 6 $3.600, Beldent 2 $1.600, Bon o Bon 2 $1.000) y "ÚLTIMAS VENTAS" (hora/items/medio/total/estado). Estados como pills 11px: Cobrada (verde/tinte), Anulada (gris `#8A8F96` sobre `#F4F0EC`, **fila tachada en `#B9BDC3`**), Fiada (acento/tinte).
- **Bloque anulaciones**: una fila — "ANULACIONES DEL DÍA · 1 · $1.800 · 14:22 — Coca-Cola 500ml ×1, anulada por Marto (turno mañana)" + link "Ver historial →".

### A3 · Productos + aumento masivo (escritorio)
- Header: "PRODUCTOS · 214" + botones **+ Nuevo** (outline) y **Aumentar precios** (fondo acento) arriba a la derecha. Buscador 38px (max 420px).
- **Tabla densa** (grid 2fr/1fr/1.3fr/0.8fr): NOMBRE / RUBRO / CÓDIGO / PRECIO (derecha). Header de tabla fondo `#FAF4EF`. Filas 13.5px, hover fondo `#FFFDFB`. **Edición en línea**: la fila en edición (Alfajor $600) tiene fondo `#FFF9F7` y el precio dentro de un input pill con borde acento + focus ring. Nota al pie: "Click en el precio = editás ahí mismo. Enter guarda."
- **Panel lateral derecho fijo de 316px** (blanco, hairline izquierda): "AUMENTAR PRECIOS" → RUBRO (select: Cigarrillos), AUMENTO (+8%, input enfocado) y REDONDEO (a $50, select), luego "ASÍ QUEDAN · 12 PRODUCTOS" con preview en vivo de 5 filas antes→después (viejo tachado gris, nuevo en negrita): Marlboro 4.900→$5.300, Philip Morris 4.300→$4.650, Chesterfield 4.100→$4.450, Lucky Strike 4.600→$4.950, Camel 4.700→$5.100. "…y 7 más. Nada cambia hasta que apliques." Botón **APLICAR AUMENTO** abajo (46px, acento).

### A4 · Caja + cierre ciego (escritorio)
- Header: "CAJA · TURNO MAÑANA · ABIERTA 08:02 POR MARTO" + chip verde "Abierta hace 6 h 39 m".
- **Fila de 4 métricas**: APERTURA $10.000, VENTAS EFECTIVO +$12.600 (verde), RETIROS −$2.000 (rojo acento `#D9432C`), ESPERADO EN CAJA $20.600 (tarjeta invertida fondo `#17181A`, número blanco).
- **Tabla de movimientos** (hora/tipo/detalle/monto): apertura, ventas en efectivo agrupadas (+$12.600 verde), retiro "Pago al diariero — Marto" (−$2.000).
- **Panel derecho 316px**: acciones "− Retiro de plata" y "+ Ingreso de plata" (42px outline), separador, luego **CERRAR CAJA** (cierre ciego): copy "Contá la plata primero. El sistema no te muestra el esperado hasta que cargues lo contado." → input "¿CUÁNTO HAY EN LA CAJA?" ($20.600, focus ring) → filas Esperado $20.600 / Contado $20.600 / Diferencia con pill verde "$0 · cerró bien" → botón **CERRAR TURNO**.

### A5 · Fiados (escritorio)
- Header: "FIADOS · 4 CLIENTES" + botón outline "+ Nuevo cliente".
- **3 KPIs** (max 640px): TOTAL ADEUDADO $11.300 (tarjeta invertida `#17181A`), FIADO ESTE MES $18.700, COBRADO ESTE MES $7.400 (verde).
- **Tabla de clientes** (cliente/saldo/última compra/acción): Doña Rosa $4.900 en `#D9432C` (Hoy 13:12 · Marlboro, botón Cobrar sólido acento), Marcos (edificio) $3.200 (Ayer 19:40), Luis remisero $1.900 (Hoy 09:20), Vale $1.300 (Viernes). Botones "Cobrar" en línea: el mayor deudor sólido, el resto tinte (`#FFF0ED` texto `#D9432C`). Nota: "Cobrar acepta pago total o parcial."

### Mobile (390px, B1–B5)
Marco 390×800, radio 24px. **Navegación inferior de 5 pestañas** (VENDER/PRODUCTOS/CAJA/FIADOS/PANEL, 10px 700 uppercase; activa en `#F4573F` weight 800), fondo blanco, hairline superior. Filas de listas 44–58px (tocables). Misma densidad seria que desktop **salvo la excepción de Vender**:
- **B1 Vender**: buscador enfocado + botón escáner (42px, ícono código de barras), fila de chips frecuentes, ticket compacto (filas 46px), y abajo GRANDE: total 44px 900, COBRAR 58px, grilla 2×2 de medios de 52px c/u — se usan sin mirar.
- **B2 Panel**: $19.500 en 40px + "8 ventas", 4 KPIs en grid 2×2, mini chart por hora (52px), tarjeta verde "Caja mañana cerró bien · $0 dif.", lista últimas ventas (anulada tachada).
- **B3 Productos**: buscador + botón "+8%" (acceso a aumento masivo), chips de rubro (Todos activo pill negra), lista densa nombre+rubro+código / precio (fila en edición con input acento), botón "+ Nuevo producto" dashed acento.
- **B4 Caja**: tarjeta invertida ESPERADO $20.600 con desglose, movimientos, botones − Retiro / + Ingreso y CERRAR TURNO (52px acento).
- **B5 Fiados**: total $11.300 en 36px, lista de clientes con saldo y botón Cobrar en línea, "+ Nuevo cliente" dashed.

## Interactions & Behavior
- **Vender**: buscador con autofocus permanente; Enter agrega el primer resultado; click en celda frecuente agrega 1 unidad; steppers −/+ editan cantidad en línea; COBRAR revela/confirma los 4 medios en la misma columna (sin modal) — Enter confirma EFECTIVO, un click cualquier otro; Esc vacía el ticket; F2 abre escáner por cámara; F4 precio libre.
- **Productos**: click en el precio → input en línea, Enter guarda, Esc cancela. "Aumentar precios" abre el panel lateral (no modal); el preview se recalcula en vivo al cambiar rubro/%/redondeo; nada persiste hasta APLICAR.
- **Caja**: cierre ciego — el campo "contado" se completa ANTES de mostrar esperado/diferencia. Diferencia $0 → estado verde; diferencia ≠ 0 → mostrar en `#D9432C`.
- **Fiados**: "Cobrar" abre cobro total o parcial; el saldo del mayor deudor se destaca en `#D9432C`.
- **Anuladas**: siempre visibles, tachadas en gris — nunca ocultas.
- Hovers sutiles: bordes pasan a acento, fondos a `#FAF4EF`/`#FFFDFB`; botones acento pasan a `#F4573F`. Sin animaciones ostentosas; transiciones ≤150ms.

## State Management
- Ticket actual: líneas {producto, cantidad, precio}, total derivado; medio de pago seleccionado.
- Caja/turno: apertura, movimientos (+/−), esperado derivado, estado abierta/cerrada, empleado y hora.
- Productos: colección con rubro y código; borrador de aumento masivo {rubro, %, redondeo} con preview derivado.
- Fiados: clientes con saldo, historial de compras/pagos.
- Panel: agregados del día (por medio, por hora, más vendidos, últimas ventas, anulaciones), filtro Hoy/Semana/Mes.
- Requisito del producto real: funciona **offline-first** (persistencia local + sync).

## Assets
Sin imágenes. Íconos: SVGs inline stroke 2px (rayo, caja 3D, registradora, persona, barras, lupa, código de barras, check) — recrear con la librería de íconos del codebase (ej. Lucide) manteniendo peso visual. Fuente: Archivo vía Google Fonts.

## Files
- `Kioskeo UI.dc.html` — todas las pantallas (A1–A5 escritorio, B1–B5 celular), estilos inline con valores exactos.
