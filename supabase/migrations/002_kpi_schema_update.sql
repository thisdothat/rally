-- Migration 002: Update KPI table to match Rally KPI Collection structure

ALTER TABLE public.kpis ADD COLUMN IF NOT EXISTS kpi_status TEXT DEFAULT 'Validated';
ALTER TABLE public.kpis ADD COLUMN IF NOT EXISTS impact_pathway TEXT;

-- Add comments for AI agent context
COMMENT ON COLUMN public.kpis.kpi_status IS 'Validation status: Validated, Needs Follow-Up, or Draft';
COMMENT ON COLUMN public.kpis.impact_pathway IS 'Position in the impact chain: Output, Outcome, or Impact';
COMMENT ON COLUMN public.kpis.tags IS 'Rally Impact Areas — used for KPI-to-fund matching by the AI agent';
COMMENT ON COLUMN public.kpis.code IS 'Rally KPI identifier, e.g. RA1, RA45';
COMMENT ON COLUMN public.kpis.unit IS 'Reporting unit, e.g. tCO2e, MWh, People, CAD';

-- Index for status filtering
CREATE INDEX IF NOT EXISTS kpis_status_idx ON public.kpis (kpi_status);
CREATE INDEX IF NOT EXISTS kpis_pathway_idx ON public.kpis (impact_pathway);
