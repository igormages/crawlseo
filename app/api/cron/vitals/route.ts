import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { syncVitalsForSite } from "@/lib/workers/vitals-sync";
import { getRedis } from "@/lib/redis";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const redis = getRedis();
  const lockKey = "cron:vitals:lock";
  if (redis) {
    const locked = await redis.set(lockKey, "1", { nx: true, ex: 900 });
    if (!locked) {
      return Response.json({ skipped: true, reason: "already running" });
    }
  }

  try {
    const sites = await db.site.findMany({
      select: { id: true, userId: true, domain: true },
    });

    const results = [];
    for (const site of sites) {
      try {
        const result = await syncVitalsForSite(site.userId, site.id);
        results.push({ siteId: site.id, domain: site.domain, result });
      } catch (error) {
        results.push({
          siteId: site.id,
          domain: site.domain,
          error: error instanceof Error ? error.message : "Failed",
        });
      }
    }

    return Response.json({ ok: true, processed: results.length, results });
  } finally {
    if (redis) await redis.del(lockKey);
  }
}
