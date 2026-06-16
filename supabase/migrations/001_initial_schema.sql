-- ============================================================
-- Rally KPI - Initial Schema
-- ============================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- KPI Table
-- Core table — designed to be readable by AI matching agents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kpis (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name                TEXT NOT NULL,
  code                TEXT,                        -- e.g. "SDG-1.1", "IRIS+GD9572"
  description         TEXT,
  category            TEXT,                        -- e.g. "Environmental", "Social", "Governance"
  subcategory         TEXT,                        -- e.g. "Climate", "Gender Equity"

  -- Classification
  framework           TEXT,                        -- e.g. "IRIS+", "SDG", "GRI", "TCFD"
  framework_code      TEXT,                        -- Framework-specific code
  sdg_goals           TEXT[],                      -- e.g. ["SDG 7", "SDG 13"]
  tags                TEXT[],                      -- Free-form searchable tags

  -- Measurement
  unit                TEXT,                        -- e.g. "tCO2e", "%", "USD", "# people"
  measurement_type    TEXT,                        -- "Quantitative" | "Qualitative" | "Binary"
  aggregation_method  TEXT,                        -- "Sum" | "Average" | "Count" | "Ratio"
  reporting_frequency TEXT,                        -- "Annual" | "Quarterly" | "Monthly"

  -- Impact context (used by AI agent for matching)
  impact_theme        TEXT,                        -- e.g. "Clean Energy", "Financial Inclusion"
  geography           TEXT,                        -- e.g. "Global", "Sub-Saharan Africa"
  beneficiary_type    TEXT,                        -- e.g. "SMEs", "Women", "Smallholder farmers"
  investment_stage    TEXT,                        -- e.g. "Early", "Growth", "Mature"

  -- Raw source data (for AI agent to parse)
  source_row_json     JSONB,                       -- Original Excel row stored as JSON
  embedding           VECTOR(1536),                -- OpenAI/Claude embedding for semantic search

  -- Metadata
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  is_active           BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read KPIs"
  ON public.kpis FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Users can insert KPIs"
  ON public.kpis FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own KPIs"
  ON public.kpis FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Indexes for AI agent queries
CREATE INDEX IF NOT EXISTS kpis_category_idx        ON public.kpis (category);
CREATE INDEX IF NOT EXISTS kpis_framework_idx       ON public.kpis (framework);
CREATE INDEX IF NOT EXISTS kpis_impact_theme_idx    ON public.kpis (impact_theme);
CREATE INDEX IF NOT EXISTS kpis_tags_idx            ON public.kpis USING GIN (tags);
CREATE INDEX IF NOT EXISTS kpis_sdg_goals_idx       ON public.kpis USING GIN (sdg_goals);
CREATE INDEX IF NOT EXISTS kpis_source_row_idx      ON public.kpis USING GIN (source_row_json);

-- ============================================================
-- Impact Funds Table (to be populated later)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.impact_funds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  manager         TEXT,
  description     TEXT,
  focus_areas     TEXT[],
  geographies     TEXT[],
  sdg_alignment   TEXT[],
  target_kpis     TEXT[],                          -- KPI names/codes this fund reports on
  fund_size_usd   BIGINT,
  stage_focus     TEXT,
  website         TEXT,
  source_doc_url  TEXT,
  raw_json        JSONB,
  embedding       VECTOR(1536),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.impact_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read funds"
  ON public.impact_funds FOR SELECT
  TO authenticated
  USING (TRUE);

-- ============================================================
-- KPI ↔ Fund Matches Table (AI agent writes here)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kpi_fund_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id          UUID NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  fund_id         UUID NOT NULL REFERENCES public.impact_funds(id) ON DELETE CASCADE,
  match_score     NUMERIC(5,4),                    -- 0.0000 – 1.0000
  match_rationale TEXT,                            -- AI-generated explanation
  matched_by      TEXT DEFAULT 'ai-agent',
  model_version   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kpi_id, fund_id)
);

ALTER TABLE public.kpi_fund_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read matches"
  ON public.kpi_fund_matches FOR SELECT
  TO authenticated
  USING (TRUE);

-- ============================================================
-- Helper: updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kpis_updated_at
  BEFORE UPDATE ON public.kpis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER funds_updated_at
  BEFORE UPDATE ON public.impact_funds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
