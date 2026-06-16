'use client'

import { useState, useRef, useMemo, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveProject } from '@/app/actions/projects'
import type { ParsedRow } from '@/lib/parseProjectData'

// Map from lowercase header alias → ParsedRow field key
const HEADER_MAP: Record<string, string> = {
  '#':                                        'row_number',
  'number':                                   'row_number',
  'project name':                             'project_name',
  'project':                                  'project_name',
  'fund name':                                'project_name',
  'fund':                                     'project_name',
  'metric':                                   'metric',
  'indicator':                                'metric',
  'social/environmental outcome':             'social_environmental_outcome',
  'social environmental outcome':             'social_environmental_outcome',
  'outcome':                                  'social_environmental_outcome',
  'status of outcome':                        'status_of_outcome',
  'status':                                   'status_of_outcome',
  'comments regarding the reporting period':  'comments',
  'comments':                                 'comments',
  'notes':                                    'comments',
  'reporting level':                          'reporting_level',
  'underlying holding':                       'underlying_holding',
  'holding':                                  'underlying_holding',
  'company':                                  'underlying_holding',
  'level of indicator':                       'level_of_indicator',
  'indicator level':                          'level_of_indicator',
  'value':                                    'level_of_indicator',
  'amount':                                   'level_of_indicator',
  'unit of metric':                           'unit_of_metric',
  'unit':                                     'unit_of_metric',
  'units':                                    'unit_of_metric',
  'rally input: main impact area':            'rally_impact_area',
  'rally input main impact area':             'rally_impact_area',
  'main impact area':                         'rally_impact_area',
  'impact area':                              'rally_impact_area',
  'rally input: outcome':                     'rally_outcome',
  'rally input outcome':                      'rally_outcome',
  'rally outcome':                            'rally_outcome',
  'reporting start':                          'reporting_start',
  'start':                                    'reporting_start',
  'reporting end':                            'reporting_end',
  'end':                                      'reporting_end',
}

const DB_FIELDS: { key: keyof ParsedRow; label: string; required?: boolean; hint: string }[] = [
  { key: 'project_name',                label: 'Project Name',                 hint: 'Groups rows into separate projects' },
  { key: 'metric',                      label: 'Metric',                       required: true, hint: 'What is being measured' },
  { key: 'underlying_holding',          label: 'Underlying Holding',           hint: 'Company or investment name' },
  { key: 'level_of_indicator',          label: 'Level of Indicator',           hint: 'Numeric value' },
  { key: 'unit_of_metric',              label: 'Unit of Metric',               hint: 'e.g. MWh, jobs, M³' },
  { key: 'social_environmental_outcome',label: 'Outcome',                      hint: 'Social/environmental outcome' },
  { key: 'rally_impact_area',           label: 'Rally Impact Area',            hint: 'Thematic impact area' },
  { key: 'rally_outcome',               label: 'Rally Outcome',                hint: 'Impact pathway' },
  { key: 'status_of_outcome',           label: 'Status',                       hint: 'Achieved, On Track, etc.' },
  { key: 'comments',                    label: 'Comments',                     hint: 'Additional notes' },
  { key: 'reporting_level',             label: 'Reporting Level',              hint: 'Output / Outcome / Impact' },
  { key: 'reporting_start',             label: 'Reporting Start',              hint: 'Period start date' },
  { key: 'reporting_end',               label: 'Reporting End',                hint: 'Period end date' },
]

type Step = 'upload' | 'map' | 'saving'
type CellValue = string | number | boolean | null | undefined
type FieldMap = Partial<Record<keyof ParsedRow, string>>  // dbField → file column name

function autoDetect(headers: string[]): FieldMap {
  const map: FieldMap = {}
  for (const h of headers) {
    const dbKey = HEADER_MAP[h.toLowerCase().trim()]
    if (dbKey) (map as Record<string, string>)[dbKey] = h
  }
  return map
}

function applyFieldMap(fileRows: CellValue[][], headers: string[], fieldMap: FieldMap): ParsedRow[] {
  const colIndex = (col: string | undefined) =>
    col ? headers.indexOf(col) : -1

  return fileRows
    .map((row, i) => {
      const get = (key: keyof ParsedRow): string => {
        const col = fieldMap[key]
        const idx = colIndex(col)
        return idx >= 0 ? String(row[idx] ?? '').trim() : ''
      }

      const raw_row: Record<string, string> = {}
      headers.forEach((h, idx) => { raw_row[h] = String(row[idx] ?? '') })

      return {
        row_number: String(i + 1),
        project_name:                  get('project_name'),
        metric:                        get('metric'),
        social_environmental_outcome:  get('social_environmental_outcome'),
        status_of_outcome:             get('status_of_outcome'),
        comments:                      get('comments'),
        reporting_level:               get('reporting_level'),
        underlying_holding:            get('underlying_holding'),
        level_of_indicator:            get('level_of_indicator'),
        unit_of_metric:                get('unit_of_metric'),
        rally_impact_area:             get('rally_impact_area'),
        rally_outcome:                 get('rally_outcome'),
        reporting_start:               get('reporting_start'),
        reporting_end:                 get('reporting_end'),
        raw_row,
      } satisfies ParsedRow
    })
    .filter(r => r.metric?.trim())
}

export default function UploadProjectModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [fallbackName, setFallbackName] = useState('')  // used only when project_name not mapped
  const [projectNameOverrides, setProjectNameOverrides] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [fileRows, setFileRows] = useState<CellValue[][]>([])
  const [fieldMap, setFieldMap] = useState<FieldMap>({})
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('upload')
    setFallbackName('')
    setProjectNameOverrides({})
    setFileName(null)
    setFileHeaders([])
    setFileRows([])
    setFieldMap({})
    setError(null)
    setIsDragging(false)
  }

  const handleClose = () => { setOpen(false); reset() }

  const parseFile = useCallback(async (file: File) => {
    setError(null)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setError('Please upload a .csv, .xlsx, or .xls file.')
      return
    }

    try {
      const XLSX = await import('xlsx')
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab, { type: 'array', raw: false, cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<CellValue[]>(ws, { header: 1, defval: null, raw: false })

      if (data.length < 2) { setError('File appears to be empty or has no data rows.'); return }

      const headers = (data[0] as CellValue[]).map(h => String(h ?? '').trim()).filter(Boolean)
      const rows = (data.slice(1) as CellValue[][]).filter(r => r.some(c => c !== null && c !== ''))

      if (headers.length === 0) { setError('Could not read column headers from the first row.'); return }

      setFileName(file.name)
      setFileHeaders(headers)
      setFileRows(rows)
      setFieldMap(autoDetect(headers))
      setStep('map')
    } catch {
      setError('Could not read the file. Make sure it is a valid CSV or Excel file.')
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const mappedRows = useMemo(
    () => applyFieldMap(fileRows, fileHeaders, fieldMap),
    [fileRows, fileHeaders, fieldMap]
  )

  // Group rows by project_name when that column is mapped
  const projectGroups = useMemo(() => {
    if (!fieldMap.project_name) return null
    const map = new Map<string, ParsedRow[]>()
    for (const row of mappedRows) {
      const key = row.project_name?.trim() || '(No project name)'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return Array.from(map.entries()).map(([original, rows]) => ({ original, rows }))
  }, [mappedRows, fieldMap.project_name])

  const uniqueHoldings = useMemo(
    () => Array.from(new Set(mappedRows.map(r => r.underlying_holding).filter(Boolean))),
    [mappedRows]
  )

  const getProjectName = (original: string) =>
    projectNameOverrides[original]?.trim() || original

  const handleSave = () => {
    if (!fieldMap.metric) { setError('You must map the Metric column before saving.'); return }
    if (mappedRows.length === 0) { setError('No rows with a metric value found after mapping.'); return }

    if (!projectGroups) {
      // Single-project fallback (no project_name column mapped)
      if (!fallbackName.trim()) { setError('Please enter a project name.'); return }
    }

    setError(null)
    startTransition(async () => {
      setStep('saving')

      if (projectGroups && projectGroups.length > 0) {
        let lastProjectId: string | null = null
        for (const group of projectGroups) {
          const name = getProjectName(group.original)
          const { error: saveError, projectId } = await saveProject(name, group.rows)
          if (saveError) { setError(saveError); setStep('map'); return }
          lastProjectId = projectId
        }
        handleClose()
        if (projectGroups.length === 1 && lastProjectId) {
          router.push(`/dashboard/funds/${lastProjectId}`)
        } else {
          router.push('/dashboard/funds')
        }
      } else {
        const { error: saveError, projectId } = await saveProject(fallbackName.trim(), mappedRows)
        if (saveError) { setError(saveError); setStep('map'); return }
        handleClose()
        if (projectId) router.push(`/dashboard/funds/${projectId}`)
      }

      router.refresh()
    })
  }

  const savingLabel = projectGroups
    ? `Creating ${projectGroups.length} project${projectGroups.length !== 1 ? 's' : ''}…`
    : `Saving ${mappedRows.length} rows…`

  const saveDisabled = isPending
    || !fieldMap.metric
    || mappedRows.length === 0
    || (!projectGroups && !fallbackName.trim())

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Upload a new project
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          <div className={`relative w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] transition-all ${step === 'map' ? 'max-w-3xl' : 'max-w-lg'}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {step === 'upload' ? 'Upload a new project'
                    : step === 'map' ? 'Map your columns'
                    : 'Saving…'}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {step === 'upload' ? 'Upload a CSV or Excel file to get started'
                    : step === 'map' ? `${fileName} · ${fileRows.length} rows · ${fileHeaders.length} columns`
                    : savingLabel}
                </p>
              </div>
              {step !== 'saving' && (
                <div className="flex items-center gap-1.5 mr-4">
                  {(['upload', 'map'] as Step[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        step === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-500'
                      }`}>{i + 1}</div>
                      <span className={`text-xs ${step === s ? 'text-white' : 'text-gray-600'}`}>
                        {s === 'upload' ? 'Upload' : 'Map fields'}
                      </span>
                      {i === 0 && <div className="w-4 h-px bg-gray-700 mx-1" />}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={handleClose} className="text-gray-500 hover:text-white transition flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── Step 1: Upload ── */}
              {step === 'upload' && (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-16 px-6 cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-950/30'
                      : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/40'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">Drop your file here</p>
                    <p className="text-xs text-gray-500 mt-1">or click to browse · CSV, XLSX, XLS</p>
                    <p className="text-xs text-gray-600 mt-2">Projects are auto-detected from the Project Name column</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
              )}

              {/* ── Step 2: Map fields ── */}
              {step === 'map' && (
                <>
                  {/* Mapping table */}
                  <div className="border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Column mapping</p>
                      <p className="text-xs text-gray-600 mt-0.5">We auto-detected matches — adjust any that are wrong</p>
                    </div>
                    <div className="divide-y divide-gray-800/60">
                      {DB_FIELDS.map(field => (
                        <div key={field.key} className="flex items-center gap-4 px-4 py-2.5">
                          <div className="w-44 flex-shrink-0">
                            <span className={`text-sm ${fieldMap[field.key] ? 'text-white' : 'text-gray-500'}`}>
                              {field.label}
                              {field.required && <span className="text-indigo-400 ml-0.5">*</span>}
                            </span>
                            <p className="text-xs text-gray-600 mt-0.5">{field.hint}</p>
                          </div>
                          <div className="flex-1">
                            <select
                              value={fieldMap[field.key] ?? ''}
                              onChange={e => setFieldMap(prev => ({
                                ...prev,
                                [field.key]: e.target.value || undefined,
                              }))}
                              className={`w-full px-3 py-1.5 bg-gray-800 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${
                                fieldMap[field.key]
                                  ? 'border-indigo-700 text-white'
                                  : 'border-gray-700 text-gray-500'
                              }`}
                            >
                              <option value="">— not mapped —</option>
                              {fileHeaders.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                          {fieldMap[field.key] && (
                            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Project detection — multi-project or fallback name input */}
                  {mappedRows.length > 0 && (
                    projectGroups ? (
                      /* Multi-project: detected from project_name column */
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Projects to create
                          </p>
                          <span className="text-xs text-gray-600">{projectGroups.length} project{projectGroups.length !== 1 ? 's' : ''} detected</span>
                        </div>
                        <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60">
                          {projectGroups.map(group => (
                            <div key={group.original} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                              <input
                                type="text"
                                defaultValue={group.original}
                                onBlur={e => setProjectNameOverrides(prev => ({
                                  ...prev,
                                  [group.original]: e.target.value,
                                }))}
                                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <span className="text-xs text-gray-500 flex-shrink-0 w-20 text-right">
                                {group.rows.length} row{group.rows.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1.5">
                          Each entry becomes a separate project in Impact Funds. Edit names above to rename before saving.
                        </p>
                      </div>
                    ) : (
                      /* Single-project fallback: no project_name column mapped */
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Project name <span className="text-indigo-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={fallbackName}
                          onChange={e => setFallbackName(e.target.value)}
                          placeholder="e.g. Q4 2024 Fund Reporting"
                          className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                        <p className="text-xs text-gray-600 mt-1.5">
                          Map the <span className="text-gray-400">Project Name</span> column above to auto-detect multiple projects.
                        </p>
                      </div>
                    )
                  )}

                  {/* Live preview */}
                  {mappedRows.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{mappedRows.length} rows</span>
                          <span>{uniqueHoldings.length} holding{uniqueHoldings.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-gray-800">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="border-b border-gray-800 bg-gray-800/60">
                              {fieldMap.project_name && (
                                <th className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">Project</th>
                              )}
                              <th className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">Holding</th>
                              <th className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">Metric</th>
                              <th className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">Value</th>
                              <th className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">Unit</th>
                              <th className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">Impact Area</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mappedRows.slice(0, 5).map((row, i) => (
                              <tr key={i} className={i > 0 ? 'border-t border-gray-800/60' : ''}>
                                {fieldMap.project_name && (
                                  <td className="px-3 py-2 text-violet-300 whitespace-nowrap max-w-[100px] truncate">
                                    {row.project_name || <span className="text-gray-600">—</span>}
                                  </td>
                                )}
                                <td className="px-3 py-2 text-indigo-300 whitespace-nowrap max-w-[120px] truncate">{row.underlying_holding || <span className="text-gray-600">—</span>}</td>
                                <td className="px-3 py-2 text-gray-300 max-w-[180px] truncate">{row.metric || <span className="text-gray-600">—</span>}</td>
                                <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{row.level_of_indicator || <span className="text-gray-600">—</span>}</td>
                                <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{row.unit_of_metric || <span className="text-gray-600">—</span>}</td>
                                <td className="px-3 py-2 text-gray-400 max-w-[120px] truncate">{row.rally_impact_area || <span className="text-gray-600">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {mappedRows.length > 5 && (
                        <p className="text-xs text-gray-600 mt-1.5 text-right">+ {mappedRows.length - 5} more rows</p>
                      )}
                    </div>
                  )}

                  {mappedRows.length === 0 && fieldMap.metric && (
                    <div className="px-4 py-3 bg-amber-950 border border-amber-800 rounded-lg text-amber-300 text-xs">
                      No rows have a value in the mapped Metric column. Check that you selected the right column.
                    </div>
                  )}
                </>
              )}

              {/* ── Saving ── */}
              {step === 'saving' && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">{savingLabel}</p>
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            {step !== 'saving' && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 flex-shrink-0">
                <button
                  onClick={step === 'upload' ? handleClose : () => { setStep('upload'); setError(null) }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
                >
                  {step === 'upload' ? 'Cancel' : '← Back'}
                </button>
                {step === 'map' && (
                  <button
                    onClick={handleSave}
                    disabled={saveDisabled}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
                  >
                    {projectGroups
                      ? `Create ${projectGroups.length} project${projectGroups.length !== 1 ? 's' : ''}`
                      : `Save ${mappedRows.length > 0 ? `${mappedRows.length} rows` : 'project'}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
