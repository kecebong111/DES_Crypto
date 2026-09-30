import type { ApiErrorBody, EncryptRequest, EncryptResponse, DecryptRequest, DecryptResponse, KeyScheduleRequest, KeyScheduleResponse } from "./types";
import { validError, validSuccess, type Operation } from "./validation";

export class DesApiError extends Error {
  constructor(public readonly status: number, public readonly body: ApiErrorBody) {
    super(body.error.message);
    this.name = "DesApiError";
  }
}

async function post<T>(path: Operation, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/des/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store", signal,
  });
  const malformed = () => new DesApiError(502, { error: { code: "BACKEND_BAD_RESPONSE", message: "The server returned an unexpected response.", details: [] } });
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw malformed(); }
  if (!response.ok) {
    if (!validError(payload)) throw malformed();
    throw new DesApiError(response.status, payload);
  }
  if (response.status !== 200 || !validSuccess(payload, path)) throw malformed();
  return payload as T;
}

export const encrypt = (request: EncryptRequest, signal?: AbortSignal) => post<EncryptResponse>("encrypt", request, signal);
export const decrypt = (request: DecryptRequest, signal?: AbortSignal) => post<DecryptResponse>("decrypt", request, signal);
export const keySchedule = (request: KeyScheduleRequest, signal?: AbortSignal) => post<KeyScheduleResponse>("key-schedule", request, signal);
