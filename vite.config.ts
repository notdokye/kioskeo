import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

// Modo "celular" (npm run dev:celular): sirve por HTTPS y en toda la red
// local, porque los navegadores solo habilitan la cámara en páginas seguras.
// El certificado es autofirmado: el teléfono muestra una advertencia una vez.
const modoCelular = process.env.CELULAR === "1";

export default defineConfig({
  plugins: [
    react(),
    ...(modoCelular ? [basicSsl()] : []),
    VitePWA({
      registerType: "autoUpdate",
      // Habilitado también en desarrollo para poder probar la instalación
      // desde el celular antes de publicar.
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
      },
      manifest: {
        name: "Kioskeo",
        short_name: "Kioskeo",
        description: "Tu kiosco, sin cuaderno. Punto de venta que anda sin internet.",
        lang: "es-AR",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        background_color: "#FFFDFB",
        theme_color: "#FFFDFB",
        icons: [
          { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/iconos/icono-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: modoCelular ? { host: true, port: 5174 } : undefined,
});
