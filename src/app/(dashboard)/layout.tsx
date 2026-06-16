import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const name = user.user_metadata?.full_name ?? user.email ?? 'User'

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar userName={name} userEmail={user.email ?? ''} />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  )
}
