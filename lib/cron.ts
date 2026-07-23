import type { NextRequest } from "next/server";

/** Verify the request comes from Vercel Cron (or a bearer with CRON_SECRET). */
export function authorizeCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}
