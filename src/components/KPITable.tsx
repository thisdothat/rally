'use client'

import { useState, useMemo } from 'react'
import { upsertKpi, deleteKpi, type KPIData } from '@/app/actions/kpis'

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

const STATUS_OPTIONS = ['Validated', 'Needs Follow-Up', 'Draft']
const PATHWAY_OPTIONS = ['Output', 'Outcome', 'Impact']

const STATUS_COLORS: Record<string, string> = {
  'Validated':       'bg-emerald-900 text-emerald-300 border-emerald-800',
  'Needs Follow-Up': 'bg-amber-900 text-amber-300 border-amber-800',
  'Draft':           'bg-gray-800 text-gray-400 border-gray-700',
}

const PATHWAY_COLORS: Record<string, string> = {
  'Output':  'bg-blue-900 text-blue-300 border-blue-800',
  'Outcome': 'bg-purple-900 text-purple-300 border-purple-800',
  'Impact':  'bg-rose-900 text-rose-300 border-rose-800',
}

const EMPTY_KPI: Omit<KPI, 'id'> = {
  code: '',
  name: '',
  description: '',
  kpi_status: 'Draft',
  unit: '',
  aggregation_method: '',
  tags: [],
  impact_pathway: 'Output',
}

function EditForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Partial<KPI>
  onSave: (data: KPIData) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState<Omit<KPI, 'id'>>({
    ...EMPTY_KPI,
    ...initial,
  })
  const [tagsInput, setTagsInput] = useState((initial.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('Code and Name are required.')
      return
    }
    setSaving(true)
    setError(null)
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    await onSave({ ...initial, ...form, tags })
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirm('Delete this KPI? This cannot be undone.')) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="p-4 bg-gray-800/60 border-t border-gray-700 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Code <span className="text-indigo-400">*</span></label>
          <input
            value={form.code}
            onChange={e => set('code', e.target.value)}
            placeholder="e.g. KPI-001"
            className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Unit</label>
          <input
            value={form.unit}
            onChange={e => set('unit', e.target.value)}
            placeholder="e.g. MWh, jobs, tCO2e"
            className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Name <span className="text-indigo-400">*</span></label>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="KPI name"
          className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Description / Definition</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={3}
          placeholder="What does this KPI measure?"
          className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={form.kpi_status}
            onChange={e => set('kpi_status', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Impact Pathway</label>
          <select
            value={form.impact_pathway}
            onChange={e => set('impact_pathway', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {PATHWAY_OPTIONS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Aggregation Method</label>
          <input
            value={form.aggregation_method}
            onChange={e => set('aggregation_method', e.target.value)}
            placeholder="e.g. Sum, Average"
            className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Impact Areas <span className="text-gray-600">(comma-separated)</span></label>
        <input
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          placeholder="e.g. Clean Energy, Quality Jobs"
          className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-600 hover:text-red-400 transition disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete KPI'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function KPITable({ kpis: initialKpis }: { kpis: KPI[] }) {
  const [kpis, setKpis] = useState<KPI[]>(initialKpis)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [pathwayFilter, setPathwayFilter] = useState('All')
  const [areaFilter, setAreaFilter] = useState('All')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)

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

  const handleSave = async (id: string | undefined, data: KPIData) => {
    const { error, id: newId } = await upsertKpi({ ...data, id })
    if (error) { alert(`Save failed: ${error}`); return }
    if (id) {
      setKpis(prev => prev.map(k => k.id === id ? { ...k, ...data } : k))
    } else {
      setKpis(prev => [...prev, { ...data, id: newId! }])
      setAddingNew(false)
    }
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteKpi(id)
    if (error) { alert(`Delete failed: ${error}`); return }
    setKpis(prev => prev.filter(k => k.id !== id))
    setEditingId(null)
  }

  return (
    <div>
      {/* Filters + Add button */}
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

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {['All', ...STATUS_OPTIONS].map(s => <option key={s}>{s}</option>)}
        </select>

        <select value={pathwayFilter} onChange={e => setPathwayFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {['All', ...PATHWAY_OPTIONS].map(p => <option key={p}>{p}</option>)}
        </select>

        <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-56">
          {allAreas.map(a => <option key={a}>{a}</option>)}
        </select>

        <span className="px-3 py-2 text-sm text-gray-500 self-center">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>

        <button
          onClick={() => { setAddingNew(true); setEditingId(null) }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add KPI
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* New KPI form */}
        {addingNew && (
          <div className="border-b border-gray-700">
            <div className="px-4 py-3 bg-indigo-950/40 flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-400 rounded-full" />
              <span className="text-sm font-semibold text-white">New KPI</span>
            </div>
            <EditForm
              initial={EMPTY_KPI}
              onSave={data => handleSave(undefined, data)}
              onCancel={() => setAddingNew(false)}
            />
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Code</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">KPI Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Unit</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Pathway</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Impact Areas</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !addingNew && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">
                  No KPIs match your filters.
                </td>
              </tr>
            )}
            {filtered.map((kpi) => (
              <tr key={kpi.id} className="border-t border-gray-800">
                <td colSpan={editingId === kpi.id ? 7 : 1} className={editingId === kpi.id ? 'p-0' : 'px-4 py-3 font-mono text-indigo-400 text-xs'}>
                  {editingId === kpi.id ? (
                    <>
                      <div className="px-4 py-3 bg-gray-800/40 flex items-center gap-2">
                        <span className="font-mono text-indigo-400 text-xs">{kpi.code}</span>
                        <span className="text-white text-sm font-medium">{kpi.name}</span>
                      </div>
                      <EditForm
                        initial={kpi}
                        onSave={data => handleSave(kpi.id, data)}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => handleDelete(kpi.id)}
                      />
                    </>
                  ) : kpi.code}
                </td>
                {editingId !== kpi.id && (
                  <>
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
                          <span key={tag} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded border border-gray-700">{tag}</span>
                        ))}
                        {(kpi.tags ?? []).length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-800 text-gray-500 text-xs rounded border border-gray-700">
                            +{(kpi.tags ?? []).length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setEditingId(kpi.id); setAddingNew(false) }}
                        className="text-xs text-gray-600 hover:text-indigo-400 transition"
                      >
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
