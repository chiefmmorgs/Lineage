"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient, createWalletClient, custom, http,
  encodeFunctionData, parseAbi,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import { AGENT_REGISTRY_ADDRESS } from "@/lib/contracts";

const REGISTRY_ABI = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function register() returns (uint256 agentId)",
]);

export default function RegisterAgentPage() {
  const { login, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();

  // Form fields
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [agentImage, setAgentImage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [webEndpoint, setWebEndpoint] = useState("");
  const [a2aEndpoint, setA2aEndpoint] = useState("");
  const [mcpEndpoint, setMcpEndpoint] = useState("");

  // Transaction state
  const [txState, setTxState] = useState<"idle" | "signing" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;

      // Resize via canvas to keep on-chain data small
      const img = new Image();
      img.onload = () => {
        const MAX_SIZE = 256; // avatar resolution
        let w = img.width;
        let h = img.height;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          const scale = MAX_SIZE / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        // Compress to JPEG at 0.8 quality — keeps data URI small
        const dataUri = canvas.toDataURL("image/jpeg", 0.8);
        setAgentImage(dataUri);
        setImagePreview(dataUri);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  const canSubmit = authenticated && agentName.trim() && txState !== "signing" && txState !== "pending";

  async function handleRegister() {
    if (!wallets.length || !agentName.trim()) return;

    try {
      setTxState("signing");
      setTxError(null);
      setTxHash(null);
      setMintedTokenId(null);

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

      // Build the ERC-8004 registration JSON
      const services = [];
      if (webEndpoint.trim()) services.push({ name: "web", endpoint: webEndpoint.trim() });
      if (a2aEndpoint.trim()) services.push({ name: "A2A", endpoint: a2aEndpoint.trim(), version: "0.3.0" });
      if (mcpEndpoint.trim()) services.push({ name: "MCP", endpoint: mcpEndpoint.trim() });

      const registrationFile = {
        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        name: agentName.trim(),
        description: agentDescription.trim() || undefined,
        image: agentImage.trim() || undefined,
        services,
        active: true,
        registrations: [], // Will be populated after minting
        supportedTrust: ["reputation"],
      };

      // Encode as base64 data URI for fully on-chain storage
      const json = JSON.stringify(registrationFile);
      const base64 = btoa(json);
      const agentURI = `data:application/json;base64,${base64}`;

      // Encode the register(string) call
      const data = encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "register",
        args: [agentURI],
      });

      setTxState("pending");

      const hash = await walletClient.sendTransaction({
        account,
        to: AGENT_REGISTRY_ADDRESS as Address,
        data,
      });

      setTxHash(hash);

      // Wait for receipt and parse tokenId
      try {
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http("https://sepolia.base.org"),
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        // Registered event — agentId is first indexed topic
        for (const log of receipt.logs) {
          if (log.topics[0] && log.topics[1]) {
            const parsedId = Number(BigInt(log.topics[1]));
            if (parsedId > 0) {
              setMintedTokenId(parsedId);
              break;
            }
          }
        }
      } catch {
        // Non-critical
      }

      setTxState("success");
    } catch (err: unknown) {
      console.error("Register failed:", err);
      setTxError((err as Error)?.message?.slice(0, 300) || "Transaction failed");
      setTxState("error");
    }
  }

  const walletAddress = wallets[0]?.address;

  return (
    <main>
      <div className="container" style={{ maxWidth: 680 }}>

        {/* Back */}
        <div style={{ paddingTop: 32, marginBottom: 28 }}>
          <Link href="/agents" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: "0.875rem" }}>
            ← Agents
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div className="hero-eyebrow animate-up" style={{ marginBottom: 12 }}>
            <span>⬡</span> ERC-8004 Identity
          </div>
          <h1 style={{
            fontFamily: "var(--font-head)", fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 700, background: "linear-gradient(135deg, #818cf8, #34d399)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 8
          }}>
            Register Your Agent
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            Mint an ERC-8004 agent identity NFT on Base Sepolia. This gives your agent a
            permanent, transferable on-chain identity.
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: 28, marginBottom: 24,
        }}>
          {/* Agent Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              Agent Name *
            </label>
            <input
              type="text"
              placeholder="e.g. TrustBot, MarketAnalyzer"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--bg-subtle)",
                color: "var(--text-primary)", fontSize: "0.875rem",
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              Description
            </label>
            <textarea
              placeholder="What does your agent do?"
              value={agentDescription}
              onChange={(e) => setAgentDescription(e.target.value)}
              rows={3}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--bg-subtle)",
                color: "var(--text-primary)", fontSize: "0.875rem", resize: "vertical",
              }}
            />
          </div>

          {/* Agent Image — Upload or URL */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              Agent Image
            </label>

            {/* Preview + Upload zone */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* Preview */}
              {(imagePreview || (agentImage && !agentImage.startsWith("data:"))) && (
                <div style={{
                  width: 80, height: 80, borderRadius: 14, overflow: "hidden",
                  border: "2px solid var(--border)", flexShrink: 0,
                  background: "var(--bg-subtle)",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview || agentImage}
                    alt="Agent preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleImageUpload(file);
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleImageUpload(file);
                  };
                  input.click();
                }}
                style={{
                  flex: 1, padding: "24px 20px",
                  borderRadius: 12,
                  border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
                  background: isDragging ? "rgba(129,140,248,0.08)" : "rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>
                  {imagePreview ? "✅" : "📁"}
                </div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: isDragging ? "var(--accent)" : "var(--text-primary)", marginBottom: 4 }}>
                  {imagePreview ? "Image uploaded" : "Drop image here or click to browse"}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                  PNG, JPG, SVG · Auto-resized to 256×256 for on-chain storage
                </div>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setImagePreview(null); setAgentImage(""); }}
                    style={{
                      marginTop: 8, padding: "4px 12px", borderRadius: 6, fontSize: "0.6875rem",
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                      color: "#ef4444", cursor: "pointer", fontWeight: 600,
                    }}
                  >
                    ✕ Remove
                  </button>
                )}
              </div>
            </div>

            {/* URL fallback */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4, fontWeight: 500 }}>
                Or paste an image URL:
              </div>
              <input
                type="text"
                placeholder="https://example.com/agent-avatar.png"
                value={agentImage.startsWith("data:") ? "" : agentImage}
                onChange={(e) => { setAgentImage(e.target.value); setImagePreview(e.target.value || null); }}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--bg-subtle)",
                  color: "var(--text-primary)", fontSize: "0.8125rem",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>
          </div>

          {/* Endpoints */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              Endpoints <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 40, flexShrink: 0 }}>Web</span>
                <input
                  type="text"
                  placeholder="https://myagent.com"
                  value={webEndpoint}
                  onChange={(e) => setWebEndpoint(e.target.value)}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 6,
                    border: "1px solid var(--border)", background: "var(--bg-subtle)",
                    color: "var(--text-primary)", fontSize: "0.8125rem",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 40, flexShrink: 0 }}>A2A</span>
                <input
                  type="text"
                  placeholder="https://agent.example/.well-known/agent-card.json"
                  value={a2aEndpoint}
                  onChange={(e) => setA2aEndpoint(e.target.value)}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 6,
                    border: "1px solid var(--border)", background: "var(--bg-subtle)",
                    color: "var(--text-primary)", fontSize: "0.8125rem",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 40, flexShrink: 0 }}>MCP</span>
                <input
                  type="text"
                  placeholder="https://mcp.myagent.com/"
                  value={mcpEndpoint}
                  onChange={(e) => setMcpEndpoint(e.target.value)}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 6,
                    border: "1px solid var(--border)", background: "var(--bg-subtle)",
                    color: "var(--text-primary)", fontSize: "0.8125rem",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{
            padding: "14px 18px", borderRadius: 8,
            background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)",
            marginBottom: 20,
          }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Registration Preview
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <strong>Name:</strong> {agentName || "—"}<br />
              <strong>Owner:</strong> {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Connect wallet"}<br />
              <strong>Storage:</strong> Fully on-chain (base64 data URI)<br />
              <strong>Network:</strong> Base Sepolia<br />
              <strong>Contract:</strong> <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                {AGENT_REGISTRY_ADDRESS.slice(0, 10)}…{AGENT_REGISTRY_ADDRESS.slice(-6)}
              </span>
            </div>
          </div>

          {/* Submit */}
          {authenticated ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={handleRegister}
                disabled={!canSubmit}
                className="btn btn-primary"
                style={{
                  fontSize: "1rem", padding: "14px 32px", width: "100%",
                  justifyContent: "center",
                  opacity: canSubmit ? 1 : 0.4,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                {txState === "signing" ? "✍️ Sign in your wallet…"
                  : txState === "pending" ? "⏳ Minting…"
                  : txState === "success" ? "✅ Agent registered!"
                  : "🤖 Mint Agent Identity"}
              </button>

              {txState === "success" && txHash && (
                <div style={{
                  padding: "20px 24px", borderRadius: "var(--radius-md)",
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                }}>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, color: "#34d399", marginBottom: 8 }}>
                    ✓ Agent registered on-chain!
                  </div>

                  {mintedTokenId && (
                    <div style={{ fontSize: "0.9375rem", color: "var(--text-primary)", marginBottom: 12 }}>
                      Your agent token ID is <strong style={{ color: "var(--accent)" }}>#{mintedTokenId}</strong>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <a
                      href={`https://base-sepolia.blockscout.com/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 500 }}
                    >
                      View transaction ↗
                    </a>
                  </div>

                  {mintedTokenId && (
                    <>
                      {/* Copyable agent info */}
                      <div style={{
                        padding: "12px 16px", borderRadius: 8,
                        background: "var(--bg-subtle)", border: "1px solid var(--border)",
                        marginBottom: 12,
                      }}>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4, fontWeight: 500 }}>
                          Use these values when linking your agent:
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                          Agent Token ID: <strong>{mintedTokenId}</strong><br />
                          Agent Wallet: <strong>{walletAddress}</strong>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `Agent Token ID: ${mintedTokenId}\nAgent Wallet: ${walletAddress}`
                            );
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="btn btn-ghost"
                          style={{ padding: "6px 12px", fontSize: "0.75rem", marginTop: 8 }}
                        >
                          {copied ? "✓ Copied!" : "📋 Copy"}
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <Link
                          href={`/agents/${mintedTokenId}`}
                          className="btn btn-primary"
                          style={{ fontSize: "0.8125rem", padding: "8px 18px" }}
                        >
                          View Agent #{mintedTokenId} →
                        </Link>
                        <Link
                          href="/creator/link"
                          className="btn btn-ghost"
                          style={{ fontSize: "0.8125rem", padding: "8px 18px" }}
                        >
                          Link to your Ethos profile →
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}

              {txState === "error" && txError && (
                <div style={{
                  padding: "16px 20px", borderRadius: "var(--radius-md)",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                }}>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, color: "#ef4444", marginBottom: 6 }}>
                    Transaction failed
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", wordBreak: "break-all", marginBottom: 8 }}>
                    {txError}
                  </div>
                  <button onClick={handleRegister} className="btn btn-ghost" style={{ fontSize: "0.8125rem" }}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => login()}
              className="btn btn-primary"
              style={{ fontSize: "0.875rem", width: "100%", justifyContent: "center" }}
            >
              Connect wallet to register
            </button>
          )}
        </div>

        {/* Info box */}
        <div style={{
          padding: "20px 24px", borderRadius: "var(--radius-lg)",
          background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)",
          marginBottom: 48,
        }}>
          <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.875rem", marginBottom: 8 }}>
            What is ERC-8004?
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            ERC-8004 is the standard for giving AI agents persistent, portable, on-chain identities.
            Each agent gets an NFT (ERC-721) with a registration file describing its name, services, endpoints,
            and supported trust layers. The identity travels with the agent across platforms.{" "}
            <a
              href="https://eips.ethereum.org/EIPS/eip-8004"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              Read the spec ↗
            </a>
          </p>
        </div>

      </div>
    </main>
  );
}
