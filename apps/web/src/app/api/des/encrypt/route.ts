import { proxyDes } from "@/lib/server/python-client";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) { return proxyDes(request, "encrypt"); }
