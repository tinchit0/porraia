import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Stage } from "../src/generated/prisma/enums";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// --- Selecciones por grupo (sorteo final Mundial 2026, 12 grupos A-L) ---
// El orden dentro de cada grupo es la posición de bombo (1..4).
type Seed = { name: string; code: string; flag: string };

const GROUPS: Record<string, Seed[]> = {
  A: [
    { name: "México", code: "MEX", flag: "🇲🇽" },
    { name: "Sudáfrica", code: "RSA", flag: "🇿🇦" },
    { name: "Corea del Sur", code: "KOR", flag: "🇰🇷" },
    { name: "Chequia", code: "CZE", flag: "🇨🇿" },
  ],
  B: [
    { name: "Canadá", code: "CAN", flag: "🇨🇦" },
    { name: "Bosnia y Herzegovina", code: "BIH", flag: "🇧🇦" },
    { name: "Catar", code: "QAT", flag: "🇶🇦" },
    { name: "Suiza", code: "SUI", flag: "🇨🇭" },
  ],
  C: [
    { name: "Brasil", code: "BRA", flag: "🇧🇷" },
    { name: "Marruecos", code: "MAR", flag: "🇲🇦" },
    { name: "Haití", code: "HAI", flag: "🇭🇹" },
    { name: "Escocia", code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  ],
  D: [
    { name: "Estados Unidos", code: "USA", flag: "🇺🇸" },
    { name: "Paraguay", code: "PAR", flag: "🇵🇾" },
    { name: "Australia", code: "AUS", flag: "🇦🇺" },
    { name: "Turquía", code: "TUR", flag: "🇹🇷" },
  ],
  E: [
    { name: "Alemania", code: "GER", flag: "🇩🇪" },
    { name: "Curazao", code: "CUW", flag: "🇨🇼" },
    { name: "Costa de Marfil", code: "CIV", flag: "🇨🇮" },
    { name: "Ecuador", code: "ECU", flag: "🇪🇨" },
  ],
  F: [
    { name: "Países Bajos", code: "NED", flag: "🇳🇱" },
    { name: "Japón", code: "JPN", flag: "🇯🇵" },
    { name: "Suecia", code: "SWE", flag: "🇸🇪" },
    { name: "Túnez", code: "TUN", flag: "🇹🇳" },
  ],
  G: [
    { name: "Bélgica", code: "BEL", flag: "🇧🇪" },
    { name: "Egipto", code: "EGY", flag: "🇪🇬" },
    { name: "Irán", code: "IRN", flag: "🇮🇷" },
    { name: "Nueva Zelanda", code: "NZL", flag: "🇳🇿" },
  ],
  H: [
    { name: "España", code: "ESP", flag: "🇪🇸" },
    { name: "Cabo Verde", code: "CPV", flag: "🇨🇻" },
    { name: "Arabia Saudí", code: "KSA", flag: "🇸🇦" },
    { name: "Uruguay", code: "URU", flag: "🇺🇾" },
  ],
  I: [
    { name: "Francia", code: "FRA", flag: "🇫🇷" },
    { name: "Senegal", code: "SEN", flag: "🇸🇳" },
    { name: "Irak", code: "IRQ", flag: "🇮🇶" },
    { name: "Noruega", code: "NOR", flag: "🇳🇴" },
  ],
  J: [
    { name: "Argentina", code: "ARG", flag: "🇦🇷" },
    { name: "Argelia", code: "ALG", flag: "🇩🇿" },
    { name: "Austria", code: "AUT", flag: "🇦🇹" },
    { name: "Jordania", code: "JOR", flag: "🇯🇴" },
  ],
  K: [
    { name: "Portugal", code: "POR", flag: "🇵🇹" },
    { name: "RD del Congo", code: "COD", flag: "🇨🇩" },
    { name: "Uzbekistán", code: "UZB", flag: "🇺🇿" },
    { name: "Colombia", code: "COL", flag: "🇨🇴" },
  ],
  L: [
    { name: "Inglaterra", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    { name: "Croacia", code: "CRO", flag: "🇭🇷" },
    { name: "Ghana", code: "GHA", flag: "🇬🇭" },
    { name: "Panamá", code: "PAN", flag: "🇵🇦" },
  ],
};

// Emparejamientos de round-robin para 4 equipos (índices 0..3) por jornada.
const RR: [number, number][][] = [
  [
    [0, 1],
    [2, 3],
  ], // J1
  [
    [0, 2],
    [3, 1],
  ], // J2
  [
    [3, 0],
    [1, 2],
  ], // J3
];

// Kickoffs oficiales FIFA por grupo (fuente: Sky Sports BST → UTC).
// Orden: [jornada1_partido1, jornada1_partido2, jornada2_partido1, jornada2_partido2, jornada3_partido1, jornada3_partido2]
// Coincide con el orden de emparejamientos del round-robin RR[md][slot].
const GROUP_KICKOFFS: Record<string, [string, string, string, string, string, string]> = {
  A: ["2026-06-11T19:00:00.000Z","2026-06-12T02:00:00.000Z","2026-06-19T01:00:00.000Z","2026-06-18T16:00:00.000Z","2026-06-25T01:00:00.000Z","2026-06-25T01:00:00.000Z"],
  B: ["2026-06-12T19:00:00.000Z","2026-06-13T19:00:00.000Z","2026-06-18T22:00:00.000Z","2026-06-18T19:00:00.000Z","2026-06-24T19:00:00.000Z","2026-06-24T19:00:00.000Z"],
  C: ["2026-06-13T22:00:00.000Z","2026-06-14T01:00:00.000Z","2026-06-20T00:30:00.000Z","2026-06-19T22:00:00.000Z","2026-06-24T22:00:00.000Z","2026-06-24T22:00:00.000Z"],
  D: ["2026-06-13T01:00:00.000Z","2026-06-14T04:00:00.000Z","2026-06-19T19:00:00.000Z","2026-06-20T03:00:00.000Z","2026-06-26T02:00:00.000Z","2026-06-26T02:00:00.000Z"],
  E: ["2026-06-14T17:00:00.000Z","2026-06-14T23:00:00.000Z","2026-06-20T20:00:00.000Z","2026-06-21T00:00:00.000Z","2026-06-25T20:00:00.000Z","2026-06-25T20:00:00.000Z"],
  F: ["2026-06-14T20:00:00.000Z","2026-06-15T02:00:00.000Z","2026-06-20T17:00:00.000Z","2026-06-21T04:00:00.000Z","2026-06-25T23:00:00.000Z","2026-06-25T23:00:00.000Z"],
  G: ["2026-06-15T19:00:00.000Z","2026-06-16T01:00:00.000Z","2026-06-21T19:00:00.000Z","2026-06-22T01:00:00.000Z","2026-06-27T03:00:00.000Z","2026-06-27T03:00:00.000Z"],
  H: ["2026-06-15T16:00:00.000Z","2026-06-15T22:00:00.000Z","2026-06-21T16:00:00.000Z","2026-06-21T22:00:00.000Z","2026-06-27T00:00:00.000Z","2026-06-27T00:00:00.000Z"],
  I: ["2026-06-16T19:00:00.000Z","2026-06-16T22:00:00.000Z","2026-06-22T21:00:00.000Z","2026-06-23T00:00:00.000Z","2026-06-26T19:00:00.000Z","2026-06-26T19:00:00.000Z"],
  J: ["2026-06-17T01:00:00.000Z","2026-06-17T04:00:00.000Z","2026-06-22T17:00:00.000Z","2026-06-23T03:00:00.000Z","2026-06-28T02:00:00.000Z","2026-06-28T02:00:00.000Z"],
  K: ["2026-06-17T17:00:00.000Z","2026-06-18T02:00:00.000Z","2026-06-23T17:00:00.000Z","2026-06-24T02:00:00.000Z","2026-06-27T23:30:00.000Z","2026-06-27T23:30:00.000Z"],
  L: ["2026-06-17T20:00:00.000Z","2026-06-17T23:00:00.000Z","2026-06-23T20:00:00.000Z","2026-06-23T23:00:00.000Z","2026-06-27T21:00:00.000Z","2026-06-27T21:00:00.000Z"],
};

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000);
}

async function main() {
  // Idempotencia: limpiar datos del torneo (no borra usuarios ni sus apuestas en cascada salvo predicciones).
  await prisma.prediction.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.group.deleteMany();

  const groupNames = Object.keys(GROUPS);

  // Crear grupos + equipos
  const teamIdByCode = new Map<string, number>();
  const groupTeamIds: Record<string, number[]> = {};
  const groupIdByName: Record<string, number> = {};

  for (const gName of groupNames) {
    const group = await prisma.group.create({ data: { name: gName } });
    groupIdByName[gName] = group.id;
    groupTeamIds[gName] = [];
    for (const t of GROUPS[gName]) {
      const team = await prisma.team.create({
        data: { name: t.name, code: t.code, flag: t.flag, groupId: group.id },
      });
      teamIdByCode.set(t.code, team.id);
      groupTeamIds[gName].push(team.id);
    }
  }

  // Crear partidos de fase de grupos (6 por grupo)
  for (const gName of groupNames) {
    const ids = groupTeamIds[gName];
    let kickoffIndex = 0;
    for (let md = 0; md < 3; md++) {
      for (const [a, b] of RR[md]) {
        const kickoff = new Date(GROUP_KICKOFFS[gName][kickoffIndex++]);
        await prisma.match.create({
          data: {
            stage: "GROUP",
            matchday: md + 1,
            groupId: groupIdByName[gName],
            homeTeamId: ids[a],
            awayTeamId: ids[b],
            kickoff,
          },
        });
      }
    }
  }

  // Crear placeholders de eliminatorias (sin equipos asignados)
  const knockout: { stage: Stage; count: number; label: string; base: Date }[] = [
    { stage: "R32", count: 16, label: "Dieciseisavos", base: new Date("2026-06-28T16:00:00.000Z") },
    { stage: "R16", count: 8, label: "Octavos", base: new Date("2026-07-04T16:00:00.000Z") },
    { stage: "QF", count: 4, label: "Cuartos", base: new Date("2026-07-09T16:00:00.000Z") },
    { stage: "SF", count: 2, label: "Semifinal", base: new Date("2026-07-14T18:00:00.000Z") },
    { stage: "THIRD", count: 1, label: "Tercer puesto", base: new Date("2026-07-18T18:00:00.000Z") },
    { stage: "FINAL", count: 1, label: "Final", base: new Date("2026-07-19T18:00:00.000Z") },
  ];

  for (const k of knockout) {
    for (let i = 0; i < k.count; i++) {
      await prisma.match.create({
        data: {
          stage: k.stage,
          label: k.count > 1 ? `${k.label} ${i + 1}` : k.label,
          kickoff: addHours(k.base, i * 4),
        },
      });
    }
  }

  // Settings (fila única)
  const lockAt = process.env.LOCK_AT
    ? new Date(process.env.LOCK_AT)
    : new Date("2026-06-11T19:00:00.000Z");

  await prisma.settings.upsert({
    where: { id: 1 },
    update: { lockAt },
    create: { id: 1, tournamentName: "Mundial 2026", lockAt },
  });

  // Usuario administrador
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@porra.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", passwordHash },
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  const matchCount = await prisma.match.count();
  console.log(
    `Seed completado: ${groupNames.length} grupos, ${teamIdByCode.size} equipos, ${matchCount} partidos.`
  );
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Bloqueo (lockAt): ${lockAt.toISOString()}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
