"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  readReputation,
  readFeedback,
  readAgent,
  REPUTATION_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ABI,
  type OnChainAgent,
  type OnChainFeedback,
  type OnChainReputation,
} from "@/lib/contracts";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type WalletClient } from "viem";
import { baseSepolia } from "viem/chains";

// ── Star renderer ──────────────────────────────────────────────
function Stars({ score, size = 18 }: { score: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            fontSize: size,
            color: i <= score ? "#facc15" : "var(--text-muted)",
            filter: i <= score ? "drop-shadow(0 0 4px rgba(250,204,21,0.4))" : "none",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ── Interactive star selector ──────────────────────────────────
function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: 4, cursor: "pointer" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            fontSize: 28,
            color: i <= (hover || value) ? "#facc15" : "var(--text-muted)",
            transition: "color 0.15s, transform 0.15s",
            transform: i <= hover ? "scale(1.15)" : "scale(1)",
            filter: i <= (hover || value) ? "drop-shadow(0 0 6px rgba(250,204,21,0.5))" : "none",
          }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReputationPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();

  // Search state
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<OnChainAgent | null>(null);
  const [reputation, setReputation] = useState<OnChainReputation | null>(null);
  const [feedback, setFeedback] = useState<OnChainFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Submit state
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const lookupAgent = useCallback(async (tokenId: number) => {
    setLoading(true);
    setError("");
    setSelectedAgent(null);
    setReputation(null);
    setFeedback([]);

    try {
      const agent = await readAgent(tokenId);
      if (!agent) {
        setError(`Agent #${tokenId} not found on the registry.`);
        return;
      }
      setSelectedAgent(agent);

      const [rep, fb] = await Promise.all([
        readReputation(tokenId),
        readFeedback(tokenId, 0, 50),
      ]);
      setReputation(rep);
      setFeedback(fb);
    } catch (e) {
      setError("Failed to read agent data. Check the token ID.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(tokenIdInput);
    if (isNaN(id) || id < 1) {
      setError("Enter a valid token ID (1 or higher).");
      return;
    }
    lookupAgent(id);
  };

  const submitReview = async () => {
    if (!selectedAgent) return;
    if (score < 1 || score > 5) { setSubmitMsg("Select a score (1–5)."); return; }
    if (!authenticated) { setSubmitMsg("Connect your wallet first."); return; }

    const wallet = wallets[0];
    if (!wallet) { setSubmitMsg("No wallet found."); return; }

    setSubmitting(true);
    setSubmitMsg("");

    try {
      const provider = await wallet.getEthereumProvider();
      const walletClient: WalletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.writeContract({
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "submitFeedback",
        args: [BigInt(selectedAgent.tokenId), score, comment],
        account,
        chain: baseSepolia,
      });

      setSubmitMsg(`✅ Review submitted! Tx: ${hash.slice(0, 16)}...`);
      setScore(0);
      setComment("");

      // Refresh data after a short delay
      setTimeout(() => lookupAgent(selectedAgent.tokenId), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setSubmitMsg(`❌ ${msg.slice(0, 100)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main>
      <section className="section" style={{ paddingTop: 48 }}>
        <div className="container">

          {/* Header */}
          <div className="section-header">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h1 className="section-title">Agent Reputation</h1>
                <p className="section-sub">
                  View trust scores and submit on-chain reviews for ERC-8004 agents ·{" "}
                  <a
                    href={`https://base-sepolia.blockscout.com/address/${REPUTATION_REGISTRY_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    ReputationRegistry ↗
                  </a>
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="tag">⭐ On-Chain Reviews</span>
                <span className="tag">🔴 Live from chain</span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="card" style={{ padding: 24, marginBottom: 32 }}>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>
                  Agent Token ID
                </label>
                <input
                  type="number"
                  min="1"
                  value={tokenIdInput}
                  onChange={(e) => setTokenIdInput(e.target.value)}
                  placeholder="e.g. 1"
                  className="input"
                  style={{ width: "100%" }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Loading..." : "Look Up Agent"}
              </button>
            </form>
            {error && (
              <p style={{ color: "#ef4444", marginTop: 12, fontSize: "0.875rem" }}>{error}</p>
            )}
          </div>

          {/* Agent Reputation Card */}
          {selectedAgent && reputation && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>

              {/* Agent Info */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                  <div
                    className="agent-avatar"
                    style={{ width: 48, height: 48, fontSize: "1.5rem" }}
                  >
                    {selectedAgent.image ? (
                      <img src={selectedAgent.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                    ) : "🤖"}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-head)", fontSize: "1.125rem" }}>
                      {selectedAgent.name || `Agent #${selectedAgent.tokenId}`}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Token #{selectedAgent.tokenId} ·{" "}
                      <Link href={`/agents/${selectedAgent.tokenId}`} style={{ color: "var(--accent)" }}>
                        View Profile →
                      </Link>
                    </div>
                  </div>
                </div>
                {selectedAgent.description && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 0 }}>
                    {selectedAgent.description}
                  </p>
                )}
              </div>

              {/* Reputation Score */}
              <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: "2.5rem", fontFamily: "var(--font-head)", fontWeight: 700 }}>
                  {reputation.reviewCount > 0
                    ? (reputation.averageScore / 100).toFixed(2)
                    : "—"}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Stars score={reputation.reviewCount > 0 ? Math.round(reputation.averageScore / 100) : 0} size={22} />
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 8 }}>
                  {reputation.reviewCount} review{reputation.reviewCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          )}

          {/* Submit Review */}
          {selectedAgent && (
            <div className="card" style={{ padding: 24, marginBottom: 32 }}>
              <h3 style={{ fontFamily: "var(--font-head)", fontSize: "1rem", marginBottom: 16 }}>
                Submit Review
              </h3>
              {!ready ? (
                <p style={{ color: "var(--text-muted)" }}>Loading wallet...</p>
              ) : !authenticated ? (
                <p style={{ color: "var(--text-secondary)" }}>
                  Connect your wallet (top-right) to submit a review.
                </p>
              ) : (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "block" }}>
                      Rating
                    </label>
                    <StarSelector value={score} onChange={setScore} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>
                      Comment (optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your experience with this agent..."
                      className="input"
                      rows={3}
                      style={{ width: "100%", resize: "vertical" }}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={submitReview}
                    disabled={submitting || score < 1}
                    style={{ minWidth: 160 }}
                  >
                    {submitting ? "Submitting..." : "Submit Review On-Chain"}
                  </button>
                  {submitMsg && (
                    <p style={{
                      marginTop: 12,
                      fontSize: "0.875rem",
                      color: submitMsg.startsWith("✅") ? "var(--green)" : "#ef4444",
                    }}>
                      {submitMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Review List */}
          {selectedAgent && feedback.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontFamily: "var(--font-head)", fontSize: "1rem", marginBottom: 16 }}>
                Reviews ({feedback.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {feedback.map((fb, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 16,
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Stars score={fb.score} size={14} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {fb.score}/5
                        </span>
                      </div>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {fb.reviewer.slice(0, 6)}…{fb.reviewer.slice(-4)}
                      </span>
                    </div>
                    {fb.comment && (
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                        {fb.comment}
                      </p>
                    )}
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 8 }}>
                      {new Date(fb.timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAgent && feedback.length === 0 && reputation && reputation.reviewCount === 0 && (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>📝</div>
              <p style={{ color: "var(--text-secondary)" }}>
                No reviews yet. Be the first to review this agent!
              </p>
            </div>
          )}

        </div>
      </section>
    </main>
  );
}
