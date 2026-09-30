import { proxyDes } from "@/lib/server/python-client";
export const runtime = "nodejs";
export async function POST(request: Request) { return proxyDes(request, "encrypt"); }
