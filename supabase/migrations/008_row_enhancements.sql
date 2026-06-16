-- Exclusion workflow, match confidence, and match flags
ALTER TABLE public.fund_report_rows
  ADD COLUMN IF NOT EXISTS exclusion_code    text,       -- 'forecasted' | 'double_count' | 'outdated' | 'missing'
  ADD COLUMN IF NOT EXISTS exclusion_notes   text,
  ADD COLUMN IF NOT EXISTS match_confidence  integer,    -- 0–100 from AI match_score
  ADD COLUMN IF NOT EXISTS match_flag        text;       -- 'exact_match' | 'needs_review' | 'old_match'

-- Allow authenticated users to update these new columns (existing update policy covers it)
