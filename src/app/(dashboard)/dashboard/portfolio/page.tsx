import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type RollupRow = {
  kpi_code: string
  kpi_name: string
  total_value: number | null
  common_unit: string | null
  metric_count: number
  fund_count: number
  holding_count: number
  needs_review_count: number
  reporting_levels: string[]
}

export default async function PortfolioPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('fund_report_rows')
    .select('matched_kpi_code, matched_kpi_name, level_of_indicator, unit_of_metric, underlying_holding, project_id, match_flag, reporting_level, exclusion_code')
    .not('matched_kpi_id', 'is', null)
    .is('exclusion_code', null)

  // Aggregate by KPI code
  const kpiMap = new Map<string, {
    name: string
    values: number[]
    unit: string | null
    funds: Set<string>
    holdings: Set<string>
    needsReview: number
    reportingLevels: Set<string>
  }>()

  for (const row of rows ?? []) {
    const code = row.matched_kpi_code
    if (!code) continue

    if (!kpiMap.has(code)) {
      kpiMap.set(code, {
        name: row.matched_kpi_name ?? '',
        values: [],
        unit: row.unit_of_metric ?? null,
        funds: new Set(),
        holdings: new Set(),
        needsReview: 0,
        reportingLevels: new Set(),
      })
    }

    const entry = kpiMap.get(code)!
    if (row.project_id) entry.funds.add(row.project_id)
    if (row.underlying_holding) entry.holdings.add(row.underlying_holding)
    if (row.match_flag === 'needs_review') entry.needsReview++
    if (row.reporting_level) entry.reportingLevels.add(row.reporting_level)

    const num = row.level_of_indicator
      ? parseFloat(String(row.level_of_indicator).replace(/,/g, ''))
      : NaN
    if (!isNaN(num)) entry.values.push(num)
  }

  const rollup: RollupRow[] = Array.from(kpiMap.entries())
    .map(([code, data]) => ({
      kpi_code: code,
      kpi_name: data.name,
      total_value: data.values.length > 0 ? data.values.reduce((a, b) => a + b, 0) : null,
      common_unit: data.unit,
      metric_count: (rows ?? []).filter(r => r.matched_kpi_code === code).length,
      fund_count: data.funds.size,
      holding_count: data.holdings.size,
      needs_review_count: data.needsReview,
      reporting_levels: Array.from(data.reportingLevels),
    }))
    .sort((a, b) => (b.metric_count - a.metric_count))

  const totalMetrics = rollup.reduce((s, r) => s + r.metric_count, 0)
  const totalKpis = rollup.length
  const needsReviewTotal = rollup.reduce((s, r) => s + r.needs_review_count, 0)

  function formatValue(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M'
    if (n >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio KPI Roll-up</h1>
        <p className="text-gray-400 text-sm mt-1">
          Aggregated matched metrics across all funds — excluded rows are omitted.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Active KPIs</p>
          <p className="text-3xl font-bold text-indigo-400">{totalKpis}</p>
          <p className="text-xs text-gray-500 mt-1">unique KPIs with matched metrics</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Total Metrics</p>
          <p className="text-3xl font-bold text-emerald-400">{totalMetrics}</p>
          <p className="text-xs text-gray-500 mt-1">matched and included in roll-up</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Needs Review</p>
          <p className={`text-3xl font-bold ${needsReviewTotal > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
            {needsReviewTotal}
          </p>
          <p className="text-xs text-gray-500 mt-1">matches below 80% confidence</p>
        </div>
      </div>

      {rollup.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-gray-900 border border-gray-800 rounded-xl">
          <svg className="w-10 h-10 text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-white font-medium mb-1">No matched metrics yet</p>
          <p className="text-gray-500 text-sm">
            Upload a fund and run AI matching to see the roll-up here.
          </p>
          <Link href="/dashboard/funds" className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition">
            Go to Impact Funds
          </Link>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">KPI</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right w-40">Total Value</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Rep. Level</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-20">Metrics</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-20">Funds</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-24">Holdings</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-24">Review</th>
                </tr>
              </thead>
              <tbody>
                {rollup.map((row, i) => (
                  <tr key={row.kpi_code} className={`hover:bg-gray-800/40 transition-colors ${i > 0 ? 'border-t border-gray-800' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-indigo-900/60 border border-indigo-700 text-indigo-300 text-xs font-mono font-bold rounded">
                        {row.kpi_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium max-w-xs">
                      <p className="truncate">{row.kpi_name}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {row.total_value !== null ? (
                        <span className="text-white font-semibold">
                          {formatValue(row.total_value)}
                          {row.common_unit && (
                            <span className="text-gray-400 font-normal ml-1 text-xs">{row.common_unit}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">non-numeric</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.reporting_levels.map(lvl => (
                          <span key={lvl} className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 text-gray-400 text-xs rounded">
                            {lvl}
                          </span>
                        ))}
                        {row.reporting_levels.length === 0 && <span className="text-gray-600">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300 text-sm font-medium">{row.metric_count}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{row.fund_count}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{row.holding_count}</td>
                    <td className="px-4 py-3 text-center">
                      {row.needs_review_count > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-900/40 border border-amber-800 text-amber-400 text-xs rounded-full">
                          {row.needs_review_count}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
