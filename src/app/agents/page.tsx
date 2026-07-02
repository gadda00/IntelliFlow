import { AgentsExplorer } from '@/components/v7/AgentsExplorer';

export const metadata = {
  title: 'Agents — Busara AI',
  description: 'Explore all 50 AI agents in the Busara v7.0 pipeline',
};

export default function AgentsRoute() {
  return <AgentsExplorer />;
}
