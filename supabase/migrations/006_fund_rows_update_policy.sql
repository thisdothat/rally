-- fund_report_rows was created without an UPDATE policy, silently blocking
-- KPI match saves. This adds the missing policy.
CREATE POLICY "Users can update fund rows"
  ON public.fund_report_rows FOR UPDATE
  TO authenticated USING (TRUE);
