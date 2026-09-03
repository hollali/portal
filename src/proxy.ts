import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('session')?.value
  const session = token ? verifyToken(token) : null

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    if (!session || !(session.role === 'admin' || session.role === 'editor' || session.role === 'viewer')) {
      const url = new URL('/login', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login'],
}