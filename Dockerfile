FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --audit=false --legacy-peer-deps
COPY . .
# El cliente de Prisma se genera en src/generated/prisma (gitignored), así que hay
# que generarlo dentro de la imagen: en un checkout limpio no viene en el contexto.
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
