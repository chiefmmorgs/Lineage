/**
 * Ethos Network API client for Lineage platform.
 * Base URL: https://api.ethos.network/api/v2
 * Required header: X-Ethos-Client
 */

const API_BASE = "https://api.ethos.network/api/v2";
const CLIENT   = "lineage@0.1.0";

const HEADERS = {
  "X-Ethos-Client": CLIENT,
  "Accept": "application/json",
  "Content-Type": "application/json",
};

// ── Score levels ──────────────────────────────────────────────────

export type ScoreLevel =
  | "untrusted" | "questionable" | "neutral" | "known"
  | "established" | "reputable" | "exemplary"
  | "distinguished" | "revered" | "renowned";

export interface EthosScore {
  score: number;   // 0–2800
  level: ScoreLevel;
}

export interface EthosUser {
  id: number;
  profileId: number | null;
  displayName: string;
  username: string | null;
  avatarUrl: string;
  description: string | null;
  score: number;
  status: "ACTIVE" | "INACTIVE" | "MERGED";
  userkeys: string[];
  xpTotal: number;
  influenceFactor: number;
  humanVerificationStatus: "VERIFIED" | "REQUESTED" | "REVOKED" | null;
  links: { profile: string; scoreBreakdown: string };
  stats: {
    review: { received: { positive: number; neutral: number; negative: number } };
    vouch: {
      given:    { count: number; amountWeiTotal: number };
      received: { count: number; amountWeiTotal: number };
    };
  };
}

export interface EthosProfileEntry {
  profile: { id: number; archived: boolean; createdAt: number; invitesAvailable: number };
  user: EthosUser;
  inviterUser: EthosUser;
}

// ── Helpers ────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: HEADERS,
    next: { revalidate: 60 }, // cache 60s on server
  });
  if (!res.ok) throw new Error(`Ethos ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Ethos ${res.status}: ${path}`);
  return res.json();
}

// ── Public API ─────────────────────────────────────────────────────

/** GET /score/userkey?userkey=... */
export async function getScore(userkey: string): Promise<EthosScore | null> {
  try {
    return await get<EthosScore>(`/score/userkey?userkey=${encodeURIComponent(userkey)}`);
  } catch {
    return null;
  }
}

/** POST /profiles  — batch lookup by address or profileId */
export async function getProfiles(params: {
  ids?: number[];
  addresses?: string[];
  limit?: number;
}): Promise<{ values: EthosProfileEntry[]; total: number }> {
  return post("/profiles", { limit: 50, ...params });
}

/** Convenience: get a single profile by any userkey format */
export async function getProfileByUserkey(
  userkey: string
): Promise<EthosProfileEntry | null> {
  try {
    // Resolve from address or profileId
    if (userkey.startsWith("profileId:")) {
      const id = parseInt(userkey.split(":")[1]);
      const res = await getProfiles({ ids: [id], limit: 1 });
      return res.values[0] ?? null;
    }
    if (userkey.startsWith("address:")) {
      const addr = userkey.split(":")[1];
      const res = await getProfiles({ addresses: [addr], limit: 1 });
      return res.values[0] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/** GET /profiles/recent — discover latest profiles */
export async function getRecentProfiles(limit = 20): Promise<EthosProfileEntry[]> {
  try {
    const res = await get<{ values: EthosProfileEntry[] }>(`/profiles/recent?limit=${limit}`);
    return res.values;
  } catch {
    return [];
  }
}

// ── Score level metadata ──────────────────────────────────────────

export function scoreLevelMeta(level: ScoreLevel) {
  const map: Record<ScoreLevel, { label: string; color: string; glow: string }> = {
    untrusted:     { label: "Untrusted",     color: "#ef4444", glow: "#ef444433" },
    questionable:  { label: "Questionable",  color: "#f97316", glow: "#f9731633" },
    neutral:       { label: "Neutral",       color: "#94a3b8", glow: "#94a3b833" },
    known:         { label: "Known",         color: "#60a5fa", glow: "#60a5fa33" },
    established:   { label: "Established",   color: "#818cf8", glow: "#818cf833" },
    reputable:     { label: "Reputable",     color: "#a78bfa", glow: "#a78bfa33" },
    exemplary:     { label: "Exemplary",     color: "#c084fc", glow: "#c084fc33" },
    distinguished: { label: "Distinguished", color: "#e879f9", glow: "#e879f933" },
    revered:       { label: "Revered",       color: "#f0abfc", glow: "#f0abfc33" },
    renowned:      { label: "Renowned",      color: "#ffffff", glow: "#ffffff33" },
  };
  return map[level] ?? map["neutral"];
}

export function formatWei(wei: number): string {
  const eth = wei / 1e18;
  if (eth === 0) return "0 ETH";
  if (eth < 0.001) return `${(eth * 1000).toFixed(2)}m ETH`;
  return `${eth.toFixed(4)} ETH`;
}
