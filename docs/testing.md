# Testing

## Python tests

Run from `apps/crypto-api`:

```bash
.venv/bin/python -m unittest discover -s tests -v
```

The unit tests cover:

- Two published DES known-answer vectors.
- The first and last subkeys for key `133457799BBCDFF1`.
- All sixteen key-schedule rotations and PC-2 outputs.
- Deterministic round-trip cases.
- UTF-8 text input and undecodable plaintext bytes.
- Leading zeros and parity-bit behavior.
- Invalid text and hexadecimal input.

## Web checks

Run from `apps/web`:

```bash
npm run lint
npm run typecheck
npm run build
```

## Integration test

Build the web application first, then run from `apps/crypto-api`:

```bash
.venv/bin/python tests/integration_des.py
```

The integration test starts FastAPI and Next.js on local test ports. It checks health routes, all three DES operations, validation errors, malformed service responses, timeouts, unavailable-service handling, and cache headers. Ports `18000`, `18001`, and `13000` must be available.

## Reference values

| Plaintext | Key | Ciphertext |
| --- | --- | --- |
| `0123456789ABCDEF` | `133457799BBCDFF1` | `85E813540F0AB405` |
| `0000000000000000` | `0000000000000000` | `8CA64DE9C1B123A7` |

For the first key, K1 is `1B02EFFC7072` and K16 is `CB3D8B0E17F5`.
