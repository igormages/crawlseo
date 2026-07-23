import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { syncGSCDataForSite } from "@/lib/workers/gsc-sync";
import { getRedis } from "@/lib/redis";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const redis = getRedis();
  const lockKey = "cron:gsc-sync:lock";
  if (redis) {
    const locked = await redis.set(lockKey, "1", { nx: true, ex: 600 });
    if (!locked) {
      return Response.json({ skipped: true, reason: "already running" });
    }
  }

  try {
    const sites = await db.site.findMany({
      where: { gscProperty: { not: null } },
      select: { id: true, userId: true, domain: true },
    });

    const results = [];
    for (const site of sites) {
      const result = await syncGSCDataForSite(site.userId, site.id);
      results.push({ siteId: site.id, domain: site.domain, result });
    }

    return Response.json({ ok: true, synced: results.length, results });
  } finally {
    if (redis) await redis.del(lockKey);
  }
}
