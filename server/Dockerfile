# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies (include devDeps so tsx is available at runtime)
COPY package*.json ./
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=development

# Copy only what we need
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Allow configurable port with default 3010
ARG PORT=3010
ENV PORT=$PORT
EXPOSE $PORT

# Run the TS server with tsx loader
CMD ["node", "--loader", "tsx", "src/server.ts"]
