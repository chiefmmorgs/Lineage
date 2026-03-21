"use client";

/**
 * ============================================================
 *  Creator: Link Your Agent — Mutual Verification Protocol
 * ============================================================
 *
 *  Supports three verification modes:
 *
 *    Mode A — Same Wallet (Level 3 automatically)
 *      Human wallet IS the agent wallet. One click signs and submits.
 *
 *    Mode B — Different Wallets (Level 1 → Level 3)
 *      Human wallet signs a Self Claim (Level 1).
 *      Agent Controller signs to Upgrade to Mutual Verification (Level 3).
 *
 *    Mode C — Renting (Level 3 with expiration)
 *      Same as Mode B, but with a time-bounded expiration.
 *
 *  All signing uses EIP-712 typed structured data.
 * ============================================================
 */

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEthosProfile } from "@/hooks/useEthosProfile";
import {
  createPublicClient, createWalletClient, custom, http,
  encodeFunctionData, parseAbi,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  LINK_REGISTRY_ADDRESS, AGENT_REGISTRY_ADDRESS,
  LINK_EIP712_DOMAIN, LINK_EIP712_TYPES,
  readNonce,
  resolveEns, resolveBasename, generateLinkHash,
} from "@/lib/contracts";

// ── Role definitions ─────────────────────────────────────────────

const ROLE_OPTIONS = [
  { label: "Creator",    value: 0, weight: "100%", desc: "You built it. Full accountability.", color: "#c084fc" },
  { label: "Operator",   value: 1, weight: "80%",  desc: "You run it. Accountable for live behavior.", color: "#818cf8" },
  { label: "Maintainer", value: 2, weight: "50%",  desc: "You maintain infra. Accountable for uptime.", color: "#60a5fa" },
  { label: "Delegate",   value: 3, weight: "30%",  desc: "Secondary operator. Limited accountability.", color: "#34d399" },
  { label: "Renter",     value: 4, weight: "Time-bound", desc: "Temporary operator. Link expires automatically.", color: "#f59e0b" },
];

// ── Contract ABI (write) ─────────────────────────────────────────

const REGISTRY_ABI = parseAbi([
  "function createVerifiedLink(address agentWallet, uint256 agentTokenId, uint256 ethosProfileId, uint8 role, uint256 expiration, uint256 deadline, bytes humanSignature, bytes agentSignature) returns (uint256)",
]);

// ── Expiration presets ───────────────────────────────────────────

const EXPIRATION_OPTIONS = [
  { label: "1 day",    seconds: 86400 },
  { label: "7 days",   seconds: 604800 },
  { label: "30 days",  seconds: 2592000 },
  { label: "90 days",  seconds: 7776000 },
  { label: "1 year",   seconds: 31536000 },
];

// ═════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════

export default function LinkAgentPage() {
  const { login, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { profile, loading: ethosLoading, walletAddress } = useEthosProfile();

  // Form state
  const [selectedRole, setSelectedRole] = useState(0);
  const [agentTokenId, setAgentTokenId] = useState("");
  const [agentWalletInput, setAgentWalletInput] = useState("");
  const [expirationIdx, setExpirationIdx] = useState(2); // default 30 days

  // My Agents — auto-fetched from 8004scan when wallet connects
  const [myAgents, setMyAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [fetchingAgent, setFetchingAgent] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchResults, setFetchResults] = useState<any[]>([]); // multi-chain results

  // Transaction state
  const [txState, setTxState] = useState<"idle" | "signing" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [createdLinkId, setCreatedLinkId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Domain resolution state
  const [domainInput, setDomainInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // ── Auto-fetch My Agents when wallet connects ──────────────
  useEffect(() => {
    if (!walletAddress) return;
    setLoadingAgents(true);
    fetch(`/api/my-agents?address=${walletAddress}`)
      .then(r => r.json())
      .then(data => {
        setMyAgents(data?.data ?? []);
      })
      .catch(() => setMyAgents([]))
      .finally(() => setLoadingAgents(false));
  }, [walletAddress]);

  function selectAgent(agent: any) {
    setSelectedAgent(agent);
    setAgentTokenId(agent.token_id);
    setAgentWalletInput(agent.owner_address);
    setFetchError(null);
    setFetchResults([]); // clear multi-results once selected
  }

  function clearAgent() {
    setSelectedAgent(null);
    setAgentTokenId("");
    setAgentWalletInput("");
    setFetchError(null);
    setFetchResults([]);
  }

  async function fetchAndSelectAgent() {
    if (!agentTokenId) return;
    setFetchingAgent(true);
    setFetchError(null);
    setFetchResults([]);
    try {
      const res = await fetch(`/api/fetch-agent?tokenId=${agentTokenId}`);
      if (res.ok) {
        const data = await res.json();
        const agents = data?.data ?? [];
        if (agents.length === 1) {
          // Only one match — select it directly
          selectAgent(agents[0]);
        } else if (agents.length > 1) {
          // Multiple matches — show picker
          setFetchResults(agents);
        } else {
          setFetchError(`Agent #${agentTokenId} not found on any chain.`);
        }
        return;
      }
      setFetchError(`Agent #${agentTokenId} not found on any chain.`);
    } catch {
      setFetchError("Failed to fetch agent. Check your connection.");
    } finally {
      setFetchingAgent(false);
    }
  }

  // Chain display helpers
  const chainColors: Record<number, string> = {
    1: "#627eea", 8453: "#3886f7", 56: "#f3ba2f", 42161: "#28a0f0",
    43114: "#e84142", 42220: "#35d07f", 84532: "#3886f7", 11155111: "#627eea",
    2741: "#7c3aed", 10: "#ff0420",
  };
  const chainNames: Record<number, string> = {
    1: "Ethereum", 8453: "Base", 56: "BNB Smart Chain", 42161: "Arbitrum",
    43114: "Avalanche", 42220: "Celo", 84532: "Base Sepolia", 11155111: "Eth Sepolia",
    2741: "Abstract", 10: "Optimism",
  };

  // Derived
  const addr = walletAddress ?? "0xYourWallet";
  const shortAddr = walletAddress ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "0xYour…Wallet";
  const profileId = profile?.profileId;
  const isRenter = selectedRole === 4;
  const agentWallet = agentWalletInput || addr; // defaults to own wallet
  const isSameWallet = agentWallet.toLowerCase() === addr.toLowerCase();
  const verificationLevel = isSameWallet ? "Level 3 (Mutual)" : "Level 1 (Self Claim)";

  const canSubmit = authenticated && profileId && agentTokenId && txState !== "signing" && txState !== "pending";

  // ── EIP-712 Sign & Submit ──────────────────────────────────

  async function submitLink() {
    if (!wallets.length || !profileId || !agentTokenId) return;

    try {
      setTxState("signing");
      setTxError(null);
      setTxHash(null);

      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();

      // Switch to Base Sepolia
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + baseSepolia.id.toString(16) }],
        });
      } catch (switchErr: unknown) {
        if ((switchErr as { code?: number })?.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x" + baseSepolia.id.toString(16),
              chainName: "Base Sepolia",
              rpcUrls: ["https://sepolia.base.org"],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              blockExplorerUrls: ["https://sepolia.basescan.org"],
            }],
          });
        }
      }

      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();

      // Build expiration
      const expiration = isRenter
        ? BigInt(Math.floor(Date.now() / 1000) + EXPIRATION_OPTIONS[expirationIdx].seconds)
        : BigInt(0);

      // Deadline = 1 hour from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Get nonce
      const nonce = await readNonce(account);

      // Build EIP-712 payload
      const message = {
        agentTokenId: BigInt(agentTokenId),
        ethosProfileId: BigInt(profileId),
        role: selectedRole,
        expiration,
        nonce,
        deadline,
      };

      // Sign EIP-712 typed data (human claim)
      const humanSignature = await walletClient.signTypedData({
        account,
        domain: { ...LINK_EIP712_DOMAIN },
        types: LINK_EIP712_TYPES,
        primaryType: "LinkAgent",
        message,
      });

      // If same wallet, the human IS the agent — sign again as agent confirmation
      let agentSignature: `0x${string}` = "0x";
      if (isSameWallet) {
        agentSignature = humanSignature; // Same signer = mutual verification
      }

      // Encode the createVerifiedLink call
      const data = encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "createVerifiedLink",
        args: [
          agentWallet as Address,
          BigInt(agentTokenId),
          BigInt(profileId),
          selectedRole,
          expiration,
          deadline,
          humanSignature,
          agentSignature,
        ],
      });

      setTxState("pending");

      const hash = await walletClient.sendTransaction({
        account,
        to: LINK_REGISTRY_ADDRESS as Address,
        data,
      });

      setTxHash(hash);

      // Wait for receipt and parse linkId from AgentLinked event
      try {
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http("https://sepolia.base.org"),
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        // AgentLinked event — linkId is the first indexed topic
        for (const log of receipt.logs) {
          if (log.topics[0] && log.topics[1]) {
            const parsedLinkId = Number(BigInt(log.topics[1]));
            if (parsedLinkId > 0) {
              setCreatedLinkId(parsedLinkId);
              break;
            }
          }
        }
      } catch {
        // Non-critical — tx already succeeded
      }

      setTxState("success");
    } catch (err: unknown) {
      console.error("Link transaction failed:", err);
      setTxError((err as Error)?.message?.slice(0, 300) || "Transaction failed");
      setTxState("error");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <main>
      <div className="container">

        {/* Back */}
        <div style={{ paddingTop: 32, marginBottom: 28 }}>
          <Link href="/creator" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: "0.875rem" }}>
            ← Creators
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>
            Mutual Verification Protocol
          </div>
          <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 14, lineHeight: 1.15 }}>
            Link your agent to your<br />
            <span style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-alt))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Ethos profile
            </span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.7, maxWidth: 620 }}>
            Create a cryptographically verified, on-chain attestation linking an ERC-8004 agent identity
            to your Ethos reputation profile. Both parties sign an EIP-712 message to prove the relationship.
          </p>
        </div>

        {/* ── Connected Profile Card ──────────────────────────── */}
        {authenticated && (
          <ProfileCard profile={profile} ethosLoading={ethosLoading} walletAddress={walletAddress} shortAddr={shortAddr} />
        )}

        {/* ── Not connected ───────────────────────────────────── */}
        {!authenticated && ready && (
          <div style={{ marginBottom: 40, padding: "32px", borderRadius: "var(--radius-lg)", background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.18)", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>⬡</div>
            <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "1rem", marginBottom: 8 }}>Connect your wallet to get started</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 20, maxWidth: 460, margin: "0 auto 20px" }}>
              Once connected, your Ethos profile will be detected automatically and the signing flow will begin.
            </p>
            <button onClick={() => login()} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>Connect wallet</button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            STEP 01 — Agent Identity
        ════════════════════════════════════════════════════ */}
        <StepCard n="01" color="var(--accent)" title="Identify the agent">

          {/* ══════════════════════════════════════════════════
              STATE B — Agent Confirmed (rich card)
          ═══════════════════════════════════════════════════ */}
          {selectedAgent ? (() => {
            const sa = selectedAgent;
            const color = chainColors[sa.chain_id] ?? "#888";
            const cName = chainNames[sa.chain_id] ?? `Chain ${sa.chain_id}`;
            const protocols: string[] = sa.supported_protocols ?? [];
            return (
              <div style={{ marginBottom: 8 }}>
                {/* Confirmed banner */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  marginBottom: 16, fontSize: "0.75rem", color: "#22c55e",
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
                    boxShadow: "0 0 8px rgba(34,197,94,0.5)",
                  }} />
                  Agent identified and verified via 8004scan
                </div>

                {/* Selected Agent Card */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(129,140,248,0.06), rgba(0,0,0,0.3))",
                  border: `2px solid ${color}44`,
                  borderRadius: 16, padding: "24px 28px",
                  position: "relative", overflow: "hidden",
                }}>
                  {/* Glow accent */}
                  <div style={{
                    position: "absolute", top: -40, right: -40,
                    width: 120, height: 120, borderRadius: "50%",
                    background: `${color}15`, filter: "blur(40px)",
                  }} />

                  <div style={{ display: "flex", gap: 20, alignItems: "flex-start", position: "relative" }}>
                    {/* Avatar */}
                    <div style={{
                      width: 64, height: 64, borderRadius: 14, flexShrink: 0,
                      background: sa.image_url && !sa.image_url.includes("example.com")
                        ? "transparent" : `linear-gradient(135deg, ${color}44, ${color}22)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.5rem", fontWeight: 700, color,
                      overflow: "hidden", border: `2px solid ${color}33`,
                    }}>
                      {sa.image_url && !sa.image_url.includes("example.com") ? (
                        <img src={sa.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (sa.name || "?")[0]}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name + token */}
                      <div style={{
                        fontFamily: "var(--font-head)", fontWeight: 700,
                        fontSize: "1.25rem", marginBottom: 4,
                        display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
                      }}>
                        <span>{sa.name || `Agent #${sa.token_id}`}</span>
                        <span style={{
                          fontSize: "0.75rem", color: "var(--text-muted)",
                          fontWeight: 400, fontFamily: "monospace",
                        }}>#{sa.token_id}</span>
                      </div>

                      {/* Chain badge */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "0.6875rem", padding: "3px 10px",
                          borderRadius: 6, fontWeight: 600,
                          background: `${color}22`, color,
                          display: "inline-flex", alignItems: "center", gap: 5,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                          {cName}
                        </span>
                        {protocols.length > 0 ? protocols.map(p => (
                          <span key={p} style={{
                            fontSize: "0.6rem", padding: "2px 7px", borderRadius: 4, fontWeight: 600,
                            background: p === "MCP" ? "rgba(129,140,248,0.15)" :
                              p === "A2A" ? "rgba(34,197,94,0.15)" :
                              p === "OASF" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)",
                            color: p === "MCP" ? "#818cf8" :
                              p === "A2A" ? "#22c55e" :
                              p === "OASF" ? "#f59e0b" : "var(--text-secondary)",
                          }}>{p}</span>
                        )) : (
                          <span style={{ fontSize: "0.6rem", padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>CUSTOM</span>
                        )}
                      </div>

                      {/* Wallet address */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: "0.75rem", color: "var(--text-muted)",
                      }}>
                        <span style={{ textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, fontSize: "0.625rem" }}>Wallet</span>
                        <span style={{ fontFamily: "monospace" }}>
                          {sa.owner_address?.slice(0, 10)}…{sa.owner_address?.slice(-6)}
                        </span>
                      </div>

                      {/* Description (if available) */}
                      {sa.description && (
                        <div style={{
                          marginTop: 8, fontSize: "0.75rem", color: "var(--text-secondary)",
                          lineHeight: 1.5, maxWidth: 500,
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {sa.description}
                        </div>
                      )}

                      {/* Stats row */}
                      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                        {[
                          { label: "Score", val: sa.total_score ? Math.round(sa.total_score) : 0, icon: "⚡" },
                          { label: "Feedback", val: sa.total_feedbacks ?? 0, icon: "💬" },
                          { label: "Stars", val: sa.star_count ?? 0, icon: "☆" },
                        ].map(s => (
                          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem" }}>
                            <span>{s.icon}</span>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.val}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.625rem" }}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Change button */}
                    <button
                      onClick={clearAgent}
                      style={{
                        padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                        background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
                        color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600,
                        whiteSpace: "nowrap", transition: "all 0.15s ease", flexShrink: 0,
                      }}
                    >
                      ✕ Change
                    </button>
                  </div>
                </div>

                {/* Verification level indicator */}
                {authenticated && isSameWallet && (
                  <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", fontSize: "0.8125rem", color: "var(--green)" }}>
                    ✓ Your wallet holds this agent — this will be a <strong>Level 3 Mutual Verification</strong> in a single signature.
                  </div>
                )}
                {authenticated && agentWalletInput && !isSameWallet && (
                  <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "0.8125rem", color: "#f59e0b" }}>
                    ⚠ Agent wallet differs from your connected wallet. This will create a <strong>Level 1 Self Claim</strong>.
                  </div>
                )}
              </div>
            );
          })() : (

          /* ══════════════════════════════════════════════════
              STATE A — Agent Selection (picker + manual)
          ═══════════════════════════════════════════════════ */
          <div>
            {/* ── My Agents — auto-discovered from 8004scan ── */}
            {authenticated && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: "var(--accent)" }}>
                    Your ERC-8004 Agents
                  </span>
                  {loadingAgents && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Loading…</span>}
                  {!loadingAgents && myAgents.length > 0 && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{myAgents.length} found across all chains</span>
                  )}
                </div>

                {!loadingAgents && myAgents.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                    {myAgents.map((a: any) => {
                      const color = chainColors[a.chain_id] ?? "#888";
                      return (
                        <button
                          key={a.agent_id}
                          onClick={() => selectAgent(a)}
                          style={{
                            padding: "12px 14px", borderRadius: "var(--radius-md)", textAlign: "left",
                            background: "rgba(0,0,0,0.2)",
                            border: "2px solid var(--border)",
                            cursor: "pointer", transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            {a.image_url && !a.image_url.includes("example.com") ? (
                              <img src={a.image_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color }}>
                                {(a.name || "?")[0]}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.8125rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {a.name || `Agent #${a.token_id}`}
                              </div>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                                <span style={{ color, fontWeight: 600 }}>{chainNames[a.chain_id] ?? `Chain ${a.chain_id}`}</span>
                                {" · "}#{a.token_id}
                              </div>
                            </div>
                          </div>
                          {a.supported_protocols?.length > 0 && (
                            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                              {a.supported_protocols.map((p: string) => (
                                <span key={p} style={{
                                  fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                                  background: p === "MCP" ? "rgba(129,140,248,0.12)" : p === "A2A" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                                  color: p === "MCP" ? "#818cf8" : p === "A2A" ? "#22c55e" : "#f59e0b",
                                }}>{p}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : !loadingAgents ? (
                  <div style={{ padding: "16px", borderRadius: "var(--radius-sm)", background: "rgba(0,0,0,0.2)", fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "center" }}>
                    No ERC-8004 agents found for this wallet. Enter an agent manually below, or register one on <a href="https://www.8004scan.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>8004scan.io</a>.
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Manual entry + Fetch ── */}
            <div style={{
              padding: "16px 20px", borderRadius: "var(--radius-md)",
              background: "rgba(0,0,0,0.15)", border: "1px solid var(--border)",
              marginBottom: 12,
            }}>
              <div style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600, marginBottom: 10 }}>
                Manual Entry
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <InputField
                  label="Agent Token ID"
                  value={agentTokenId}
                  onChange={(v) => setAgentTokenId(v.replace(/\D/g, ""))}
                  placeholder="e.g. 34897"
                  mono
                  style={{ width: 140 }}
                />
                <button
                  onClick={fetchAndSelectAgent}
                  disabled={!agentTokenId || fetchingAgent}
                  className="btn btn-ghost"
                  style={{
                    padding: "10px 20px", fontSize: "0.8125rem",
                    whiteSpace: "nowrap", marginBottom: 0,
                  }}
                >
                  {fetchingAgent ? "Searching…" : "Fetch Agent →"}
                </button>
              </div>
              {fetchError && (
                <div style={{ marginTop: 8, fontSize: "0.8125rem", color: "#ef4444" }}>
                  {fetchError}
                </div>
              )}

              {/* Multi-chain results picker */}
              {fetchResults.length > 1 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)",
                    marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", background: "var(--accent)",
                      boxShadow: "0 0 6px rgba(129,140,248,0.5)",
                    }} />
                    Found #{agentTokenId} on {fetchResults.length} chains — choose one:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {fetchResults.map((a: any) => {
                      const color = chainColors[a.chain_id] ?? "#888";
                      const cName = chainNames[a.chain_id] ?? `Chain ${a.chain_id}`;
                      const isTestnet = a.is_testnet;
                      return (
                        <button
                          key={a.agent_id}
                          onClick={() => selectAgent(a)}
                          style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 18px", borderRadius: 12, textAlign: "left",
                            background: "rgba(0,0,0,0.2)",
                            border: `2px solid ${color}44`,
                            cursor: "pointer", transition: "all 0.15s ease",
                            width: "100%",
                          }}
                        >
                          {/* Avatar */}
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            background: a.image_url && !a.image_url.includes("example.com")
                              ? "transparent" : `linear-gradient(135deg, ${color}44, ${color}22)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1rem", fontWeight: 700, color,
                            overflow: "hidden", border: `1px solid ${color}33`,
                          }}>
                            {a.image_url && !a.image_url.includes("example.com") ? (
                              <img src={a.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (a.name || "?")[0]}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.875rem",
                              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                            }}>
                              <span>{a.name || `Agent #${a.token_id}`}</span>
                              <span style={{
                                fontSize: "0.625rem", padding: "2px 8px",
                                borderRadius: 5, fontWeight: 600,
                                background: `${color}22`, color,
                                display: "inline-flex", alignItems: "center", gap: 4,
                              }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
                                {cName}
                              </span>
                              {isTestnet && (
                                <span style={{
                                  fontSize: "0.5625rem", padding: "1px 6px",
                                  borderRadius: 4, fontWeight: 600,
                                  background: "rgba(245,158,11,0.12)", color: "#f59e0b",
                                }}>
                                  TESTNET
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>
                              Owner: {a.owner_address?.slice(0, 10)}…{a.owner_address?.slice(-4)}
                            </div>
                          </div>

                          {/* Protocols */}
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {(a.supported_protocols || []).slice(0, 3).map((p: string) => (
                              <span key={p} style={{
                                fontSize: "0.5625rem", padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                                background: p === "MCP" ? "rgba(129,140,248,0.12)" : p === "A2A" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                                color: p === "MCP" ? "#818cf8" : p === "A2A" ? "#22c55e" : "#f59e0b",
                              }}>{p}</span>
                            ))}
                          </div>

                          {/* Select arrow */}
                          <span style={{ color: "var(--text-muted)", fontSize: "1.25rem", flexShrink: 0 }}>→</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Domain Name Resolution */}
            <div style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                🔗 Or resolve a domain name
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={domainInput}
                    onChange={(e) => { setDomainInput(e.target.value); setResolveError(null); }}
                    placeholder="name.eth or name.base.eth"
                    className="input"
                    style={{ width: "100%", fontFamily: "monospace", fontSize: "0.8125rem" }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={resolving || !domainInput.includes(".")}
                  onClick={async () => {
                    setResolving(true);
                    setResolveError(null);
                    try {
                      let address: string | null = null;
                      const name = domainInput.trim().toLowerCase();
                      if (name.endsWith(".base.eth")) {
                        address = await resolveBasename(name);
                      } else if (name.endsWith(".eth")) {
                        address = await resolveEns(name);
                      } else {
                        setResolveError("Supported: .eth and .base.eth domains");
                        setResolving(false);
                        return;
                      }
                      if (address) {
                        setAgentWalletInput(address);
                        setResolvedName(name);
                      } else {
                        setResolveError(`Could not resolve "${name}"`);
                      }
                    } catch {
                      setResolveError("Resolution failed. Try again.");
                    } finally {
                      setResolving(false);
                    }
                  }}
                  style={{ fontSize: "0.8125rem", padding: "8px 16px", whiteSpace: "nowrap" }}
                >
                  {resolving ? "Resolving…" : "Resolve →"}
                </button>
              </div>
              {resolvedName && (
                <div style={{ marginTop: 8, fontSize: "0.8125rem", color: "var(--green)" }}>
                  ✓ Resolved <strong>{resolvedName}</strong> → <span style={{ fontFamily: "monospace" }}>{agentWalletInput.slice(0, 10)}…</span>
                </div>
              )}
              {resolveError && (
                <div style={{ marginTop: 8, fontSize: "0.8125rem", color: "#ef4444" }}>
                  {resolveError}
                </div>
              )}
            </div>

            <Instruction style={{ marginTop: 16 }}>
              Don&apos;t have an agent yet? Register one on{" "}
              <ExtLink href="https://www.8004scan.io">
                8004scan.io
              </ExtLink>{" "}or directly on the{" "}
              <ExtLink href="https://etherscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#writeContract">
                ERC-8004 Identity Registry
              </ExtLink>.
            </Instruction>
          </div>
          )}
        </StepCard>

        {/* ════════════════════════════════════════════════════
            STEP 02 — Your Ethos Profile
        ════════════════════════════════════════════════════ */}
        <StepCard n="02" color="#60a5fa" title="Your Ethos Profile">
          {authenticated && profileId ? (
            <div style={{ padding: "14px 18px", borderRadius: "var(--radius-md)", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--green)", fontSize: "1.25rem" }}>✓</span>
              <div>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.9375rem" }}>
                  Profile ID: {profileId} — {profile?.displayName}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  Auto-detected from wallet {shortAddr}. Score: {profile?.score ?? "—"}.
                </div>
              </div>
            </div>
          ) : authenticated ? (
            <Instruction>
              No Ethos profile found for <Code>{shortAddr}</Code>.{" "}
              <ExtLink href="https://app.ethos.network">Create one on Ethos</ExtLink> first.
            </Instruction>
          ) : (
            <Instruction>Connect your wallet above to auto-detect your Ethos profile.</Instruction>
          )}
        </StepCard>

        {/* ════════════════════════════════════════════════════
            STEP 03 — Choose your role
        ════════════════════════════════════════════════════ */}
        <StepCard n="03" color="#c084fc" title="Choose your role">
          <Instruction>
            Select the role that best describes your relationship to the agent.
          </Instruction>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
            {ROLE_OPTIONS.map((r) => {
              const isSelected = selectedRole === r.value;
              return (
                <button key={r.value} onClick={() => setSelectedRole(r.value)} style={{
                  padding: "14px", borderRadius: "var(--radius-md)", textAlign: "left",
                  background: isSelected ? r.color + "20" : r.color + "08",
                  border: `2px solid ${isSelected ? r.color : r.color + "33"}`,
                  cursor: "pointer", transition: "all 0.15s ease",
                  transform: isSelected ? "scale(1.02)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${r.color}`, background: isSelected ? r.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isSelected && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.875rem", color: r.color }}>{r.label}</span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: 22 }}>Weight: {r.weight}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginLeft: 22, marginTop: 2 }}>{r.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Rental duration picker */}
          {isRenter && (
            <div style={{ marginTop: 16, padding: "16px 20px", borderRadius: "var(--radius-md)", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.875rem", color: "#f59e0b", marginBottom: 10 }}>
                ⏱ Rental Duration
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {EXPIRATION_OPTIONS.map((opt, i) => (
                  <button key={opt.label} onClick={() => setExpirationIdx(i)} style={{
                    padding: "8px 16px", borderRadius: "var(--radius-sm)",
                    background: expirationIdx === i ? "rgba(245,158,11,0.2)" : "rgba(0,0,0,0.2)",
                    border: `1px solid ${expirationIdx === i ? "#f59e0b" : "var(--border)"}`,
                    color: expirationIdx === i ? "#f59e0b" : "var(--text-secondary)",
                    fontSize: "0.8125rem", cursor: "pointer", fontWeight: expirationIdx === i ? 600 : 400,
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
                The link will automatically expire and become inactive after this period.
              </div>
            </div>
          )}
        </StepCard>

        {/* ════════════════════════════════════════════════════
            STEP 04 — Sign & Submit
        ════════════════════════════════════════════════════ */}
        <StepCard n="04" color="#34d399" title="Sign & submit the link" last>
          <Instruction>
            Your wallet will prompt you to sign an EIP-712 typed message. This is <strong>not</strong> a transfer — it
            creates a verifiable attestation on-chain.
          </Instruction>

          {/* Transaction summary */}
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            <ParamRow label="Your wallet" value={addr} highlight />
            <ParamRow label="Agent wallet" value={agentWallet} highlight={isSameWallet} warn={!isSameWallet && !!agentWalletInput} />
            <ParamRow label="Agent tokenId" value={agentTokenId || "—"} warn={!agentTokenId} />
            <ParamRow label="Ethos Profile" value={profileId ? `${profileId} (${profile?.displayName})` : "—"} warn={!profileId} />
            <ParamRow label="Role" value={ROLE_OPTIONS[selectedRole].label} />
            <ParamRow label="Verification" value={verificationLevel} />
            {isRenter && <ParamRow label="Expires" value={EXPIRATION_OPTIONS[expirationIdx].label + " from now"} />}
            <ParamRow label="Network" value="Base Sepolia" />
          </div>

          {/* Warnings */}
          {authenticated && !agentTokenId && (
            <WarningBox>Enter your agent&apos;s tokenId in Step 01 above.</WarningBox>
          )}
          {authenticated && !profileId && !ethosLoading && (
            <WarningBox>No Ethos profile found. <a href="https://app.ethos.network" target="_blank" rel="noopener noreferrer" style={{ color: "#eab308", textDecoration: "underline" }}>Create one</a> first.</WarningBox>
          )}

          {/* Submit */}
          {authenticated ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <button
                onClick={submitLink}
                disabled={!canSubmit}
                className="btn btn-primary"
                style={{ fontSize: "1rem", padding: "14px 32px", width: "100%", justifyContent: "center", opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed" }}
              >
                {txState === "signing" ? "✍️ Sign in your wallet…"
                  : txState === "pending" ? "⏳ Broadcasting…"
                  : txState === "success" ? "✅ Link created!"
                  : isSameWallet
                    ? "🔗 Sign & submit (Mutual Verification)"
                    : "✍️ Sign & submit (Self Claim)"}
              </button>

              {txState === "success" && txHash && (
                <SuccessBox>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, color: "var(--green)", marginBottom: 6 }}>
                    {isSameWallet ? "✓ Mutually verified link created!" : "✓ Self Claim submitted!"}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                    {isSameWallet
                      ? "Your agent is now linked to your Ethos profile with Level 3 Mutual Verification."
                      : "The agent owner can now sign to upgrade this to Level 3 Mutual Verification."}
                  </div>
                  <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 500, wordBreak: "break-all" }}>
                    View transaction on Basescan ↗
                  </a>

                  {/* ── Shareable link for agent owner ── */}
                  {!isSameWallet && createdLinkId && (
                    <div style={{ marginTop: 16, padding: "16px 20px", borderRadius: "var(--radius-md)", background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)" }}>
                      <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.8125rem", color: "var(--accent)", marginBottom: 8 }}>
                        🔗 Upgrade to Level 3 — Mutual Verification
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 10 }}>
                        Send the upgrade link to the agent wallet owner (<span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{agentWallet.slice(0, 6)}…{agentWallet.slice(-4)}</span>).
                        They can upgrade via browser, Node.js script, or share with a third party.
                      </div>

                      {/* Copyable upgrade URL */}
                      <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 12 }}>
                        <div style={{
                          flex: 1, padding: "10px 14px", borderRadius: 8,
                          background: "var(--bg-subtle)", border: "1px solid var(--border)",
                          fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                          color: "var(--text-primary)", wordBreak: "break-all",
                          display: "flex", alignItems: "center",
                        }}>
                          {(() => {
                            let secureHashUrl = `/upgrade?linkId=${createdLinkId}`;
                            try {
                              const fauxLink = {
                                linkId: createdLinkId,
                                agentWallet,
                                agentTokenId: Number(agentTokenId),
                                humanWallet: walletAddress,
                                ethosProfileId: Number(profileId)
                              } as any;
                              secureHashUrl = `/upgrade?linkId=${generateLinkHash(fauxLink)}`;
                            } catch { /* fallback */ }
                            return typeof window !== "undefined" ? `${window.location.origin}${secureHashUrl}` : secureHashUrl;
                          })()}
                        </div>
                        <button
                          onClick={() => {
                            let secureHashUrl = `/upgrade?linkId=${createdLinkId}`;
                            try {
                              const fauxLink = {
                                linkId: createdLinkId,
                                agentWallet,
                                agentTokenId: Number(agentTokenId),
                                humanWallet: walletAddress,
                                ethosProfileId: Number(profileId)
                              } as any;
                              secureHashUrl = `/upgrade?linkId=${generateLinkHash(fauxLink)}`;
                            } catch { /* fallback */ }
                            const url = `${window.location.origin}${secureHashUrl}`;
                            navigator.clipboard.writeText(url);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="btn btn-ghost"
                          style={{ padding: "10px 16px", fontSize: "0.8125rem", whiteSpace: "nowrap" }}
                        >
                          {copied ? "✓ Copied!" : "📋 Copy"}
                        </button>
                      </div>

                      {/* Upgrade & Explorer links */}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <Link
                          href={(() => {
                            try {
                              const fauxLink = { linkId: createdLinkId, agentWallet, agentTokenId: Number(agentTokenId), humanWallet: walletAddress, ethosProfileId: Number(profileId) } as any;
                              return `/upgrade?linkId=${generateLinkHash(fauxLink)}`;
                            } catch {
                              return `/upgrade?linkId=${createdLinkId}`;
                            }
                          })()}
                          className="btn btn-primary"
                          style={{ fontSize: "0.8125rem", padding: "8px 18px" }}
                        >
                          Open Upgrade Page →
                        </Link>
                        <Link
                          href={`/explorer/link/${createdLinkId}`}
                          className="btn btn-ghost"
                          style={{ fontSize: "0.8125rem", padding: "8px 18px" }}
                        >
                          View Link #{createdLinkId} in Explorer
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Explorer link for mutual verification */}
                  {isSameWallet && createdLinkId && (
                    <div style={{ marginTop: 12 }}>
                      <Link href={`/explorer/link/${createdLinkId}`} style={{ fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 500 }}>
                        View Link #{createdLinkId} in Explorer →
                      </Link>
                    </div>
                  )}
                </SuccessBox>
              )}

              {txState === "error" && txError && (
                <ErrorBox>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, color: "var(--red)", marginBottom: 6 }}>Transaction failed</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", wordBreak: "break-all", marginBottom: 8 }}>{txError}</div>
                  <button onClick={submitLink} className="btn btn-ghost" style={{ fontSize: "0.8125rem" }}>Try again</button>
                </ErrorBox>
              )}
            </div>
          ) : (
            <button onClick={() => login()} className="btn btn-primary" style={{ fontSize: "0.875rem", marginTop: 8 }}>Connect wallet to submit</button>
          )}

          {/* Multi-wallet explanation */}
          {authenticated && !isSameWallet && agentWalletInput && txState !== "success" && (
            <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: "var(--radius-md)", background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)" }}>
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.875rem", marginBottom: 8 }}>
                🔄 Upgrading to Level 3
              </div>
              <Instruction>
                After you submit your Self Claim, the agent owner ({agentWallet.slice(0, 6)}…{agentWallet.slice(-4)}) must:
              </Instruction>
              <ol style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", lineHeight: 1.8, paddingLeft: 20, marginTop: 4 }}>
                <li>Connect their wallet on this page</li>
                <li>Navigate to the &quot;Pending Links&quot; section (coming soon)</li>
                <li>Sign the same EIP-712 payload to upgrade to Level 3</li>
              </ol>
            </div>
          )}
        </StepCard>

        <div style={{ height: 80 }} />
      </div>
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════

function ProfileCard({ profile, ethosLoading, walletAddress, shortAddr }: {
  profile: ReturnType<typeof useEthosProfile>["profile"];
  ethosLoading: boolean;
  walletAddress: string | null;
  shortAddr: string;
}) {
  return (
    <div style={{
      marginBottom: 40, padding: "24px 28px", borderRadius: "var(--radius-lg)",
      background: profile ? "rgba(34,197,94,0.06)" : "rgba(129,140,248,0.06)",
      border: `1px solid ${profile ? "rgba(34,197,94,0.2)" : "rgba(129,140,248,0.18)"}`,
    }}>
      {ethosLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-card)" }} />
          <div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Looking up your Ethos profile…</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace", marginTop: 4 }}>{walletAddress}</div>
          </div>
        </div>
      ) : profile ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", border: "2px solid var(--border)" }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, var(--accent), var(--accent-alt))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "1rem" }}>{profile.displayName}</span>
              {profile.username && <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>@{profile.username}</span>}
              <span className="tag" style={{ color: "var(--green)", borderColor: "#22c55e44", background: "#22c55e11" }}>● Ethos connected</span>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.8125rem" }}>
              {profile.profileId && <span style={{ color: "var(--text-secondary)" }}>Profile ID: <strong style={{ color: "var(--text-primary)" }}>{profile.profileId}</strong></span>}
              {profile.score != null && (
                <span style={{ color: "var(--text-secondary)" }}>
                  Score: <strong style={{ color: levelColor(profile.level) }}>{profile.score}</strong>
                  {profile.level && <span style={{ marginLeft: 6, color: levelColor(profile.level), textTransform: "capitalize" }}>({profile.level})</span>}
                </span>
              )}
              <a href={profile.ethosUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 500 }}>View on Ethos ↗</a>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(129,140,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>⬡</div>
          <div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: 4 }}>No Ethos profile found for this wallet</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{walletAddress}</div>
            <a href="https://app.ethos.network" target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 500, marginTop: 6, display: "inline-block" }}>
              Create an Ethos profile →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function StepCard({ n, color, title, last, children }: { n: string; color: string; title: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 32, borderLeft: `3px solid ${color}`, marginBottom: last ? 0 : 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
        <div style={{ fontFamily: "var(--font-head)", fontSize: "1.625rem", fontWeight: 700, color, opacity: 0.5, flexShrink: 0, lineHeight: 1 }}>{n}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "1.0625rem", marginBottom: 12 }}>{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

function Instruction({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.7, marginBottom: 12, ...style }}>{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 4, padding: "2px 6px", fontSize: "0.8125rem", fontFamily: "monospace", color: "#e2e8f0" }}>{children}</code>;
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 500 }}>{children} ↗</a>;
}

function InputField({ label, value, onChange, placeholder, mono, style }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; mono?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          padding: "10px 14px", color: "var(--text-primary)", fontSize: "0.875rem",
          fontFamily: mono ? "monospace" : "inherit", width: "100%", outline: "none",
        }}
      />
    </div>
  );
}

function ParamRow({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderRadius: 6,
      background: highlight ? "rgba(129,140,248,0.08)" : "rgba(0,0,0,0.2)", marginBottom: 4,
      fontSize: "0.8125rem", fontFamily: "monospace",
      borderLeft: warn ? "3px solid #eab308" : highlight ? "3px solid var(--accent)" : "3px solid transparent",
    }}>
      <span style={{ color: "var(--text-muted)", minWidth: 130 }}>{label}:</span>
      <span style={{ color: warn ? "#eab308" : "#e2e8f0", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", marginBottom: 16, fontSize: "0.8125rem", color: "#eab308" }}>
      ⚠ {children}
    </div>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "16px 20px", borderRadius: "var(--radius-md)", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>{children}</div>;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "16px 20px", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{children}</div>;
}

function levelColor(level: string | null | undefined): string {
  const map: Record<string, string> = {
    untrusted: "#ef4444", questionable: "#f97316", neutral: "#94a3b8",
    known: "#60a5fa", established: "#818cf8", reputable: "#a78bfa",
    exemplary: "#c084fc", distinguished: "#e879f9", revered: "#f0abfc", renowned: "#ffffff",
  };
  return map[level ?? ""] ?? "#818cf8";
}
