# DES Explorer

DES Explorer is a web application for studying the Data Encryption Standard (DES). It implements one-block encryption, decryption, and the complete 16-round key schedule without using a cryptography library.

DES is obsolete and must not be used to protect real data.

## Features

- Encrypt one 64-bit block from text or hexadecimal input.
- Decrypt one 64-bit hexadecimal block.
- Display PC-1, C0 and D0, the shift schedule, PC-2, and all round keys.
- Preserve leading zeros in binary and hexadecimal output.
- Validate text by UTF-8 byte length.

## Technology

- Next.js, React, TypeScript, and Tailwind CSS
- FastAPI and Pydantic
- Python standard library for the DES implementation

The request flow is:

```text
Browser -> Next.js API routes -> FastAPI -> DES implementation
```

No database is required because every calculation is stateless.

## Requirements

- Node.js 24
- npm 11
- Python 3.13

## Installation

Run these commands from the repository root:

```bash
python3.13 -m venv apps/crypto-api/.venv
apps/crypto-api/.venv/bin/python -m pip install -r apps/crypto-api/requirements.txt
npm --prefix apps/web ci
cp apps/web/.env.example apps/web/.env
cp apps/crypto-api/.env.example apps/crypto-api/.env
```

## Running the application

Start FastAPI in the first terminal:

```bash
cd apps/crypto-api
source .venv/bin/activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start Next.js in the second terminal:

```bash
cd apps/web
npm run dev
```

Open <http://localhost:3000>. The FastAPI documentation is available at <http://127.0.0.1:8000/docs>.

## Environment variables

`apps/web/.env`:

```env
CRYPTO_API_URL=http://127.0.0.1:8000
CRYPTO_API_TIMEOUT_MS=5000
```

`apps/crypto-api/.env`:

```env
APP_NAME=DES Explorer Crypto API
```

## Testing

Python tests:

```bash
cd apps/crypto-api
.venv/bin/python -m unittest discover -s tests -v
```

Web checks:

```bash
cd apps/web
npm run lint
npm run typecheck
npm run build
```

Integration test, after building the web application:

```bash
cd apps/crypto-api
.venv/bin/python tests/integration_des.py
```

## Reference vector

```text
Plaintext:  0123456789ABCDEF
Key:        133457799BBCDFF1
Ciphertext: 85E813540F0AB405
K1:         1B02EFFC7072
K16:        CB3D8B0E17F5
```

## Documentation

- [API contract](docs/api-contract.md)
