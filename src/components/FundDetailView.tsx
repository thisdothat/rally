'use client'

import React, { useState, useRef, useMemo } from 'react'
import { saveKpiMatch, remapProjectRows } from '@/app/actions/projects'

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

type SavedKpi = { code: string; name: string; id?: string | null; unit?: string; confidence?: number | null; flag?: string | null }

type BatchState = {
  running: boolean
  currentRowId: string | null
  currentMetric: string | null
  processedCount: number
  totalCount: number
  startTime: number
  rowDurations: number[]
  cancelled: boolean
}

export type FundRow = {
  id: string
  project_name: string | null
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
  reporting_start: string | null
  reporting_end: string | null
  matched_kpi_id?: string | null
  matched_kpi_code?: string | null
  matched_kpi_name?: string | null
  match_confidence?: number | null
  match_flag?: string | null
  exclusion_code?: string | null
  exclusion_notes?: string | null
  raw_row?: Record<string, string> | null
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

function parseMetricValue(str: string | null | undefined): number | null {
  if (!str) return null
  const n = parseFloat(str.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function formatMetricValue(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M'
  if (n >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function areaAccent(area: string | null | undefined): { bar: string; text: string; bg: string } {
  const a = (area ?? '').toLowerCase()
  if (a.includes('climat') || a.includes('ghg') || a.includes('carbon') || a.includes('emission'))
    return { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  if (a.includes('energy') || a.includes('solar') || a.includes('renewab'))
    return { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' }
  if (a.includes('water'))
    return { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' }
  if (a.includes('employ') || a.includes('job') || a.includes('econom'))
    return { bar: 'bg-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10' }
  if (a.includes('health'))
    return { bar: 'bg-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10' }
  if (a.includes('educat') || a.includes('school'))
    return { bar: 'bg-sky-500', text: 'text-sky-400', bg: 'bg-sky-500/10' }
  if (a.includes('gender') || a.includes('women'))
    return { bar: 'bg-pink-500', text: 'text-pink-400', bg: 'bg-pink-500/10' }
  if (a.includes('food') || a.includes('agri') || a.includes('nutri'))
    return { bar: 'bg-lime-500', text: 'text-lime-400', bg: 'bg-lime-500/10' }
  if (a.includes('hous') || a.includes('shelter'))
    return { bar: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10' }
  return { bar: 'bg-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-500/10' }
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `~${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? `~${m}m` : `~${m}m ${rem}s`
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

      {confirming && (
        <div className="border-t border-gray-700 px-4 py-4 bg-gray-900/80 rounded-b-xl space-y-4">
          <p className="text-xs font-semibold text-gray-300">Confirm selection — adjust unit if needed</p>

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

export default function FundDetailView({
  projectId,
  rows,
}: {
  projectId: string
  rows: FundRow[]
}) {
  const [matchStates, setMatchStates] = useState<Record<string, RowState>>({})
  const [savedKpis, setSavedKpis] = useState<Record<string, SavedKpi | null>>(() =>
    Object.fromEntries(
      rows.map(r => [
        r.id,
        r.matched_kpi_code
          ? { code: r.matched_kpi_code, name: r.matched_kpi_name ?? '', id: r.matched_kpi_id, confidence: r.match_confidence, flag: r.match_flag }
          : null,
      ])
    )
  )
  const [unitOverrides, setUnitOverrides] = useState<Record<string, string>>({})
  const [indicatorOverrides, setIndicatorOverrides] = useState<Record<string, string>>({})
  const [exclusionCodes] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(rows.map(r => [r.id, r.exclusion_code ?? null]))
  )
  const [kpiEdits, setKpiEdits] = useState<Record<string, { code: string; name: string }>>(() =>
    Object.fromEntries(
      rows
        .filter(r => r.matched_kpi_code)
        .map(r => [r.id, { code: r.matched_kpi_code!, name: r.matched_kpi_name ?? '' }])
    )
  )
  const [savingRow, setSavingRow] = useState<string | null>(null)

  const [batch, setBatch] = useState<BatchState | null>(null)
  const cancelRef = useRef(false)

  // Re-map columns state
  const [remapOpen, setRemapOpen] = useState(false)
  const [remapSaving, setRemapSaving] = useState(false)
  const [remapError, setRemapError] = useState<string | null>(null)
  const [remapSuccess, setRemapSuccess] = useState(false)

  const rawHeaders = useMemo(() => {
    const first = rows.find(r => r.raw_row && Object.keys(r.raw_row).length > 0)
    return first?.raw_row ? Object.keys(first.raw_row) : []
  }, [rows])

  const DB_FIELD_LABELS: { key: string; label: string }[] = [
    { key: 'metric',                       label: 'Metric' },
    { key: 'level_of_indicator',           label: 'Level of Indicator' },
    { key: 'unit_of_metric',               label: 'Unit of Metric' },
    { key: 'project_name',                 label: 'Product Name' },
    { key: 'underlying_holding',           label: 'Underlying Holding' },
    { key: 'reporting_start',              label: 'Reporting Start' },
    { key: 'reporting_end',                label: 'Reporting End' },
    { key: 'reporting_level',              label: 'Reporting Level' },
    { key: 'status_of_outcome',            label: 'Status of Outcome' },
    { key: 'social_environmental_outcome', label: 'Social/Environmental Outcome' },
    { key: 'rally_impact_area',            label: 'Rally Input: Main Impact Area' },
    { key: 'rally_outcome',                label: 'Rally Input: Outcome' },
    { key: 'comments',                     label: 'Comments regarding the reporting period' },
  ]

  // Auto-detect current mapping by matching field values against raw_row keys
  const initialRemapMap = useMemo(() => {
    const map: Record<string, string> = {}
    const sampleRow = rows[0]
    if (!sampleRow?.raw_row) return map
    for (const { key } of DB_FIELD_LABELS) {
      const currentVal = (sampleRow as unknown as Record<string, string>)[key]
      if (!currentVal) continue
      const match = Object.entries(sampleRow.raw_row).find(([, v]) => v === currentVal)
      if (match) map[key] = match[0]
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const [remapMap, setRemapMap] = useState<Record<string, string>>({})

  const handleOpenRemap = () => {
    setRemapMap(initialRemapMap)
    setRemapError(null)
    setRemapSuccess(false)
    setRemapOpen(true)
  }

  const handleSaveRemap = async () => {
    setRemapSaving(true)
    setRemapError(null)
    const { error, updated } = await remapProjectRows(projectId, remapMap)
    setRemapSaving(false)
    if (error) { setRemapError(error); return }
    setRemapSuccess(true)
    setTimeout(() => { setRemapOpen(false); setRemapSuccess(false) }, 1200)
    void updated
  }

  const holdingMap = useMemo(() => {
    const map = new Map<string, FundRow[]>()
    for (const row of rows) {
      const key = row.underlying_holding || 'Ungrouped'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return map
  }, [rows])

  const unmatchedCount = rows.filter(r => !savedKpis[r.id] && !exclusionCodes[r.id]).length


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

    const indicatorStr = convertedValue !== null
      ? (Number.isInteger(convertedValue)
          ? convertedValue.toString()
          : parseFloat(convertedValue.toFixed(6)).toString())
      : null

    const confidence = Math.round(match.match_score * 100)
    const flag = confidence >= 80 ? 'exact_match' : confidence >= 50 ? 'needs_review' : null

    try {
      const { error } = await saveKpiMatch(
        rowId,
        projectId,
        match.kpi_code,
        match.kpi_name,
        match.kpi_id ?? null,
        unitChanged ? unit : null,
        indicatorStr,
        confidence,
        flag,
      )
      if (error) {
        alert(`Could not save KPI: ${error}`)
      } else {
        setSavedKpis(prev => ({ ...prev, [rowId]: { code: match.kpi_code, name: match.kpi_name, id: match.kpi_id, unit, confidence, flag } }))
        setKpiEdits(prev => ({ ...prev, [rowId]: { code: match.kpi_code, name: match.kpi_name } }))
        if (unitChanged) setUnitOverrides(prev => ({ ...prev, [rowId]: unit }))
        if (indicatorStr) setIndicatorOverrides(prev => ({ ...prev, [rowId]: indicatorStr }))
        setMatchStates(prev => ({ ...prev, [rowId]: { ...prev[rowId], open: false } }))
      }
    } catch {
      alert('Could not save KPI — please check your connection and try again.')
    }
    setSavingRow(null)
  }


  const handleKpiEditBlur = async (rowId: string) => {
    const edit = kpiEdits[rowId]
    const saved = savedKpis[rowId]
    if (!edit || !saved) return
    if (edit.code === saved.code && edit.name === saved.name) return
    const { error } = await saveKpiMatch(
      rowId, projectId,
      edit.code || null, edit.name || null, saved.id ?? null,
      null, null, saved.confidence ?? null, saved.flag ?? null,
    )
    if (!error) {
      setSavedKpis(prev => ({ ...prev, [rowId]: { ...prev[rowId]!, code: edit.code, name: edit.name } }))
    }
  }

  const runBatch = async () => {
    const toProcess = rows.filter(r => !savedKpis[r.id] && !exclusionCodes[r.id])
    if (toProcess.length === 0) return

    cancelRef.current = false
    setBatch({
      running: true,
      currentRowId: null,
      currentMetric: null,
      processedCount: 0,
      totalCount: toProcess.length,
      startTime: Date.now(),
      rowDurations: [],
      cancelled: false,
    })

    for (let i = 0; i < toProcess.length; i++) {
      if (cancelRef.current) {
        setBatch(prev => prev ? { ...prev, running: false, cancelled: true, processedCount: i } : null)
        return
      }

      const row = toProcess[i]
      setBatch(prev => prev ? {
        ...prev,
        currentRowId: row.id,
        currentMetric: row.metric,
        processedCount: i,
      } : null)

      const rowStart = Date.now()
      try {
        const res = await fetch('/api/match-kpi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row }),
        })
        const data = await res.json()
        if (res.ok && !data.error && data.matches?.length > 0) {
          const matches: MatchResult[] = data.matches
          setMatchStates(prev => ({
            ...prev,
            [row.id]: { loading: false, matches, error: null, open: false },
          }))
          // Auto-save the top match
          const top = matches[0]
          const confidence = Math.round(top.match_score * 100)
          const flag = confidence >= 80 ? 'exact_match' : confidence >= 50 ? 'needs_review' : null
          try {
            const { error } = await saveKpiMatch(
              row.id, projectId,
              top.kpi_code, top.kpi_name, top.kpi_id ?? null,
              null, null, confidence, flag,
            )
            if (!error) {
              setSavedKpis(prev => ({ ...prev, [row.id]: { code: top.kpi_code, name: top.kpi_name, id: top.kpi_id, unit: row.unit_of_metric ?? '', confidence, flag } }))
              setKpiEdits(prev => ({ ...prev, [row.id]: { code: top.kpi_code, name: top.kpi_name } }))
            }
          } catch { /* silently continue */ }
        }
      } catch {
        // silently continue — individual row failure shouldn't stop the batch
      }

      const duration = Date.now() - rowStart
      setBatch(prev => prev ? {
        ...prev,
        processedCount: i + 1,
        rowDurations: [...prev.rowDurations, duration],
      } : null)
    }

    setBatch(prev => prev ? { ...prev, running: false, currentRowId: null, currentMetric: null } : null)
  }

  const renderTable = (holdingRows: FundRow[]) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60">
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Metric</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Holding</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Reporting Level</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Level of Indicator</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Unit of Metric</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Status</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Start</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">End</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Impact Area</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Rally Outcome</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Social/Env Outcome</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Comments</th>
              <th className="px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">Matched KPI</th>
            </tr>
          </thead>
          <tbody>
            {holdingRows.map((row, i) => {
              const state = matchStates[row.id]
              const saved = savedKpis[row.id]
              const isOpen = state?.open
              const exclusion = exclusionCodes[row.id]
              const isExcluded = !!exclusion

              return (
                <React.Fragment key={row.id}>
                  <tr
                    key={row.id}
                    className={`border-b border-gray-800 transition-colors ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'} ${isExcluded ? 'opacity-40' : 'hover:bg-gray-800/50'}`}
                  >
                    <td className="px-3 py-2 text-white max-w-xs">
                      <span className={isExcluded ? 'line-through text-gray-500' : ''}>{row.metric || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.underlying_holding || '—'}</td>
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.reporting_level || '—'}</td>
                    <td className="px-3 py-2 text-white font-medium whitespace-nowrap">
                      {row.level_of_indicator || <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.unit_of_metric || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.status_of_outcome
                        ? <StatusBadge status={row.status_of_outcome} />
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.reporting_start || '—'}</td>
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.reporting_end || '—'}</td>
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.rally_impact_area || '—'}</td>
                    <td className="px-3 py-2 text-gray-300 max-w-xs">{row.rally_outcome || '—'}</td>
                    <td className="px-3 py-2 text-gray-300 max-w-xs">{row.social_environmental_outcome || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 italic max-w-xs">{row.comments || '—'}</td>
                    <td className="px-3 py-2" style={{minWidth: '220px'}}>
                      {saved ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={kpiEdits[row.id]?.code ?? saved.code}
                              onChange={e => setKpiEdits(prev => ({ ...prev, [row.id]: { ...prev[row.id] ?? { code: saved.code, name: saved.name }, code: e.target.value } }))}
                              onBlur={() => handleKpiEditBlur(row.id)}
                              className="w-24 px-1.5 py-0.5 bg-indigo-950/60 border border-indigo-700 text-indigo-300 font-mono font-bold rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            {saved.confidence != null && (
                              <span className={`text-xs px-1 py-0.5 rounded border flex-shrink-0 ${saved.confidence >= 80 ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800' : 'bg-amber-900/40 text-amber-400 border-amber-800'}`}>
                                {saved.confidence}%
                              </span>
                            )}
                            <button
                              onClick={() => handleMatch(row)}
                              disabled={state?.loading}
                              className="text-xs text-gray-600 hover:text-gray-300 transition disabled:opacity-50 flex-shrink-0"
                            >
                              {state?.loading ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : 'Re-match'}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={kpiEdits[row.id]?.name ?? saved.name}
                            onChange={e => setKpiEdits(prev => ({ ...prev, [row.id]: { ...prev[row.id] ?? { code: saved.code, name: saved.name }, name: e.target.value } }))}
                            onBlur={() => handleKpiEditBlur(row.id)}
                            className="w-full px-1.5 py-0.5 bg-gray-800 border border-gray-700 text-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleMatch(row)}
                          disabled={state?.loading || isExcluded}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-gray-800 hover:bg-indigo-600 text-gray-300 hover:text-white border border-gray-700 hover:border-indigo-600 transition disabled:opacity-40"
                        >
                          {state?.loading ? (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          )}
                          {state?.loading ? 'Matching…' : 'Match KPI'}
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* KPI match results row */}
                  {isOpen && !isExcluded && (
                    <tr className="bg-gray-800/40 border-b border-gray-700">
                      <td colSpan={13} className="px-4 py-3">
                        {state.loading && (
                          <div className="flex items-center gap-2 text-gray-400 text-xs">
                            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            Analysing metric and searching Rally KPI library…
                          </div>
                        )}
                        {state.error && (
                          <p className="text-red-400 text-xs">{state.error}</p>
                        )}
                        {state.matches && state.matches.length === 0 && (
                          <p className="text-gray-500 text-xs">No matching KPIs found.</p>
                        )}
                        {state.matches && state.matches.length > 0 && (
                          <div className="grid gap-2">
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
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // Time estimate for the progress panel
  const avgDuration = batch && batch.rowDurations.length > 0
    ? batch.rowDurations.reduce((a, b) => a + b, 0) / batch.rowDurations.length
    : null
  const remainingMs = batch && avgDuration !== null
    ? (batch.totalCount - batch.processedCount) * avgDuration
    : null

  // Build matched metrics dashboard data
  const matchedRows = rows.filter(r => savedKpis[r.id])

  // Group by unit to compute relative bar widths within each unit type
  const unitMaxMap = new Map<string, number>()
  for (const row of matchedRows) {
    const unit = unitOverrides[row.id] ?? row.unit_of_metric ?? ''
    const val = parseMetricValue(indicatorOverrides[row.id] ?? row.level_of_indicator)
    if (val !== null) {
      unitMaxMap.set(unit, Math.max(unitMaxMap.get(unit) ?? 0, val))
    }
  }

  return (
    <div className="space-y-6">

      {/* Re-map columns panel */}
      {remapOpen && rawHeaders.length > 0 && (
        <div className="bg-gray-900 border border-amber-700/60 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-semibold text-white">Fix column mapping</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Match each field to the correct column from your original spreadsheet, then save to update all rows.
              </p>
            </div>
            <button onClick={() => setRemapOpen(false)} className="text-gray-500 hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {DB_FIELD_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-52 flex-shrink-0">{label}</span>
                  <select
                    value={remapMap[key] ?? ''}
                    onChange={e => setRemapMap(prev => ({ ...prev, [key]: e.target.value }))}
                    className={`flex-1 px-2.5 py-1.5 bg-gray-800 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      remapMap[key] ? 'border-indigo-700 text-white' : 'border-gray-700 text-gray-500'
                    }`}
                  >
                    <option value="">— not mapped —</option>
                    {rawHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {remapError && (
              <p className="mt-3 text-xs text-red-400">{remapError}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSaveRemap}
                disabled={remapSaving || remapSuccess}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                {remapSaving ? (
                  <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Remapping…</>
                ) : remapSuccess ? (
                  <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Done</>
                ) : 'Apply remapping to all rows'}
              </button>
              <button onClick={() => setRemapOpen(false)} className="text-sm text-gray-500 hover:text-white transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matched metrics dashboard — compact table */}
      {matchedRows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Impact Overview</h2>
            <span className="text-xs text-gray-500">
              {matchedRows.length} matched{unmatchedCount > 0 ? ` · ${unmatchedCount} remaining` : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide w-4"></th>
                  <th className="px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide">Metric</th>
                  <th className="px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide text-right w-36">Value</th>
                  <th className="px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide">Matched KPI</th>
                  <th className="px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide">Holding</th>
                </tr>
              </thead>
              <tbody>
                {matchedRows.map((row, i) => {
                  const saved = savedKpis[row.id]!
                  const displayUnit = unitOverrides[row.id] ?? row.unit_of_metric ?? ''
                  const rawValue = indicatorOverrides[row.id] ?? row.level_of_indicator
                  const numericValue = parseMetricValue(rawValue)
                  const accent = areaAccent(row.rally_impact_area)

                  return (
                    <tr key={row.id} className={`hover:bg-gray-800/40 transition-colors ${i > 0 ? 'border-t border-gray-800/60' : ''}`}>
                      {/* Color dot */}
                      <td className="pl-4 pr-2 py-2.5">
                        <div className={`w-2 h-2 rounded-full ${accent.bar} flex-shrink-0`} />
                      </td>
                      {/* Metric */}
                      <td className="px-4 py-2.5 text-gray-300 max-w-xs">
                        <p className="truncate">{row.metric || '—'}</p>
                      </td>
                      {/* Value */}
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className="text-white font-semibold">
                          {numericValue !== null ? formatMetricValue(numericValue) : rawValue || '—'}
                        </span>
                        {displayUnit && (
                          <span className={`ml-1 font-medium ${accent.text}`}>{displayUnit}</span>
                        )}
                      </td>
                      {/* KPI */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 font-mono font-bold rounded ${accent.bg} ${accent.text} flex-shrink-0`}>
                            {saved.code}
                          </span>
                          <span className="text-gray-400 truncate max-w-[160px]">{saved.name}</span>
                        </div>
                      </td>
                      {/* Holding */}
                      <td className="px-4 py-2.5 text-gray-500 truncate max-w-[140px]">
                        {row.underlying_holding || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch control bar */}
      <div>
        {!batch?.running && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {unmatchedCount > 0
                ? `${unmatchedCount} metric${unmatchedCount !== 1 ? 's' : ''} not yet matched`
                : rows.length > 0
                ? 'All metrics matched'
                : ''}
            </p>
            <div className="flex items-center gap-2">
              {rawHeaders.length > 0 && (
                <button
                  onClick={handleOpenRemap}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Fix column mapping
                </button>
              )}
              {unmatchedCount > 0 && (
                <button
                  onClick={runBatch}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-indigo-900/30"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Find KPIs
                </button>
              )}
            </div>
          </div>
        )}

        {/* Progress panel — shown while running or just completed */}
        {batch && (
          <div className={`rounded-xl border p-4 transition-colors ${
            batch.running
              ? 'border-indigo-700 bg-indigo-950/40'
              : batch.cancelled
              ? 'border-gray-700 bg-gray-900/60'
              : 'border-emerald-800 bg-emerald-950/30'
          }`}>
            {batch.running ? (
              <>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse flex-shrink-0" />
                      <span className="text-sm font-semibold text-white">Finding KPIs…</span>
                      <span className="text-xs text-gray-500">{batch.processedCount} of {batch.totalCount} done</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 truncate">
                      {batch.currentMetric
                        ? `Working on: ${batch.currentMetric}`
                        : 'Starting…'}
                    </p>
                  </div>
                  <button
                    onClick={() => { cancelRef.current = true }}
                    className="flex-shrink-0 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition"
                  >
                    Stop
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                      style={{ width: `${batch.totalCount > 0 ? (batch.processedCount / batch.totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{Math.round((batch.processedCount / batch.totalCount) * 100)}% complete</span>
                  <span>
                    {remainingMs !== null
                      ? `${formatDuration(remainingMs)} remaining`
                      : batch.totalCount > 0
                      ? `${formatDuration(batch.totalCount * 10000)} estimated`
                      : ''}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  {batch.cancelled ? (
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-white">
                    {batch.cancelled ? 'Stopped' : 'Done'} — {batch.processedCount} of {batch.totalCount} rows processed
                  </span>
                  <span className="text-xs text-gray-500">
                    in {formatDuration(Date.now() - batch.startTime)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {unmatchedCount > 0 && (
                    <button
                      onClick={runBatch}
                      className="px-3 py-1.5 text-xs text-indigo-300 hover:text-white border border-indigo-700 hover:border-indigo-500 rounded-lg transition"
                    >
                      Run again
                    </button>
                  )}
                  <button
                    onClick={() => setBatch(null)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Holdings */}
      {Array.from(holdingMap.entries()).map(([holding, holdingRows]) => {
        const impactAreas = Array.from(new Set((holdingRows ?? []).map(r => r.rally_impact_area).filter(Boolean)))
        return (
          <div key={holding} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Holding header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-850">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{holding}</p>
                  <p className="text-gray-500 text-xs">{holdingRows?.length} metric{(holdingRows?.length ?? 0) !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                {impactAreas.slice(0, 4).map(area => (
                  <span key={area} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded border border-gray-700">
                    {area}
                  </span>
                ))}
                {impactAreas.length > 4 && (
                  <span className="px-2 py-0.5 bg-gray-800 text-gray-500 text-xs rounded border border-gray-700">
                    +{impactAreas.length - 4}
                  </span>
                )}
              </div>
            </div>

            {renderTable(holdingRows ?? [])}
          </div>
        )
      })}
    </div>
  )
}
