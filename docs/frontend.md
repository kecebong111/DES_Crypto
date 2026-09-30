# Frontend

The web application provides three pages:

- `/encryption` encrypts one 8-byte block.
- `/decryption` decrypts one 8-byte block.
- `/key-scheduling` displays PC-1, C0/D0, the rotation schedule, and all sixteen round keys.

## Source files

- `apps/web/src/app/` contains the page routes and shared layout.
- `apps/web/src/features/des/components/des-explorer.tsx` contains the DES interface.
- `apps/web/src/features/des/types.ts` defines the API types.
- `apps/web/src/features/des/api.ts` sends requests to the Next.js API routes.
- `apps/web/src/features/des/validation.ts` validates responses at runtime.
- `apps/web/src/lib/server/python-client.ts` forwards server-side requests to FastAPI.

Browser code only calls relative `/api` routes. It does not connect directly to FastAPI or PostgreSQL. Modules under `src/lib/server` must not be imported into client components.

## Input validation

Hexadecimal input accepts 16 digits after ASCII whitespace is removed. Text input must encode to exactly 8 UTF-8 bytes. The frontend checks these rules before submission, and FastAPI repeats the checks because server validation is authoritative.

Decryption always displays the plaintext in hexadecimal. Text is displayed only when the decrypted bytes are valid UTF-8. DES cannot determine whether a decryption key is correct.

## Styling

Tailwind CSS is configured through `postcss.config.mjs`. Shared styles are in `src/app/globals.css`. The interface uses a light background, white cards, blue controls, lavender input areas, and mint accents.
