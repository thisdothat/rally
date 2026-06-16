import { createClient } from '@/lib/supabase/server'
import KPITable from '@/components/KPITable'

export default async function KPIsPage() {
  const supabase = await createClient()

  const { data: kpis, error } = await supabase
    .from('kpis')
    .select('id, code, name, description, kpi_status, unit, aggregation_method, tags, impact_pathway')
    .order('code', { ascending: true })

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">KPIs</h1>
        <div className="mt-6 px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
          Could not load KPIs: {error.message}. Make sure you have run the database migrations.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">KPI Library</h1>
        <p className="text-gray-400 mt-1 text-sm">
          {kpis?.length ?? 0} KPIs across all Rally Impact Areas
        </p>
      </div>
      <KPITable kpis={kpis ?? []} />
    </div>
  )
}
