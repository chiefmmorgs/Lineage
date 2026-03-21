/**
 * ============================================================
 *  Lineage — ERC-8004 Indexer
 * ============================================================
 *
 *  Watches on-chain events and emits to the event bus.
 *  Does NOT store agent data — that stays in ERC-8004/8004scan.
 *  Only stores score_events (audit trail) in our DB.
 * ============================================================
 */

import { createPublicClient, http, parseAbiItem, type Address, type Log } from "viem";
import { baseSepolia } from "viem/chains";
import { db, now } from "../../db/index";
import { externalSync, scoreEvents } from "../../db/schema";
import { eventBus } from "../events";
import { eq, and } from "drizzle-orm";
import { AGENT_REGISTRY_ADDRESS, REPUTATION_REGISTRY_ADDRESS } from "../../contracts";

// ── Config ────────────────────────────────────────────────────────

const CHAIN_ID = 84532;
const POLL_INTERVAL_MS = 15_000;
const BLOCK_BATCH = BigInt(500);

const client = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

// ── ABI event signatures ──────────────────────────────────────────

const RegisteredEvent = parseAbiItem(
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"
);

const FeedbackEvent = parseAbiItem(
  "event FeedbackSubmitted(uint256 indexed agentTokenId, address indexed reviewer, uint8 score, string comment)"
);

// ── Indexer state ─────────────────────────────────────────────────

let lastProcessedBlock = BigInt(0);
let isRunning = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function getLastBlock(): bigint {
  const result = db.select().from(externalSync)
    .where(and(eq(externalSync.source, "erc8004"), eq(externalSync.chainId, CHAIN_ID)))
    .get();
  return result ? BigInt(result.lastBlock) : BigInt(0);
}

function saveLastBlock(block: bigint) {
  const existing = db.select().from(externalSync)
    .where(and(eq(externalSync.source, "erc8004"), eq(externalSync.chainId, CHAIN_ID)))
    .get();
  const ts = now();
  if (existing) {
    db.update(externalSync)
      .set({ lastBlock: Number(block), lastSyncedAt: ts, status: "idle" })
      .where(eq(externalSync.id, existing.id))
      .run();
  } else {
    db.insert(externalSync).values({
      source: "erc8004", chainId: CHAIN_ID,
      lastBlock: Number(block), lastSyncedAt: ts, status: "idle",
    }).run();
  }
}

// ── Process events (emit only — no local storage of agents) ───────

function processRegistered(log: Log) {
  const agentId = log.topics[1] ? Number(BigInt(log.topics[1])) : 0;
  const owner = log.topics[2] ? ("0x" + log.topics[2].slice(26)).toLowerCase() : "";
  if (!agentId || !owner) return;

  const ts = now();
  db.insert(scoreEvents).values({
    eventType: "agent.registered", entityType: "agent",
    entityId: `${agentId}:${CHAIN_ID}`, source: "erc8004",
    data: JSON.stringify({ owner, blockNumber: Number(log.blockNumber) }),
    createdAt: ts,
  }).run();

  eventBus.emit({
    type: "agent.registered", agentTokenId: agentId,
    chainId: CHAIN_ID, owner, name: `Agent #${agentId}`, timestamp: ts,
  });
  console.log(`  [ERC-8004] Agent #${agentId} registered by ${owner.slice(0, 10)}…`);
}

function processFeedback(log: Log) {
  const agentTokenId = log.topics[1] ? Number(BigInt(log.topics[1])) : 0;
  const reviewer = log.topics[2] ? ("0x" + log.topics[2].slice(26)).toLowerCase() : "";
  if (!agentTokenId || !reviewer) return;

  let score = 3;
  let comment = "";
  try {
    if (log.data && log.data.length >= 66) {
      score = Number(BigInt("0x" + log.data.slice(2, 66)));
    }
  } catch { /* use defaults */ }

  const ts = now();
  db.insert(scoreEvents).values({
    eventType: "agent.feedback", entityType: "agent",
    entityId: `${agentTokenId}:${CHAIN_ID}`, source: "erc8004",
    data: JSON.stringify({ reviewer, score, blockNumber: Number(log.blockNumber) }),
    createdAt: ts,
  }).run();

  eventBus.emit({
    type: "agent.feedback", agentTokenId, chainId: CHAIN_ID,
    reviewer, score, comment, txHash: log.transactionHash || undefined, timestamp: ts,
  });
  console.log(`  [ERC-8004] Feedback on Agent #${agentTokenId}: ${score}/5 by ${reviewer.slice(0, 10)}…`);
}

// ── Main poll loop ────────────────────────────────────────────────

async function poll() {
  if (!isRunning) return;
  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock = lastProcessedBlock > BigInt(0)
      ? lastProcessedBlock + BigInt(1)
      : currentBlock - BigInt(1000);
    const toBlock = fromBlock + BLOCK_BATCH > currentBlock ? currentBlock : fromBlock + BLOCK_BATCH;
    if (fromBlock > currentBlock) return;

    const [registeredLogs, feedbackLogs] = await Promise.all([
      client.getLogs({ address: AGENT_REGISTRY_ADDRESS as Address, event: RegisteredEvent, fromBlock, toBlock }),
      client.getLogs({ address: REPUTATION_REGISTRY_ADDRESS as Address, event: FeedbackEvent, fromBlock, toBlock }),
    ]);

    for (const log of registeredLogs) processRegistered(log as unknown as Log);
    for (const log of feedbackLogs) processFeedback(log as unknown as Log);

    lastProcessedBlock = toBlock;
    saveLastBlock(toBlock);

    if (registeredLogs.length > 0 || feedbackLogs.length > 0) {
      console.log(`[ERC-8004] Block ${fromBlock}→${toBlock}: ${registeredLogs.length} registrations, ${feedbackLogs.length} feedbacks`);
    }
  } catch (err) {
    console.error("[ERC-8004] Poll error:", (err as Error).message?.slice(0, 200));
  }
}

// ── Public API ────────────────────────────────────────────────────

export function startERC8004Indexer() {
  if (isRunning) return;
  isRunning = true;
  lastProcessedBlock = getLastBlock();
  console.log(`[ERC-8004] Indexer started (from block ${lastProcessedBlock})`);
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopERC8004Indexer() {
  isRunning = false;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  console.log("[ERC-8004] Indexer stopped");
}
