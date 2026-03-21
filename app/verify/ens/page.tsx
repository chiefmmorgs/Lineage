"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Link from "next/link";

export default function VerifyEnsPage() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const [agentTokenId, setAgentTokenId] = useState("");
  const [ensName, setEnsName] = useState("");
  const [role, setRole] = useState<"creator" | "operator" | "owner">("creator");
  const [status, setStatus] = useState<"idle" | "signing" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [proofResult, setProofResult] = useState<{
    ensName: string;
    role: string;
    agentTokenId: number;
  } | null>(null);

  async function handleVerify() {
    if (!authenticated || wallets.length === 0) {
      login();
      return;
    }

    if (!agentTokenId || !ensName) {
      setStatus("error");
      setMessage("Please fill in both Agent Token ID and ENS Name.");
      return;
    }

    if (!ensName.endsWith(".eth")) {
      setStatus("error");
      setMessage("ENS name must end with .eth");
      return;
    }

    const wallet = wallets[0];

    try {
      // Step 1: Sign the proof message
      setStatus("signing");
      setMessage(`Sign the message to prove you control ${ensName}...`);

      const provider = await wallet.getEthereumProvider();
      const proofMessage = `I verify ownership of agent #${agentTokenId} via ${ensName}`;

      const signature = await provider.request({
        method: "personal_sign",
        params: [proofMessage, wallet.address],
      });

      // Step 2: Submit to API for verification
      setStatus("verifying");
      setMessage("Verifying ENS ownership on-chain...");

      const res = await fetch("/api/verify-ens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentTokenId: Number(agentTokenId),
          ensName: ensName.toLowerCase().trim(),
          wallet: wallet.address,
          signature,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Verification failed");
        return;
      }

      setStatus("success");
      setMessage(`Verified owner of agent #${agentTokenId} via ENS: ${ensName}`);
      setProofResult(data.proof);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }

  return (
    <main>
      <div className="container" style={{ maxWidth: 640, paddingTop: 48, paddingBottom: 80 }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <Link href="/agents" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: "0.875rem", marginBottom: 20, display: "inline-block" }}>
            ← Back
          </Link>
          <h1 style={{ fontFamily: "var(--font-head)", fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 8 }}>
            Verify via ENS
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
            Prove you control a named wallet by signing a message with the wallet that owns your ENS name.
            This lets users see not only the agent identity, but also the person publicly tied to it.
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginTop: 8 }}>
            ENS proves control of the named wallet, not legal identity.
          </p>
        </div>

        {/* Form */}
        <div className="card" style={{ padding: 28 }}>

          {/* Agent Token ID */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              Agent Token ID
            </label>
            <input
              type="number"
              value={agentTokenId}
              onChange={(e) => setAgentTokenId(e.target.value)}
              placeholder="e.g., 1"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                color: "var(--text-primary)", fontSize: "0.9375rem",
                outline: "none",
              }}
            />
          </div>

          {/* ENS Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              ENS Name
            </label>
            <input
              type="text"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value)}
              placeholder="e.g., chief.eth"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                color: "var(--text-primary)", fontSize: "0.9375rem",
                outline: "none",
              }}
            />
          </div>

          {/* Role */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              Your Role
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {([
                { value: "creator", label: "Creator", desc: "I built this agent" },
                { value: "operator", label: "Operator", desc: "I run this agent" },
                { value: "owner", label: "Owner", desc: "I own the NFT" },
              ] as const).map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10,
                    border: `1px solid ${role === r.value ? "var(--accent)" : "var(--border)"}`,
                    background: role === r.value ? "rgba(129,140,248,0.08)" : "transparent",
                    color: role === r.value ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div>{r.label}</div>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 400, marginTop: 2, opacity: 0.7 }}>
                    {r.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div style={{
            padding: 16, borderRadius: 10,
            background: "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.15)",
            marginBottom: 24,
          }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>
              How it works
            </div>
            <ol style={{
              fontSize: "0.8125rem", color: "var(--text-secondary)",
              lineHeight: 1.7, paddingLeft: 16, margin: 0,
            }}>
              <li>Connect the wallet that owns or controls the ENS name</li>
              <li>Sign a message to prove you control that wallet</li>
              <li>We resolve your ENS name on-chain and verify the match</li>
              <li>Your proof appears on the agent&apos;s profile card</li>
            </ol>
          </div>

          {/* Submit button */}
          {!authenticated ? (
            <button type="button" onClick={login} className="btn btn-primary" style={{ width: "100%", padding: "12px 0" }}>
              Connect Wallet to Verify
            </button>
          ) : (
            <button
              type="button"
              onClick={handleVerify}
              disabled={status === "signing" || status === "verifying"}
              className="btn btn-primary"
              style={{
                width: "100%", padding: "12px 0",
                opacity: status === "signing" || status === "verifying" ? 0.6 : 1,
              }}
            >
              {status === "signing" ? "Signing message..." :
               status === "verifying" ? "Verifying on-chain..." :
               "Sign & Verify ENS Proof"}
            </button>
          )}

          {/* Status message */}
          {message && (
            <div style={{
              marginTop: 16, padding: 14, borderRadius: 10,
              fontSize: "0.875rem", lineHeight: 1.5,
              background: status === "success" ? "rgba(34,197,94,0.08)" :
                         status === "error" ? "rgba(239,68,68,0.08)" :
                         "rgba(129,140,248,0.08)",
              border: `1px solid ${
                status === "success" ? "rgba(34,197,94,0.2)" :
                status === "error" ? "rgba(239,68,68,0.2)" :
                "rgba(129,140,248,0.2)"
              }`,
              color: status === "success" ? "#22c55e" :
                     status === "error" ? "#ef4444" :
                     "var(--accent)",
            }}>
              {message}
            </div>
          )}

          {/* Success result */}
          {proofResult && (
            <div style={{
              marginTop: 20, padding: 20, borderRadius: 12,
              background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)",
            }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#22c55e", marginBottom: 10 }}>
                ✓ PROOF VERIFIED
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Agent</span>
                  <span style={{ fontWeight: 600 }}>#{proofResult.agentTokenId}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>ENS Name</span>
                  <span style={{ fontWeight: 600 }}>{proofResult.ensName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Role</span>
                  <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{proofResult.role}</span>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Link
                  href={`/agents/${proofResult.agentTokenId}`}
                  className="btn btn-ghost"
                  style={{ fontSize: "0.8125rem", padding: "8px 16px" }}
                >
                  View Agent Profile →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
