# DES Explorer

DES Explorer is a college assignment that demonstrates the Data Encryption Standard (DES). It uses **Next.js with TypeScript and Tailwind CSS** for the web application, **FastAPI and Pydantic** for DES calculations, and optional **Neon PostgreSQL with Prisma** for operation metadata.

The project implements single-block DES encryption, decryption, and key scheduling without a cryptography library. DES is obsolete and should only be used for study. No local PostgreSQL installation is required.

## macOS setup

Run from the repository root. Use Node 24 (verified 24.18.0), npm 11.16.0, and Python 3.13 (verified 3.13.15). With Homebrew already installed:

```bash
brew install node@24 python@3.13
export PATH="$(brew --prefix node@24)/bin:$PATH"
python3.13 -m venv apps/crypto-api/.venv
apps/crypto-api/.venv/bin/python -m pip install -r apps/crypto-api/requirements.txt
npm --prefix apps/web ci
cp -n apps/web/.env.example apps/web/.env
cp -n apps/crypto-api/.env.example apps/crypto-api/.env
npm --prefix apps/web run prisma:generate
```

`.nvmrc` and `.python-version` record the versions used during development. Dependency versions are pinned in `package-lock.json` and `requirements.txt`.

### Terminal 1: Next.js

```bash
cd /Users/adit/Projects/cryptoweb/apps/web
npm run dev
```

Open <http://localhost:3000>; `/` redirects to `/encryption`. Other pages: `/decryption` and `/key-scheduling`.

### Terminal 2: FastAPI

```bash
cd /Users/adit/Projects/cryptoweb/apps/crypto-api
source .venv/bin/activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --no-access-log
```

Health: <http://127.0.0.1:8000/health>. OpenAPI UI: <http://127.0.0.1:8000/docs>. Web connectivity check: <http://localhost:3000/api/health>.

## Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `apps/web/.env` | `CRYPTO_API_URL` | Server-only Python origin; default example `http://127.0.0.1:8000` |
| `apps/web/.env` | `CRYPTO_API_TIMEOUT_MS` | Server fetch timeout, 5000 ms by default, allowed 1–120000 |
| `apps/web/.env` | `DATABASE_URL` | Neon **pooled** URL, used only by lazy application Prisma client |
| `apps/web/.env` | `DIRECT_URL` | Neon **direct/unpooled** URL, used by Prisma CLI via `prisma.config.ts` |
| `apps/crypto-api/.env` | `APP_NAME` | FastAPI application title |

All `.env` files are ignored by Git. Do not use `NEXT_PUBLIC_` for service or database URLs. Use `.env` in the web app so Next.js and Prisma read the same configuration, then restart the servers after making changes. Python has no database credentials or database dependencies.

## Optional Neon database

The DES features do not require a database. A Neon database is only needed if operation metadata is added later.

Copy the pooled and direct connection URLs from the Neon **Connect** dialog into `apps/web/.env`. The pooled hostname includes `-pooler`; the direct hostname does not. `DIRECT_URL` corresponds to `DATABASE_URL_UNPOOLED` in Neon's Prisma documentation.

Prisma 7 uses the `prisma-client` generator, explicit output, `prisma.config.ts`, and `@prisma/adapter-neon`; it does not put connection URLs in `schema.prisma`. Generation and schema validation are offline:

```bash
npm --prefix apps/web run prisma:generate
npm --prefix apps/web run prisma:validate
```

To create and apply the initial migration on an empty development database, run from `apps/web`:

```bash
npx prisma migrate dev --name init_operation_log --create-only
# Check the generated SQL before applying it.
npx prisma migrate deploy
```

`migrate dev` may require permission to create a shadow database. Check the generated SQL before applying it. Existing databases should be introspected and baselined instead of reset.

`OperationLog` contains only `id`, `operation`, `algorithm`, and `createdAt`. Plaintext, keys, subkeys, traces, and request bodies must not be stored. DES endpoints do not use Prisma and continue to work when the database is unavailable.

## Checks

```bash
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
npm --prefix apps/web run prisma:validate
apps/crypto-api/.venv/bin/python -m pip check
apps/crypto-api/.venv/bin/python -m compileall -q apps/crypto-api/app
```

Manual checks with both servers running:

```bash
curl -i http://127.0.0.1:8000/health
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/des/encrypt \
  -H 'Content-Type: application/json' \
  -d '{"plaintext":{"format":"hex","value":"0123456789ABCDEF"},"key":{"format":"hex","value":"133457799BBCDFF1"}}'
# Expected: 200, ciphertextHex 85E813540F0AB405.
curl -i http://localhost:3000/api/des/encrypt \
  -H 'Content-Type: application/json' -d '{}'
# Expected: 422 VALIDATION_ERROR.
# Stop Python, then repeat /api/health: expected 503 BACKEND_UNAVAILABLE.
```

Shell history stores command arguments, so the examples use published test vectors. For a production web run, execute `npm run build` followed by `npm start` from `apps/web`.

## Documentation

- [Architecture](docs/architecture.md)
- [API contract](docs/api-contract.md)
- [Frontend](docs/frontend.md)
- [Testing](docs/testing.md)

## References

- Next.js 16 installation: <https://nextjs.org/docs/app/getting-started/installation>
- Tailwind 4 Next.js PostCSS setup: <https://tailwindcss.com/docs/installation/framework-guides/nextjs>
- Prisma 7 generator/adapter: <https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators>
- Neon Prisma integration: <https://neon.com/docs/guides/prisma>
- FastAPI environments: <https://fastapi.tiangolo.com/virtual-environments/>
- Pydantic 2 validators: <https://docs.pydantic.dev/latest/concepts/validators/>

The project uses Prisma 7.10.0 because Prisma 8 was still a release candidate when the dependencies were selected. ESLint is pinned to version 9.39.5 for compatibility with the installed Next.js configuration.
