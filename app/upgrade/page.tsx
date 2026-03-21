"use client";

/**
 * ============================================================
 *  Upgrade Link to Level 3 — Mutual Verification
 * ============================================================
 *
 *  URL: /upgrade?linkId=3-0xabcdef12345678
 *
 *  Three upgrade paths:
 *    1. UI — Connect agent wallet, sign & upgrade with one click
 *    2. Script — Copy a Node.js script to run headless
 *    3. Share — Copy contract details for a third party
 * ============================================================
 */

import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient, createWalletClient, custom, http,
  encodeFunctionData, parseAbi,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  LINK_REGISTRY_ADDRESS,
  LINK_EIP712_DOMAIN,
  LINK_EIP712_TYPES,
  readLink,
  readNonce,
  generateLinkHash,
  type OnChainLink,
} from "@/lib/contracts";

const UPGRADE_ABI = parseAbi([
  "function upgradeLink(uint256 linkId, bytes signature, uint256 deadline)",
]);

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <main><div className="container" style={{ padding: "96px 24px", textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading upgrade page…</div>
      </div></main>
    }>
      <UpgradePageInner />
    </Suspense>
  );
}

function UpgradePageInner() {
  const searchParams = useSearchParams();
  const linkIdParam = searchParams.get("linkId") || "";
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [linkIdInput, setLinkIdInput] = useState(linkIdParam);
  const [link, setLink] = useState<OnChainLink | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [activeTab, setActiveTab] = useState<"ui" | "script" | "share">("ui");
  const [txState, setTxState] = useState<"idle" | "signing" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const walletAddress = wallets[0]?.address?.toLowerCase() ?? "";

  const loadLink = useCallback(async () => {
    const id = parseInt(linkIdInput);
    if (isNaN(id) || id <= 0) return;

    setLoadingLink(true);
    setLoadError("");
    setLink(null);

    const result = await readLink(id);
    if (!result) {
      setLoadError(`Link #${id} not found.`);
    } else {
      const expectedKey = generateLinkHash(result);
      if (linkIdInput.trim() !== expectedKey) {
        setLoadError("Invalid or incomplete upgrade key. The key must include the security hash.");
      } else {
        setLink(result);
      }
    }
    setLoadingLink(false);
  }, [linkIdInput]);

  useEffect(() => {
    if (linkIdParam) loadLink();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAgentWallet = link && walletAddress === link.agentWallet.toLowerCase();
  const needsAgent = link?.level === "self-claim";
  const alreadyMutual = link?.level === "mutual-verification";

  async function handleUpgrade() {
    if (!wallets.length || !link) return;

    try {
      setTxState("signing");
      setTxError(null);
      setTxHash(null);

      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();

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

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const nonce = await readNonce(account);

      // Sign EIP-712 typed data
      const signature = await walletClient.signTypedData({
        account,
        domain: { ...LINK_EIP712_DOMAIN },
        types: LINK_EIP712_TYPES,
        primaryType: "LinkAgent",
        message: {
          agentTokenId: BigInt(link.agentTokenId),
          ethosProfileId: BigInt(link.ethosProfileId),
          role: link.level === "self-claim" ? 0 : 0, // Use the role index from the link
          expiration: BigInt(link.expiration),
          nonce,
          deadline,
        },
      });

      const data = encodeFunctionData({
        abi: UPGRADE_ABI,
        functionName: "upgradeLink",
        args: [BigInt(link.linkId), signature, deadline],
      });

      setTxState("pending");

      const hash = await walletClient.sendTransaction({
        account,
        to: LINK_REGISTRY_ADDRESS as Address,
        data,
      });

      setTxHash(hash);

      // Wait for confirmation
      try {
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http("https://sepolia.base.org"),
        });
        await publicClient.waitForTransactionReceipt({ hash });
      } catch { /* non-critical */ }

      setTxState("success");
    } catch (err: unknown) {
      console.error("Upgrade failed:", err);
      setTxError((err as Error)?.message?.slice(0, 300) || "Transaction failed");
      setTxState("error");
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // Node.js script for autonomous agents
  const nodeScript = link ? `import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ⚠️ Replace with the agent's private key
const AGENT_PRIVATE_KEY = "0xYOUR_AGENT_PRIVATE_KEY";

const account = privateKeyToAccount(AGENT_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

// Link details
const LINK_ID = ${link.linkId}n;
const AGENT_TOKEN_ID = ${link.agentTokenId}n;
const ETHOS_PROFILE_ID = ${link.ethosProfileId}n;
const ROLE = ${link.role === "creator" ? 0 : link.role === "operator" ? 1 : link.role === "maintainer" ? 2 : link.role === "delegate" ? 3 : 4};
const EXPIRATION = ${link.expiration}n;
const REGISTRY = "${LINK_REGISTRY_ADDRESS}";

async function upgradeLink() {
  // Get nonce
  const nonce = await publicClient.readContract({
    address: REGISTRY,
    abi: parseAbi(["function nonces(address) view returns (uint256)"]),
    functionName: "nonces",
    args: [account.address],
  });

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  // Sign EIP-712
  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: "AgentHumanLinkRegistry",
      version: "1",
      chainId: ${baseSepolia.id},
      verifyingContract: REGISTRY,
    },
    types: {
      LinkAgent: [
        { name: "agentTokenId", type: "uint256" },
        { name: "ethosProfileId", type: "uint256" },
        { name: "role", type: "uint8" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "LinkAgent",
    message: {
      agentTokenId: AGENT_TOKEN_ID,
      ethosProfileId: ETHOS_PROFILE_ID,
      role: ROLE,
      expiration: EXPIRATION,
      nonce,
      deadline,
    },
  });

  // Submit upgrade tx
  const hash = await walletClient.sendTransaction({
    to: REGISTRY,
    data: encodeFunctionData({
      abi: parseAbi(["function upgradeLink(uint256 linkId, bytes signature, uint256 deadline)"]),
      functionName: "upgradeLink",
      args: [LINK_ID, signature, deadline],
    }),
  });

  console.log("✅ Upgrade tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("✅ Confirmed in block:", receipt.blockNumber);
}

upgradeLink().catch(console.error);` : "";

  const shareText = link ? `🔗 Upgrade Link #${link.linkId} to Level 3 Mutual Verification

Contract: ${LINK_REGISTRY_ADDRESS}
Network:  Base Sepolia (chain ID 84532)
Function: upgradeLink(uint256 linkId, bytes signature, uint256 deadline)

Link Details:
  Link ID:          ${link.linkId}
  Agent Token ID:   ${link.agentTokenId}
  Ethos Profile ID: ${link.ethosProfileId}
  Agent Wallet:     ${link.agentWallet}
  Human Wallet:     ${link.humanWallet}
  Role:             ${link.role}
  Current Level:    ${link.level}
  Expiration:       ${link.expiration === 0 ? "Permanent" : new Date(link.expiration * 1000).toISOString()}

The agent wallet (${link.agentWallet}) must:
1. Sign an EIP-712 typed data payload with the link details above
2. Call upgradeLink(${link.linkId}, signature, deadline) on the contract

EIP-712 Domain:
  name: "AgentHumanLinkRegistry"
  version: "1"
  chainId: 84532
  verifyingContract: ${LINK_REGISTRY_ADDRESS}

Upgrade page: ${typeof window !== "undefined" ? `${window.location.origin}/upgrade?linkId=${generateLinkHash(link)}` : `/upgrade?linkId=${generateLinkHash(link)}`}
Blockscout: https://base-sepolia.blockscout.com/address/${LINK_REGISTRY_ADDRESS}` : "";

  return (
    <main>
      <div className="container" style={{ maxWidth: 720 }}>

        <div style={{ paddingTop: 32, marginBottom: 28 }}>
          <Link href="/explorer" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: "0.875rem" }}>
            ← Explorer
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div className="hero-eyebrow animate-up" style={{ marginBottom: 12 }}>
            <span>⬡</span> Mutual Verification Protocol
          </div>
          <h1 style={{
            fontFamily: "var(--font-head)", fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 700, background: "linear-gradient(135deg, #818cf8, #34d399)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}>
            Upgrade to Level 3
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            Add the missing signature to upgrade a Self Claim (Level 1) to Mutual Verification (Level 3).
          </p>
        </div>

        {/* Link lookup */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 24,
        }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
            Secure Upgrade Key
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="e.g. 1-0xabcd..."
              value={linkIdInput}
              onChange={(e) => setLinkIdInput(e.target.value)}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--bg-subtle)",
                color: "var(--text-primary)", fontSize: "0.875rem",
                fontFamily: "var(--font-mono)",
              }}
            />
            <button
              onClick={loadLink}
              disabled={loadingLink}
              className="btn btn-primary"
              style={{ padding: "10px 20px", fontSize: "0.875rem" }}
            >
              {loadingLink ? "Loading…" : "Load"}
            </button>
          </div>
          {loadError && (
            <div style={{ marginTop: 8, color: "#ef4444", fontSize: "0.8125rem" }}>⚠ {loadError}</div>
          )}
        </div>

        {/* Link details */}
        {link && (
          <>
            {/* Status card */}
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)", padding: 20, marginBottom: 24,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "1rem" }}>
                  Link #{link.linkId}
                </div>
                <span style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600,
                  color: alreadyMutual ? "#34d399" : "#f59e0b",
                  background: alreadyMutual ? "rgba(52,211,153,0.1)" : "rgba(245,158,11,0.1)",
                  border: `1px solid ${alreadyMutual ? "rgba(52,211,153,0.3)" : "rgba(245,158,11,0.3)"}`,
                }}>
                  {alreadyMutual ? "● Level 3 — Mutual Verification" : `◑ Level 1 — ${link.level}`}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.8125rem" }}>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.6875rem", textTransform: "uppercase", marginBottom: 2 }}>Human Wallet</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{link.humanWallet.slice(0, 10)}…{link.humanWallet.slice(-6)}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.6875rem", textTransform: "uppercase", marginBottom: 2 }}>Agent Wallet</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{link.agentWallet.slice(0, 10)}…{link.agentWallet.slice(-6)}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.6875rem", textTransform: "uppercase", marginBottom: 2 }}>Agent Token ID</div>
                  <div>#{link.agentTokenId}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.6875rem", textTransform: "uppercase", marginBottom: 2 }}>Role</div>
                  <div style={{ textTransform: "capitalize" }}>{link.role}</div>
                </div>
              </div>
            </div>

            {alreadyMutual ? (
              <div style={{
                padding: 24, textAlign: "center", background: "rgba(52,211,153,0.06)",
                border: "1px solid rgba(52,211,153,0.2)", borderRadius: "var(--radius-lg)",
              }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>✅</div>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, color: "#34d399", marginBottom: 4 }}>
                  Already Level 3
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  This link already has Mutual Verification. No upgrade needed.
                </div>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {([
                    { key: "ui" as const, label: "🖥 Sign in Browser", desc: "Connect wallet" },
                    { key: "script" as const, label: "🤖 Node.js Script", desc: "Autonomous agent" },
                    { key: "share" as const, label: "📋 Share Details", desc: "Third party" },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        flex: 1, padding: "12px 16px", borderRadius: 8,
                        border: "1px solid",
                        borderColor: activeTab === tab.key ? "var(--accent)" : "var(--border)",
                        background: activeTab === tab.key ? "rgba(129,140,248,0.1)" : "transparent",
                        color: activeTab === tab.key ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer", transition: "all 0.2s",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{tab.label}</div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>{tab.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)", padding: 24,
                }}>

                  {/* ── TAB 1: Sign in Browser ── */}
                  {activeTab === "ui" && (
                    <div>
                      <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, marginBottom: 12 }}>
                        Sign & Upgrade (Browser)
                      </div>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                        Connect the <strong>agent wallet</strong> (<code style={{ fontSize: "0.75rem" }}>{link.agentWallet.slice(0, 10)}…</code>)
                        and click to sign the EIP-712 payload and submit the upgrade.
                      </p>

                      {authenticated && !isAgentWallet && (
                        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: "0.8125rem", color: "#f59e0b", marginBottom: 12 }}>
                          ⚠ Connected wallet ({walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}) is not the agent wallet. Switch to <code>{link.agentWallet.slice(0, 10)}…</code>
                        </div>
                      )}

                      {!authenticated ? (
                        <button onClick={() => login()} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                          Connect agent wallet
                        </button>
                      ) : (
                        <button
                          onClick={handleUpgrade}
                          disabled={!isAgentWallet || txState === "signing" || txState === "pending"}
                          className="btn btn-primary"
                          style={{ width: "100%", justifyContent: "center", opacity: isAgentWallet ? 1 : 0.4 }}
                        >
                          {txState === "signing" ? "✍️ Sign in wallet…"
                            : txState === "pending" ? "⏳ Broadcasting…"
                            : txState === "success" ? "✅ Upgraded!"
                            : "🔗 Sign & Upgrade to Level 3"}
                        </button>
                      )}

                      {txState === "success" && txHash && (
                        <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 8, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                          <div style={{ fontWeight: 600, color: "#34d399", marginBottom: 4 }}>✓ Upgraded to Level 3!</div>
                          <a href={`https://base-sepolia.blockscout.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8125rem", color: "var(--accent)" }}>
                            View transaction ↗
                          </a>
                        </div>
                      )}

                      {txState === "error" && txError && (
                        <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                          <div style={{ fontWeight: 600, color: "#ef4444", marginBottom: 4 }}>Failed</div>
                          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", wordBreak: "break-all" }}>{txError}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TAB 2: Node.js Script ── */}
                  {activeTab === "script" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontFamily: "var(--font-head)", fontWeight: 600 }}>
                          Node.js Upgrade Script
                        </div>
                        <button
                          onClick={() => copyText(nodeScript, "script")}
                          className="btn btn-ghost"
                          style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                        >
                          {copied === "script" ? "✓ Copied!" : "📋 Copy"}
                        </button>
                      </div>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                        Give this script to the agent. It signs with the agent&apos;s private key and submits the upgrade.
                        Replace <code>AGENT_PRIVATE_KEY</code> with the real key.
                      </p>
                      <pre style={{
                        padding: "14px 18px", borderRadius: 8,
                        background: "#0d1117", border: "1px solid var(--border)",
                        fontSize: "0.7rem", lineHeight: 1.6, overflow: "auto",
                        color: "#e6edf3", margin: 0, maxHeight: 400,
                      }}>
                        {nodeScript}
                      </pre>
                    </div>
                  )}

                  {/* ── TAB 3: Share Details ── */}
                  {activeTab === "share" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontFamily: "var(--font-head)", fontWeight: 600 }}>
                          Share with Agent Owner
                        </div>
                        <button
                          onClick={() => copyText(shareText, "share")}
                          className="btn btn-ghost"
                          style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                        >
                          {copied === "share" ? "✓ Copied!" : "📋 Copy All"}
                        </button>
                      </div>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                        Copy everything below and send it to the person who controls the agent wallet.
                      </p>
                      <pre style={{
                        padding: "14px 18px", borderRadius: 8,
                        background: "#0d1117", border: "1px solid var(--border)",
                        fontSize: "0.7rem", lineHeight: 1.6, overflow: "auto",
                        color: "#e6edf3", margin: 0, maxHeight: 400,
                        whiteSpace: "pre-wrap",
                      }}>
                        {shareText}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <div style={{ height: 48 }} />
      </div>
    </main>
  );
}
