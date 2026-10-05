FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# Dependencies and the Prisma client: redone only when package*.json or the schema change,
# not on every code change
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY prisma ./prisma
RUN npx prisma generate

# What runs in production: no TypeScript, test tools or type definitions. Independent of the source
# code, so a code change does not rebuild it. (prisma stays: the container runs `prisma migrate deploy`.)
FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
