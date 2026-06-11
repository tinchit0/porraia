import { prisma } from "@/lib/db";
import { scoreMatchPrediction, scoreGlobalBet } from "@/lib/scoring";

/**
 * Recalcula y cachea los puntos de todas las predicciones de un partido.
 * Llamar tras editar el marcador de un partido.
 */
export async function recomputeMatch(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { predictions: true },
  });
  if (!match) return;

  await Promise.all(
    match.predictions.map((pred) =>
      prisma.prediction.update({
        where: { id: pred.id },
        data: { points: scoreMatchPrediction(pred, match) },
      })
    )
  );
}

/**
 * Recalcula y cachea los puntos de la apuesta de pichichi de todos los usuarios
 * según el pichichi real fijado en Settings. (Campeón/subcampeón se puntúan en el cuadro.)
 */
export async function recomputeGlobalBets(): Promise<void> {
  const settings = await prisma.settings.findFirst();
  if (!settings) return;

  const finals = { topScorer: settings.topScorer };

  const bets = await prisma.globalBet.findMany();
  await Promise.all(
    bets.map((bet) =>
      prisma.globalBet.update({
        where: { id: bet.id },
        data: { points: scoreGlobalBet(bet, finals) },
      })
    )
  );
}
