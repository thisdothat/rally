'use client'

import { useState, useTransition } from 'react'
import { saveAgentConfig, type AgentConfig } from '@/app/actions/agent'
import { DEFAULT_KEYWORD_RULES, DEFAULT_PROMPT_TEMPLATE, type KeywordRule } from '@/lib/agentDefaults'

type RuleRow = KeywordRule & { _id: string }

function ruleId() { return Math.random().toString(36).slice(2) }

function toRows(rules: KeywordRule[]): RuleRow[] {
  return (rules.length > 0 ? rules : DEFAULT_KEYWORD_RULES).map(r => ({ ...r, _id: ruleId() }))
}

export default function AgentConfigView({ initial }: { initial: AgentConfig }) {
  const [rules, setRules] = useState<RuleRow[]>(() => toRows(initial.keyword_rules))
  const [promptText, setPromptText] = useState(initial.prompt_override ?? DEFAULT_PROMPT_TEMPLATE)
  const [promptEditing, setPromptEditing] = useState(false)
  const [model, setModel] = useState(initial.model)
  const [maxTokens, setMaxTokens] = useState(initial.max_tokens)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const updateRule = (id: string, field: 'triggers' | 'tags', value: string) => {
    setRules(prev => prev.map(r =>
      r._id === id
        ? { ...r, [field]: value.split(',').map(s => s.trim()).filter(Boolean) }
        : r
    ))
  }

  const addRule = () => {
    setRules(prev => [...prev, { _id: ruleId(), triggers: [], tags: [] }])
  }

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(r => r._id !== id))
  }

  const handleSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const { error: err } = await saveAgentConfig({
        id:              initial.id,
        keyword_rules:   rules.map(({ triggers, tags }) => ({ triggers, tags })),
        prompt_override: promptText !== DEFAULT_PROMPT_TEMPLATE ? promptText : null,
        model,
        max_tokens:      maxTokens,
      })
      if (err) { setError(err); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  const resetPrompt = () => setPromptText(DEFAULT_PROMPT_TEMPLATE)

  return (
    <div className="space-y-8">

      {/* ── How it works ── */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4">How matching works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            {
              step: '1',
              title: 'Impact area signal',
              body: 'Filters KPIs whose tags overlap with the row\'s Rally Impact Area field.',
              color: 'border-indigo-800 bg-indigo-950/30',
              badge: 'bg-indigo-900 text-indigo-300',
            },
            {
              step: '2',
              title: 'Keyword signal',
              body: 'Extracts keywords from the metric text and matches them against KPI names.',
              color: 'border-violet-800 bg-violet-950/30',
              badge: 'bg-violet-900 text-violet-300',
            },
            {
              step: '3',
              title: 'Rule signal',
              body: 'Applies your keyword rules below — trigger words force-include KPIs by tag.',
              color: 'border-amber-800 bg-amber-950/30',
              badge: 'bg-amber-900 text-amber-300',
            },
            {
              step: '4',
              title: 'AI ranking',
              body: 'Claude receives the filtered KPI shortlist and ranks them with a score and rationale.',
              color: 'border-emerald-800 bg-emerald-950/30',
              badge: 'bg-emerald-900 text-emerald-300',
            },
          ].map(card => (
            <div key={card.step} className={`rounded-xl border p-4 ${card.color}`}>
              <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-2 ${card.badge}`}>
                {card.step}
              </div>
              <p className="text-white text-sm font-medium mb-1">{card.title}</p>
              <p className="text-gray-400 text-xs leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">
          Signals 1–3 build a shortlist (min 5 KPIs). If fewer than 5 match, all 88 KPIs are sent to the AI.
          The AI prompt and model settings below control step 4.
        </p>
      </section>

      {/* ── Keyword rules ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Keyword rules</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              When a metric contains a trigger word, all KPIs matching the listed tags are added to the shortlist.
            </p>
          </div>
          <button
            onClick={addRule}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add rule
          </button>
        </div>

        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_24px_1fr_36px] gap-0 px-4 py-2.5 bg-gray-800/50 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Trigger words <span className="text-gray-700 font-normal normal-case">(comma-separated)</span></span>
            <span />
            <span>KPI tags to include <span className="text-gray-700 font-normal normal-case">(comma-separated)</span></span>
            <span />
          </div>
          <div className="divide-y divide-gray-800/60">
            {rules.map(rule => (
              <div key={rule._id} className="grid grid-cols-[1fr_24px_1fr_36px] items-center gap-3 px-4 py-2.5">
                <input
                  type="text"
                  defaultValue={rule.triggers.join(', ')}
                  onBlur={e => updateRule(rule._id, 'triggers', e.target.value)}
                  placeholder="e.g. water, litre, aqua"
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <svg className="w-4 h-4 text-gray-600 flex-shrink-0 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <input
                  type="text"
                  defaultValue={rule.tags.join(', ')}
                  onBlur={e => updateRule(rule._id, 'tags', e.target.value)}
                  placeholder="e.g. Water, Water & Sanitation"
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => removeRule(rule._id)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/30 transition mx-auto"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {rules.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-600 text-sm">
                No rules yet. Add one above.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── AI Prompt ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">AI prompt</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sent to Claude for every match. Use <code className="text-indigo-400 bg-gray-800 px-1 rounded">{'{rowContext}'}</code>, <code className="text-indigo-400 bg-gray-800 px-1 rounded">{'{kpiList}'}</code>, and <code className="text-indigo-400 bg-gray-800 px-1 rounded">{'{kpiCount}'}</code> as placeholders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {promptText !== DEFAULT_PROMPT_TEMPLATE && (
              <button onClick={resetPrompt} className="text-xs text-gray-500 hover:text-white transition">
                Reset to default
              </button>
            )}
            <button
              onClick={() => setPromptEditing(e => !e)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {promptEditing ? 'Done editing' : 'Edit'}
            </button>
          </div>
        </div>

        {promptText !== DEFAULT_PROMPT_TEMPLATE && (
          <div className="mb-3 px-3 py-2 bg-amber-950/40 border border-amber-800 rounded-lg text-amber-400 text-xs">
            Prompt has been customised. Save below to apply changes.
          </div>
        )}

        {promptEditing ? (
          <textarea
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            rows={18}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        ) : (
          <pre className="w-full px-4 py-4 bg-gray-800/50 border border-gray-800 rounded-xl text-gray-400 text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
            {promptText}
          </pre>
        )}
      </section>

      {/* ── Model settings ── */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4">Model settings</h2>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="claude-opus-4-8">Claude Opus 4.8 (best)</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (faster)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (cheapest)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Max output tokens
              <span className="text-gray-600 font-normal ml-1">— controls response length</span>
            </label>
            <input
              type="number"
              value={maxTokens}
              onChange={e => setMaxTokens(Number(e.target.value))}
              min={256}
              max={4096}
              step={256}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Opus 4.8 gives the best match quality. Sonnet is ~40% cheaper and faster. Haiku is the most cost-effective for bulk runs.
        </p>
      </section>

      {/* ── Save bar ── */}
      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-gray-950/90 backdrop-blur border-t border-gray-800 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Changes apply to all future KPI matches. Existing saved matches are not affected.
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {error && <span className="text-red-400 text-xs">{error}</span>}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
