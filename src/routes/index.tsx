import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { Route as RootRoute } from './__root'
import {
  isAdminDashboardRole,
  isTutorDashboardRole,
} from '../lib/user-role'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { sessionData } = RootRoute.useLoaderData()
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionData?.user) {
      navigate({ to: "/auth/login" });
    } else {
      const role = sessionData.user.user_metadata?.role as string | undefined
      if (isAdminDashboardRole(role)) {
        navigate({ to: "/admin" });
      } else if (isTutorDashboardRole(role)) {
        navigate({ to: "/tutor" });
      }
    }
  }, [sessionData, navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
    </div>
  )
}
