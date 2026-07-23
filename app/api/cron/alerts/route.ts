import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { evaluateAlertsForUser } from "@/lib/alerts/evaluate";
import { getRedis } from "@/lib/redis";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const redis = getRedis();
  const lockKey = "cron:alerts:lock";
  if (redis) {
    const locked = await redis.set(lockKey, "1", { nx: true, ex: 300 });
    if (!locked) {
      return Response.json({ skipped: true, reason: "already running" });
    }
  }

  try {
    const users = await db.user.findMany({ select: { id: true } });
    const allFires = [];

    for (const user of users) {
      const fires = await evaluateAlertsForUser(user.id);
      allFires.push(...fires);
    }

    return Response.json({ ok: true, fires: allFires.length, details: allFires });
  } finally {
    if (redis) await redis.del(lockKey);
  }
}
