'use client'

import { useState } from 'react'
import { saveKpiMatch } from '@/app/actions/projects'

type Conversion = {
  from_unit: string
  to_unit: string
  factor: number
  formula: string
}

type MatchResult = {
  kpi_code: string
  kpi_name: string
  match_score: number
  rationale: string
  kpi_id?: string | null
  unit?: string
  tags?: string[]
  impact_pathway?: string
  conversion?: Conversion
}

type RowState = {
  loading: boolean
  matches: MatchResult[] | null
  error: string | null
  open: boolean
}

type SavedKpi = { code: string; name: string; id?: string | null; unit?: string }

export type FundRow = {
  id: string
  metric: string | null
  social_environmental_outcome: string | null
  unit_of_metric: string | null
  status_of_outcome: string | null
  rally_impact_area: string | null
  rally_outcome: string | null
  level_of_indicator: string | null
  comments: string | null
  reporting_level: string | null
  underlying_holding: string | null
  matched_kpi_id?: string | null
  matched_kpi_code?: string | null
  matched_kpi_name?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  'Achieved':      'bg-emerald-900 text-emerald-300 border-emerald-800',
  'On Track':      'bg-blue-900 text-blue-300 border-blue-800',
  'In Progress':   'bg-blue-900 text-blue-300 border-blue-800',
  'Partially Met': 'bg-amber-900 text-amber-300 border-amber-800',
  'Not Met':       'bg-red-900 text-red-300 border-red-800',
  'Pending':       'bg-gray-800 text-gray-400 border-gray-700',
  'N/A':           'bg-gray-800 text-gray-500 border-gray-700',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-800 text-gray-400 border-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const bar = score >= 0.8 ? 'bg-emerald-500' : score >= 0.6 ? 'bg-amber-500' : 'bg-orange-500'
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-300 w-9 text-right">{pct}%</span>
    </div>
  )
}

function MatchCard({
  match,
  rank,
  isSelected,
  isSaving,
  rowUnit,
  rowValue,
  onSelect,
}: {
  match: MatchResult
  rank: number
  isSelected: boolean
  isSaving: boolean
  rowUnit: string | null
  rowValue: string | null
  onSelect: (match: MatchResult, unit: string, convertedValue: number | null) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [unitValue, setUnitValue] = useState(match.unit ?? rowUnit ?? '')
  const [sourceValue, setSourceValue] = useState(rowValue ?? '')

  const parsedSource = parseFloat(sourceValue.replace(/,/g, ''))
  const convertedValue =
    !isNaN(parsedSource) && match.conversion?.factor
      ? parsedSource * match.conversion.factor
      : null

  const unitMismatch =
    match.unit && rowUnit &&
    match.unit.trim().toLowerCase() !== rowUnit.trim().toLowerCase()

  const borderCls = isSelected
    ? 'border-indigo-600 bg-indigo-950/40'
    : confirming
    ? 'border-indigo-700 bg-gray-900'
    : match.match_score >= 0.8
    ? 'border-emerald-800 bg-emerald-950/40'
    : match.match_score >= 0.6
    ? 'border-amber-800 bg-amber-950/40'
    : 'border-orange-800 bg-orange-950/40'

  return (
    <div className={`rounded-xl border transition-colors ${borderCls}`}>
      {/* Card header — always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs text-gray-500 font-medium w-4 flex-shrink-0">#{rank}</span>
            <span className="px-2 py-0.5 bg-gray-900 border border-gray-700 text-indigo-300 text-xs font-mono font-bold rounded-lg flex-shrink-0">
              {match.kpi_code}
            </span>
            <span className="text-white text-sm font-semibold leading-snug min-w-0">{match.kpi_name}</span>
          </div>
          <ScoreBar score={match.match_score} />
        </div>

        <p className="text-gray-400 text-xs leading-relaxed mb-3">{match.rationale}</p>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-3">
          {match.unit && (
            <span className={`text-xs ${unitMismatch ? 'text-amber-400 font-medium' : 'text-gray-500'}`}>
              KPI unit: <span className="font-semibold">{match.unit}</span>
              {unitMismatch && <span className="text-gray-500 font-normal ml-1">(row has: {rowUnit})</span>}
            </span>
          )}
          {match.impact_pathway && (
            <span className="text-xs text-gray-500">
              Pathway: <span className="text-gray-400">{match.impact_pathway}</span>
            </span>
          )}
          {Array.isArray(match.tags) && match.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {match.tags.slice(0, 4).map((tag: string) => (
                <span key={tag} className="px-1.5 py-0.5 bg-gray-800 text-gray-500 text-xs rounded border border-gray-700">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {!confirming && (
          <button
            onClick={() => {
              setUnitValue(match.unit ?? rowUnit ?? '')
              setConfirming(true)
            }}
            disabled={isSaving || isSelected}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-50 ${
              isSelected
                ? 'bg-indigo-600 text-white cursor-default'
                : 'bg-gray-800 hover:bg-indigo-600 text-gray-300 hover:text-white border border-gray-700 hover:border-indigo-600'
            }`}
          >
            {isSelected ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Selected
              </>
            ) : (
              'Select this KPI'
            )}
          </button>
        )}
      </div>

      {/* Confirmation panel — unit edit step */}
      {confirming && (
        <div className="border-t border-gray-700 px-4 py-4 bg-gray-900/80 rounded-b-xl space-y-4">
          <p className="text-xs font-semibold text-gray-300">Confirm selection — adjust unit if needed</p>

          {/* Unit field */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Unit saved to this row
              {unitMismatch && (
                <span className="ml-2 text-amber-400">— mismatch detected, pre-filled with KPI standard</span>
              )}
            </label>
            <input
              type="text"
              value={unitValue}
              onChange={e => setUnitValue(e.target.value)}
              placeholder={match.unit ?? 'e.g. M³'}
              className="w-48 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Conversion calculator — only shown when Claude returned conversion data */}
          {match.conversion && unitMismatch && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Conversion preview</p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={sourceValue}
                  onChange={e => setSourceValue(e.target.value)}
                  placeholder="Enter source value"
                  className="w-40 px-2.5 py-1 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                />
                <span className="text-gray-400 text-sm font-medium">{match.conversion.from_unit}</span>
                <span className="text-gray-500 text-sm">{match.conversion.formula}</span>
                <span className="text-gray-500 text-sm">=</span>
                {convertedValue !== null ? (
                  <span className="text-indigo-300 text-sm font-semibold">
                    {convertedValue.toLocaleString(undefined, { maximumFractionDigits: 4 })} {match.conversion.to_unit}
                  </span>
                ) : (
                  <span className="text-gray-600 text-sm">? {match.conversion.to_unit}</span>
                )}
              </div>
              <p className="text-xs text-gray-600">Type your source value above to preview the converted result.</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelect(match, unitValue.trim() || rowUnit || '', convertedValue)}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                'Save selection'
              )}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HoldingMetricsTable({ projectId, rows }: { projectId: string; rows: FundRow[] }) {
  const [matchStates, setMatchStates] = useState<Record<string, RowState>>({})

  const [savedKpis, setSavedKpis] = useState<Record<string, SavedKpi | null>>(() =>
    Object.fromEntries(
      rows.map(r => [
        r.id,
        r.matched_kpi_code
          ? { code: r.matched_kpi_code, name: r.matched_kpi_name ?? '', id: r.matched_kpi_id }
          : null,
      ])
    )
  )

  // Tracks overrides applied locally so the table cells update immediately without waiting for a page reload
  const [unitOverrides, setUnitOverrides] = useState<Record<string, string>>({})
  const [indicatorOverrides, setIndicatorOverrides] = useState<Record<string, string>>({})

  const [savingRow, setSavingRow] = useState<string | null>(null)

  const handleMatch = async (row: FundRow) => {
    const current = matchStates[row.id]
    if (current?.matches) {
      setMatchStates(prev => ({ ...prev, [row.id]: { ...prev[row.id], open: !prev[row.id].open } }))
      return
    }
    setMatchStates(prev => ({ ...prev, [row.id]: { loading: true, matches: null, error: null, open: true } }))
    try {
      const res = await fetch('/api/match-kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed')
      setMatchStates(prev => ({ ...prev, [row.id]: { loading: false, matches: data.matches, error: null, open: true } }))
    } catch (e) {
      setMatchStates(prev => ({
        ...prev,
        [row.id]: { loading: false, matches: null, error: e instanceof Error ? e.message : 'Unknown error', open: true },
      }))
    }
  }

  const handleSelect = async (rowId: string, match: MatchResult, unit: string, convertedValue: number | null) => {
    setSavingRow(rowId + match.kpi_code)
    const row = rows.find(r => r.id === rowId)
    const originalUnit = row?.unit_of_metric ?? null
    const unitChanged = unit && unit !== originalUnit

    // Format the converted number for storage — strip trailing zeros after decimal
    const indicatorStr = convertedValue !== null
      ? (Number.isInteger(convertedValue)
          ? convertedValue.toString()
          : parseFloat(convertedValue.toFixed(6)).toString())
      : null

    try {
      const { error } = await saveKpiMatch(
        rowId,
        projectId,
        match.kpi_code,
        match.kpi_name,
        match.kpi_id ?? null,
        unitChanged ? unit : null,
        indicatorStr
      )
      if (error) {
        alert(`Could not save KPI: ${error}`)
      } else {
        setSavedKpis(prev => ({ ...prev, [rowId]: { code: match.kpi_code, name: match.kpi_name, id: match.kpi_id, unit } }))
        if (unitChanged) setUnitOverrides(prev => ({ ...prev, [rowId]: unit }))
        if (indicatorStr) setIndicatorOverrides(prev => ({ ...prev, [rowId]: indicatorStr }))
        setMatchStates(prev => ({ ...prev, [rowId]: { ...prev[rowId], open: false } }))
      }
    } catch {
      alert('Could not save KPI — please check your connection and try again.')
    }
    setSavingRow(null)
  }

  const tableRows = rows.flatMap((row, i) => {
    const state = matchStates[row.id]
    const saved = savedKpis[row.id]
    const isOpen = state?.open
    const hasMatches = !!state?.matches
    const displayUnit = unitOverrides[row.id] ?? row.unit_of_metric

    const metricRow = (
      <tr key={row.id} className={`hover:bg-gray-800/40 transition-colors ${i > 0 ? 'border-t border-gray-800' : ''}`}>
        <td className="px-4 py-3 text-xs whitespace-nowrap">
          {indicatorOverrides[row.id] ? (
            <span className="text-indigo-300 font-medium">{indicatorOverrides[row.id]}</span>
          ) : (
            <span className="text-gray-400">{row.level_of_indicator || '—'}</span>
          )}
        </td>
        <td className="px-4 py-3 text-white font-medium max-w-xs">
          <p className="leading-snug">{row.metric || '—'}</p>
        </td>
        <td className="px-4 py-3 text-xs whitespace-nowrap">
          {unitOverrides[row.id] ? (
            <span className="text-indigo-300 font-medium">{unitOverrides[row.id]}</span>
          ) : (
            <span className="text-gray-400">{displayUnit || '—'}</span>
          )}
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs max-w-xs">
          <p className="leading-relaxed line-clamp-3">{row.social_environmental_outcome || '—'}</p>
          {row.comments && (
            <p className="text-gray-600 mt-1 line-clamp-2 italic">{row.comments}</p>
          )}
        </td>
        <td className="px-4 py-3">
          {row.status_of_outcome ? <StatusBadge status={row.status_of_outcome} /> : <span className="text-gray-600">—</span>}
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs">{row.rally_impact_area || '—'}</td>
        <td className="px-4 py-3 text-gray-400 text-xs">{row.rally_outcome || '—'}</td>
        <td className="px-4 py-3">
          {saved ? (
            <div className="flex flex-col gap-0.5">
              <span className="px-2 py-0.5 bg-indigo-900/60 border border-indigo-700 text-indigo-300 text-xs font-mono font-bold rounded self-start">
                {saved.code}
              </span>
              <span className="text-xs text-gray-400 leading-snug max-w-[160px]">{saved.name}</span>
            </div>
          ) : (
            <button
              onClick={() => handleMatch(row)}
              disabled={state?.loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap disabled:opacity-50 ${
                isOpen && hasMatches
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
              }`}
            >
              {state?.loading ? (
                <>
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  Matching…
                </>
              ) : isOpen && hasMatches ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Hide results
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Match KPI
                </>
              )}
            </button>
          )}
        </td>
      </tr>
    )

    if (!isOpen) return [metricRow]

    const expandedRow = (
      <tr key={`${row.id}-expanded`} className="border-t border-gray-800 bg-gray-900/60">
        <td colSpan={8} className="px-5 py-4">
          {state.loading && (
            <div className="flex items-center gap-3 text-gray-400 text-sm py-1">
              <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Analysing metric and searching Rally KPI library…
            </div>
          )}
          {state.error && (
            <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
              {state.error}
            </div>
          )}
          {state.matches && state.matches.length === 0 && (
            <p className="text-gray-500 text-sm py-1">No matching KPIs found for this metric.</p>
          )}
          {state.matches && state.matches.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Suggested KPI Matches — {state.matches.length} found
              </p>
              <div className="grid gap-3">
                {state.matches.map((match, mi) => (
                  <MatchCard
                    key={match.kpi_code}
                    match={match}
                    rank={mi + 1}
                    isSelected={saved?.code === match.kpi_code}
                    isSaving={savingRow === row.id + match.kpi_code}
                    rowUnit={row.unit_of_metric}
                    rowValue={row.level_of_indicator}
                    onSelect={(m, unit, cv) => handleSelect(row.id, m, unit, cv)}
                  />
                ))}
              </div>
            </div>
          )}
        </td>
      </tr>
    )

    return [metricRow, expandedRow]
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left bg-gray-900">
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Level</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Metric</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Unit</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Outcome</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Status</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Impact Area</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rally Outcome</th>
            <th className="px-4 py-2.5 w-44 text-xs font-semibold text-gray-500 uppercase tracking-wide">Matched KPI</th>
          </tr>
        </thead>
        <tbody>{tableRows}</tbody>
      </table>
    </div>
  )
}
