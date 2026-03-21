/**
 * ============================================================
 *  Lineage SDK — Client
 * ============================================================
 *
 *  TypeScript SDK for the Lineage Trust Engine API.
 *
 *  Usage:
 *    import { Lineage } from "@lineage/sdk";
 *    const lineage = new Lineage({ apiUrl: "https://lineage.app" });
 *    const score = await lineage.getScore("1:84532");
 * ============================================================
 */
export class Lineage {
    constructor(config = {}) {
        this.baseUrl = (config.apiUrl || "http://localhost:3000").replace(/\/$/, "");
        this.timeout = config.timeout || 10000;
        this.apiKey = config.apiKey;
    }
    // ── Internal fetch wrapper ──────────────────────────────────────
    async request(path, options = {}) {
        const url = `${this.baseUrl}/api/v1${path}`;
        const headers = {
            "Content-Type": "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
            ...(options.headers || {}),
        };
        const res = await fetch(url, {
            ...options,
            headers,
            signal: AbortSignal.timeout(this.timeout),
        });
        const data = await res.json();
        if (!res.ok) {
            const err = data;
            throw new LineageAPIError(err.error || `HTTP ${res.status}`, res.status, err);
        }
        return data;
    }
    // ── Scores ──────────────────────────────────────────────────────
    /** Get the latest Lineage Score for an entity. */
    async getScore(entityId) {
        return this.request(`/scores/${encodeURIComponent(entityId)}`);
    }
    /** Get an agent's score using token ID and chain ID. */
    async getAgentScore(tokenId, chainId) {
        return this.getScore(`${tokenId}:${chainId}`);
    }
    /** Get score history (snapshots over time). */
    async getHistory(entityId, limit = 50) {
        return this.request(`/scores/${encodeURIComponent(entityId)}/history?limit=${Math.min(limit, 200)}`);
    }
    /** Get a human-readable explanation of the current score. */
    async getExplanation(entityId) {
        return this.request(`/scores/${encodeURIComponent(entityId)}/explanation`);
    }
    // ── Agent Profile ───────────────────────────────────────────────
    /**
     * Get the full agent profile in one call:
     * score + links + proofs + tasks + disputes + feedback
     */
    async getAgentProfile(tokenId, chainId) {
        return this.request(`/agents/${tokenId}/${chainId}/profile`);
    }
    // ── Links ───────────────────────────────────────────────────────
    /** Get a specific link by its on-chain ID. */
    async getLink(linkId) {
        return this.request(`/links/${linkId}`);
    }
    /** Get all links for an agent. */
    async getAgentLinks(tokenId, chainId, status) {
        const qs = status ? `?status=${status}` : "";
        return this.request(`/agents/${tokenId}/${chainId}/links${qs}`);
    }
    // ── Tasks ───────────────────────────────────────────────────────
    /** Report a task completion. */
    async reportTask(task) {
        return this.request("/tasks", {
            method: "POST",
            body: JSON.stringify(task),
        });
    }
    /** Get task history for an agent. */
    async getAgentTasks(tokenId, chainId, limit = 50) {
        return this.request(`/agents/${tokenId}/${chainId}/tasks?limit=${limit}`);
    }
    // ── Disputes ────────────────────────────────────────────────────
    /** Open a new dispute. */
    async openDispute(dispute) {
        return this.request("/disputes", {
            method: "POST",
            body: JSON.stringify(dispute),
        });
    }
    /** View a specific dispute. */
    async getDispute(disputeId) {
        return this.request(`/disputes/${disputeId}`);
    }
    /** Get all disputes for an agent. */
    async getAgentDisputes(tokenId, chainId, status) {
        const qs = status ? `?status=${status}` : "";
        return this.request(`/agents/${tokenId}/${chainId}/disputes${qs}`);
    }
    // ── Feedback ────────────────────────────────────────────────────
    /** Submit platform-level feedback on an agent. */
    async submitFeedback(feedback) {
        return this.request("/feedback", {
            method: "POST",
            body: JSON.stringify(feedback),
        });
    }
    // ── Trust Check ─────────────────────────────────────────────────
    /**
     * Quick trust check — returns PASS/FAIL.
     * Use before delegating work to another agent.
     *
     * @param threshold Minimum score to pass (default 40)
     */
    async checkTrust(tokenId, chainId, threshold = 40) {
        return this.request(`/trust-check/${tokenId}/${chainId}?threshold=${threshold}`);
    }
    // ── Webhooks ────────────────────────────────────────────────────
    /** Register a webhook for event notifications. */
    async registerWebhook(webhook) {
        return this.request("/webhooks", {
            method: "POST",
            body: JSON.stringify(webhook),
        });
    }
    /** List registered webhooks. */
    async getWebhooks(agentTokenId) {
        const qs = agentTokenId ? `?agentTokenId=${agentTokenId}` : "";
        return this.request(`/webhooks${qs}`);
    }
    // ── Badges ──────────────────────────────────────────────────────
    /**
     * Get the URL for an agent's SVG score badge.
     * Embed in websites, READMEs, or A2A protocol responses.
     */
    getBadgeUrl(tokenId, chainId) {
        return `${this.baseUrl}/api/v1/badges/${tokenId}/${chainId}`;
    }
    // ── Utilities ───────────────────────────────────────────────────
    /** Check if the API is reachable. */
    async isHealthy() {
        try {
            await fetch(`${this.baseUrl}/api/v1/scores/health`, {
                signal: AbortSignal.timeout(3000),
            });
            return true;
        }
        catch {
            return false;
        }
    }
    /** Get the base URL. */
    getApiUrl() {
        return this.baseUrl;
    }
}
// ── Custom error class ────────────────────────────────────────────
export class LineageAPIError extends Error {
    constructor(message, status, details) {
        super(message);
        this.name = "LineageAPIError";
        this.status = status;
        this.details = details;
    }
}
//# sourceMappingURL=index.js.map