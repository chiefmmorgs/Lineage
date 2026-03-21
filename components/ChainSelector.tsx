"use client";

import { useState, useRef, useEffect } from "react";
import { SUPPORTED_CHAINS } from "@/lib/chains";

interface ChainSelectorProps {
  selected: string;
  onChange: (chainId: string) => void;
  showTestnets?: boolean;
}

export default function ChainSelector({ selected, onChange, showTestnets = true }: ChainSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const chains = showTestnets
    ? SUPPORTED_CHAINS
    : SUPPORTED_CHAINS.filter((c) => !c.isTestnet);

  const current = chains.find((c) => c.id === selected);
  const label = current ? current.name : "All Chains";
  const color = current?.color ?? "#94a3b8";

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px", borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          fontSize: "0.8125rem", fontWeight: 600,
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
      >
        {selected !== "all" && (
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: color, flexShrink: 0,
          }} />
        )}
        {selected === "all" && (
          <span style={{ fontSize: "0.875rem" }}>⊕</span>
        )}
        {label}
        <span style={{
          fontSize: "0.625rem", color: "var(--text-muted)",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.15s",
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          minWidth: 180, background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          zIndex: 50,
        }}>
          {/* All Chains option */}
          <button
            type="button"
            onClick={() => { onChange("all"); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px", width: "100%",
              background: selected === "all" ? "rgba(129,140,248,0.08)" : "transparent",
              border: "none", borderBottom: "1px solid var(--border)",
              color: selected === "all" ? "var(--accent)" : "var(--text-primary)",
              fontSize: "0.8125rem", fontWeight: 500,
              cursor: "pointer", textAlign: "left",
              transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: "0.875rem" }}>⊕</span>
            All Chains
          </button>

          {chains.map((chain) => (
            <button
              key={chain.id}
              type="button"
              onClick={() => { onChange(chain.id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", width: "100%",
                background: selected === chain.id ? "rgba(129,140,248,0.08)" : "transparent",
                border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                color: selected === chain.id ? chain.color : "var(--text-primary)",
                fontSize: "0.8125rem", fontWeight: 500,
                cursor: "pointer", textAlign: "left",
                transition: "background 0.15s",
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: chain.color, flexShrink: 0,
              }} />
              {chain.name}
              {chain.isTestnet && (
                <span style={{
                  fontSize: "0.5625rem", padding: "1px 5px",
                  borderRadius: 4, background: "rgba(234,179,8,0.12)",
                  color: "#eab308", marginLeft: "auto",
                }}>
                  Testnet
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
