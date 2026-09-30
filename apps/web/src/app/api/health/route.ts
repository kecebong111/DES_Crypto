import { callPython } from "@/lib/server/python-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
export async function GET() { return callPython("/health"); }
