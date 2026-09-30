import "server-only";
import { NextResponse } from "next/server";
import type { ErrorCode } from "@/features/des/types";
import { validError, validSuccess, type Operation } from "@/features/des/validation";

function failure(status: number, code: ErrorCode, message: string) {
  return NextResponse.json({ error: { code, message, details: [] } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function callPython(path: "/health" | "/des/encrypt" | "/des/decrypt" | "/des/key-schedule", body?: unknown) {
  const base = process.env.CRYPTO_API_URL;
  const timeout = Number(process.env.CRYPTO_API_TIMEOUT_MS ?? "5000");
  if (!base || !Number.isInteger(timeout) || timeout < 1 || timeout > 120000) {
    return failure(500, "CONFIGURATION_ERROR", "Python service configuration is invalid.");
  }
  let url: URL;
  try {
    url = new URL(path, base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch { return failure(500, "CONFIGURATION_ERROR", "Python service URL is invalid."); }
  const signal = AbortSignal.timeout(timeout);
  try {
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store", signal, redirect: "manual",
    });
    const payload: unknown = await response.json();
    if (path === "/health" && response.status === 200 && typeof payload === "object" && payload !== null && "status" in payload && payload.status === "ok" && "service" in payload && payload.service === "crypto-api" && Object.keys(payload).length === 2) {
      return NextResponse.json({ status: "ok", service: "web", python: "ok" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (path !== "/health" && response.status === 200 && validSuccess(payload, path.slice(5) as Operation)) {
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    }
    // Only forward the documented, sanitized Python validation envelope.
    if (path !== "/health" && response.status === 422 && validError(payload) && payload.error.code === "VALIDATION_ERROR") {
      return NextResponse.json(payload, { status: 422, headers: { "Cache-Control": "no-store" } });
    }
    return failure(502, "BACKEND_BAD_RESPONSE", "Python returned an unexpected response.");
  } catch (error) {
    if (signal.aborted) return failure(504, "BACKEND_TIMEOUT", "Python service timed out.");
    if (error instanceof SyntaxError) return failure(502, "BACKEND_BAD_RESPONSE", "Python returned invalid JSON.");
    return failure(503, "BACKEND_UNAVAILABLE", "Python service is unavailable.");
  }
}

export async function proxyDes(request: Request, operation: "encrypt" | "decrypt" | "key-schedule") {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return failure(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return failure(400, "INVALID_JSON", "Request body must be valid JSON."); }
  return callPython(`/des/${operation}`, body);
}
