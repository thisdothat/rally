export type KeywordRule = { triggers: string[]; tags: string[] }

export const DEFAULT_KEYWORD_RULES: KeywordRule[] = [
  { triggers: ['water', 'litre', 'liter', 'liters', 'litres', 'aqua', 'irrigation', 'decontamin'], tags: ['Water', 'Water & Sanitation', 'Clean Water'] },
  { triggers: ['carbon', 'co2', 'ghg', 'emission', 'greenhouse'],                                  tags: ['Climate Change Mitigation', 'GHG', 'Emissions'] },
  { triggers: ['solar', 'wind', 'renewable', 'energy'],                                            tags: ['Clean Energy', 'Energy Efficiency'] },
  { triggers: ['job', 'employ', 'work', 'labour', 'labor'],                                       tags: ['Employment', 'Economic Inclusion'] },
  { triggers: ['school', 'educat', 'student', 'learn', 'train'],                                  tags: ['Education'] },
  { triggers: ['health', 'clinic', 'hospital', 'patient', 'medical'],                             tags: ['Health'] },
  { triggers: ['gender', 'women', 'female', 'girl'],                                              tags: ['Gender Equality', 'Women'] },
  { triggers: ['food', 'nutrition', 'hunger', 'agriculture', 'farm', 'crop'],                     tags: ['Food & Nutrition', 'Agriculture'] },
  { triggers: ['house', 'home', 'shelter', 'affordable'],                                         tags: ['Affordable Housing'] },
  { triggers: ['microfinance', 'loan', 'credit', 'financial'],                                    tags: ['Financial Inclusion'] },
]

export const DEFAULT_PROMPT_TEMPLATE = `Match this fund metric to the most relevant KPIs from the Rally library.

FUND METRIC:
{rowContext}

RALLY KPI LIBRARY ({kpiCount} KPIs — Code | Name | Unit | Impact Areas | Pathway | Description):
{kpiList}

Prioritise:
1. What is actually being measured (the noun — water, energy, people, etc.)
2. Whether the unit is compatible
3. Whether the indicator level (Output/Outcome/Impact) aligns
4. Thematic / impact area fit

For each match where the fund's unit and the KPI unit differ, include a "conversion" field showing how to convert between them:
- "from_unit": the fund's unit (e.g. "kWh")
- "to_unit": the KPI unit (e.g. "MWh")
- "factor": the numeric multiplier to apply to the fund value (e.g. 0.001 to convert kWh → MWh)
- "formula": human-readable formula string (e.g. "÷ 1,000")
Omit "conversion" entirely when units are already compatible or identical.

Return ONLY this JSON, no other text:
{"matches":[{"kpi_code":"RA22","kpi_name":"...","match_score":0.95,"rationale":"2-3 sentences on why this KPI fits.","conversion":{"from_unit":"kWh","to_unit":"MWh","factor":0.001,"formula":"÷ 1,000"}}]}

Top 3-5 matches ranked by relevance. match_score is 0.0–1.0.`
