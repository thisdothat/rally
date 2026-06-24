'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface KPIData {
  id?: string
  code: string
  name: string
  description: string
  kpi_status: string
  unit: string
  aggregation_method: string
  tags: string[]
  impact_pathway: string
}

export async function upsertKpi(kpi: KPIData): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', id: null }

  const payload = {
    code: kpi.code,
    name: kpi.name,
    description: kpi.description,
    kpi_status: kpi.kpi_status,
    unit: kpi.unit,
    aggregation_method: kpi.aggregation_method,
    tags: kpi.tags,
    impact_pathway: kpi.impact_pathway,
  }

  if (kpi.id) {
    const { error } = await supabase.from('kpis').update(payload).eq('id', kpi.id)
    if (error) return { error: error.message, id: null }
    revalidatePath('/dashboard/kpis')
    return { error: null, id: kpi.id }
  } else {
    const { data, error } = await supabase.from('kpis').insert(payload).select('id').single()
    if (error) return { error: error.message, id: null }
    revalidatePath('/dashboard/kpis')
    return { error: null, id: data.id }
  }
}

export async function deleteKpi(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('kpis').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/kpis')
  return { error: null }
}
