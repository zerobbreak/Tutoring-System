import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { TutorAppShell } from "#/components/tutor-app-shell"
import { supabase } from "#/lib/supabase"
import { isTutorDashboardRole } from "#/lib/user-role"

export const Route = createFileRoute("/tutor")({
  component: TutorLayout,
})

function TutorLayout() {
  const [user, setUser] = useState<{
    email?: string
    user_metadata?: Record<string, string | undefined>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      const role = u?.user_metadata?.role as string | undefined
      if (!u || !isTutorDashboardRole(role)) {
        navigate({ to: "/auth/login" })
        return
      }
      setUser(u)
      setLoading(false)
    }
    checkAuth()
  }, [navigate])

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--lagoon-deep)] border-t-transparent" />
      </div>
    )
  }

  return (
    <TutorAppShell user={user}>
      <Outlet />
    </TutorAppShell>
  )
}
