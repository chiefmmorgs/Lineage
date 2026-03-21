"use client";

import { useState, useMemo } from "react";

interface SearchFilterProps {
  placeholder?: string;
  sortOptions?: { label: string; value: string }[];
  onSearch?: (query: string) => void;
  onSort?: (sort: string) => void;
  children: (filter: { query: string; sort: string }) => React.ReactNode;
}

export default function SearchFilter({
  placeholder = "Search...",
  sortOptions = [],
  children,
}: SearchFilterProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(sortOptions[0]?.value ?? "");

  return (
    <div>
      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 20,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <span style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.875rem",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}>
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="input"
            style={{
              width: "100%",
              paddingLeft: 36,
              fontSize: "0.875rem",
            }}
          />
        </div>
        {sortOptions.length > 0 && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input"
            style={{
              width: "auto",
              minWidth: 140,
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {query && (
          <button
            onClick={() => setQuery("")}
            className="btn btn-ghost"
            style={{ fontSize: "0.8125rem", padding: "8px 14px" }}
          >
            Clear
          </button>
        )}
      </div>
      {children({ query, sort })}
    </div>
  );
}
