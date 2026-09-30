# DES Explorer API contract — version 1

Browser endpoint prefix: `/api`. Python endpoint prefix: none. All POST bodies use `application/json`. Field names are case-sensitive. All fields shown are required; additional fields are rejected, including nested fields. Pydantic strict mode rejects scalar coercion. TypeScript types describe this contract; runtime authoritative validation is in Python.

## Single-block rules

- Exactly one 64-bit (8-byte) block. No mode/IV, automatic padding, truncation, or key adjustment.
- `BlockInput = {"format":"text" | "hex", "value": string}`.
- Text must encode to exactly **8 UTF-8 bytes**, not eight JavaScript characters. No trimming or Unicode normalization. Invalid Unicode such as lone surrogates is rejected. Examples: `ABCDEFGH`, `éééé`, and `😀😀` are each 8 bytes; `HELLO!` is not.
- Hex input removes only ASCII space, tab, CR, LF, FF, VT (`[ \t\r\n\f\v]`) anywhere in the string. Then exactly 16 ASCII hex characters are required. No `0x` prefix. Case is accepted either way; canonical output is uppercase. Other Unicode whitespace is rejected.
- The same rules apply to keys. A DES key contains 64 supplied bits, including eight parity bits, and 56 effective bits.
- Parity policy: preserve the supplied key **bytes** exactly; do not reject or correct parity. PC-1 discards the parity bits. Different supplied keys that differ only in parity produce identical subkeys. Hex formatting normalization does not change bytes.
- All binary and hexadecimal outputs are strings of exact fixed widths, retaining leading zeros. Tables use 1-based DES bit positions, most-significant bit first.
- Decryption must always expose raw `plaintextHex`; `plaintextText` is a required nullable field, populated only by strict valid UTF-8 decoding. No replacement characters for invalid UTF-8. DES alone cannot establish whether a decryption key is correct; there is no “key matches” field.

## Exact requests

### POST `/api/des/encrypt` → Python `/des/encrypt`

```json
{"plaintext":{"format":"hex","value":"0123456789ABCDEF"},"key":{"format":"hex","value":"133457799BBCDFF1"}}
```

Schema: `{ plaintext: BlockInput, key: BlockInput }`.

### POST `/api/des/decrypt` → Python `/des/decrypt`

```json
{"ciphertextHex":"85E813540F0AB405","key":{"format":"hex","value":"133457799BBCDFF1"}}
```

Schema: `{ ciphertextHex: string, key: BlockInput }`. Ciphertext accepts hex only, with the same normalization/8-byte rule.

### POST `/api/des/key-schedule` → Python `/des/key-schedule`

```json
{"key":{"format":"hex","value":"133457799BBCDFF1"}}
```

Schema: `{ key: BlockInput }`.

## Implemented HTTP 200 responses

Exact schemas are the following TypeScript-shaped definitions, mirrored by Pydantic models in `app/schemas/des.py`. No fields below are optional. `HexN` means N uppercase hexadecimal characters; `BitsN` means N characters from `0`/`1`.

```typescript
type EncryptResponse = {
  algorithm: "DES";
  operation: "encrypt";
  plaintextHex: Hex16;
  ciphertextHex: Hex16;
};
type DecryptResponse = {
  algorithm: "DES";
  operation: "decrypt";
  plaintextHex: Hex16;
  plaintextText: string | null;
};
type KeyScheduleResponse = {
  algorithm: "DES";
  operation: "key-schedule";
  inputKeyBinary: Bits64; // Includes supplied parity bits.
  inputKeyHex: Hex16;
  pc1Table: number[];    // Exactly 56 positions, each 1..64; standard PC-1 order.
  pc1Output: Bits56;
  c0: Bits28;
  d0: Bits28;
  shiftSchedule: (1 | 2)[]; // Exactly 16 entries, standard sequence below.
  rounds: {             // Exactly 16 entries in ascending round order.
    round: number;      // 1..16, unique and sequential.
    shift: 1 | 2;
    c: Bits28;          // Full Ci after this round's left rotation.
    d: Bits28;          // Full Di after this round's left rotation.
    subkeyBinary: Bits48;
    subkeyHex: Hex12;
  }[];
  pc2Table: number[];    // Exactly 48 positions, each 1..56; standard PC-2 order.
};
```

Shift schedule: `[1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1]`. The implementation computes the full trace; Pydantic models enforce field shapes/lengths. Unit tests check known subkeys, rotations, and binary/hex consistency. The Next proxy validates identifiers, exact fields, fixed widths, standard tables/shifts, and all 16 sequential rounds before forwarding success.

Verified known-answer vector:

```text
Plaintext hex:  0123456789ABCDEF
Key hex:        133457799BBCDFF1
Ciphertext hex: 85E813540F0AB405
```

This is a computed, tested result. `HELLO!` is rejected because it is not eight UTF-8 bytes.

## Current errors

Valid POST operations return **200** with validated result models.

Exact envelope: `{ error: { code: ErrorCode, message: string, details: { path: string, message: string }[] } }`. Details are always an array. They never contain request values, Pydantic input/context, or unknown user-supplied property names. Paths use dot notation, e.g. `body.plaintext`; unknown path segments become `unknown`. Clients should branch on code/status, not message wording.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Next.js cannot parse JSON |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Next.js requires application/json |
| 422 | `VALIDATION_ERROR` | Python rejects schema, format, UTF-8, or byte length; malformed direct Python JSON also uses this |
| 503 | `BACKEND_UNAVAILABLE` | Next.js cannot reach Python |
| 504 | `BACKEND_TIMEOUT` | Python exceeded configured timeout |
| 502 | `BACKEND_BAD_RESPONSE` | Python returned malformed JSON, a redirect, an unexpected status/shape, or an invalid success payload |
| 500 | `CONFIGURATION_ERROR` | Missing/invalid server Python configuration |
| 500 | `INTERNAL_ERROR` | Unexpected direct Python failure |
| varies | `HTTP_ERROR` | Direct Python HTTP error such as unmatched route |

This contract covers the implemented handlers; Next.js framework-generated 404/405 pages are not this JSON envelope. Backend validation is authoritative, so a well-formed but semantically invalid request returns 503 rather than 422 if Python is offline. The proxy forwards validated 200 successes and 422 validation errors only. Unexpected Python 500 responses become safe 502 responses at the web boundary. Browser helpers retain their optional AbortSignal: caller cancellation/network failures may reject natively; backend timeouts return the documented 504 envelope.

## Health

GET Python `/health`: `200 {"status":"ok","service":"crypto-api"}`.

GET Next `/api/health`: `200 {"status":"ok","service":"web","python":"ok"}` only after reaching Python. Otherwise controlled 500/502/503/504 errors as above. Health does not require or contact Neon. Responses from the proxy and Python error handlers use `Cache-Control: no-store`.

Python `/openapi.json` exposes machine-readable request and response schemas. Test commands and reference values are listed in [testing.md](testing.md).
