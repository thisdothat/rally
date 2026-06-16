import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_KEYWORD_RULES, DEFAULT_PROMPT_TEMPLATE, type KeywordRule } from '@/lib/agentDefaults'

const anthropic = new Anthropic()

type KpiRow = {
  id: string
  code: string
  name: string
  description: string | null
  unit: string | null
  tags: string[] | null
  impact_pathway: string | null
  kpi_status: string | null
}

// Module-level caches — survive across requests for the lifetime of the process
let kpiCache: KpiRow[] | null = null

type AgentConfigCache = {
  keyword_rules: KeywordRule[]
  prompt_override: string | null
  model: string
  max_tokens: number
  fetchedAt: number
}
let configCache: AgentConfigCache | null = null
const CONFIG_TTL = 60_000 // re-fetch config every 60 seconds

const STOPWORDS = new Set([
  'with', 'from', 'that', 'this', 'have', 'been', 'will', 'through',
  'related', 'using', 'their', 'which', 'were', 'they', 'then', 'into',
  'more', 'each', 'some', 'over', 'also', 'when', 'where', 'than',
])

function extractKeywords(text: string): string[] {
  return Array.from(new Set(
    text.toLowerCase().split(/\W+/).filter(w => w.length >= 4 && !STOPWORDS.has(w))
  ))
}

function selectKpis(kpis: KpiRow[], row: {
  rally_impact_area?: string | null
  metric?: string | null
  social_environmental_outcome?: string | null
  unit_of_metric?: string | null
}, keywordRules: KeywordRule[]): { kpis: KpiRow[]; signals: string[] } {
  const selected = new Set<string>()
  const signals: string[] = []

  // Signal A — impact area tags
  if (row.rally_impact_area) {
    const areaWords = row.rally_impact_area.toLowerCase().split(/[\s\-,/]+/).filter(w => w.length > 3)
    for (const k of kpis) {
      if (Array.isArray(k.tags) && k.tags.some(tag => areaWords.some(w => tag.toLowerCase().includes(w)))) {
        selected.add(k.id)
      }
    }
    if (selected.size > 0) signals.push(`impact area "${row.rally_impact_area}"`)
  }

  // Signal B — metric content keywords matched against KPI names
  const metricText = [row.metric, row.social_environmental_outcome, row.unit_of_metric].filter(Boolean).join(' ')
  const metricWords = extractKeywords(metricText)
  let nameHits = 0
  for (const k of kpis) {
    const kpiName = k.name.toLowerCase()
    if (metricWords.some(w => kpiName.includes(w))) {
      if (!selected.has(k.id)) nameHits++
      selected.add(k.id)
    }
  }
  if (nameHits > 0) signals.push(`metric keywords (${nameHits} additional KPIs)`)

  // Signal C — keyword rules (from config or defaults)
  let ruleHits = 0
  for (const rule of keywordRules) {
    const triggered = rule.triggers.some(t => metricText.toLowerCase().includes(t))
    if (!triggered) continue
    for (const k of kpis) {
      if (Array.isArray(k.tags) && k.tags.some(tag => rule.tags.some(rt => tag.toLowerCase().includes(rt.toLowerCase())))) {
        if (!selected.has(k.id)) ruleHits++
        selected.add(k.id)
      }
    }
  }
  if (ruleHits > 0) signals.push(`keyword rules (${ruleHits} additional KPIs)`)

  const result = kpis.filter(k => selected.has(k.id))
  if (result.length < 5) return { kpis, signals: ['fallback: all KPIs'] }
  return { kpis: result, signals }
}

export async function POST(request: NextRequest) {
  try {
    const { row } = await request.json()
    const supabase = await createClient()

    // Load KPI library (cached)
    if (!kpiCache) {
      const { data, error } = await supabase
        .from('kpis')
        .select('id, code, name, description, unit, tags, impact_pathway, kpi_status')
        .order('code')

      if (error || !data?.length) {
        return NextResponse.json({ error: 'No KPIs found in database' }, { status: 404 })
      }
      kpiCache = data as KpiRow[]
    }

    // Load agent config (cached with TTL)
    const now = Date.now()
    if (!configCache || now - configCache.fetchedAt > CONFIG_TTL) {
      const { data: cfg } = await supabase
        .from('agent_config')
        .select('keyword_rules, prompt_override, model, max_tokens')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      configCache = {
        keyword_rules:   cfg?.keyword_rules?.length ? cfg.keyword_rules : DEFAULT_KEYWORD_RULES,
        prompt_override: cfg?.prompt_override ?? null,
        model:           cfg?.model           ?? 'claude-opus-4-8',
        max_tokens:      cfg?.max_tokens       ?? 1024,
        fetchedAt:       now,
      }
    }

    const { keyword_rules, prompt_override, model, max_tokens } = configCache

    const { kpis: relevantKpis, signals } = selectKpis(kpiCache, row, keyword_rules)

    const rowContext = [
      row.metric                       && `Metric: ${row.metric}`,
      row.social_environmental_outcome && `Outcome: ${row.social_environmental_outcome}`,
      row.unit_of_metric               && `Unit: ${row.unit_of_metric}`,
      row.rally_impact_area            && `Impact Area: ${row.rally_impact_area}`,
      row.rally_outcome                && `Pathway: ${row.rally_outcome}`,
      row.level_of_indicator           && `Indicator Level: ${row.level_of_indicator}`,
      row.comments                     && `Notes: ${row.comments}`,
    ].filter(Boolean).join('\n')

    const kpiList = relevantKpis
      .map(k => {
        const tags = Array.isArray(k.tags) ? k.tags.join(', ') : ''
        const desc = k.description ? ` | ${k.description.slice(0, 80)}` : ''
        return `${k.code} | ${k.name} | Unit:${k.unit ?? '—'} | Areas:${tags} | Pathway:${k.impact_pathway ?? '—'}${desc}`
      })
      .join('\n')

    // Build prompt — use saved override if set, else default template
    const template = prompt_override ?? DEFAULT_PROMPT_TEMPLATE
    const prompt = template
      .replace('{rowContext}', rowContext)
      .replace('{kpiList}', kpiList)
      .replace('{kpiCount}', String(relevantKpis.length))

    const message = await anthropic.messages.create({
      model,
      max_tokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response format from AI' }, { status: 500 })
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response as JSON' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])

    const enriched = (result.matches ?? []).map((m: {
      kpi_code: string
      kpi_name: string
      match_score: number
      rationale: string
      conversion?: { from_unit: string; to_unit: string; factor: number; formula: string }
    }) => {
      const kpi = kpiCache!.find(k => k.code === m.kpi_code)
      return { ...m, kpi_id: kpi?.id ?? null, unit: kpi?.unit, tags: kpi?.tags, impact_pathway: kpi?.impact_pathway }
    })

    const { input_tokens, output_tokens } = message.usage
    const inputCost  = (input_tokens  / 1_000_000) * 5.00
    const outputCost = (output_tokens / 1_000_000) * 25.00
    const totalCost  = inputCost + outputCost

    console.log(
      `[match-kpi] selected ${relevantKpis.length}/${kpiCache!.length} KPIs via: ${signals.join(' + ')} | ` +
      `model: ${model} | tokens — in: ${input_tokens}, out: ${output_tokens} | cost: $${totalCost.toFixed(5)}`
    )

    return NextResponse.json({
      matches: enriched,
      usage: { input_tokens, output_tokens, kpis_considered: relevantKpis.length, cost_usd: parseFloat(totalCost.toFixed(5)) },
    })
  } catch (err) {
    console.error('[match-kpi]', err)
    return NextResponse.json({ error: 'Failed to match KPIs' }, { status: 500 })
  }
}
