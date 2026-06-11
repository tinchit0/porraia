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

// Fechas base de cada jornada de la fase de grupos.
const MD_BASE = [
  new Date("2026-06-11T16:00:00.000Z"),
  new Date("2026-06-17T16:00:00.000Z"),
  new Date("2026-06-23T16:00:00.000Z"),
];

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
  let groupIndex = 0;
  for (const gName of groupNames) {
    const ids = groupTeamIds[gName];
    for (let md = 0; md < 3; md++) {
      let slot = 0;
      for (const [a, b] of RR[md]) {
        const kickoff = addHours(MD_BASE[md], (groupIndex % 6) * 2 + slot * 3);
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
        slot++;
      }
    }
    groupIndex++;
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
    : new Date("2026-06-11T16:00:00.000Z");

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
