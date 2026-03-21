"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

export interface EthosProfileData {
  profileId: number | null;
  displayName: string;
  username: string | null;
  avatarUrl: string;
  score: number | null;
  level: string | null;
  ethosUrl: string;
}

const API = "https://api.ethos.network/api/v2";
const HEADERS = {
  "X-Ethos-Client": "lineage@0.1.0",
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * After the user connects their wallet via Privy, this hook
 * looks up their Ethos profile and credibility score.
 */
export function useEthosProfile(): {
  profile: EthosProfileData | null;
  loading: boolean;
  walletAddress: string | null;
} {
  const { user, authenticated } = usePrivy();
  const [profile, setProfile] = useState<EthosProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  const walletAddress = user?.wallet?.address ?? null;

  useEffect(() => {
    if (!authenticated || !walletAddress) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchProfile() {
      try {
        // 1. Look up profile by wallet address
        const profileRes = await fetch(`${API}/profiles`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify({ addresses: [walletAddress], limit: 1 }),
        });

        let ethosProfile: EthosProfileData | null = null;

        if (profileRes.ok) {
          const data = await profileRes.json();
          const entry = data?.values?.[0];

          if (entry?.user) {
            ethosProfile = {
              profileId: entry.user.profileId,
              displayName: entry.user.displayName || walletAddress!.slice(0, 8) + "…",
              username: entry.user.username,
              avatarUrl: entry.user.avatarUrl || "",
              score: entry.user.score ?? null,
              level: null,
              ethosUrl: entry.user.links?.profile || `https://app.ethos.network/profile/${walletAddress}`,
            };
          }
        }

        // 2. Look up score separately (more reliable)
        if (walletAddress) {
          try {
            const scoreRes = await fetch(
              `${API}/score/userkey?userkey=${encodeURIComponent(`address:${walletAddress}`)}`,
              { headers: HEADERS }
            );
            if (scoreRes.ok) {
              const scoreData = await scoreRes.json();
              if (ethosProfile) {
                ethosProfile.score = scoreData.score ?? ethosProfile.score;
                ethosProfile.level = scoreData.level ?? null;
              } else {
                // No profile found but we got a score — create minimal profile
                ethosProfile = {
                  profileId: null,
                  displayName: walletAddress.slice(0, 8) + "…",
                  username: null,
                  avatarUrl: "",
                  score: scoreData.score ?? null,
                  level: scoreData.level ?? null,
                  ethosUrl: `https://app.ethos.network/profile/${walletAddress}`,
                };
              }
            }
          } catch {
            // score lookup failed, continue with what we have
          }
        }

        if (!cancelled) {
          setProfile(ethosProfile);
          setLoading(false);
        }
      } catch (err) {
        console.error("Ethos profile fetch failed:", err);
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [authenticated, walletAddress]);

  return { profile, loading, walletAddress };
}
