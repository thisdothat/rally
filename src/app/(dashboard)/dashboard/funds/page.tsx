import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import UploadProjectModal from '@/components/UploadProjectModal'

export default async function FundsPage() {
  const supabase = await createClient()

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, description, row_count, holding_count, created_at')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Impact Fund Projects</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? 's' : ''} uploaded
          </p>
        </div>
        <UploadProjectModal />
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm mb-4">
          Could not load projects: {error.message}. Run migration 004 in Supabase SQL Editor.
        </div>
      )}

      {(!projects || projects.length === 0) && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-white font-medium mb-1">No projects yet</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Click <span className="text-indigo-400">Upload a new project</span> and paste your spreadsheet data to get started.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {(projects ?? []).map(project => (
          <Link
            key={project.id}
            href={`/dashboard/funds/${project.id}`}
            className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 hover:bg-gray-800 transition group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-white font-semibold text-base truncate group-hover:text-indigo-300 transition">
                    {project.name}
                  </h2>
                </div>
                {project.description && (
                  <p className="text-gray-400 text-sm mb-3 ml-11">{project.description}</p>
                )}
                <div className="flex items-center gap-4 ml-11 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {project.holding_count} holding{project.holding_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {project.row_count} metric{project.row_count !== 1 ? 's' : ''}
                  </span>
                  <span>
                    {new Date(project.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
