import { describe, expect, it } from "vitest";
import { ahoraEfectivo, calcularEstado, type Suscripcion } from "./suscripcion";

function sus(venceEl: string, extra: Partial<Suscripcion> = {}): Suscripcion {
  return {
    venceEl,
    graciaDias: 3,
    plan: "prueba",
    horaServidor: "2026-08-01T12:00:00.000Z",
    leidoEn: new Date("2026-08-01T12:00:00.000Z").getTime(),
    ...extra,
  };
}

const el = (fecha: string) => new Date(`${fecha}T10:00:00`);

describe("estado de la suscripción", () => {
  it("sin datos es desconocida (no bloquea)", () => {
    expect(calcularEstado(null, el("2026-08-10")).estado).toBe("desconocida");
  });

  it("activa cuando faltan más de 5 días", () => {
    const r = calcularEstado(sus("2026-08-31"), el("2026-08-10"));
    expect(r.estado).toBe("activa");
    expect(r.dias).toBe(21);
    expect(r.prueba).toBe(true);
  });

  it("por vencer a 5 días o menos, incluido el último día", () => {
    expect(calcularEstado(sus("2026-08-31"), el("2026-08-26")).estado).toBe("por_vencer");
    const ultimo = calcularEstado(sus("2026-08-31"), el("2026-08-31"));
    expect(ultimo.estado).toBe("por_vencer");
    expect(ultimo.dias).toBe(0);
  });

  it("gracia los 3 días siguientes al vencimiento", () => {
    expect(calcularEstado(sus("2026-08-31"), el("2026-09-01")).estado).toBe("gracia");
    expect(calcularEstado(sus("2026-08-31"), el("2026-09-03")).estado).toBe("gracia");
    expect(calcularEstado(sus("2026-08-31"), el("2026-09-03")).dias).toBe(-3);
  });

  it("bloqueada pasada la gracia", () => {
    expect(calcularEstado(sus("2026-08-31"), el("2026-09-04")).estado).toBe("bloqueada");
  });

  it("gracia configurable", () => {
    expect(calcularEstado(sus("2026-08-31", { graciaDias: 0 }), el("2026-09-01")).estado).toBe("bloqueada");
  });

  it("atrasar el reloj del celular no rejuvenece la suscripción", () => {
    // El servidor dijo que era 10 de septiembre cuando se leyó.
    const s = sus("2026-08-31", {
      horaServidor: "2026-09-10T12:00:00.000Z",
      leidoEn: new Date("2026-09-10T12:00:00.000Z").getTime(),
    });
    // El celular dice 1 de agosto: se usa la hora del servidor.
    expect(calcularEstado(s, el("2026-08-01")).estado).toBe("bloqueada");
    expect(ahoraEfectivo(s, el("2026-08-01")).getTime()).toBeGreaterThanOrEqual(
      new Date("2026-09-10T12:00:00.000Z").getTime(),
    );
  });

  it("el tiempo transcurrido desde la lectura cuenta aunque el reloj local esté atrasado", () => {
    const leido = new Date("2026-09-01T12:00:00.000Z").getTime();
    const s = sus("2026-08-31", { horaServidor: "2026-09-01T12:00:00.000Z", leidoEn: leido });
    // Pasaron 5 días locales desde la lectura (aunque el reloj diga otra fecha).
    const ahora = new Date(leido + 5 * 86400000);
    expect(calcularEstado(s, ahora).estado).toBe("bloqueada");
  });
});
