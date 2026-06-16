CREATE TABLE IF NOT EXISTS public.agent_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_rules   jsonb        NOT NULL DEFAULT '[]'::jsonb,
  prompt_override text,
  model           text         NOT NULL DEFAULT 'claude-opus-4-8',
  max_tokens      integer      NOT NULL DEFAULT 1024,
  updated_at      timestamptz           DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id)
);

ALTER TABLE public.agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent config"
  ON public.agent_config FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can insert agent config"
  ON public.agent_config FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update agent config"
  ON public.agent_config FOR UPDATE TO authenticated USING (TRUE);
