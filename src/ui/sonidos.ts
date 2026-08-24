// Sonidos sintetizados con Web Audio: cero archivos, cero peso, siempre
// disponibles offline. Regla de diseño: sonidos ceremoniales (woosh) solo
// en navegación; adentro del POS solo feedback funcional (bip, éxito),
// corto y a volumen moderado — se escuchan cientos de veces por día.

let ctx: AudioContext | null = null;

/** Interruptor de Ajustes ("Sonidos"). Se lee de la copia local: cero costo. */
export function sonidosActivos(): boolean {
  try {
    const a = JSON.parse(localStorage.getItem("kioskeo-ajustes") ?? "{}");
    return a.sonidos !== false;
  } catch {
    return true;
  }
}

function audio(): AudioContext | null {
  if (!sonidosActivos()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null; // sin audio no pasa nada: la app sigue muda y feliz
  }
}

/**
 * iPhone solo habilita el audio web después de un toque del usuario, y el
 * escaneo no es un toque: el bip salía mudo. Con el primer toque en cualquier
 * lado se crea y despierta el contexto, y desde ahí suena todo.
 */
export function prepararAudio(): void {
  const despertar = () => {
    try {
      ctx ??= new AudioContext();
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      // sin audio
    }
  };
  for (const evento of ["pointerdown", "touchend", "keydown"]) {
    document.addEventListener(evento, despertar, { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx?.state === "suspended") void ctx.resume();
  });
}

/** Ola de mar: ruido blanco con un barrido de filtro. ~600ms. */
export function woosh(): void {
  const ac = audio();
  if (!ac) return;
  const dur = 0.65;
  const buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;

  const fuente = ac.createBufferSource();
  fuente.buffer = buffer;

  const filtro = ac.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.Q.value = 0.9;
  filtro.frequency.setValueAtTime(300, ac.currentTime);
  filtro.frequency.exponentialRampToValueAtTime(2800, ac.currentTime + dur * 0.45);
  filtro.frequency.exponentialRampToValueAtTime(400, ac.currentTime + dur);

  const ganancia = ac.createGain();
  ganancia.gain.setValueAtTime(0.0001, ac.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(0.5, ac.currentTime + dur * 0.35);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);

  fuente.connect(filtro).connect(ganancia).connect(ac.destination);
  fuente.start();
  fuente.stop(ac.currentTime + dur);
}

/** Confirmación de venta cobrada: dos notas cortas ascendentes. */
export function exitoVenta(): void {
  const ac = audio();
  if (!ac) return;
  const notas = [660, 880];
  notas.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const ganancia = ac.createGain();
    const inicio = ac.currentTime + i * 0.09;
    osc.type = "sine";
    osc.frequency.value = freq;
    ganancia.gain.setValueAtTime(0.0001, inicio);
    ganancia.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.12);
    osc.connect(ganancia).connect(ac.destination);
    osc.start(inicio);
    osc.stop(inicio + 0.14);
  });
}

/**
 * Nota del cuestionario de bienvenida: cada respuesta sube un escalón de la
 * escala (sol-la-si-do), así el avance también se escucha. Suave y redonda.
 */
export function notaBienvenida(paso: number): void {
  const ac = audio();
  if (!ac) return;
  const notas = [392, 440, 493.9, 523.3];
  const freq = notas[Math.min(paso, notas.length - 1)];
  const osc = ac.createOscillator();
  const ganancia = ac.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  ganancia.gain.setValueAtTime(0.0001, ac.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(0.22, ac.currentTime + 0.02);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.35);
  osc.connect(ganancia).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.4);
}

/** Arpegio de llegada al último paso: la escala completa, rapidita. */
export function llegadaBienvenida(): void {
  const ac = audio();
  if (!ac) return;
  [392, 493.9, 587.3, 784].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const ganancia = ac.createGain();
    const inicio = ac.currentTime + i * 0.07;
    osc.type = "triangle";
    osc.frequency.value = freq;
    ganancia.gain.setValueAtTime(0.0001, inicio);
    ganancia.gain.exponentialRampToValueAtTime(0.16, inicio + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.3);
    osc.connect(ganancia).connect(ac.destination);
    osc.start(inicio);
    osc.stop(inicio + 0.35);
  });
}

/** Bip de escáner: corto y seco, como los lectores de verdad. */
export function bipEscaner(): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const ganancia = ac.createGain();
  osc.type = "square";
  osc.frequency.value = 1175;
  ganancia.gain.setValueAtTime(0.12, ac.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.08);
  osc.connect(ganancia).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.09);
}
