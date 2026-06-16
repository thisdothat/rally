-- Migration 004: Projects and Fund Report Rows
-- Projects are top-level containers uploaded by users.
-- Each project contains fund_report_rows — one row per metric per holding.

CREATE TABLE IF NOT EXISTS public.projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  row_count       INT DEFAULT 0,
  holding_count   INT DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their projects"
  ON public.projects FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Users can insert projects"
  ON public.projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- -------------------------------------------------------
-- Fund Report Rows
-- Each row = one metric for one holding in one project.
-- Column names mirror the paste-in spreadsheet exactly.
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fund_report_rows (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Spreadsheet columns (mapped 1:1)
  row_number                      TEXT,
  project_name                    TEXT,
  metric                          TEXT,
  social_environmental_outcome    TEXT,
  status_of_outcome               TEXT,
  comments                        TEXT,
  reporting_level                 TEXT,
  underlying_holding              TEXT,
  level_of_indicator              TEXT,
  unit_of_metric                  TEXT,
  rally_impact_area               TEXT,
  rally_outcome                   TEXT,
  reporting_start                 TEXT,
  reporting_end                   TEXT,

  -- Full original row stored as JSON so AI agent can read all fields
  raw_row                         JSONB,

  created_at                      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fund_report_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fund rows"
  ON public.fund_report_rows FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Users can insert fund rows"
  ON public.fund_report_rows FOR INSERT
  TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Users can delete fund rows"
  ON public.fund_report_rows FOR DELETE
  TO authenticated USING (TRUE);

-- Indexes for AI agent queries
CREATE INDEX IF NOT EXISTS fund_rows_project_idx         ON public.fund_report_rows (project_id);
CREATE INDEX IF NOT EXISTS fund_rows_holding_idx         ON public.fund_report_rows (underlying_holding);
CREATE INDEX IF NOT EXISTS fund_rows_impact_area_idx     ON public.fund_report_rows (rally_impact_area);
CREATE INDEX IF NOT EXISTS fund_rows_raw_idx             ON public.fund_report_rows USING GIN (raw_row);

-- Auto-update timestamps
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
