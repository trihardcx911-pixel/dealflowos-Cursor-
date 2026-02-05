# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies (include devDeps so tsx and prisma are available at runtime)
COPY package*.json ./
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what we need
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# Allow configurable port with default 3010
ARG PORT=3010
ENV PORT=$PORT
EXPOSE $PORT

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node --loader tsx src/server.ts"]
