/** Validates data returned by the DES API. */
import type { ApiErrorBody } from "./types";

export type Operation = "encrypt" | "decrypt" | "key-schedule";
const shifts = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const pc1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const pc2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function hex(value: unknown, width: number): value is string {
  return typeof value === "string" && value.length === width && /^[0-9A-F]+$/.test(value);
}
function bits(value: unknown, width: number): value is string {
  return typeof value === "string" && value.length === width && /^[01]+$/.test(value);
}
function sequence(value: unknown, expected: number[]) {
  return Array.isArray(value) && value.length === expected.length && value.every((v, i) => v === expected[i]);
}

export function validSuccess(value: unknown, operation: Operation): boolean {
  if (!record(value) || value.algorithm !== "DES" || value.operation !== operation) return false;
  if (operation === "encrypt") {
    return exact(value, ["algorithm", "operation", "plaintextHex", "ciphertextHex"]) && hex(value.plaintextHex, 16) && hex(value.ciphertextHex, 16);
  }
  if (operation === "decrypt") {
    return exact(value, ["algorithm", "operation", "plaintextHex", "plaintextText"]) && hex(value.plaintextHex, 16) && (value.plaintextText === null || typeof value.plaintextText === "string");
  }
  return exact(value, ["algorithm", "operation", "inputKeyBinary", "inputKeyHex", "pc1Table", "pc1Output", "c0", "d0", "shiftSchedule", "rounds", "pc2Table"]) &&
    bits(value.inputKeyBinary, 64) && hex(value.inputKeyHex, 16) && bits(value.pc1Output, 56) && bits(value.c0, 28) && bits(value.d0, 28) &&
    sequence(value.pc1Table, pc1) && sequence(value.pc2Table, pc2) && sequence(value.shiftSchedule, shifts) &&
    Array.isArray(value.rounds) && value.rounds.length === 16 && value.rounds.every((r: unknown, i: number) =>
      record(r) && exact(r, ["round", "shift", "c", "d", "subkeyBinary", "subkeyHex"]) &&
      r.round === i + 1 && r.shift === shifts[i] && bits(r.c, 28) && bits(r.d, 28) && bits(r.subkeyBinary, 48) && hex(r.subkeyHex, 12));
}

const codes = new Set(["VALIDATION_ERROR", "INVALID_JSON", "UNSUPPORTED_MEDIA_TYPE", "BACKEND_UNAVAILABLE", "BACKEND_TIMEOUT", "BACKEND_BAD_RESPONSE", "CONFIGURATION_ERROR", "INTERNAL_ERROR", "HTTP_ERROR"]);
export function validError(value: unknown): value is ApiErrorBody {
  if (!record(value) || !exact(value, ["error"]) || !record(value.error)) return false;
  const error = value.error;
  return exact(error, ["code", "message", "details"]) && typeof error.code === "string" && codes.has(error.code) && typeof error.message === "string" &&
    Array.isArray(error.details) && error.details.every((d: unknown) => record(d) && exact(d, ["path", "message"]) && typeof d.path === "string" && typeof d.message === "string");
}
