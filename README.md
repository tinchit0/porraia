# ⚽ Porra Mundial 2026

Aplicación full-stack para una porra del Mundial de fútbol 2026. Los participantes se
registran con su correo, predicen los marcadores de la fase de grupos y sus apuestas
globales (campeón, subcampeón y pichichi), y compiten en una clasificación general.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**
- **Prisma 7** + **SQLite** (driver adapter `better-sqlite3`)
- **Auth.js (NextAuth v5)** — login con email + contraseña, sesión JWT, rol de admin
- Mutaciones con Server Actions

## Mecánica

- **Fase de grupos**: predices el marcador exacto de los 72 partidos.
  - Marcador exacto → **3 pts** · Acierto de resultado 1·X·2 → **1 pt**
- **Apuestas globales** (una vez): Campeón **10 pts** · Subcampeón **5 pts** · Pichichi **5 pts**
- La porra es **editable hasta el pitido inicial** (`LOCK_AT`), después se bloquea.
- El **admin** introduce los resultados desde `/admin`; la clasificación se recalcula sola.

## Puesta en marcha

```bash
npm install
npx prisma migrate dev   # crea la BD y aplica migraciones
npm run db:seed          # carga grupos, equipos, calendario y usuario admin
npm run dev              # http://localhost:3000
```

### Variables de entorno (`.env`)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Ruta del fichero SQLite (`file:./dev.db`) |
| `AUTH_SECRET` | Secreto para firmar las sesiones (cámbialo en producción) |
| `LOCK_AT` | Instante de bloqueo de la porra (ISO 8601) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales del usuario admin que crea el seed |

Usuario admin por defecto: **admin@porra.local** / **admin1234**.

## Páginas

| Ruta | Qué hace |
|------|----------|
| `/` | Dashboard: cuenta atrás, tu posición y puntos, próximos partidos |
| `/normas` | Reglas y sistema de puntuación |
| `/registro`, `/login` | Alta y acceso con email + contraseña |
| `/porra` | Editar tu porra (bloqueada tras `LOCK_AT`) |
| `/clasificacion` | Clasificación general con desempates |
| `/jornada` | Tus pronósticos vs resultados reales y puntos por partido |
| `/admin` | (solo admin) Introducir resultados y recalcular |

## Notas

- Los grupos y equipos del seed reflejan el sorteo final del Mundial 2026 (12 grupos A–L).
  Las eliminatorias se crean como huecos en el calendario; en la porra solo se predicen los
  partidos de la fase de grupos.
- El control de acceso vive en `src/proxy.ts` (en Next 16 el antiguo `middleware` se llama
  *proxy*) **y** se revalida dentro de cada Server Action.
