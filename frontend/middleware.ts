import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Not logged in → redirect to login (except login page itself)
  if (!user && path !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in on login page → fetch role and redirect to correct home
  if (user && path === '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const home = profile?.role === 'customer' ? '/chat' : '/'
    return NextResponse.redirect(new URL(home, request.url))
  }

  // Logged in — enforce role-based access
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Customers trying to access broker pages → redirect to /chat
    if (role === 'customer' && (path === '/' || path.startsWith('/leads'))) {
      return NextResponse.redirect(new URL('/chat', request.url))
    }

    // Brokers trying to access /chat → redirect to dashboard
    if (role === 'broker' && path === '/chat') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api|auth|_next/static|_next/image|favicon.ico).*)'],
}
