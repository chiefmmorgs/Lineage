"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmkm4ovmu02mci20c0lujai67";

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // No loginMethodsAndOrder = Privy auto-detects all injected wallets via EIP-6963
        appearance: {
          theme: "dark",
          accentColor: "#818cf8",
          logo: "/lineage-logo.svg",
          landingHeader: "Sign in to Lineage",
          loginMessage: "Connect any wallet on your device, or sign in with X.",
          showWalletLoginFirst: true,
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
