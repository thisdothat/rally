import { loadAgentConfig } from '@/app/actions/agent'
import AgentConfigView from '@/components/AgentConfigView'

export default async function AgentConfigPage() {
  const config = await loadAgentConfig()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Agent Matching Details</h1>
        <p className="text-gray-400 text-sm mt-1">
          Control how the AI finds and ranks Rally KPIs for your fund metrics.
        </p>
      </div>
      <AgentConfigView initial={config} />
    </div>
  )
}
