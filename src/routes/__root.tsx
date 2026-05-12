import { HeadContent, Link, Scripts, createRootRoute, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserNav } from '../components/user-nav'
import { Toaster } from '../components/ui/sonner'

import appCss from '../styles.css?url'

import { getCurrentUserFn } from '../lib/auth-server'
import { getPostAuthDashboardPath } from '../lib/user-role'

export const Route = createRootRoute({
  loader: async () => {
    try {
      const sessionData = await getCurrentUserFn()
      return { sessionData }
    } catch {
      return { sessionData: null }
    }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-2xl font-bold">404 - Not Found</h1>
      <p className="mt-2 text-gray-600">The page you are looking for does not exist.</p>
      <Link to="/auth/login" className="mt-4 text-indigo-600 hover:underline">Go to sign in</Link>
    </div>
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const loaderData = Route.useLoaderData()
  const sessionData = loaderData?.sessionData
  const [session, setSession] = useState<any>(sessionData?.session ?? null)

  useEffect(() => {
    if (sessionData?.session) {
      setSession(sessionData.session)
    }
  }, [sessionData])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const location = useLocation()
  const isAuthPage = location.pathname.startsWith('/auth')

  const brandTo = session?.user
    ? getPostAuthDashboardPath(
        session.user.user_metadata?.role as string | undefined,
      )
    : '/auth/login'

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-gray-50">
        {!isAuthPage && (
          <nav className="border-b bg-white px-4 py-3 shadow-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <Link to={brandTo} className="text-xl font-bold text-indigo-600">
                Tutoring System
              </Link>
              <div className="flex items-center gap-4">
                {session ? (
                  <UserNav user={session.user} />
                ) : (
                  <>
                    <Link
                      to="/auth/login"
                      className="text-sm font-medium text-gray-700 hover:text-indigo-600"
                    >
                      Login
                    </Link>
                    <Link
                      to="/auth/register"
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Register
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        )}
        <main>{children}</main>
        <Toaster richColors closeButton />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
