import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { runSiteCrawl } from "@/lib/crawler/engine";
import { getRedis } from "@/lib/redis";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const redis = getRedis();
  const lockKey = "cron:crawl:lock";
  if (redis) {
    const locked = await redis.set(lockKey, "1", { nx: true, ex: 1800 });
    if (!locked) {
      return Response.json({ skipped: true, reason: "already running" });
    }
  }

  try {
    const sites = await db.site.findMany({
      select: { id: true, domain: true },
    });

    const results = [];
    for (const site of sites) {
      const running = await db.crawl.findFirst({
        where: { siteId: site.id, status: "RUNNING" },
      });
      if (running) {
        results.push({ siteId: site.id, skipped: true, reason: "already running" });
        continue;
      }

      const crawl = await db.crawl.create({
        data: { siteId: site.id, status: "PENDING" },
      });

      // Fire-and-forget within the cron invocation window
      runSiteCrawl(site.id, site.domain, 100, crawl.id).catch((error) => {
        console.error(`Cron crawl failed for ${site.id}:`, error);
      });

      results.push({ siteId: site.id, crawlId: crawl.id, status: "started" });
    }

    return Response.json({ ok: true, started: results.length, results });
  } finally {
    if (redis) await redis.del(lockKey);
  }
}
