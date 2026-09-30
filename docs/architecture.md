# Architecture

```text
Browser (strict TypeScript React)
  -> relative Next.js /api routes (Node runtime)
    -> server-only Python client (timeout, no-store, sanitized errors)
      -> FastAPI routers (Pydantic request validation)
        -> DES services (byte conversion and validated response models)
          -> pure standard-library DES tables, key schedule, and Feistel rounds

Next.js server only -> lazy Prisma client -> Neon pooled PostgreSQL
Prisma CLI only -> DIRECT_URL -> Neon direct PostgreSQL
```

Two independent applications, no workspace orchestrator. npm manages web dependencies; Python venv plus fully pinned requirements manages the API. No Redis, authentication, history APIs, or local database server.

## Boundaries

- `src/app/api/**/route.ts`: HTTP route selection; no algorithm, SQL, or secrets in client code.
- `src/lib/server/python-client.ts`: fixed endpoint allowlist, origin from server env, JSON/media-type checks, controlled transport errors, timeout covering fetch and body parsing. No incoming user-selected backend URLs, redirects, request-body logs, retries, or cache.
- FastAPI routers: exact validated input and output models.
- `app/services/des_service.py`: byte conversion, orchestration, full key-trace assembly, and strict nullable UTF-8 decoding.
- `app/crypto/`: deterministic manual single-block DES and full key schedule, free of HTTP, third-party crypto, and persistence.
- `src/features/des/validation.ts`: shared browser/proxy runtime validation of success and error payload shapes, including every key-schedule round.
- `src/lib/server/prisma.ts`: lazy `getPrisma()` using Neon adapter with pooled `DATABASE_URL`. Not used by crypto or health.
- `prisma.config.ts`: CLI-only direct URL, loaded from web `.env`. An empty URL permits offline generation; database operations require real credentials.

FastAPI is bound to the loopback interface during local development. CORS is not required because browser requests go through Next.js. Health checks test Python connectivity and do not query the database. Request bodies, keys, subkeys, and plaintext are not logged. A public deployment would also need request-size limits, rate limiting, and normal production hardening.

## Configuration decisions

All Next.js application files are `.ts`/`.tsx`; strict mode is on and JavaScript application files are disallowed. Only ESLint and PostCSS tool configuration uses `.mjs`. Tailwind 4 uses its PostCSS plugin and CSS import, not Tailwind 3 directives/configuration. Prisma 7 uses an explicit generated TypeScript output directory and Neon driver adapter. Generated files are ignored and regenerated before builds/type checks.
