// Lógica de puntuación de la porra. Funciones puras y constantes ajustables.

export const POINTS = {
  /** Acertar el marcador exacto de un partido. */
  EXACT: 3,
  /** Diferencia de goles correcta pero no marcador exacto (ej. 3-1 ↔ 2-0). */
  DIFF: 2,
  /** Acertar solo el resultado 1X2 sin la diferencia de goles. */
  RESULT: 1,
  /** Acertar el pichichi (máximo goleador). */
  TOP_SCORER: 5,
} as const;

/**
 * Puntos del cuadro de eliminatorias: por cada equipo que predices que GANA
 * (avanza) una ronda y realmente lo hace. Escalado por ronda.
 * Clave = ronda del cruce que se gana (prefijo del slot: R32, R16, QF, SF, F).
 */
export const KNOCKOUT_POINTS: Record<string, number> = {
  R32: 1,    // ganar dieciseisavos → llegar a octavos
  R16: 2,    // ganar octavos → llegar a cuartos
  QF: 4,     // ganar cuartos → llegar a semis
  SF: 6,     // ganar semis → llegar a la final
  F: 10,     // ganar la final → campeón
  THIRD: 1,  // ganar el partido por el 3er puesto
};

export type Outcome = "HOME" | "DRAW" | "AWAY";

export function outcome(home: number, away: number): Outcome {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

/**
 * Puntúa un marcador predicho frente al real.
 * Exact = 3 · misma diferencia de goles = 2 · mismo 1X2 = 1 · fallo = 0.
 */
export function scoreMatchResult(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return POINTS.EXACT;
  const predDiff = predHome - predAway;
  const realDiff = realHome - realAway;
  if (predDiff === realDiff) return POINTS.DIFF;
  if (Math.sign(predDiff) === Math.sign(realDiff)) return POINTS.RESULT;
  return 0;
}

/**
 * Puntos de una predicción de marcador frente al resultado real.
 * Devuelve 0 si el partido aún no tiene resultado.
 */
export function scoreMatchPrediction(
  pred: { homeScore: number; awayScore: number },
  match: { homeScore: number | null; awayScore: number | null }
): number {
  if (match.homeScore == null || match.awayScore == null) return 0;
  return scoreMatchResult(pred.homeScore, pred.awayScore, match.homeScore, match.awayScore);
}

/**
 * Puntos de la apuesta global de pichichi (máximo goleador).
 * El campeón y el subcampeón se puntúan a través del cuadro de eliminatorias.
 */
export function scoreGlobalBet(
  bet: { topScorer: string },
  finals: { topScorer: string }
): number {
  if (
    finals.topScorer.trim() !== "" &&
    bet.topScorer.trim().toLowerCase() === finals.topScorer.trim().toLowerCase()
  ) {
    return POINTS.TOP_SCORER;
  }
  return 0;
}
