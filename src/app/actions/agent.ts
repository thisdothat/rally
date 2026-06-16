'use server'

import { createClient } from '@/lib/supabase/server'
import type { KeywordRule } from '@/lib/agentDefaults'

export type AgentConfig = {
  id: string | null
  keyword_rules: KeywordRule[]
  prompt_override: string | null
  model: string
  max_tokens: number
}

export async function loadAgentConfig(): Promise<AgentConfig> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('agent_config')
    .select('id, keyword_rules, prompt_override, model, max_tokens')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    id:              data?.id              ?? null,
    keyword_rules:   data?.keyword_rules   ?? [],
    prompt_override: data?.prompt_override ?? null,
    model:           data?.model           ?? 'claude-opus-4-8',
    max_tokens:      data?.max_tokens      ?? 1024,
  }
}

export async function saveAgentConfig(
  config: Omit<AgentConfig, 'id'> & { id: string | null }
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const payload = {
    keyword_rules:   config.keyword_rules,
    prompt_override: config.prompt_override || null,
    model:           config.model,
    max_tokens:      config.max_tokens,
    updated_at:      new Date().toISOString(),
    updated_by:      user.id,
  }

  if (config.id) {
    const { error } = await supabase
      .from('agent_config')
      .update(payload)
      .eq('id', config.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('agent_config')
      .insert(payload)
    if (error) return { error: error.message }
  }

  return { error: null }
}
