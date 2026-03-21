/**
 * ============================================================
 *  Lineage — Link Registry Indexer
 * ============================================================
 *
 *  Watches the AgentHumanLinkRegistry on Base Sepolia for:
 *    - AgentLinked    → new link created
 *    - LinkUpgraded   → link level changed
 *    - LinkRevoked    → link deactivated
 * ============================================================
 */

import { createPublicClient, http, parseAbiItem, type Address, type Log } from "viem";
import { baseSepolia } from "viem/chains";
import { db, now } from "../../db/index";
import { links, externalSync, scoreEvents } from "../../db/schema";
import { eventBus } from "../events";
import { eq, and } from "drizzle-orm";
import { LINK_REGISTRY_ADDRESS, roleFromIndex, verificationFromIndex } from "../../contracts";

// ── Config ────────────────────────────────────────────────────────

const CHAIN_ID = 84532;
const POLL_INTERVAL_MS = 15_000;
const BLOCK_BATCH = BigInt(500);

const client = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

// ── ABI event signatures ──────────────────────────────────────────

const AgentLinkedEvent = parseAbiItem(
  "event AgentLinked(uint256 indexed linkId, address indexed agentWallet, uint256 agentTokenId, address humanWallet, uint256 ethosProfileId, uint8 role, uint8 level)"
);

// ── Indexer state ─────────────────────────────────────────────────

let lastProcessedBlock = BigInt(0);
let isRunning = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function getLastBlock(): bigint {
  const result = db.select().from(externalSync)
    .where(and(
      eq(externalSync.source, "link_registry"),
      eq(externalSync.chainId, CHAIN_ID)
    ))
    .get();
  return result ? BigInt(result.lastBlock) : BigInt(0);
}

function saveLastBlock(block: bigint) {
  const existing = db.select().from(externalSync)
    .where(and(
      eq(externalSync.source, "link_registry"),
      eq(externalSync.chainId, CHAIN_ID)
    ))
    .get();

  const ts = now();
  if (existing) {
    db.update(externalSync)
      .set({ lastBlock: Number(block), lastSyncedAt: ts, status: "idle" })
      .where(eq(externalSync.id, existing.id))
      .run();
  } else {
    db.insert(externalSync).values({
      source: "link_registry",
      chainId: CHAIN_ID,
      lastBlock: Number(block),
      lastSyncedAt: ts,
      status: "idle",
    }).run();
  }
}

// ── Process AgentLinked events ────────────────────────────────────

function processAgentLinked(log: Log) {
  const linkId = log.topics[1] ? Number(BigInt(log.topics[1])) : 0;
  const agentWallet = log.topics[2]
    ? ("0x" + log.topics[2].slice(26)).toLowerCase()
    : "";

  if (!linkId || !agentWallet) return;

  // Decode remaining fields from data
  let agentTokenId = 0;
  let humanWallet = "";
  let ethosProfileId = 0;
  let role = 0;
  let level = 0;

  try {
    if (log.data && log.data.length >= 322) {
      agentTokenId = Number(BigInt("0x" + log.data.slice(2, 66)));
      humanWallet = ("0x" + log.data.slice(90, 130)).toLowerCase();
      ethosProfileId = Number(BigInt("0x" + log.data.slice(130, 194)));
      role = Number(BigInt("0x" + log.data.slice(194, 258)));
      level = Number(BigInt("0x" + log.data.slice(258, 322)));
    }
  } catch { /* use defaults */ }

  const ts = now();
  const roleName = roleFromIndex(role);
  const levelName = verificationFromIndex(level);

  db.insert(links).values({
    linkId,
    agentTokenId,
    humanWallet,
    agentWallet,
    ethosProfileId,
    role: roleName,
    level: levelName,
    status: "active",
    createdAt: ts,
    updatedAt: ts,
  }).onConflictDoNothing().run();

  db.insert(scoreEvents).values({
    eventType: "link.created",
    entityType: "link",
    entityId: String(linkId),
    source: "link_registry",
    data: JSON.stringify({ agentTokenId, humanWallet, role: roleName, level: levelName }),
    createdAt: ts,
  }).run();

  eventBus.emit({
    type: "link.created",
    linkId,
    agentTokenId,
    humanWallet,
    agentWallet,
    role: roleName,
    level: levelName,
    timestamp: ts,
  });

  console.log(`  [LINKS] Link #${linkId} created: ${roleName} / ${levelName}`);
}

// ── Main poll loop ────────────────────────────────────────────────

async function poll() {
  if (!isRunning) return;

  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock = lastProcessedBlock > BigInt(0) ? lastProcessedBlock + BigInt(1) : currentBlock - BigInt(1000);
    const toBlock = fromBlock + BLOCK_BATCH > currentBlock ? currentBlock : fromBlock + BLOCK_BATCH;

    if (fromBlock > currentBlock) return;

    const logs = await client.getLogs({
      address: LINK_REGISTRY_ADDRESS as Address,
      event: AgentLinkedEvent,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      processAgentLinked(log as unknown as Log);
    }

    lastProcessedBlock = toBlock;
    saveLastBlock(toBlock);

    if (logs.length > 0) {
      console.log(`[LINKS] Block ${fromBlock}→${toBlock}: ${logs.length} link events`);
    }
  } catch (err) {
    console.error("[LINKS] Poll error:", (err as Error).message?.slice(0, 200));
  }
}

// ── Public API ────────────────────────────────────────────────────

export function startLinkIndexer() {
  if (isRunning) return;
  isRunning = true;
  lastProcessedBlock = getLastBlock();

  console.log(`[LINKS] Indexer started (from block ${lastProcessedBlock})`);
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopLinkIndexer() {
  isRunning = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  console.log("[LINKS] Indexer stopped");
}
