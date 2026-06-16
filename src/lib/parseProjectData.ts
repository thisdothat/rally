// Pure client-safe utility — no 'use server', no async required

const HEADER_MAP: Record<string, string> = {
  '#':                                        'row_number',
  'number':                                   'row_number',
  'project name':                             'project_name',
  'metric':                                   'metric',
  'social/environmental outcome':             'social_environmental_outcome',
  'social environmental outcome':             'social_environmental_outcome',
  'outcome':                                  'social_environmental_outcome',
  'status of outcome':                        'status_of_outcome',
  'status':                                   'status_of_outcome',
  'comments regarding the reporting period':  'comments',
  'comments':                                 'comments',
  'reporting level':                          'reporting_level',
  'underlying holding':                       'underlying_holding',
  'holding':                                  'underlying_holding',
  'fund':                                     'underlying_holding',
  'level of indicator':                       'level_of_indicator',
  'indicator level':                          'level_of_indicator',
  'unit of metric':                           'unit_of_metric',
  'unit':                                     'unit_of_metric',
  'rally input: main impact area':            'rally_impact_area',
  'rally input main impact area':             'rally_impact_area',
  'main impact area':                         'rally_impact_area',
  'impact area':                              'rally_impact_area',
  'rally input: outcome':                     'rally_outcome',
  'rally input outcome':                      'rally_outcome',
  'rally outcome':                            'rally_outcome',
  'reporting start':                          'reporting_start',
  'start':                                    'reporting_start',
  'reporting end':                            'reporting_end',
  'end':                                      'reporting_end',
}

export type ParsedRow = {
  row_number?: string
  project_name?: string
  metric?: string
  social_environmental_outcome?: string
  status_of_outcome?: string
  comments?: string
  reporting_level?: string
  underlying_holding?: string
  level_of_indicator?: string
  unit_of_metric?: string
  rally_impact_area?: string
  rally_outcome?: string
  reporting_start?: string
  reporting_end?: string
  raw_row: Record<string, string>
}

export function parsePastedData(raw: string): { headers: string[]; rows: ParsedRow[]; unmappedHeaders: string[] } {
  const lines = raw.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [], unmappedHeaders: [] }

  const rawHeaders = lines[0].split('\t').map(h => h.trim())
  const mappedKeys = rawHeaders.map(h => HEADER_MAP[h.toLowerCase()] ?? null)
  const unmappedHeaders = rawHeaders.filter((_, i) => !mappedKeys[i])

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t').map(c => c.trim())
    if (cells.every(c => !c)) continue

    const raw_row: Record<string, string> = {}
    rawHeaders.forEach((h, idx) => { raw_row[h] = cells[idx] ?? '' })

    const row: ParsedRow = { raw_row }
    mappedKeys.forEach((key, idx) => {
      if (key) (row as unknown as Record<string, string>)[key] = cells[idx] ?? ''
    })

    rows.push(row)
  }

  return { headers: rawHeaders, rows, unmappedHeaders }
}
