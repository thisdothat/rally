import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function greeting() {
  const h = new Date().getUTCHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: { user } },
    { count: kpiCount },
    { count: projectCount },
    { count: totalRows },
    { count: matchedRows },
    { data: recentMatches },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('kpis').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('fund_report_rows').select('*', { count: 'exact', head: true }),
    supabase
      .from('fund_report_rows')
      .select('*', { count: 'exact', head: true })
      .not('matched_kpi_id', 'is', null),
    supabase
      .from('fund_report_rows')
      .select('id, metric, matched_kpi_name, matched_kpi_code, underlying_holding, project_id, projects(name)')
      .not('matched_kpi_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  const matchRate = totalRows && totalRows > 0
    ? Math.round(((matchedRows ?? 0) / totalRows) * 100)
    : null

  const stats = [
    {
      label: 'KPI Library',
      value: kpiCount != null ? kpiCount.toLocaleString() : '—',
      sub: 'Standard impact KPIs available',
      color: 'text-indigo-400',
    },
    {
      label: 'Impact Funds',
      value: projectCount != null ? projectCount.toLocaleString() : '—',
      sub: projectCount === 1 ? '1 project uploaded' : `${projectCount ?? 0} projects uploaded`,
      color: 'text-violet-400',
    },
    {
      label: 'Metrics Matched',
      value: matchedRows != null ? matchedRows.toLocaleString() : '—',
      sub: totalRows ? `of ${totalRows.toLocaleString()} total metrics` : 'No metrics uploaded yet',
      color: 'text-emerald-400',
    },
    {
      label: 'Match Rate',
      value: matchRate != null ? `${matchRate}%` : '—',
      sub: matchRate != null
        ? matchRate >= 80 ? 'Excellent coverage' : matchRate >= 50 ? 'Good progress' : 'Room to improve'
        : 'Upload metrics to begin',
      color: matchRate != null
        ? matchRate >= 80 ? 'text-emerald-400' : matchRate >= 50 ? 'text-amber-400' : 'text-red-400'
        : 'text-gray-500',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{greeting()}, {name}</h1>
        <p className="text-gray-400 mt-1">Here&apos;s an overview of your KPI matching activity.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold mb-1 ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Quick actions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Quick actions</h2>
          <div className="space-y-2">
            <Link
              href="/dashboard/funds"
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Upload a fund</p>
                <p className="text-xs text-gray-500">Import a CSV or Excel report</p>
              </div>
            </Link>
            <Link
              href="/dashboard/kpis"
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Browse KPI library</p>
                <p className="text-xs text-gray-500">{kpiCount ?? 0} standard KPIs available</p>
              </div>
            </Link>
            <Link
              href="/dashboard/agent"
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Agent matching settings</p>
                <p className="text-xs text-gray-500">Tune rules, prompt, and model</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent matches */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Recent matches</h2>
          {recentMatches && recentMatches.length > 0 ? (
            <div className="space-y-2">
              {recentMatches.map(row => {
                const proj = (Array.isArray(row.projects) ? row.projects[0] : row.projects) as { name: string } | null
                return (
                  <Link
                    key={row.id}
                    href={`/dashboard/funds/${row.project_id}`}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-800 transition group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate group-hover:text-indigo-300 transition">
                        {row.metric}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {row.matched_kpi_code} · {row.matched_kpi_name}
                      </p>
                      {proj?.name && (
                        <p className="text-xs text-gray-600 truncate mt-0.5">{proj.name}</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <svg className="w-8 h-8 text-gray-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-sm text-gray-500">No matches yet</p>
              <p className="text-xs text-gray-600 mt-0.5">Upload a fund and run AI matching</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
