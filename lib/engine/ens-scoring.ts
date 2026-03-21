/**
 * ============================================================
 *  Lineage — ENS Fixed-Point Scoring
 * ============================================================
 *
 *  Adds up to 20 direct points to Human Trust:
 *
 *    1. Base ENS Verification:            +5 points
 *    2. Wallet Balance (on ENS chain):  0–5 points
 *    3. Transaction Activity:           0–5 points
 *    4. Full Activity Bonus:            0–5 points
 *
 *  Uses Etherscan API (works across all EVM chains).
 *  Nothing is stored locally.
 * ============================================================
 */

// ── Etherscan API key (works for all EVM chains) ──────────────────

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || "X365F9KNZAZ9NCYQZESSABNB6R2SER3S1S";

// ── Chain → Etherscan API base URL mapping ────────────────────────

interface ChainConfig {
  name: string;
  api: string;
  nativeSymbol: string;
}

const CHAIN_CONFIG: Record<number, ChainConfig> = {
  1: {
    name: "Ethereum",
    api: "https://api.etherscan.io/api",
    nativeSymbol: "ETH",
  },
  8453: {
    name: "Base",
    api: "https://api.basescan.org/api",
    nativeSymbol: "ETH",
  },
  84532: {
    name: "Base Sepolia",
    api: "https://api-sepolia.basescan.org/api",
    nativeSymbol: "ETH",
  },
  10: {
    name: "Optimism",
    api: "https://api-optimistic.etherscan.io/api",
    nativeSymbol: "ETH",
  },
  42161: {
    name: "Arbitrum",
    api: "https://api.arbiscan.io/api",
    nativeSymbol: "ETH",
  },
  137: {
    name: "Polygon",
    api: "https://api.polygonscan.com/api",
    nativeSymbol: "MATIC",
  },
  56: {
    name: "BNB Chain",
    api: "https://api.bscscan.com/api",
    nativeSymbol: "BNB",
  },
  43114: {
    name: "Avalanche",
    api: "https://api.snowtrace.io/api",
    nativeSymbol: "AVAX",
  },
  250: {
    name: "Fantom",
    api: "https://api.ftmscan.com/api",
    nativeSymbol: "FTM",
  },
  42220: {
    name: "Celo",
    api: "https://api.celoscan.io/api",
    nativeSymbol: "CELO",
  },
  324: {
    name: "zkSync Era",
    api: "https://api-era.zksync.network/api",
    nativeSymbol: "ETH",
  },
  59144: {
    name: "Linea",
    api: "https://api.lineascan.build/api",
    nativeSymbol: "ETH",
  },
  534352: {
    name: "Scroll",
    api: "https://api.scrollscan.com/api",
    nativeSymbol: "ETH",
  },
};

const DEFAULT_CHAIN = 1;

// ── ENS Score Result ──────────────────────────────────────────────

export interface ENSScore {
  total: number;          // 0–20
  verified: number;       // 0 or 5
  balance: number;        // 0, 2, 3, or 5
  activity: number;       // 0, 2, or 5
  bonus: number;          // 0 or 5
  ensName: string;
  chainId: number;
  chainName: string;
  walletBalance: number;  // USD equivalent
  txCount: number;
  breakdown: string[];
}

// ── Etherscan: Fetch wallet balance (in USD) ──────────────────────

async function fetchWalletBalanceUSD(wallet: string, chainId: number): Promise<number> {
  const config = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[DEFAULT_CHAIN];

  try {
    // Get native balance in Wei
    const balanceRes = await fetch(
      `${config.api}?module=account&action=balance&address=${wallet}&tag=latest&apikey=${ETHERSCAN_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!balanceRes.ok) return 0;
    const balanceData = await balanceRes.json();
    if (balanceData.status !== "1") return 0;

    const weiBalance = Number(balanceData.result);
    const nativeBalance = weiBalance / 1e18;

    // Get native token price in USD
    const price = await fetchNativePrice(chainId);
    return nativeBalance * price;
  } catch {
    return 0;
  }
}

/** Fetch native token price via CoinGecko (free, no key needed) */
async function fetchNativePrice(chainId: number): Promise<number> {
  const tokenMap: Record<number, string> = {
    1: "ethereum", 8453: "ethereum", 84532: "ethereum",
    10: "ethereum", 42161: "ethereum", 324: "ethereum",
    59144: "ethereum", 534352: "ethereum",
    137: "matic-network", 56: "binancecoin",
    43114: "avalanche-2", 250: "fantom", 42220: "celo",
  };
  const fallbacks: Record<number, number> = {
    137: 0.5, 56: 300, 43114: 20, 250: 0.3, 42220: 0.5,
  };

  try {
    const tokenId = tokenMap[chainId] || "ethereum";
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return fallbacks[chainId] ?? 2000;
    const data = await res.json();
    return data?.[tokenId]?.usd ?? (fallbacks[chainId] ?? 2000);
  } catch {
    return fallbacks[chainId] ?? 2000;
  }
}

// ── Etherscan: Fetch transaction count ────────────────────────────

async function fetchTxCount(wallet: string, chainId: number): Promise<number> {
  const config = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[DEFAULT_CHAIN];

  try {
    // Get normal (external) transaction list — Etherscan returns up to 10000
    // We use page=1&offset=1 with sort=asc to get the total count efficiently
    const res = await fetch(
      `${config.api}?module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${ETHERSCAN_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return 0;
    const data = await res.json();

    // If status is "1", transactions exist — use internal tx count method
    if (data.status === "1") {
      // Fetch actual count via proxy (getTransactionCount = nonce = outgoing txns)
      const countRes = await fetch(
        `${config.api}?module=proxy&action=eth_getTransactionCount&address=${wallet}&tag=latest&apikey=${ETHERSCAN_KEY}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!countRes.ok) return 0;
      const countData = await countRes.json();
      return Number(BigInt(countData?.result ?? "0x0"));
    }

    return 0;
  } catch {
    return 0;
  }
}

// ── Core scoring function ─────────────────────────────────────────

/**
 * Calculate ENS fixed-point score (max 20 points).
 *
 * @param wallet   The wallet address linked to the ENS name
 * @param ensName  The verified ENS name (e.g., "chief.eth")
 * @param chainId  The chain to evaluate balance and activity on
 */
export async function calculateENSScore(
  wallet: string,
  ensName: string,
  chainId: number,
): Promise<ENSScore> {
  const config = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[DEFAULT_CHAIN];
  const breakdown: string[] = [];

  // ── 1. Base ENS Verification: +5 ───────────────────────────────
  let verified = 0;
  if (ensName && ensName.length > 0) {
    verified = 5;
    breakdown.push(`✅ ENS verified: ${ensName} (+5)`);
  } else {
    breakdown.push("❌ No verified ENS name (+0)");
    return {
      total: 0, verified: 0, balance: 0, activity: 0, bonus: 0,
      ensName: "", chainId, chainName: config.name,
      walletBalance: 0, txCount: 0, breakdown,
    };
  }

  // Fetch balance and tx count in parallel via Etherscan
  const [walletBalance, txCount] = await Promise.all([
    fetchWalletBalanceUSD(wallet, chainId),
    fetchTxCount(wallet, chainId),
  ]);

  // ── 2. Wallet Balance: 0–5 ────────────────────────────────────
  let balancePoints = 0;
  if (walletBalance >= 1000) {
    balancePoints = 5;
    breakdown.push(`💰 Balance: ~$${Math.round(walletBalance)} (≥$1000) (+5)`);
  } else if (walletBalance >= 500) {
    balancePoints = 3;
    breakdown.push(`💰 Balance: ~$${Math.round(walletBalance)} (≥$500) (+3)`);
  } else if (walletBalance >= 200) {
    balancePoints = 2;
    breakdown.push(`💰 Balance: ~$${Math.round(walletBalance)} (≥$200) (+2)`);
  } else {
    breakdown.push(`💰 Balance: ~$${Math.round(walletBalance)} (<$200) (+0)`);
  }

  // ── 3. Transaction Activity: 0–5 ──────────────────────────────
  let activityPoints = 0;
  if (txCount >= 1000) {
    activityPoints = 5;
    breakdown.push(`📊 Transactions: ${txCount} (≥1000) (+5)`);
  } else if (txCount >= 500) {
    activityPoints = 2;
    breakdown.push(`📊 Transactions: ${txCount} (≥500) (+2)`);
  } else {
    breakdown.push(`📊 Transactions: ${txCount} (<500) (+0)`);
  }

  // ── 4. Full Activity Bonus: 0 or 5 ─────────────────────────────
  let bonusPoints = 0;
  if (balancePoints === 5 && activityPoints === 5) {
    bonusPoints = 5;
    breakdown.push("🏆 Full activity bonus: highest balance + highest activity (+5)");
  }

  const total = verified + balancePoints + activityPoints + bonusPoints;
  breakdown.push(`   Total ENS Score: ${total}/20`);

  return {
    total, verified,
    balance: balancePoints,
    activity: activityPoints,
    bonus: bonusPoints,
    ensName, chainId, chainName: config.name,
    walletBalance: Math.round(walletBalance * 100) / 100,
    txCount, breakdown,
  };
}
