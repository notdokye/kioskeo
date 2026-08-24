/* Kioskeo — flujo de bienvenida: transiciones pop con fondos alternados */
const { useComposition, CompositionStage, Shot, Captions, Easing, interpolate, animate, clamp } = window;

const SALMON = '#FF6B5B', INK = '#17181A', BG = '#FFFDFB', TINT = '#FFF0ED', GREEN = '#128A5C';
const AR = 'Archivo, system-ui, sans-serif';
const SW = 390, SHh = 760;

const QS = [
  { q: '¿Vendés fiado?', opts: ['Sí, tengo clientes que anotan', 'No, en mi negocio no se fía'], icon: 'notebook', sel: 0 },
  { q: '¿Contás la plata del cajón al cerrar?', opts: ['Sí, hago cierre de caja', 'No, no cuento el cajón'], icon: 'drawer', sel: 0 },
  { q: '¿Cómo vas a cargar tus productos?', opts: ['Tengo una lista en Excel', 'Los escaneo con la cámara', 'Los cargo a mano'], optIcons: ['sheet', 'scan', 'pencil'], sel: 1 },
  { q: '¿Querés que Kioskeo te cuente secretos de tu negocio?', sub: 'Qué se vende más, en qué horario entra más gente, qué te deja más ganancia.', opts: ['Sí, contame todo', 'No, solo quiero cobrar'], icon: 'bulb', sel: 0 },
];
function cardGeom(qi) {
  const three = QS[qi].opts.length === 3;
  const y0 = qi === 3 ? 478 : 430, h = three ? 76 : 88, gap = three ? 14 : 16;
  return { y0, h, gap, centers: QS[qi].opts.map((_, j) => y0 + j * (h + gap) + h / 2) };
}

function Icon({ name, size = 30, color = INK, style }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const body = {
    notebook: <g {...s}><rect x="7" y="5" width="16" height="22" rx="2.5" /><line x1="11" y1="11" x2="19" y2="11" /><line x1="11" y1="16" x2="19" y2="16" /><line x1="11" y1="21" x2="16" y2="21" /><line x1="4.5" y1="9" x2="7" y2="9" /><line x1="4.5" y1="16" x2="7" y2="16" /><line x1="4.5" y1="23" x2="7" y2="23" /></g>,
    drawer: <g {...s}><rect x="4" y="10" width="24" height="14" rx="2.5" /><path d="M4 16 h9 c0 2 2 3.4 3 3.4 s3-1.4 3-3.4 h9" /><circle cx="11" cy="7" r="2.6" /><circle cx="17" cy="6" r="2.6" /></g>,
    sheet: <g {...s}><rect x="6" y="5" width="20" height="22" rx="2.5" /><line x1="6" y1="12" x2="26" y2="12" /><line x1="6" y1="19" x2="26" y2="19" /><line x1="13" y1="5" x2="13" y2="27" /></g>,
    scan: <g {...s}><path d="M5 10 V7 a2 2 0 0 1 2-2 h3 M22 5 h3 a2 2 0 0 1 2 2 v3 M27 22 v3 a2 2 0 0 1-2 2 h-3 M10 27 H7 a2 2 0 0 1-2-2 v-3" /><line x1="8" y1="16" x2="24" y2="16" /></g>,
    pencil: <g {...s}><path d="M8 24 l-2 6 6-2 L26 14 a3 3 0 0 0-4-4 Z" /><line x1="18" y1="13" x2="23" y2="18" /></g>,
    bulb: <g {...s}><path d="M16 4 a8 8 0 0 1 5 14.2 c-1.2 1-1.8 2-1.8 3.3 h-6.4 c0-1.3-.6-2.3-1.8-3.3 A8 8 0 0 1 16 4 Z" /><line x1="13" y1="25.5" x2="19" y2="25.5" /><line x1="14" y1="28.5" x2="18" y2="28.5" /></g>,
  }[name];
  return <svg width={size} height={size} viewBox="0 0 32 32" style={style}>{body}</svg>;
}
function KBadge({ h = 56, style }) {
  return <div style={{ width: h, height: h, borderRadius: h * 0.32, background: SALMON, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: AR, fontWeight: 800, fontSize: h * 0.56, color: '#FFFFFF', boxShadow: '0 8px 20px rgba(255,107,91,0.30)', ...style }}>K</div>;
}

// ---------- Timeline ----------
const R_FULL = 880, WIPE = 0.7;
function buildTL(CUES) {
  const L = CUES['Empezá gratis'], Q = [CUES['Pregunta 1'], CUES['Pregunta 2'], CUES['Pregunta 3'], CUES['Pregunta 4']], AC = CUES['Crear cuenta'], DK = CUES['Escritorio'];
  const g = QS.map((_, i) => cardGeom(i));
  const selY = i => g[i].centers[QS[i].sel];
  const tap = [Q[1] - 0.9, Q[1] + 3.4, Q[3] - 0.9, AC - 0.9]; // selección en Q1..Q4
  const backTap = Q[1] + 4.6, reTap = Q[1] + 6.2, resume = Q[1] + 7.6;
  // wipes: por pantalla, círculo desde el punto tocado
  const wipes = [
    [{ at: L + 2.95, from: 0, to: R_FULL, x: 195, y: 592 }],                                   // Q1 (blanco)
    [{ at: tap[0] + 0.35, from: 0, to: R_FULL, x: 195, y: selY(0) },                            // Q2 (salmón)
     { at: backTap + 0.2, from: R_FULL, to: 0, x: 32, y: 40 },
     { at: reTap + 0.2, from: 0, to: R_FULL, x: 195, y: selY(0) }],
    [{ at: resume + 0.35, from: 0, to: R_FULL, x: 195, y: selY(1) }],                           // Q3 (blanco)
    [{ at: tap[2] + 0.35, from: 0, to: R_FULL, x: 195, y: selY(2) }],                           // Q4 (salmón)
    [{ at: tap[3] + 0.35, from: 0, to: R_FULL, x: 195, y: selY(3) }],                           // Cuenta
  ];
  const pop = [Q[0] + 0.45, Q[1] + 0.45, Q[2] + 0.45, Q[3] + 0.45];
  const cards = pop.map(p => p + 0.4);
  const prog = interpolate(
    [Q[0] + 0.2, Q[0] + 0.9, Q[1] + 0.2, Q[1] + 0.9, Q[2] + 0.2, Q[2] + 0.9, Q[3] + 0.2, Q[3] + 0.9],
    [0, .25, .25, .5, .5, .75, .75, 1], Easing.easeOutCubic);
  // pantalla visible (para color de barra/label): 0..5
  const idxIn = [0, L + 3.3, Q[0] + 0.01, tap[0] + 0.7, backTap + 0.55, backTap + 0.56, reTap + 0.55, reTap + 0.56, resume + 0.7, tap[2] + 0.7, tap[3] + 0.7];
  const idxOut = [0, 1, 1, 2, 2, 1, 1, 2, 3, 4, 5];
  const idx = interpolate(idxIn, idxOut, Easing.linear);
  // dedo (coordenadas locales de pantalla)
  const W = [
    { t: L + 1.5, x: 275, y: 668, o: 0 }, { t: L + 1.9, x: 265, y: 655, o: 1 }, { t: L + 2.45, x: 195, y: 592, o: 1 }, { t: L + 3.1, x: 203, y: 604, o: 0 },
    { t: Q[0] + 2.4, x: 320, y: 650, o: 0 }, { t: Q[0] + 2.8, x: 310, y: 640, o: 1 }, { t: tap[0] - 0.15, x: 195, y: selY(0), o: 1 }, { t: tap[0] + 0.55, x: 203, y: selY(0) + 12, o: 0 },
    { t: Q[1] + 2.3, x: 320, y: 650, o: 0 }, { t: Q[1] + 2.7, x: 310, y: 640, o: 1 }, { t: tap[1] - 0.15, x: 195, y: selY(1), o: 1 },
    { t: tap[1] + 0.5, x: 195, y: selY(1), o: 1 }, { t: backTap - 0.1, x: 32, y: 40, o: 1 }, { t: backTap + 0.5, x: 38, y: 48, o: 0 },
    { t: reTap - 0.45, x: 225, y: selY(0) + 30, o: 0 }, { t: reTap - 0.3, x: 195, y: selY(0), o: 1 }, { t: reTap + 0.55, x: 203, y: selY(0) + 12, o: 0 },
    { t: Q[2] + 2.7, x: 320, y: 650, o: 0 }, { t: Q[2] + 3.1, x: 310, y: 640, o: 1 }, { t: tap[2] - 0.15, x: 195, y: selY(2), o: 1 }, { t: tap[2] + 0.55, x: 203, y: selY(2) + 12, o: 0 },
    { t: Q[3] + 2.7, x: 320, y: 650, o: 0 }, { t: Q[3] + 3.1, x: 310, y: 640, o: 1 }, { t: tap[3] - 0.15, x: 195, y: selY(3), o: 1 }, { t: tap[3] + 0.55, x: 203, y: selY(3) + 12, o: 0 },
    { t: AC + 4.8, x: 300, y: 724, o: 0 }, { t: AC + 5.1, x: 295, y: 718, o: 1 }, { t: AC + 5.65, x: 195, y: 680, o: 1 }, { t: AC + 6.4, x: 203, y: 694, o: 0 },
  ];
  const taps = [
    { t: L + 2.6, x: 195, y: 592, c: SALMON }, { t: tap[0], x: 195, y: selY(0), c: SALMON },
    { t: tap[1], x: 195, y: selY(1), c: '#FFFFFF' }, { t: backTap, x: 32, y: 40, c: '#FFFFFF' },
    { t: reTap, x: 195, y: selY(0), c: SALMON }, { t: tap[2], x: 195, y: selY(2), c: SALMON },
    { t: tap[3], x: 195, y: selY(3), c: '#FFFFFF' }, { t: AC + 5.8, x: 195, y: 680, c: SALMON },
  ];
  return {
    L, Q, AC, DK, tap, backTap, reTap, resume, wipes, pop, cards, prog, idx, taps,
    fx: interpolate(W.map(w => w.t), W.map(w => w.x), Easing.easeInOutCubic),
    fy: interpolate(W.map(w => w.t), W.map(w => w.y), Easing.easeInOutCubic),
    fo: interpolate(W.map(w => w.t), W.map(w => w.o), Easing.easeInOutQuad),
  };
}

// ---------- Motion helpers (los únicos tres) ----------
const MOTION = {
  enter: (T, at, dy = 24, dur = 0.5) => ({ opacity: animate({ from: 0, to: 1, start: at, end: at + dur * 0.7, ease: Easing.easeOutQuad })(T), transform: `translateY(${animate({ from: dy, to: 0, start: at, end: at + dur, ease: Easing.easeOutCubic })(T)}px)` }),
  pop: (T, at, dur = 0.5) => ({ opacity: animate({ from: 0, to: 1, start: at, end: at + 0.25, ease: Easing.easeOutQuad })(T), transform: `scale(${animate({ from: 0.9, to: 1, start: at, end: at + dur, ease: Easing.easeOutBack })(T)})` }),
  press: (T, at) => { const p = clamp((T - at) / 0.32, 0, 1); return p <= 0 || p >= 1 ? 1 : 1 - 0.06 * Math.sin(p * Math.PI); },
};
function wipeClip(T, wipes) {
  let r = 0, x = wipes[0].x, y = wipes[0].y;
  for (const w of wipes) {
    if (T >= w.at) { r = animate({ from: w.from, to: w.to, start: w.at, end: w.at + WIPE, ease: Easing.easeInOutCubic })(T); x = w.x; y = w.y; }
  }
  return { visible: r > 0.5, clipPath: `circle(${r}px at ${x}px ${y}px)` };
}

// ---------- Pantallas ----------
function TopBar({ light }) {
  const c = light ? '#FFFFFF' : INK, op = light ? 0.8 : 0.55;
  return <div style={{ position: 'absolute', top: 30, left: 0, right: 0, height: 30 }}>
    <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: 'absolute', left: 20, top: 3 }}><polyline points="13,4 6,11 13,18" fill="none" stroke={c} strokeOpacity={op} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <div style={{ position: 'absolute', right: 20, top: 4, fontSize: 15, color: c, opacity: light ? 0.8 : 0.45, fontWeight: 500 }}>Saltar</div>
  </div>;
}
function QScreen({ qi, T, TL }) {
  const q = QS[qi], gm = cardGeom(qi), light = qi % 2 === 1; // Q2 y Q4 en salmón
  const tapT = TL.tap[qi];
  return <div style={{ position: 'absolute', inset: 0, background: light ? SALMON : '#FFFFFF' }}>
    <TopBar light={light} />
    <div style={{ position: 'absolute', top: 225, left: 30, right: 30, textAlign: 'center', ...MOTION.pop(T, TL.pop[qi]) }}>
      {q.icon && <Icon name={q.icon} size={36} color={light ? '#FFFFFF' : SALMON} style={{ margin: '0 auto 12px', display: 'block' }} />}
      <div style={{ fontFamily: AR, fontWeight: 700, fontSize: qi === 3 ? 28 : 33, lineHeight: 1.15, color: light ? '#FFFFFF' : INK, letterSpacing: '-0.5px', textWrap: 'balance' }}>{q.q}</div>
      {q.sub && <div style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.45, color: light ? '#FFFFFF' : INK, opacity: light ? 0.85 : 0.6 }}>{q.sub}</div>}
    </div>
    {q.opts.map((o, j) => {
      const sel = j === q.sel && T >= tapT + 0.12;
      const press = j === q.sel ? MOTION.press(T, tapT) * (qi === 0 && T > TL.reTap - 0.2 ? MOTION.press(T, TL.reTap) : 1) : 1;
      const selBg = light ? INK : SALMON;
      const ent = MOTION.enter(T, TL.cards[qi] + j * 0.14);
      return <div key={j} style={{
        position: 'absolute', left: 30, right: 30, top: gm.y0 + j * (gm.h + gm.gap), height: gm.h,
        borderRadius: 22, display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', boxSizing: 'border-box',
        background: sel ? selBg : '#FFFFFF', border: `1.5px solid ${sel ? selBg : light ? 'rgba(255,255,255,0.0)' : 'rgba(23,24,26,0.14)'}`,
        boxShadow: sel ? (light ? '0 8px 22px rgba(23,24,26,0.35)' : '0 8px 22px rgba(255,107,91,0.30)') : (light ? '0 6px 18px rgba(23,24,26,0.14)' : '0 2px 8px rgba(23,24,26,0.05)'),
        opacity: ent.opacity, transform: `${ent.transform} scale(${press})`,
      }}>
        {q.optIcons && <Icon name={q.optIcons[j]} size={28} color={sel ? '#FFFFFF' : INK} />}
        <div style={{ fontFamily: AR, fontWeight: 600, fontSize: 17.5, color: sel ? '#FFFFFF' : INK, lineHeight: 1.2 }}>{o}</div>
      </div>;
    })}
  </div>;
}
function Field({ y, label, value, secret, T, at }) {
  return <div style={{ position: 'absolute', left: 30, right: 30, top: y, ...MOTION.enter(T, at, 18) }}>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, opacity: 0.55, marginBottom: 6, letterSpacing: '0.2px' }}>{label}</div>
    <div style={{ height: 52, borderRadius: 15, border: '1.5px solid rgba(23,24,26,0.16)', background: '#FFFFFF', display: 'flex', alignItems: 'center', padding: '0 16px', fontFamily: AR, fontSize: 16, color: INK, letterSpacing: secret ? '3px' : 'normal' }}>{value}<span style={{ width: 2, height: 20, background: SALMON, marginLeft: 2, opacity: value && value.length ? 1 : 0 }} /></div>
  </div>;
}
function typed(T, from, to, text) { const n = Math.round(clamp((T - from) / (to - from), 0, 1) * text.length); return text.slice(0, n); }
function AccountScreen({ T, TL }) {
  const AC = TL.AC;
  const name = typed(T, AC + 1.4, AC + 2.6, 'Kiosco El Trébol');
  const mail = typed(T, AC + 2.8, AC + 3.7, 'elena@gmail.com');
  const pass = typed(T, AC + 3.9, AC + 4.4, '••••••••');
  const btnPress = MOTION.press(T, AC + 5.8);
  const bob = Math.sin(T * 2.2) * 4;
  return <div style={{ position: 'absolute', inset: 0, background: BG }}>
    <div style={{ position: 'absolute', top: 92, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `translateY(${bob}px)`, ...{ opacity: MOTION.pop(T, AC + 0.2).opacity } }}>
      <div style={{ transform: MOTION.pop(T, AC + 0.2).transform }}><KBadge h={64} /></div>
    </div>
    <div style={{ position: 'absolute', top: 208, left: 0, right: 0, textAlign: 'center', ...MOTION.pop(T, AC + 0.4) }}>
      <div style={{ fontFamily: AR, fontWeight: 700, fontSize: 32, color: INK, letterSpacing: '-0.5px' }}>Último paso</div>
      <div style={{ marginTop: 10, fontSize: 15, color: INK, opacity: 0.62, padding: '0 40px', lineHeight: 1.4 }}>Kioskeo ya quedó armado para tu negocio.</div>
    </div>
    <Field y={332} label="NOMBRE DEL NEGOCIO" value={name} T={T} at={AC + 0.7} />
    <Field y={420} label="EMAIL" value={mail} T={T} at={AC + 0.85} />
    <Field y={508} label="CONTRASEÑA" value={pass} secret T={T} at={AC + 1.0} />
    <div style={{ position: 'absolute', left: 30, right: 30, top: 648, height: 64, borderRadius: 20, background: SALMON, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: AR, fontWeight: 700, fontSize: 18, letterSpacing: '0.5px', color: '#FFFFFF', boxShadow: '0 10px 26px rgba(255,107,91,0.35)', ...MOTION.enter(T, AC + 1.2, 18), transform: `${MOTION.enter(T, AC + 1.2, 18).transform} scale(${btnPress})` }}>CREAR MI CUENTA</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 726, textAlign: 'center', fontSize: 12.5, color: INK, opacity: 0.5, ...MOTION.enter(T, AC + 1.4, 10) }}>Sin tarjeta. Sin permanencia.</div>
  </div>;
}
function LandingScreen({ T, TL }) {
  const press = MOTION.press(T, TL.L + 2.6);
  return <div style={{ position: 'absolute', inset: 0, background: BG }}>
    <div style={{ position: 'absolute', top: 96, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <KBadge h={56} />
      <div style={{ fontFamily: AR, fontWeight: 700, fontSize: 21, letterSpacing: '-0.3px', color: INK }}>Kioskeo</div>
    </div>
    <div style={{ position: 'absolute', top: 268, left: 34, right: 34, textAlign: 'center' }}>
      <div style={{ fontFamily: AR, fontWeight: 700, fontSize: 36, lineHeight: 1.12, letterSpacing: '-1px', color: INK, textWrap: 'balance' }}>El punto de venta para tu kiosco</div>
      <div style={{ marginTop: 16, fontSize: 15.5, lineHeight: 1.5, color: INK, opacity: 0.62 }}>Cobrá, fiá y cerrá la caja desde el celu. Sin vueltas.</div>
    </div>
    <div style={{ position: 'absolute', left: 30, right: 30, top: 560, height: 64, borderRadius: 20, background: SALMON, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: AR, fontWeight: 700, fontSize: 18, color: '#FFFFFF', boxShadow: '0 10px 26px rgba(255,107,91,0.35)', transform: `scale(${press})` }}>Empezá gratis</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 642, textAlign: 'center', fontSize: 12.5, color: INK, opacity: 0.5 }}>Sin tarjeta. Sin permanencia.</div>
  </div>;
}
function FingerLayer({ T, TL }) {
  const x = TL.fx(T), y = TL.fy(T), o = TL.fo(T);
  const ripples = TL.taps.map((tp, i) => {
    const p = (T - tp.t) / 0.55;
    if (p <= 0 || p >= 1) return null;
    return <div key={i} style={{ position: 'absolute', left: tp.x, top: tp.y, width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: '50%', border: `2.5px solid ${tp.c}`, opacity: (1 - p) * 0.8, transform: `scale(${1 + p * 6})` }} />;
  });
  let squish = 1;
  TL.taps.forEach(tp => { const p = clamp((T - tp.t) / 0.3, 0, 1); if (p > 0 && p < 1) squish = 1 - 0.25 * Math.sin(p * Math.PI); });
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {ripples}
    <div style={{ position: 'absolute', left: x, top: y, width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: '50%', background: 'rgba(23,24,26,0.22)', border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 4px 12px rgba(23,24,26,0.25)', opacity: o, transform: `scale(${squish})` }} />
  </div>;
}
function ProgressLayer({ T, TL }) {
  const p = TL.prog(T);
  const idx = TL.idx(T);
  const light = Math.round(idx) === 2 || Math.round(idx) === 4;
  const n = clamp(Math.round(idx), 1, 4);
  const showLabel = idx > 0.6 && idx < 4.4 && p > 0.01;
  const c = light ? '#FFFFFF' : SALMON;
  return <div style={{ position: 'absolute', left: 0, top: 0, right: 0, pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, height: 3.5, width: p * SW, background: c, borderRadius: '0 4px 4px 0' }} />
    <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color: light ? '#FFFFFF' : INK, opacity: showLabel ? (light ? 0.85 : 0.45) : 0 }}>{n} de 4</div>
  </div>;
}
function Phone({ T, TL, children }) {
  const E = TL.DK;
  const rise = MOTION.enter(T, 0.15, 40, 0.9);
  const shift = animate({ from: 0, to: -560, start: E - 0.3, end: E + 1.3 })(T);
  const sc = animate({ from: 1, to: 0.82, start: E - 0.3, end: E + 1.3 })(T);
  return <div style={{ position: 'absolute', left: 751, top: 132, width: 418, height: 788, opacity: rise.opacity, transform: `${rise.transform} translateX(${shift}px) scale(${sc})`, transformOrigin: 'center' }}>
    <div style={{ position: 'absolute', inset: 0, borderRadius: 48, background: INK, boxShadow: '0 30px 80px rgba(23,24,26,0.22)' }} />
    <div style={{ position: 'absolute', left: 14, top: 14, width: SW, height: SHh, borderRadius: 36, overflow: 'hidden', background: BG }}>{children}</div>
  </div>;
}
function CheckRow({ text }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill={GREEN} /><polyline points="6.5,11.5 9.5,14.5 15.5,8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <div style={{ fontSize: 15.5, fontWeight: 500, color: INK }}>{text}</div>
  </div>;
}
function DesktopMock({ T, TL }) {
  const E = TL.DK;
  const ent = MOTION.enter(T, E + 0.5, 50, 1.0);
  const zoom = animate({ from: 1, to: 1.03, start: E + 0.5, end: E + 5.5, ease: Easing.linear })(T);
  return <div style={{ position: 'absolute', left: 620, top: 190, width: 1090, height: 680, borderRadius: 18, background: '#FFFFFF', boxShadow: '0 30px 90px rgba(23,24,26,0.16)', overflow: 'hidden', border: '1px solid rgba(23,24,26,0.08)', opacity: ent.opacity, transform: `${ent.transform} scale(${zoom})` }}>
    <div style={{ height: 46, background: '#FBF7F3', borderBottom: '1px solid rgba(23,24,26,0.07)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 8 }}>
      {['#FF6B5B', '#F5C542', '#128A5C'].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c, opacity: 0.85 }} />)}
      <div style={{ marginLeft: 16, height: 26, borderRadius: 13, background: '#FFFFFF', border: '1px solid rgba(23,24,26,0.09)', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 12.5, color: INK, opacity: 0.75 }}>kioskeo.app/crear-cuenta</div>
    </div>
    <div style={{ position: 'absolute', left: 0, top: 46, height: 3.5, width: '100%', background: SALMON }} />
    <div style={{ position: 'absolute', left: 0, top: 50, right: 0, bottom: 0, display: 'flex' }}>
      <div style={{ flex: '1 1 55%', padding: '54px 70px', boxSizing: 'border-box' }}>
        <KBadge h={48} />
        <div style={{ fontFamily: AR, fontWeight: 700, fontSize: 34, color: INK, letterSpacing: '-0.7px', marginTop: 20 }}>Último paso</div>
        <div style={{ fontSize: 15.5, color: INK, opacity: 0.62, marginTop: 8 }}>Kioskeo ya quedó armado para tu negocio.</div>
        <div style={{ display: 'grid', gap: 16, marginTop: 30 }}>
          {[['NOMBRE DEL NEGOCIO', 'Kiosco El Trébol'], ['EMAIL', 'elena@gmail.com'], ['CONTRASEÑA', '••••••••']].map(([l, v], i) =>
            <div key={i}>
              <div style={{ fontSize: 12, fontWeight: 600, color: INK, opacity: 0.55, marginBottom: 6 }}>{l}</div>
              <div style={{ height: 48, borderRadius: 14, border: '1.5px solid rgba(23,24,26,0.15)', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 15.5, color: INK }}>{v}</div>
            </div>)}
        </div>
        <div style={{ marginTop: 26, height: 58, borderRadius: 18, background: SALMON, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: AR, fontWeight: 700, fontSize: 17, letterSpacing: '0.5px', boxShadow: '0 10px 26px rgba(255,107,91,0.30)' }}>CREAR MI CUENTA</div>
      </div>
      <div style={{ flex: '1 1 45%', background: TINT, padding: '54px 54px', boxSizing: 'border-box' }}>
        <div style={{ fontFamily: AR, fontWeight: 700, fontSize: 22, color: INK, letterSpacing: '-0.4px', marginBottom: 26 }}>Tu Kioskeo quedó así</div>
        <div style={{ display: 'grid', gap: 20 }}>
          <CheckRow text="Fiado activado" />
          <CheckRow text="Cierre de caja activado" />
          <CheckRow text="Carga de productos con la cámara" />
          <CheckRow text="Secretos del negocio activados" />
        </div>
        <div style={{ marginTop: 34, fontSize: 13.5, color: INK, opacity: 0.55, lineHeight: 1.5 }}>Sin tarjeta. Sin permanencia. Podés cambiar todo cuando quieras.</div>
      </div>
    </div>
  </div>;
}

// ---------- Pieza ----------
function Piece({ tweaks }) {
  const { T, CUES, authoredTotal } = useComposition();
  const TL = React.useMemo(() => buildTL(CUES), [CUES]);
  const fadeIn = animate({ from: 1, to: 0, start: 0, end: 0.45, ease: Easing.easeOutQuad })(T);
  const fadeOut = animate({ from: 0, to: 1, start: authoredTotal - 0.5, end: authoredTotal - 0.05 })(T);
  const screens = [
    <QScreen key="q0" qi={0} T={T} TL={TL} />,
    <QScreen key="q1" qi={1} T={T} TL={TL} />,
    <QScreen key="q2" qi={2} T={T} TL={TL} />,
    <QScreen key="q3" qi={3} T={T} TL={TL} />,
    <AccountScreen key="ac" T={T} TL={TL} />,
  ];
  return <div data-screen-label={`t=${Math.floor(T)}s`} style={{ position: 'absolute', inset: 0, fontFamily: AR, color: INK }}>
    <div style={{ position: 'absolute', left: 460, top: 90, width: 1000, height: 900, borderRadius: '50%', background: `radial-gradient(closest-side, ${TINT}, rgba(255,240,237,0))` }} />
    <Shot from={TL.DK - 0.6} to={authoredTotal + 5}><DesktopMock T={T} TL={TL} /></Shot>
    <Phone T={T} TL={TL}>
      <LandingScreen T={T} TL={TL} />
      {screens.map((s, i) => {
        const w = wipeClip(T, TL.wipes[i]);
        return <div key={i} style={{ position: 'absolute', inset: 0, clipPath: w.clipPath, visibility: w.visible ? 'visible' : 'hidden' }}>{s}</div>;
      })}
      <FingerLayer T={T} TL={TL} />
      <ProgressLayer T={T} TL={TL} />
    </Phone>
    {tweaks.showCaptions && <Captions style={{ fontFamily: AR, fontSize: 25, fontWeight: 500, color: INK, opacity: 0.78, bottom: '3.5%' }} items={[
      { at: 0.9, until: TL.L + 3.9, text: 'Todo empieza al tocar «Empezá gratis».' },
      { at: TL.Q[0] + 1.2, until: TL.Q[0] + 4.2, text: 'Una pregunta gigante por pantalla.' },
      { at: TL.Q[1] + 1.0, until: TL.Q[1] + 3.2, text: 'Cada respuesta abre la siguiente en pop.' },
      { at: TL.backTap - 0.3, until: TL.resume, text: 'Si volvés, tu respuesta queda guardada.' },
      { at: TL.AC + 0.5, until: TL.AC + 3.6, text: 'Al final, tu cuenta ya queda armada.' },
      { at: TL.DK + 0.8, text: 'En el celu y en el escritorio.' },
    ]} />}
    <div style={{ position: 'absolute', inset: 0, background: BG, opacity: Math.max(fadeIn, fadeOut), pointerEvents: 'none' }} />
  </div>;
}

function KioskeoVideo() {
  const [t, setTweak] = window.useTweaks(window.TWEAK_DEFAULTS || { motionEditor: true, showCaptions: true });
  return <div style={{ position: 'absolute', inset: 0 }}>
    <CompositionStage width="1920" height="1080" bg={BG} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK}>
      <Piece tweaks={t} />
    </CompositionStage>
    <window.TweaksPanel>
      <window.TweakSection label="Video" />
      <window.TweakToggle label="Motion editor" value={t.motionEditor} onChange={(v) => setTweak('motionEditor', v)} />
      <window.TweakToggle label="Subtítulos" value={t.showCaptions} onChange={(v) => setTweak('showCaptions', v)} />
    </window.TweaksPanel>
  </div>;
}
window.KioskeoVideo = KioskeoVideo;
