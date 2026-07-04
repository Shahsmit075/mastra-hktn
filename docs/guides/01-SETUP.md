# Guide 01 — Project Setup & Dependencies

## Step 1: Install Dependencies

Run these from the **root** of the monorepo:

```bash
# API dependencies
npm install --workspace @runbook-sentinel/api \
  @mastra/core \
  @ai-sdk/openai-compatible \
  @qdrant/js-client-rest \
  express helmet cors \
  jsonwebtoken \
  ioredis \
  pg \
  zod \
  dotenv \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  uuid

npm install --workspace @runbook-sentinel/api --save-dev \
  tsx typescript \
  @types/express @types/cors @types/jsonwebtoken @types/pg @types/uuid \
  @types/node

# Web dependencies (Next.js already has core; add UI libs)
npm install --workspace @runbook-sentinel/web \
  recharts \
  @radix-ui/react-dialog \
  @radix-ui/react-badge \
  class-variance-authority \
  clsx \
  lucide-react
```

## Step 2: Docker Compose for Local Development

Create `docker-compose.yml` at the **repo root**:

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: sentinel
      POSTGRES_PASSWORD: sentinel_dev_pass
      POSTGRES_DB: runbook_sentinel
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --save 60 1 --loglevel warning

  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    ports:
      - "6333:6333"   # REST API
      - "6334:6334"   # gRPC
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  postgres_data:
  qdrant_data:
```

Start local infrastructure:
```bash
docker compose up -d
# Verify: all 3 containers running
docker compose ps
```

## Step 3: API tsconfig.json

Replace `apps/api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Step 4: API package.json (final)

Replace `apps/api/package.json` — **copy exact content after npm installs update it**.

Key scripts to ensure exist:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "migrate": "tsx scripts/migrate-db.ts",
    "seed": "tsx scripts/seed-qdrant.ts",
    "smoke-test": "tsx scripts/test-workflow.ts"
  }
}
```

## Step 5: Environment File

Copy `.env.example` to `apps/api/.env` and fill in values as they become available.

**Order to fill in (by dependency):**
1. `DATABASE_URL` — local: `postgresql://sentinel:sentinel_dev_pass@localhost:5432/runbook_sentinel`
2. `REDIS_URL` — local: `redis://localhost:6379`
3. `JWT_SECRET` — generate: `openssl rand -base64 32`
4. `FEATHERLESS_API_KEY` — from Featherless AI dashboard
5. `QDRANT_URL` + `QDRANT_API_KEY` — from Qdrant Cloud dashboard
6. `ENKRYPT_API_KEY` — from Enkrypt AI dashboard
7. `OTEL_*` — from Honeycomb dashboard (can skip for Phase 1)

## Step 6: Verify Setup

Run this after all env vars are set:

```bash
# Start Docker services
docker compose up -d

# Run database migration
npm run migrate --workspace @runbook-sentinel/api

# Run Qdrant collection creation
npm run seed --workspace @runbook-sentinel/api

# Start API in dev mode
npm run dev:api

# In another terminal, test health
curl http://localhost:3001/health
# Expected: { "status": "ok", "services": { "db": "ok", "redis": "ok", "qdrant": "ok" } }
```
