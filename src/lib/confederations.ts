// Confederación FIFA de cada selección, por código de equipo (Team.code).
// Mapa estático (no hay campo en BD): las confederaciones son datos fijos.
// Los códigos coinciden con los de FIFA_TO_NUM en src/components/GoalMap.tsx.

export type Confederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";

/** Orden de presentación (de más a menos selecciones en el torneo). */
export const CONFEDERATIONS: Confederation[] = [
  "UEFA",
  "CAF",
  "AFC",
  "CONMEBOL",
  "CONCACAF",
  "OFC",
];

export const CONFEDERATION_LABEL: Record<Confederation, string> = {
  UEFA: "UEFA (Europa)",
  CONMEBOL: "CONMEBOL (Sudamérica)",
  CONCACAF: "CONCACAF (Norte/Centroamérica)",
  CAF: "CAF (África)",
  AFC: "AFC (Asia)",
  OFC: "OFC (Oceanía)",
};

export const CODE_TO_CONFEDERATION: Record<string, Confederation> = {
  // UEFA
  CZE: "UEFA", BIH: "UEFA", SUI: "UEFA", SCO: "UEFA", TUR: "UEFA", GER: "UEFA",
  NED: "UEFA", SWE: "UEFA", BEL: "UEFA", ESP: "UEFA", FRA: "UEFA", NOR: "UEFA",
  AUT: "UEFA", POR: "UEFA", ENG: "UEFA", CRO: "UEFA",
  // CONMEBOL
  BRA: "CONMEBOL", PAR: "CONMEBOL", ECU: "CONMEBOL", URU: "CONMEBOL",
  ARG: "CONMEBOL", COL: "CONMEBOL",
  // CONCACAF
  MEX: "CONCACAF", CAN: "CONCACAF", USA: "CONCACAF", HAI: "CONCACAF",
  CUW: "CONCACAF", PAN: "CONCACAF",
  // CAF
  RSA: "CAF", MAR: "CAF", CIV: "CAF", TUN: "CAF", EGY: "CAF", CPV: "CAF",
  SEN: "CAF", ALG: "CAF", COD: "CAF", GHA: "CAF",
  // AFC
  KOR: "AFC", QAT: "AFC", AUS: "AFC", JPN: "AFC", IRN: "AFC", KSA: "AFC",
  IRQ: "AFC", JOR: "AFC", UZB: "AFC",
  // OFC
  NZL: "OFC",
};

export function confederationOf(code: string): Confederation | null {
  return CODE_TO_CONFEDERATION[code] ?? null;
}
