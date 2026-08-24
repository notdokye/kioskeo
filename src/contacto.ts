// Datos de contacto de Kioskeo, en un solo lugar.
export const WHATSAPP = "5493884979972";
export const EMAIL_CONTACTO = "worklmdok@gmail.com";
export const PRECIO_MENSUAL = 18900;
export const DIAS_PRUEBA = 30;

export function enlaceWhatsApp(mensaje: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

/** Cuentas que ven el panel de administración (el servidor lo verifica aparte). */
export const ADMIN_EMAILS = ["worklmdok@gmail.com"];
