"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { decrypt, DesApiError, encrypt, keySchedule } from "../api";
import type {
  BlockInput,
  DecryptResponse,
  EncryptResponse,
  KeyScheduleResponse,
} from "../types";

type Mode = "encryption" | "decryption" | "key-scheduling";

type Result =
  | EncryptResponse
  | DecryptResponse
  | KeyScheduleResponse;

const SAMPLE_KEY = "133457799BBCDFF1";
const SAMPLE_PLAINTEXT = "0123456789ABCDEF";
const SAMPLE_CIPHERTEXT = "85E813540F0AB405";

const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

const CARD =
  "rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-8";

const BUTTON =
  "rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white " +
  "transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY =
  "rounded-lg border border-indigo-100 bg-white px-4 py-2 text-xs " +
  "font-medium text-slate-600 hover:bg-indigo-50";

const CONTENT = {
  encryption: {
    title: "Encrypt a Secret Message",
    subtitle:
      "Turn your message into ciphertext using a secret key.",
    infoTitle: "What is DES?",
    info:
      "DES transforms one 8-byte block through 16 rounds. " +
      "The key supplies 64 bits, including 8 parity bits.",
    action: "Encrypt Message",
  },
  decryption: {
    title: "Decrypt Your Message",
    subtitle:
      "Use the same secret key to recover the original bytes.",
    infoTitle: "How does decrypting work?",
    info:
      "DES follows the same round structure for decryption, " +
      "but uses its sixteen subkeys in reverse order: K16 to K1.",
    action: "Decrypt Message",
  },
  "key-scheduling": {
    title: "DES Key Scheduling",
    subtitle:
      "Follow one 64-bit key as it becomes sixteen 48-bit round keys.",
    infoTitle: "About key scheduling",
    info:
      "PC-1 selects 56 key bits. The two halves rotate each round, " +
      "then PC-2 selects the 48 bits used in each subkey.",
    action: "Generate Round Keys",
  },
};

function normalizeHex(value: string) {
  return value.replace(/[ \t\r\n\f\v]/g, "").toUpperCase();
}

function group(value: string, size = 4) {
  return value.match(new RegExp(`.{1,${size}}`, "g"))?.join(" ") ?? "";
}

function validate(input: BlockInput): string | null {
  if (!input.value) return "Enter a value.";

  if (input.format === "hex") {
    return /^[0-9A-F]{16}$/.test(normalizeHex(input.value))
      ? null
      : "Enter exactly 16 hexadecimal digits.";
  }

  // Reject invalid Unicode instead of silently replacing it.
  const invalidUnicode =
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

  if (invalidUnicode.test(input.value)) {
    return "Text contains an invalid Unicode character.";
  }

  const bytes = new TextEncoder().encode(input.value).length;

  return bytes === 8
    ? null
    : `Use exactly 8 UTF-8 bytes. Current input: ${bytes} bytes.`;
}

function Field({
  id,
  label,
  value,
  onChange,
  hexOnly = false,
}: {
  id: string;
  label: string;
  value: BlockInput;
  onChange: (value: BlockInput) => void;
  hexOnly?: boolean;
}) {
  const error = validate(value);

  return (
    <div className="min-w-0 rounded-xl bg-[#f2f2ff] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>

        {!hexOnly && (
          <div
            role="group"
            aria-label={`${label} format`}
            className="flex rounded-lg bg-indigo-100 p-1"
          >
            {(["text", "hex"] as const).map((format) => (
              <button
                key={format}
                type="button"
                aria-pressed={value.format === format}
                onClick={() => onChange({ ...value, format })}
                className={`rounded-md px-3 py-1 text-xs ${
                  value.format === format
                    ? "bg-white font-semibold text-blue-600 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                {format === "hex" ? "Hex" : "Text"}
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        id={id}
        value={value.value}
        onChange={(event) =>
          onChange({ ...value, value: event.target.value })
        }
        spellCheck={false}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help`}
        className="w-full rounded-lg border border-indigo-100 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      <p
        id={`${id}-help`}
        className={`mt-3 text-xs ${
          error ? "text-amber-700" : "text-slate-500"
        }`}
      >
        {error ??
          (value.format === "hex"
            ? "16 hexadecimal digits · 64 bits"
            : "8 UTF-8 bytes · no automatic padding")}
      </p>
    </div>
  );
}

function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied!");
    } catch {
      setStatus("Copy failed. Select the text manually.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={copy} className={SECONDARY}>
        {label}
      </button>
      <span role="status" className="text-xs text-emerald-700">
        {status}
      </span>
    </div>
  );
}

function BinaryValue({ value }: { value: string }) {
  return (
    <pre className="mt-3 whitespace-pre-wrap break-all rounded-xl border border-indigo-100 bg-indigo-50 p-4 font-mono text-xs leading-7 text-blue-700">
      {group(value, 8)}
    </pre>
  );
}

function PermutationTable({
  title,
  values,
}: {
  title: string;
  values: number[];
}) {
  return (
    <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-blue-700">
        {title} — View permutation
      </summary>

      <div className="grid grid-cols-8 gap-1 p-3">
        {values.map((value, index) => (
          <span
            key={index}
            className="rounded bg-white p-2 text-center font-mono text-xs"
          >
            {value}
          </span>
        ))}
      </div>
    </details>
  );
}

function ScheduleResult({ result }: { result: KeyScheduleResponse }) {
  const [format, setFormat] = useState<"binary" | "hex">("binary");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-6">
        <section className={CARD}>
          <h2 className="font-bold">1. Input Key</h2>
          <p className="mt-2 font-mono text-sm text-blue-600">
            {result.inputKeyHex}
          </p>
          <BinaryValue value={result.inputKeyBinary} />
        </section>

        <section className={CARD}>
          <h2 className="font-bold">2. Remove Parity Bits (PC-1)</h2>
          <p className="mt-2 text-xs text-slate-500">
            Select and permute 56 bits from the supplied key.
          </p>
          <PermutationTable title="PC-1" values={result.pc1Table} />
          <BinaryValue value={result.pc1Output} />
        </section>

        <section className={CARD}>
          <h2 className="font-bold">3. Split into C₀ and D₀</h2>
          <p className="mt-4 text-xs font-medium">C₀ · Left 28 bits</p>
          <BinaryValue value={result.c0} />
          <p className="mt-4 text-xs font-medium">D₀ · Right 28 bits</p>
          <BinaryValue value={result.d0} />
        </section>

        <section className={CARD}>
          <h2 className="font-bold">4. Left Shifts for Each Round</h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-center text-xs">
              <tbody>
                <tr className="border-b border-indigo-100">
                  <th className="p-2 text-left">Round</th>
                  {SHIFTS.map((_, index) => (
                    <td key={index} className="p-2">
                      {index + 1}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="p-2 text-left">Shift</th>
                  {SHIFTS.map((shift, index) => (
                    <td
                      key={index}
                      className={`p-2 ${
                        shift === 1 ? "bg-blue-50 text-blue-700" : ""
                      }`}
                    >
                      {shift}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className={`${CARD} min-w-0`}>
        <h2 className="font-bold">5. Generate Round Keys (PC-2)</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Combine the rotated halves, then select 48 bits per round.
        </p>

        <PermutationTable title="PC-2" values={result.pc2Table} />

        <fieldset className="my-5 flex flex-wrap gap-5">
          <legend className="mb-2 text-xs font-semibold">
            Output format
          </legend>

          {(["binary", "hex"] as const).map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 text-xs"
            >
              <input
                type="radio"
                name="subkey-format"
                checked={format === option}
                onChange={() => setFormat(option)}
                className="accent-blue-600"
              />
              {option === "binary" ? "Binary (48 bits)" : "Hex (12 digits)"}
            </label>
          ))}
        </fieldset>

        <div className="overflow-x-auto rounded-xl border border-indigo-100">
          <table className="w-full min-w-[460px] text-left text-xs">
            <thead className="bg-indigo-50">
              <tr>
                <th className="p-3">Round</th>
                <th className="p-3">Cᵢ · 28 bits</th>
                <th className="p-3">Dᵢ · 28 bits</th>
                <th className="p-3">Subkey Kᵢ</th>
              </tr>
            </thead>

            <tbody>
              {result.rounds.map((round) => (
                <tr
                  key={round.round}
                  className="border-t border-indigo-50 even:bg-slate-50"
                >
                  <th scope="row" className="p-3">
                    {round.round}
                  </th>
                  <td className="p-3">
                    <code className="break-all leading-6 text-blue-600">
                      {group(round.c, 7)}
                    </code>
                  </td>
                  <td className="p-3">
                    <code className="break-all leading-6 text-amber-700">
                      {group(round.d, 7)}
                    </code>
                  </td>
                  <td className="p-3">
                    <code className="break-all leading-6">
                      {format === "binary"
                        ? group(round.subkeyBinary, 8)
                        : group(round.subkeyHex)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5">
          <CopyButton
            label="Copy All Subkeys"
            value={result.rounds
              .map(
                (round) =>
                  `K${round.round}: ${
                    format === "binary"
                      ? round.subkeyBinary
                      : round.subkeyHex
                  }`,
              )
              .join("\n")}
          />
        </div>
      </section>
    </div>
  );
}

export default function DesExplorer({ mode }: { mode: Mode }) {
  const content = CONTENT[mode];
  const scheduling = mode === "key-scheduling";

  const [block, setBlock] = useState<BlockInput>({
    format: "hex",
    value:
      mode === "decryption" ? SAMPLE_CIPHERTEXT : SAMPLE_PLAINTEXT,
  });

  const [secretKey, setSecretKey] = useState<BlockInput>({
    format: "hex",
    value: SAMPLE_KEY,
  });

  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => activeRequest.current?.abort();
  }, []);

  const valid =
    !validate(secretKey) && (scheduling || !validate(block));

  function clear() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setPending(false);
    setResult(null);
    setError("");
  }

  function reset() {
    clear();
    setBlock({
      format: "hex",
      value:
        mode === "decryption" ? SAMPLE_CIPHERTEXT : SAMPLE_PLAINTEXT,
    });
    setSecretKey({ format: "hex", value: SAMPLE_KEY });
  }

  function randomKey() {
    clear();

    const bytes = crypto.getRandomValues(new Uint8Array(8));

    setSecretKey({
      format: "hex",
      value: Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      )
        .join("")
        .toUpperCase(),
    });
  }

  async function calculate() {
    if (!valid) return;

    clear();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);

    try {
      let response: Result;

      if (mode === "encryption") {
        response = await encrypt(
          { plaintext: block, key: secretKey },
          controller.signal,
        );
      } else if (mode === "decryption") {
        response = await decrypt(
          { ciphertextHex: block.value, key: secretKey },
          controller.signal,
        );
      } else {
        response = await keySchedule(
          { key: secretKey },
          controller.signal,
        );
      }

      if (activeRequest.current === controller) {
        setResult(response);
      }
    } catch (cause) {
      if (
        controller.signal.aborted ||
        activeRequest.current !== controller
      ) {
        return;
      }

      if (cause instanceof DesApiError) {
        const messages: Record<string, string> = {
          BACKEND_UNAVAILABLE:
            "The calculation service is unavailable. Start the Python server and try again.",
          BACKEND_TIMEOUT:
            "The calculation took too long. Please try again.",
          BACKEND_BAD_RESPONSE:
            "The calculation service returned an unexpected response.",
        };

        setError(messages[cause.body.error.code] ?? cause.message);
      } else {
        setError("The request failed. Check your connection and try again.");
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPending(false);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav
          aria-label="DES pages"
          className="flex max-w-full overflow-x-auto rounded-xl bg-indigo-50 p-1"
        >
          {(
            [
              ["encryption", "Encryption"],
              ["decryption", "Decryption"],
              ["key-scheduling", "Key Scheduling"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={`/${value}`}
              aria-current={mode === value ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-4 py-3 text-xs font-semibold ${
                mode === value
                  ? "bg-indigo-100 text-blue-700"
                  : "text-slate-500 hover:text-blue-600"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <button type="button" onClick={reset} className={SECONDARY}>
          ↻ Reset to Sample
        </button>
      </div>

      <section className="rounded-2xl bg-gradient-to-br from-indigo-50 via-[#f1f1ff] to-blue-100/60 p-6 sm:p-9">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {content.title}
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          {content.subtitle}
        </p>

        <div className="mt-6 flex max-w-3xl gap-4 rounded-xl bg-white p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-200 font-bold text-emerald-900">
            i
          </span>
          <div>
            <h2 className="text-sm font-bold">{content.infoTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {content.info}
            </p>
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="mb-6 text-lg font-bold">
          {scheduling ? "Start with Your Key" : "Choose Your Input & Secret Key"}
        </h2>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void calculate();
          }}
        >
          <div
            className={`grid gap-5 ${
              scheduling ? "" : "md:grid-cols-2"
            }`}
          >
            {!scheduling && (
              <Field
                id="des-block"
                label={
                  mode === "encryption"
                    ? "Your Message (Plaintext)"
                    : "Ciphertext"
                }
                value={block}
                hexOnly={mode === "decryption"}
                onChange={(value) => {
                  clear();
                  setBlock(value);
                }}
              />
            )}

            <div>
              <Field
                id="des-key"
                label="Secret Key"
                value={secretKey}
                onChange={(value) => {
                  clear();
                  setSecretKey(value);
                }}
              />

              <button
                type="button"
                onClick={randomKey}
                className="mt-3 text-xs font-medium text-blue-600 hover:underline"
              >
                Generate Random Key
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              {valid
                ? "● Input format is valid."
                : "Provide valid input to continue."}
            </p>

            <div className="flex items-center gap-3">
              {pending && (
                <button
                  type="button"
                  onClick={() => {
                    clear();
                    setError("Calculation cancelled.");
                  }}
                  className={SECONDARY}
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={!valid || pending}
                className={BUTTON}
              >
                {pending ? "Calculating…" : `${content.action} →`}
              </button>
            </div>
          </div>

          {pending && (
            <p role="status" className="mt-4 text-sm text-blue-600">
              Processing your request…
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            >
              {error}
            </div>
          )}
        </form>
      </section>

      {mode === "decryption" && (
        <section className={`${CARD} grid gap-5 md:grid-cols-2`}>
          {[
            {
              title: "Encryption",
              keys: ["K₁", "K₂", "K₁₆"],
              background: "bg-indigo-50",
            },
            {
              title: "Decryption",
              keys: ["K₁₆", "K₁₅", "K₁"],
              background: "bg-emerald-50",
            },
          ].map((direction) => (
            <div
              key={direction.title}
              className={`rounded-xl p-5 ${direction.background}`}
            >
              <h3 className="mb-4 text-sm font-bold">
                {direction.title}
              </h3>

              {[1, 2, 16].map((round, index) => (
                <div key={round}>
                  {index === 2 && (
                    <p className="py-2 text-center text-slate-400">•••</p>
                  )}

                  <div className="mt-2 flex items-center justify-between rounded-lg bg-white px-4 py-3 text-xs">
                    <span>Round {round}</span>
                    <span>→</span>
                    <code>Subkey {direction.keys[index]}</code>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {!result && (
        <section className={CARD}>
          <h2 className="text-lg font-bold">
            {scheduling ? "Round Keys" : "Output"}
          </h2>

          <div className="mt-5 rounded-xl border border-dashed border-indigo-200 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-600">
              {scheduling
                ? "One key becomes sixteen."
                : "Your result will appear here."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Submit valid input to request a calculation.
            </p>
          </div>
        </section>
      )}

      {result?.operation === "encrypt" && (
        <section className={CARD}>
          <h2 className="text-lg font-bold">Ciphertext</h2>

          <div className="mt-5 rounded-xl bg-indigo-50 p-6">
            <p className="text-xs tracking-widest text-slate-500">
              64-BIT HEXADECIMAL OUTPUT
            </p>
            <p className="mt-3 break-all font-mono text-2xl tracking-wider text-blue-600 sm:text-3xl">
              {group(result.ciphertextHex)}
            </p>
          </div>

          <div className="mt-5">
            <CopyButton
              value={result.ciphertextHex}
              label="Copy Ciphertext"
            />
          </div>
        </section>
      )}

      {result?.operation === "decrypt" && (
        <section className={CARD}>
          <h2 className="text-lg font-bold">Decrypted Plaintext</h2>

          <div className="mt-5 rounded-xl bg-indigo-50 p-6 text-center">
            {result.plaintextText !== null ? (
              <p className="whitespace-pre-wrap break-all font-mono text-3xl text-blue-600">
                {result.plaintextText}
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                The returned bytes are not valid UTF-8 text.
              </p>
            )}

            <p className="mt-5 break-all font-mono text-sm text-slate-600">
              HEX · {group(result.plaintextHex)}
            </p>
          </div>

          <p className="mt-4 text-xs leading-6 text-slate-500">
            DES does not verify that the key is correct or authenticate
            the returned plaintext.
          </p>

          <div className="mt-5 flex justify-end gap-3">
            <CopyButton value={result.plaintextHex} label="Copy Hex" />

            {result.plaintextText !== null && (
              <CopyButton value={result.plaintextText} label="Copy Text" />
            )}
          </div>
        </section>
      )}

      {result?.operation === "key-schedule" && (
        <ScheduleResult result={result} />
      )}
    </div>
  );
}
