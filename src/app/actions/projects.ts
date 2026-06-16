'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ParsedRow } from '@/lib/parseProjectData'

export async function saveProject(
  projectName: string,
  rows: ParsedRow[]
): Promise<{ error: string | null; projectId: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', projectId: null }

  const uniqueHoldings = new Set(rows.map(r => r.underlying_holding).filter(Boolean))

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      name: projectName,
      row_count: rows.length,
      holding_count: uniqueHoldings.size,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (projErr || !project) return { error: projErr?.message ?? 'Failed to create project', projectId: null }

  const rowsToInsert = rows.map(r => ({
    project_id: project.id,
    row_number: r.row_number,
    project_name: r.project_name,
    metric: r.metric,
    social_environmental_outcome: r.social_environmental_outcome,
    status_of_outcome: r.status_of_outcome,
    comments: r.comments,
    reporting_level: r.reporting_level,
    underlying_holding: r.underlying_holding,
    level_of_indicator: r.level_of_indicator,
    unit_of_metric: r.unit_of_metric,
    rally_impact_area: r.rally_impact_area,
    rally_outcome: r.rally_outcome,
    reporting_start: r.reporting_start,
    reporting_end: r.reporting_end,
    raw_row: r.raw_row,
  }))

  const { error: rowsErr } = await supabase
    .from('fund_report_rows')
    .insert(rowsToInsert)

  if (rowsErr) {
    await supabase.from('projects').delete().eq('id', project.id)
    return { error: rowsErr.message, projectId: null }
  }

  revalidatePath('/dashboard/funds')
  return { error: null, projectId: project.id }
}

export async function saveKpiMatch(
  rowId: string,
  projectId: string,
  kpiCode: string | null,
  kpiName: string | null,
  kpiId: string | null,
  unitOverride: string | null,
  indicatorOverride: string | null,
  confidence?: number | null,
  flag?: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const update: Record<string, string | number | null> = {
    matched_kpi_id: kpiId,
    matched_kpi_code: kpiCode,
    matched_kpi_name: kpiName,
  }
  if (unitOverride !== null) update.unit_of_metric = unitOverride
  if (indicatorOverride !== null) update.level_of_indicator = indicatorOverride
  if (confidence != null) update.match_confidence = confidence
  if (flag != null) update.match_flag = flag

  const { error } = await supabase
    .from('fund_report_rows')
    .update(update)
    .eq('id', rowId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/funds/${projectId}`)
  return { error: null }
}

export async function setExclusionCode(
  rowId: string,
  projectId: string,
  code: string | null,
  notes?: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('fund_report_rows')
    .update({ exclusion_code: code, exclusion_notes: notes ?? null })
    .eq('id', rowId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/funds/${projectId}`)
  return { error: null }
}

export async function deleteProject(projectId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/funds')
  return { error: null }
}
