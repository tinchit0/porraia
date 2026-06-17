"use client";

import { useEffect } from "react";

/**
 * Hace que las banderas se vean bien en sistemas (típicamente Windows) que no
 * tienen glifos para los emojis de bandera y los pintan como letras ("ES", "FR").
 *
 * Inyecta un @font-face ("Twemoji Country Flags") SOLO si el navegador soporta
 * emojis pero NO banderas. Como el @font-face usa `unicode-range` limitado a los
 * codepoints de bandera, basta con tener la familia al principio del font-stack
 * del body (ver globals.css): si no se inyecta (Mac/iOS, que ya pintan banderas
 * nativas a color), la familia es desconocida y el navegador la ignora.
 *
 * A diferencia del enfoque anterior con Twemoji (que sustituía el emoji por un
 * <img> mutando el DOM por fuera de React), esto es puro CSS: sobrevive a
 * cualquier re-render o hidratación, así que no se rompe al cambiar de pestaña.
 *
 * Lógica de detección adaptada de country-flag-emoji-polyfill (MIT, TalkJS).
 */
const EMOJI_FONTS =
  '"Twemoji Mozilla","Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji","EmojiOne Color","Android Emoji",sans-serif';

function makeCtx() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.textBaseline = "top";
  ctx.font = `100px ${EMOJI_FONTS}`;
  ctx.scale(0.01, 0.01);
  return ctx;
}

function pixel(ctx: CanvasRenderingContext2D, char: string, color: string) {
  ctx.clearRect(0, 0, 100, 100);
  ctx.fillStyle = color;
  ctx.fillText(char, 0, 0);
  return ctx.getImageData(0, 0, 1, 1).data.join(",");
}

/** ¿El navegador pinta este carácter como un glifo de color (emoji)? */
function rendersAsColorEmoji(char: string) {
  const ctx = makeCtx();
  const white = pixel(ctx, char, "#fff");
  const black = pixel(ctx, char, "#000");
  // Si el color del texto no afecta al pixel, es un glifo a color (emoji).
  return black === white && !black.startsWith("0,0,0,");
}

export function FlagFont() {
  useEffect(() => {
    // Soporta emoji (😊) pero NO banderas (🇨🇭) → inyectar la fuente.
    if (rendersAsColorEmoji("\u{1F60A}") && !rendersAsColorEmoji("\u{1F1E8}\u{1F1ED}")) {
      const style = document.createElement("style");
      style.textContent = `@font-face {
  font-family: "Twemoji Country Flags";
  unicode-range: U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067,
    U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F;
  src: url('/fonts/TwemojiCountryFlags.woff2') format('woff2');
  font-display: swap;
}`;
      document.head.appendChild(style);
    }
  }, []);

  return null;
}
