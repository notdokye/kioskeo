import { useEffect, useRef, useState } from "react";
import { bipEscaner } from "./sonidos";
import "./Escaner.css";

// Escáner de códigos de barras con la cámara.
// Estrategia en capas: BarcodeDetector nativo (Android/Chrome, acelerado por
// hardware) → ZXing por software (iPhone/Safari y el resto) → entrada manual
// (sin cámara o sin permiso, nunca te deja a pie).

interface Props {
  onDetectado: (ean: string) => void;
  onCerrar: () => void;
}

type EstadoCamara = "iniciando" | "activa" | "sin-camara";

// El mismo código pegado al lector dispara detecciones en ráfaga;
// lo aceptamos una vez por ventana de tiempo.
const ANTIRREBOTE_MS = 1500;

export function Escaner({ onDetectado, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<EstadoCamara>("iniciando");
  const [manual, setManual] = useState("");
  const ultimoRef = useRef<{ codigo: string; en: number }>({ codigo: "", en: 0 });

  useEffect(() => {
    let vivo = true;
    let stream: MediaStream | null = null;
    let pararZXing: (() => void) | null = null;
    let timerNativo: ReturnType<typeof setInterval> | null = null;

    function detectado(codigo: string) {
      if (!vivo || !codigo) return;
      const ahora = Date.now();
      const ultimo = ultimoRef.current;
      if (codigo === ultimo.codigo && ahora - ultimo.en < ANTIRREBOTE_MS) return;
      ultimoRef.current = { codigo, en: ahora };
      navigator.vibrate?.(60);
      bipEscaner();
      onDetectado(codigo);
    }

    async function iniciar() {
      const video = videoRef.current;
      if (!video || !navigator.mediaDevices?.getUserMedia) {
        setEstado("sin-camara");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        setEstado("sin-camara");
        return;
      }
      if (!vivo) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      setEstado("activa");

      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]>;
          };
        }
      ).BarcodeDetector;

      if (Detector) {
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });
        timerNativo = setInterval(async () => {
          if (!vivo || video.readyState < 2) return;
          try {
            const codigos = await detector.detect(video);
            if (codigos.length > 0) detectado(codigos[0].rawValue);
          } catch {
            // un frame fallido no corta el escaneo
          }
        }, 200);
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const lector = new BrowserMultiFormatReader();
        const controles = await lector.decodeFromVideoElement(
          video,
          (resultado) => {
            if (resultado) detectado(resultado.getText());
          },
        );
        pararZXing = () => controles.stop();
      }
    }

    iniciar();
    return () => {
      vivo = false;
      if (timerNativo) clearInterval(timerNativo);
      pararZXing?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetectado]);

  function enviarManual() {
    const codigo = manual.trim();
    if (!codigo) return;
    setManual("");
    onDetectado(codigo);
  }

  return (
    <div className="escaner" role="dialog" aria-label="Escáner de códigos">
      <div className="escaner-visor">
        <video ref={videoRef} muted playsInline />
        {estado === "activa" && <div className="escaner-marco" aria-hidden />}
        {estado === "iniciando" && (
          <p className="escaner-estado">Abriendo la cámara…</p>
        )}
        {estado === "sin-camara" && (
          <p className="escaner-estado">
            No hay cámara disponible.
            <br />
            Escribí el código a mano acá abajo.
          </p>
        )}
      </div>
      <div className="escaner-pie">
        <div className="escaner-manual">
          <input
            inputMode="numeric"
            placeholder="O escribí el código…"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviarManual()}
            aria-label="Código de barras manual"
          />
          <button onClick={enviarManual} disabled={!manual.trim()}>
            OK
          </button>
        </div>
        <button className="escaner-cerrar" onClick={onCerrar}>
          LISTO
        </button>
      </div>
    </div>
  );
}
