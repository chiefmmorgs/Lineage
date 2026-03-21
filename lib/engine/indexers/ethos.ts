/**
 * ============================================================
 *  Lineage — Ethos Score Poller
 * ============================================================
 *
 *  Polls Ethos scores for humans that have active links
 *  in our database. Does NOT store Ethos data locally —
 *  only emits events when a meaningful score change is detected.
 *
 *  Runs every 60s.
 * ============================================================
 */

import { db, now } from "../../db/index";
import { links, externalSync, scoreEvents } from "../../db/schema";
import { eventBus } from "../events";
import { eq } from "drizzle-orm";

// ── Config ────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;
const ETHOS_API = "https://api.ethos.network/v1";

let isRunning = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// In-memory cache of last known scores (lightweight, no DB duplication)
const scoreCache = new Map<string, number>();

// ── Fetch Ethos score (external API) ──────────────────────────────

async function fetchEthosScore(profileId: number): Promise<number | null> {
  try {
    const res = await fetch(`${ETHOS_API}/score/profileId:${profileId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.score ?? null;
  } catch {
    return null;
  }
}

// ── Main poll ─────────────────────────────────────────────────────

async function poll() {
  if (!isRunning) return;

  try {
    // Get unique wallets + profile IDs from our links (Lineage-owned data)
    const activeLinks = db.select().from(links)
      .where(eq(links.status, "active"))
      .all();

    const profileMap = new Map<number, string>(); // profileId → wallet
    for (const link of activeLinks) {
      if (link.ethosProfileId > 0) {
        profileMap.set(link.ethosProfileId, link.humanWallet);
      }
    }

    if (profileMap.size === 0) return;

    let updatedCount = 0;
    const ts = now();

    for (const [profileId, wallet] of profileMap) {
      const newScore = await fetchEthosScore(profileId);
      if (newScore === null) continue;

      const cacheKey = `${profileId}`;
      const previousScore = scoreCache.get(cacheKey) ?? 1200;
      const delta = Math.abs(newScore - previousScore);

      // Only emit if score changed by ≥5 points
      if (delta < 5) continue;

      scoreCache.set(cacheKey, newScore);

      // Log event (Lineage-owned audit trail)
      db.insert(scoreEvents).values({
        eventType: "ethos.updated",
        entityType: "human",
        entityId: wallet,
        source: "ethos",
        data: JSON.stringify({ profileId, previousScore, newScore, delta }),
        createdAt: ts,
      }).run();

      // Emit to event bus
      eventBus.emit({
        type: "ethos.updated",
        wallet,
        previousScore,
        newScore,
        timestamp: ts,
      });

      updatedCount++;
      console.log(`  [ETHOS] ${wallet.slice(0, 10)}… score: ${previousScore} → ${newScore} (Δ${delta})`);

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Update sync cursor
    const existing = db.select().from(externalSync)
      .where(eq(externalSync.source, "ethos"))
      .get();
    if (existing) {
      db.update(externalSync)
        .set({ lastSyncedAt: ts, status: "idle" })
        .where(eq(externalSync.id, existing.id))
        .run();
    } else {
      db.insert(externalSync).values({
        source: "ethos", lastBlock: 0, lastSyncedAt: ts, status: "idle",
      }).run();
    }

    if (updatedCount > 0) {
      console.log(`[ETHOS] Poll: ${updatedCount}/${profileMap.size} profiles changed`);
    }
  } catch (err) {
    console.error("[ETHOS] Poll error:", (err as Error).message?.slice(0, 200));
  }
}

// ── Public API ────────────────────────────────────────────────────

export function startEthosPoller() {
  if (isRunning) return;
  isRunning = true;
  console.log("[ETHOS] Poller started (60s interval, external-first)");
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopEthosPoller() {
  isRunning = false;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  console.log("[ETHOS] Poller stopped");
}
