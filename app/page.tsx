import {
  fetchAgents,
  getTotalAgentCount,
} from "@/lib/scan";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Fetch real agents from 8004scan.io API
  const [response, totalAgents] = await Promise.all([
    fetchAgents({ limit: 50 }),
    getTotalAgentCount(),
  ]);

  return (
    <main>
      <HomeClient
        agents={response.data}
        totalAgents={totalAgents}
      />
    </main>
  );
}
