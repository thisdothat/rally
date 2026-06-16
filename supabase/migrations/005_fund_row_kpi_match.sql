-- Store the KPI selected by the user for each fund report row
ALTER TABLE fund_report_rows
  ADD COLUMN IF NOT EXISTS matched_kpi_id   UUID REFERENCES kpis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matched_kpi_code TEXT,
  ADD COLUMN IF NOT EXISTS matched_kpi_name TEXT;
