'use client'

import { useState, useMemo } from 'react'

interface KPI {
  id: string
  code: string
  name: string
  description: string
  kpi_status: string
  unit: string
  aggregation_method: string
  tags: string[]
  impact_pathway: string
}

const STATUS_COLORS: Record<string, string> = {
  'Validated':      'bg-emerald-900 text-emerald-300 border-emerald-800',
  'Needs Follow-Up':'bg-amber-900 text-amber-300 border-amber-800',
  'Draft':          'bg-gray-800 text-gray-400 border-gray-700',
}

const PATHWAY_COLORS: Record<string, string> = {
  'Output':  'bg-blue-900 text-blue-300 border-blue-800',
  'Outcome': 'bg-purple-900 text-purple-300 border-purple-800',
  'Impact':  'bg-rose-900 text-rose-300 border-rose-800',
}

export default function KPITable({ kpis }: { kpis: KPI[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [pathwayFilter, setPathwayFilter] = useState('All')
  const [areaFilter, setAreaFilter] = useState('All')
  const [expanded, setExpanded] = useState<string | null>(null)

  const allAreas = useMemo(() => {
    const set = new Set<string>()
    kpis.forEach(k => (k.tags ?? []).forEach(t => set.add(t)))
    return ['All', ...Array.from(set).sort()]
  }, [kpis])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return kpis.filter(k => {
      if (statusFilter !== 'All' && k.kpi_status !== statusFilter) return false
      if (pathwayFilter !== 'All' && k.impact_pathway !== pathwayFilter) return false
      if (areaFilter !== 'All' && !(k.tags ?? []).includes(areaFilter)) return false
      if (q && !k.name.toLowerCase().includes(q) && !k.code.toLowerCase().includes(q) && !k.description?.toLowerCase().includes(q)) return false
      return true
    })
  }, [kpis, search, statusFilter, pathwayFilter, areaFilter])

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search KPIs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {['All', 'Validated', 'Needs Follow-Up', 'Draft'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select
          value={pathwayFilter}
          onChange={e => setPathwayFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {['All', 'Output', 'Outcome', 'Impact'].map(p => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <select
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-56"
        >
          {allAreas.map(a => (
            <option key={a}>{a}</option>
          ))}
        </select>

        <span className="px-3 py-2 text-sm text-gray-500 self-center">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">ID</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">KPI Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Unit</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Pathway</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Impact Areas</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                  No KPIs match your filters.
                </td>
              </tr>
            )}
            {filtered.map((kpi, i) => (
              <>
                <tr
                  key={kpi.id}
                  onClick={() => setExpanded(expanded === kpi.id ? null : kpi.id)}
                  className={`cursor-pointer transition hover:bg-gray-800 ${i !== 0 ? 'border-t border-gray-800' : ''} ${expanded === kpi.id ? 'bg-gray-800' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-indigo-400 text-xs">{kpi.code}</td>
                  <td className="px-4 py-3 text-white font-medium leading-snug">{kpi.name}</td>
                  <td className="px-4 py-3 text-gray-400">{kpi.unit}</td>
                  <td className="px-4 py-3">
                    {kpi.impact_pathway && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PATHWAY_COLORS[kpi.impact_pathway] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {kpi.impact_pathway}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {kpi.kpi_status && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[kpi.kpi_status] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {kpi.kpi_status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(kpi.tags ?? []).slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded border border-gray-700">
                          {tag}
                        </span>
                      ))}
                      {(kpi.tags ?? []).length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-800 text-gray-500 text-xs rounded border border-gray-700">
                          +{(kpi.tags ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded === kpi.id && (
                  <tr key={`${kpi.id}-expanded`} className="border-t border-gray-700">
                    <td colSpan={6} className="px-4 py-4 bg-gray-850">
                      <div className="max-w-3xl">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Definition</p>
                        <p className="text-gray-300 text-sm leading-relaxed">{kpi.description}</p>
                        {(kpi.tags ?? []).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            <span className="text-xs text-gray-500 mr-1 self-center">Impact Areas:</span>
                            {(kpi.tags ?? []).map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded border border-gray-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
