export type BlockInput = { format: "text" | "hex"; value: string };

export interface EncryptRequest {
  plaintext: BlockInput;
  key: BlockInput;
}

export interface DecryptRequest {
  ciphertextHex: string;
  key: BlockInput;
}

export interface KeyScheduleRequest {
  key: BlockInput;
}

export interface EncryptResponse {
  algorithm: "DES";
  operation: "encrypt";
  plaintextHex: string;
  ciphertextHex: string;
}

export interface DecryptResponse {
  algorithm: "DES";
  operation: "decrypt";
  plaintextHex: string;
  plaintextText: string | null;
}

export interface KeyScheduleRound {
  round: number;
  shift: 1 | 2;
  c: string;
  d: string;
  subkeyBinary: string;
  subkeyHex: string;
}

export interface KeyScheduleResponse {
  algorithm: "DES";
  operation: "key-schedule";
  inputKeyBinary: string;
  inputKeyHex: string;
  pc1Table: number[];
  pc1Output: string;
  c0: string;
  d0: string;
  shiftSchedule: (1 | 2)[];
  rounds: KeyScheduleRound[];
  pc2Table: number[];
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "BACKEND_UNAVAILABLE"
  | "BACKEND_TIMEOUT"
  | "BACKEND_BAD_RESPONSE"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR"
  | "HTTP_ERROR";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details: { path: string; message: string }[];
  };
}

export interface HealthResponse {
  status: "ok";
  service: "web";
  python: "ok";
}
