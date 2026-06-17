import { redirect } from "next/navigation";

// El mapa se movió a la sección Stats. Mantener la ruta antigua por bookmarks.
export default function MapaRedirectPage() {
  redirect("/stats/mapa");
}
