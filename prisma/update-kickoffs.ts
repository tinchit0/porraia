/**
 * Migración puntual: actualiza los kickoffs de la fase de grupos con los horarios
 * oficiales de la FIFA (fuente: Sky Sports BST → UTC).
 * NO borra predicciones ni equipos.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// (homeTeamCode, awayTeamCode) → kickoff UTC ISO
const KICKOFFS: Record<string, string> = {
  // --- Grupo A ---
  "MEX-RSA": "2026-06-11T19:00:00.000Z",
  "KOR-CZE": "2026-06-12T02:00:00.000Z",
  "MEX-KOR": "2026-06-19T01:00:00.000Z",
  "CZE-RSA": "2026-06-18T16:00:00.000Z",
  "CZE-MEX": "2026-06-25T01:00:00.000Z",
  "RSA-KOR": "2026-06-25T01:00:00.000Z",

  // --- Grupo B ---
  "CAN-BIH": "2026-06-12T19:00:00.000Z",
  "QAT-SUI": "2026-06-13T19:00:00.000Z",
  "CAN-QAT": "2026-06-18T22:00:00.000Z",
  "SUI-BIH": "2026-06-18T19:00:00.000Z",
  "SUI-CAN": "2026-06-24T19:00:00.000Z",
  "BIH-QAT": "2026-06-24T19:00:00.000Z",

  // --- Grupo C ---
  "BRA-MAR": "2026-06-13T22:00:00.000Z",
  "HAI-SCO": "2026-06-14T01:00:00.000Z",
  "BRA-HAI": "2026-06-20T00:30:00.000Z",
  "SCO-MAR": "2026-06-19T22:00:00.000Z",
  "SCO-BRA": "2026-06-24T22:00:00.000Z",
  "MAR-HAI": "2026-06-24T22:00:00.000Z",

  // --- Grupo D ---
  "USA-PAR": "2026-06-13T01:00:00.000Z",
  "AUS-TUR": "2026-06-14T04:00:00.000Z",
  "USA-AUS": "2026-06-19T19:00:00.000Z",
  "TUR-PAR": "2026-06-20T03:00:00.000Z",
  "TUR-USA": "2026-06-26T02:00:00.000Z",
  "PAR-AUS": "2026-06-26T02:00:00.000Z",

  // --- Grupo E ---
  "GER-CUW": "2026-06-14T17:00:00.000Z",
  "CIV-ECU": "2026-06-14T23:00:00.000Z",
  "GER-CIV": "2026-06-20T20:00:00.000Z",
  "ECU-CUW": "2026-06-21T00:00:00.000Z",
  "ECU-GER": "2026-06-25T20:00:00.000Z",
  "CUW-CIV": "2026-06-25T20:00:00.000Z",

  // --- Grupo F ---
  "NED-JPN": "2026-06-14T20:00:00.000Z",
  "SWE-TUN": "2026-06-15T02:00:00.000Z",
  "NED-SWE": "2026-06-20T17:00:00.000Z",
  "TUN-JPN": "2026-06-21T04:00:00.000Z",
  "TUN-NED": "2026-06-25T23:00:00.000Z",
  "JPN-SWE": "2026-06-25T23:00:00.000Z",

  // --- Grupo G ---
  "BEL-EGY": "2026-06-15T19:00:00.000Z",
  "IRN-NZL": "2026-06-16T01:00:00.000Z",
  "BEL-IRN": "2026-06-21T19:00:00.000Z",
  "NZL-EGY": "2026-06-22T01:00:00.000Z",
  "NZL-BEL": "2026-06-27T03:00:00.000Z",
  "EGY-IRN": "2026-06-27T03:00:00.000Z",

  // --- Grupo H ---
  "ESP-CPV": "2026-06-15T16:00:00.000Z",
  "KSA-URU": "2026-06-15T22:00:00.000Z",
  "ESP-KSA": "2026-06-21T16:00:00.000Z",
  "URU-CPV": "2026-06-21T22:00:00.000Z",
  "URU-ESP": "2026-06-27T00:00:00.000Z",
  "CPV-KSA": "2026-06-27T00:00:00.000Z",

  // --- Grupo I ---
  "FRA-SEN": "2026-06-16T19:00:00.000Z",
  "IRQ-NOR": "2026-06-16T22:00:00.000Z",
  "FRA-IRQ": "2026-06-22T21:00:00.000Z",
  "NOR-SEN": "2026-06-23T00:00:00.000Z",
  "NOR-FRA": "2026-06-26T19:00:00.000Z",
  "SEN-IRQ": "2026-06-26T19:00:00.000Z",

  // --- Grupo J ---
  "ARG-ALG": "2026-06-17T01:00:00.000Z",
  "AUT-JOR": "2026-06-17T04:00:00.000Z",
  "ARG-AUT": "2026-06-22T17:00:00.000Z",
  "JOR-ALG": "2026-06-23T03:00:00.000Z",
  "JOR-ARG": "2026-06-28T02:00:00.000Z",
  "ALG-AUT": "2026-06-28T02:00:00.000Z",

  // --- Grupo K ---
  "POR-COD": "2026-06-17T17:00:00.000Z",
  "UZB-COL": "2026-06-18T02:00:00.000Z",
  "POR-UZB": "2026-06-23T17:00:00.000Z",
  "COL-COD": "2026-06-24T02:00:00.000Z",
  "COL-POR": "2026-06-27T23:30:00.000Z",
  "COD-UZB": "2026-06-27T23:30:00.000Z",

  // --- Grupo L ---
  "ENG-CRO": "2026-06-17T20:00:00.000Z",
  "GHA-PAN": "2026-06-17T23:00:00.000Z",
  "ENG-GHA": "2026-06-23T20:00:00.000Z",
  "PAN-CRO": "2026-06-23T23:00:00.000Z",
  "PAN-ENG": "2026-06-27T21:00:00.000Z",
  "CRO-GHA": "2026-06-27T21:00:00.000Z",
};

async function main() {
  const matches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    select: {
      id: true,
      kickoff: true,
      homeTeam: { select: { code: true } },
      awayTeam: { select: { code: true } },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const m of matches) {
    const key = `${m.homeTeam?.code}-${m.awayTeam?.code}`;
    const iso = KICKOFFS[key];
    if (!iso) {
      console.warn(`⚠ Sin kickoff para ${key}`);
      skipped++;
      continue;
    }
    const newKickoff = new Date(iso);
    if (m.kickoff.getTime() === newKickoff.getTime()) {
      skipped++;
      continue;
    }
    await prisma.match.update({ where: { id: m.id }, data: { kickoff: newKickoff } });
    console.log(`✓ ${key}: ${m.kickoff.toISOString()} → ${iso}`);
    updated++;
  }

  // Actualizar lockAt al primer partido del torneo
  await prisma.settings.updateMany({
    data: { lockAt: new Date("2026-06-11T19:00:00.000Z") },
  });
  console.log(`\nkickoffs actualizados: ${updated}, sin cambios: ${skipped}`);
  console.log(`lockAt → 2026-06-11T19:00:00.000Z`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
