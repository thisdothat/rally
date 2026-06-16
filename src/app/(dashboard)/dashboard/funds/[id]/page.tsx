import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DeleteProjectButton from '@/components/DeleteProjectButton'
import FundDetailView from '@/components/FundDetailView'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, description, row_count, holding_count, created_at')
      .eq('id', params.id)
      .single(),
    supabase
      .from('fund_report_rows')
      .select('*')
      .eq('project_id', params.id)
      .order('underlying_holding', { ascending: true }),
  ])

  if (!project) notFound()

  const reportingPeriod = rows && rows.length > 0
    ? `${rows[0].reporting_start ?? ''}${rows[0].reporting_end ? ` – ${rows[0].reporting_end}` : ''}`
    : null

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard/funds" className="hover:text-gray-300 transition">Impact Fund Projects</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-300 truncate">{project.name}</span>
      </div>

      {/* Project header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
            <span>{project.holding_count} holding{project.holding_count !== 1 ? 's' : ''}</span>
            <span>{project.row_count} metric{project.row_count !== 1 ? 's' : ''}</span>
            {reportingPeriod && <span>Period: {reportingPeriod}</span>}
            <span>{new Date(project.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
        <DeleteProjectButton projectId={project.id} />
      </div>

      <FundDetailView projectId={project.id} rows={rows ?? []} />
    </div>
  )
}
